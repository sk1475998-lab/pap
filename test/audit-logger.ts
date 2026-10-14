/**
 * Audit logger
 *
 * Records every tool call and result to a JSONL file.
 * The orchestrator uses this to cross-validate LLM claims against
 * actual executions — the primary defense against hallucinated test results.
 */

import fs from 'fs';
import path from 'path';

const AUDIT_PATH = './audit/tool-calls.jsonl';

interface AuditEntry {
  ts: string;
  phase: string;
  tool: string;
  input: unknown;
  result: string;
  duration_ms: number;
}

// In-memory index for fast lookup during cross-validation
const callIndex: AuditEntry[] = [];

export const auditLogger = {
  log(phase: string, tool: string, input: unknown, result: string): void {
    const entry: AuditEntry = {
      ts:          new Date().toISOString(),
      phase,
      tool,
      input,
      result:      result.slice(0, 3000),  // truncate for readability
      duration_ms: 0,  // could add timing if needed
    };

    // Append to JSONL file
    fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
    fs.appendFileSync(AUDIT_PATH, JSON.stringify(entry) + '\n');

    // Keep in memory for cross-validation
    callIndex.push(entry);
  },

  getPhaseToolCalls(phase: string): AuditEntry[] {
    // Load from file if index is empty (e.g. after restart)
    if (callIndex.length === 0 && fs.existsSync(AUDIT_PATH)) {
      const lines = fs.readFileSync(AUDIT_PATH, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try { callIndex.push(JSON.parse(line)); } catch { /* skip malformed */ }
      }
    }
    return callIndex.filter(e => e.phase === phase);
  },

  /**
   * Cross-validate Phase C test results.
   * Returns list of test_ids that claim a result but have no matching shell execution.
   * These are potential hallucinations.
   */
  validatePhaseC(testResults: Array<{ test_id: string; passed: boolean; actual: string }>): string[] {
    const shellCalls = this.getPhaseToolCalls('C').filter(e => e.tool === 'run_shell');
    const unverified: string[] = [];

    for (const test of testResults) {
      // A test is "verified" if a shell command was run that plausibly ran this test.
      // We check for the test_id string appearing in the command, OR for jest/ts-node calls.
      const verified = shellCalls.some(call => {
        const cmd = typeof call.input === 'object' && call.input !== null
          ? (call.input as Record<string, string>).command || ''
          : '';
        return (
          cmd.includes(test.test_id) ||
          (cmd.includes('jest') && call.result.includes(test.test_id)) ||
          (cmd.includes('ts-node') && call.result.includes(test.test_id))
        );
      });

      if (!verified) {
        unverified.push(test.test_id);
      }
    }

    return unverified;
  },

  /**
   * Summarize audit log for a phase.
   */
  summary(phase: string): string {
    const calls = this.getPhaseToolCalls(phase);
    const byTool: Record<string, number> = {};
    for (const call of calls) {
      byTool[call.tool] = (byTool[call.tool] || 0) + 1;
    }
    return Object.entries(byTool)
      .map(([tool, count]) => `${tool}: ${count}`)
      .join(', ');
  },
};
