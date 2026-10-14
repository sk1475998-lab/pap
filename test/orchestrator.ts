/**
 * SJA QA Orchestrator (Gemini Interactions Edition)
 *
 * Directs an LLM through the 5-phase QA pipeline with REAL tool execution.
 * The LLM reasons and writes code. This process runs it, validates results,
 * and enforces every gate. The LLM cannot fake test outcomes.
 *
 * Usage:
 *   npx ts-node orchestrator.ts              # run all phases
 *   npx ts-node orchestrator.ts --only A     # run one phase
 *   npx ts-node orchestrator.ts --resume     # skip completed phases
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { executeTool, warmFileCache } from './tool-runner';
import { validateHandoff } from './handoff-validator';
import { auditLogger } from './audit-logger';
import { computeFinalScore, buildReadinessReport } from './score-calculator';

// ─── Config ───────────────────────────────────────────────────────────────────

const REPO_ROOT   = process.env.SJA_REPO_ROOT;
const HANDOFF_DIR = './handoffs';
const AUDIT_DIR   = './audit';
const PHASES      = ['A', 'B', 'C', 'D', 'E'] as const;
type Phase = typeof PHASES[number];

const PHASE_MODELS: Record<Phase, string> = {
  A: 'gemini-3.5-flash',   // needs large context for full repo
  B: 'gemini-3.5-flash',   // deep security reasoning
  C: 'gemini-3.5-flash', // code gen + many tool call iterations
  D: 'gemini-3.5-flash', // observation + classification per platform
  E: 'gemini-3.5-flash', // structured scoring
};

const MAX_TURNS_PER_PHASE = 150;
const MAX_CORRECTION_RETRIES = 3;
const HANDOFF_START = '===HANDOFF_JSON_START===';
const HANDOFF_END   = '===HANDOFF_JSON_END===';

// ─── Startup checks ───────────────────────────────────────────────────────────

function preflight() {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    die('GEMINI_API_KEY or OPENROUTER_API_KEY is not set. Export one before running.');
  }
  if (!REPO_ROOT) {
    die('SJA_REPO_ROOT is not set. Set it to the absolute path of the super-job-agent repo.');
  }
  if (!fs.existsSync(REPO_ROOT)) {
    die(`SJA_REPO_ROOT path does not exist: ${REPO_ROOT}`);
  }

  // Check that phase prompt files exist
  for (const phase of PHASES) {
    const p = `./prompts/phase-${phase.toLowerCase()}.txt`;
    if (!fs.existsSync(p)) {
      console.warn(`⚠️  Missing prompt file: ${p}`);
      console.warn(`   Copy Phase ${phase} tasks from the QA spec document into this file.`);
    }
  }

  fs.mkdirSync(HANDOFF_DIR, { recursive: true });
  fs.mkdirSync(AUDIT_DIR,   { recursive: true });
  fs.mkdirSync('/tmp/sja-qa-sandbox', { recursive: true });
}

function die(msg: string): never {
  console.error(`\n❌  ${msg}\n`);
  process.exit(1);
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const onlyPhase = onlyIdx !== -1 ? (args[onlyIdx + 1] as Phase) : null;
  const resume    = args.includes('--resume');
  return { onlyPhase, resume };
}

// ─── Core phase runner ────────────────────────────────────────────────────────

interface LlmResponse {
  outputText: string;
  toolCalls?: any[];
}

interface ILlmClient {
  call(
    systemInstruction: string,
    userInput: any,
    tools: any[],
    phase: Phase
  ): Promise<LlmResponse>;
}

async function callGeminiWithRetry(ai: any, options: any, maxRetries = 5): Promise<any> {
  let delay = 5000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.interactions.create(options);
    } catch (err: any) {
      const errMsg = String(err.message || err);
      const isRateLimit = errMsg.includes('429') || err.status === 429 || errMsg.includes('quota');
      if (isRateLimit && attempt < maxRetries) {
        console.warn(`\n  ⚠️  Rate limit (429) hit. Retrying in ${delay / 1000}s... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

async function fetchWithRetry(url: string, options: any, maxRetries = 5): Promise<Response> {
  let delay = 5000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const bodyText = await response.text();
        console.warn(`\n  ⚠️  Rate limit (429) from OpenRouter. Retrying in ${delay / 1000}s... (Attempt ${attempt}/${maxRetries})`);
        console.warn(`     Details: ${bodyText.slice(0, 200)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      return response;
    } catch (err: any) {
      if (attempt < maxRetries) {
        console.warn(`\n  ⚠️  Fetch failed: ${err.message || err}. Retrying in ${delay / 1000}s... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Fetch failed after ${maxRetries} attempts`);
}

class OpenRouterClient implements ILlmClient {
  private messages: any[] = [];
  private apiKey: string;
  private modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async call(
    systemInstruction: string,
    userInput: any,
    tools: any[],
    phase: Phase
  ): Promise<LlmResponse> {
    if (this.messages.length === 0) {
      this.messages.push({ role: 'system', content: systemInstruction });
    }

    if (typeof userInput === 'string') {
      // Clean up any unresponded tool calls in the last assistant message
      if (this.messages.length > 0) {
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg.role === 'assistant' && lastMsg.tool_calls) {
          delete lastMsg.tool_calls;
        }
      }
      this.messages.push({ role: 'user', content: userInput });
    } else if (Array.isArray(userInput)) {
      for (const res of userInput) {
        const textResult = res.result?.[0]?.text || '';
        this.messages.push({
          role: 'tool',
          name: res.name,
          tool_call_id: res.call_id,
          content: textResult
        });
      }
    }

    const body: any = {
      model: this.modelName,
      messages: this.messages,
      max_tokens: 8192,
    };
    if (tools.length > 0) {
      body.tools = tools.map((t: any) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));
    }

    const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await response.json() as any;
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(data)}`);
    }

    const assistantMsg = data.choices?.[0]?.message;
    if (!assistantMsg) {
      throw new Error(`OpenRouter returned empty choices: ${JSON.stringify(data)}`);
    }

    const storedAssistantMsg: any = { role: 'assistant' };
    if (assistantMsg.content) {
      storedAssistantMsg.content = assistantMsg.content;
    }
    if (assistantMsg.tool_calls) {
      storedAssistantMsg.tool_calls = assistantMsg.tool_calls;
    }
    this.messages.push(storedAssistantMsg);

    const outputText = assistantMsg.content || '';
    const toolCalls = (assistantMsg.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name || tc.name,
      arguments: typeof tc.function?.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function?.arguments || tc.arguments || {}
    }));

    return { outputText, toolCalls };
  }
}

class GeminiInteractionsClient implements ILlmClient {
  private previousInteractionId?: string;
  private ai: any;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async call(
    systemInstruction: string,
    userInput: any,
    tools: any[],
    phase: Phase
  ): Promise<LlmResponse> {
    const options: any = {
      model: PHASE_MODELS[phase],
      input: userInput,
      system_instruction: systemInstruction,
    };
    if (this.previousInteractionId) {
      options.previous_interaction_id = this.previousInteractionId;
    }
    if (tools.length > 0) {
      options.tools = tools;
    }

    const interaction = await callGeminiWithRetry(this.ai, options);
    this.previousInteractionId = interaction.id;

    const outputText = interaction.outputText || '';
    const toolCalls: any[] = [];
    const steps = interaction.steps || [];
    for (const step of steps) {
      if (step.type === 'function_call') {
        toolCalls.push({
          id: step.id,
          name: step.name,
          arguments: step.arguments
        });
      }
    }

    return { outputText, toolCalls };
  }
}

function getLlmClient(phase: Phase): ILlmClient {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('\n❌ Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is set.\n');
    process.exit(1);
  }

  if (apiKey.startsWith('sk-or-') || process.env.OPENROUTER_API_KEY) {
    console.log(`  Using OpenRouter Client with model openrouter/owl-alpha`);
    return new OpenRouterClient(apiKey, 'openrouter/owl-alpha');
  } else {
    console.log(`  Using Google GenAI Interactions Client with model ${PHASE_MODELS[phase]}`);
    return new GeminiInteractionsClient(apiKey);
  }
}

async function runPhase(
  phase: Phase,
  priorHandoffs: Record<string, unknown>,
  client: ILlmClient
): Promise<unknown> {
  const systemInstruction = buildSystemPrompt(phase);
  const userPrompt        = buildUserPrompt(phase, priorHandoffs);

  let userInput: any = userPrompt;
  let toolCallCount = 0;
  let fullText     = '';

  for (let turn = 0; turn < MAX_TURNS_PER_PHASE; turn++) {
    if (turn > 0) {
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || '';
      const isOR = apiKey.startsWith('sk-or-') || !!process.env.OPENROUTER_API_KEY;
      const delay = isOR ? 1000 : 4500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    process.stdout.write(`  Turn ${turn + 1}/${MAX_TURNS_PER_PHASE}... `);

    const tools = getGeminiTools(phase);
    
    const response = await client.call(systemInstruction, userInput, tools, phase);

    const text = response.outputText || '';
    if (text) {
      fullText += text;
    }

    // Check for completed handoff
    if (fullText.includes(HANDOFF_START) && fullText.includes(HANDOFF_END)) {
      console.log(`  ✓ Handoff emitted after ${turn + 1} turns, ${toolCallCount} tool calls`);
      return extractHandoffJson(fullText, phase);
    }

    // Process tool calls
    const functionResults: any[] = [];
    const toolCalls = response.toolCalls || [];

    for (const step of toolCalls) {
      toolCallCount++;
      const name = step.name;
      const args = step.arguments || {};
      const callId = step.id;

      const toolResultText = await executeTool(name, args as Record<string, string>, phase);
      auditLogger.log(phase, name, args, toolResultText);

      const preview = toolResultText.slice(0, 100).replace(/\n/g, ' ');
      console.log(`  [tool] ${name} → ${preview}${toolResultText.length > 100 ? '…' : ''}`);

      functionResults.push({
        type: 'function_result',
        name,
        call_id: callId,
        result: [{ type: 'text', text: toolResultText }],
      });
    }

    if (functionResults.length > 0) {
      userInput = functionResults;
      continue;
    }

    // If there were no function calls and we didn't emit a handoff, we nudge
    console.log(`stop_reason=end_turn`);
    userInput =
      'You have not yet emitted the handoff JSON. Complete any remaining tasks ' +
      `and emit the handoff delimited by ${HANDOFF_START} ... ${HANDOFF_END}.`;
  }

  throw new Error(
    `Phase ${phase} exceeded MAX_TURNS (${MAX_TURNS_PER_PHASE}) without emitting handoff. ` +
    `Ran ${toolCallCount} tool calls. Check audit log.`
  );
}
// ─── Handoff extraction ───────────────────────────────────────────────────────

function extractHandoffJson(text: string, phase: Phase): unknown {
  const start = text.indexOf(HANDOFF_START) + HANDOFF_START.length;
  const end   = text.indexOf(HANDOFF_END);
  const raw   = text.slice(start, end).trim();

  try {
    return JSON.parse(raw);
  } catch (e) {
    // LLM sometimes wraps in markdown fences — strip and retry
    const stripped = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    try {
      return JSON.parse(stripped);
    } catch {
      throw new Error(
        `Phase ${phase}: Handoff JSON parse failed.\n` +
        `Raw content (first 500 chars):\n${raw.slice(0, 500)}`
      );
    }
  }
}

// ─── Prompt construction ──────────────────────────────────────────────────────

function buildSystemPrompt(phase: Phase): string {
  return `You are a Staff QA Automation Engineer embedded in the Super Job Agent (SJA) project.

IDENTITY AND CONSTRAINTS:
- You have access to tools to read the codebase, run shell commands, and execute tests.
- You must NEVER hallucinate test results. If you cannot run a test, write exactly:
  "UNTESTED — reason: [specific reason why it could not be run]"
- Every finding you report must be reproducible or clearly marked UNCONFIRMED.
- NEVER submit real job applications. Only interact with test/sandbox listings.
- NEVER store credentials in any file. They are provided via the get_credential tool only.

CURRENT PHASE: ${phase}

HANDOFF PROTOCOL:
When you have completed ALL tasks in this phase, emit your handoff JSON inside these exact delimiters
on their own lines with no other text:
${HANDOFF_START}
{ ... your complete handoff JSON here ... }
${HANDOFF_END}

Do NOT emit the handoff until every task in this phase is complete.
Do NOT emit partial handoffs.
The handoff JSON must match the schema specified in the phase instructions exactly.`;
}

function buildUserPrompt(phase: Phase, priorHandoffs: Record<string, unknown>): string {
  const promptPath = `./prompts/phase-${phase.toLowerCase()}.txt`;

  let prompt: string;
  if (fs.existsSync(promptPath)) {
    prompt = fs.readFileSync(promptPath, 'utf8');
  } else {
    prompt = `[Phase ${phase} prompt file not found at ${promptPath}.\n` +
             `Please create this file with the Phase ${phase} tasks from the QA spec document.]`;
    console.warn(`⚠️  Phase ${phase} prompt file missing: ${promptPath}`);
  }

  // Inject prior handoffs as context
  if (Object.keys(priorHandoffs).length > 0) {
    prompt += '\n\n---\n## Context from prior phases\n\n';
    prompt += 'Use these handoffs to inform your work in this phase.\n\n';

    for (const [p, handoff] of Object.entries(priorHandoffs)) {
      const serialized = JSON.stringify(handoff, null, 2);
      // Truncate very large handoffs to avoid flooding context
      const truncated = serialized.length > 40000
        ? serialized.slice(0, 40000) + '\n... [truncated, full handoff available via query_handoff tool]'
        : serialized;
      prompt += `### Phase ${p} Handoff\n\`\`\`json\n${truncated}\n\`\`\`\n\n`;
    }
  }

  return prompt;
}

// ─── Tool definitions per phase ───────────────────────────────────────────────

function getGeminiTools(phase: Phase): any[] {
  const baseTools = [
    {
      type: 'function',
      name: 'read_file',
      description: 'Read the contents of a file from the SJA repository.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to SJA_REPO_ROOT' },
        },
        required: ['path'],
      },
    },
    {
      type: 'function',
      name: 'list_directory',
      description: 'List files and subdirectories up to 4 levels deep.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path relative to SJA_REPO_ROOT' },
        },
        required: ['path'],
      },
    },
    {
      type: 'function',
      name: 'query_handoff',
      description: 'Retrieve the full handoff JSON from a prior phase.',
      parameters: {
        type: 'object',
        properties: {
          phase: { type: 'string', description: 'Phase letter: A, B, C, D, or E' },
        },
        required: ['phase'],
      },
    },
  ];

  // Phases C, D, E can run shell commands and write files
  const shellTools = [
    {
      type: 'function',
      name: 'write_file',
      description: 'Write a file to the sandbox (for test scripts only).',
      parameters: {
        type: 'object',
        properties: {
          path:    { type: 'string', description: 'Relative path within sandbox' },
          content: { type: 'string', description: 'File content to write' },
        },
        required: ['path', 'content'],
      },
    },
    {
      type: 'function',
      name: 'run_shell',
      description:
        'Run a shell command in the sandbox. Returns stdout and stderr. ' +
        'Use for running Jest tests, compiling TypeScript, or checking Node versions. ' +
        'Commands are blocked from accessing the network or writing outside the sandbox.',
      parameters: {
        type: 'object',
        properties: {
          command:    { type: 'string',  description: 'Shell command to run' },
          timeout_ms: { type: 'number',  description: 'Max runtime in milliseconds (default: 60000)' },
        },
        required: ['command'],
      },
    },
    {
      type: 'function',
      name: 'get_credential',
      description:
        'Retrieve test account credentials for a job platform. ' +
        'Returns email:password for the dedicated test account. ' +
        'NEVER use these on real accounts. NEVER write them to files.',
      parameters: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            description: 'Platform name e.g. "naukri", "linkedin", "greenhouse"',
          },
        },
        required: ['platform'],
      },
    },
  ];

  if (['C', 'D', 'E'].includes(phase)) {
    return [...baseTools, ...shellTools];
  }
  return baseTools;
}

// ─── Handoff validation with correction loop ──────────────────────────────────

async function validateWithRetry(
  phase: Phase,
  rawHandoff: unknown,
  client: ILlmClient
): Promise<unknown> {
  for (let attempt = 1; attempt <= MAX_CORRECTION_RETRIES; attempt++) {
    const result = await validateHandoff(phase, rawHandoff);
    if (result.valid) return result.data;

    console.warn(`  ⚠️  Handoff schema validation failed (attempt ${attempt}/${MAX_CORRECTION_RETRIES})`);
    console.warn(`  Errors: ${result.errors?.join('; ')}`);

    if (attempt === MAX_CORRECTION_RETRIES) {
      throw new Error(
        `Phase ${phase} handoff failed validation after ${MAX_CORRECTION_RETRIES} attempts.\n` +
        `Errors: ${result.errors?.join('\n')}\n` +
        `Raw handoff saved to ${HANDOFF_DIR}/phase_${phase}_INVALID.json`
      );
    }

    // Save invalid handoff for debugging
    fs.writeFileSync(
      path.join(HANDOFF_DIR, `phase_${phase}_INVALID_attempt${attempt}.json`),
      JSON.stringify(rawHandoff, null, 2)
    );

    const fixPrompt = `The following handoff JSON for Phase ${phase} failed schema validation:\n` +
      `\`\`\`json\n${JSON.stringify(rawHandoff, null, 2)}\`\`\`\n\n` +
      `Validation errors:\n${result.errors?.join('\n')}\n\n` +
      `Please fix the JSON and re-emit it between ${HANDOFF_START} and ${HANDOFF_END}.`;

    const response = await client.call(
      buildSystemPrompt(phase),
      fixPrompt,
      [],
      phase
    );
    const fixText = response.outputText || '';

    if (fixText.includes(HANDOFF_START) && fixText.includes(HANDOFF_END)) {
      rawHandoff = extractHandoffJson(fixText, phase);
    }
  }
  throw new Error('Unreachable');
}

// ─── Critical blockers gate ───────────────────────────────────────────────────

function checkCriticalBlockers(phase: Phase, handoff: Record<string, unknown>) {
  const blockers: string[] = (handoff.critical_blockers as string[]) || [];
  if (blockers.length === 0) return;

  console.error(`\n${'═'.repeat(60)}`);
  console.error(`⛔  CRITICAL BLOCKERS detected in Phase ${phase} — pipeline halted`);
  console.error('═'.repeat(60));
  blockers.forEach((b, i) => console.error(`  ${i + 1}. ${b}`));
  console.error('\nFix these issues in the SJA codebase, then re-run.');
  console.error(`To resume from Phase ${phase}: npm run resume`);
  console.error('═'.repeat(60) + '\n');
  process.exit(1);
}

// ─── Hallucination detection ──────────────────────────────────────────────────

function detectHallucination(phase: Phase, handoff: Record<string, unknown>) {
  const warnings: string[] = [];

  // Phase C: verify test results are cross-referenced in audit log
  if (phase === 'C') {
    const testResults = (handoff.test_results as Array<{ test_id: string; passed: boolean }>) || [];
    const auditLog    = auditLogger.getPhaseToolCalls('C');
    const shellCalls  = auditLog.filter(e => e.tool === 'run_shell');

    for (const test of testResults) {
      const matched = shellCalls.some(call => {
        const input = call.input as any;
        return typeof input?.command === 'string' &&
          (input.command.includes(test.test_id) ||
           input.command.includes('jest') ||
           input.command.includes('npx'));
      });
      if (!matched) {
        warnings.push(
          `Test "${test.test_id}" (passed=${test.passed}) has no matching shell execution in audit log. ` +
          `Mark as UNTESTED or re-run.`
        );
      }
    }
  }

  // Phase D: verify at least some tool calls happened (real site interaction)
  if (phase === 'D') {
    const auditLog   = auditLogger.getPhaseToolCalls('D');
    const shellCalls = auditLog.filter(e => e.tool === 'run_shell');
    if (shellCalls.length === 0) {
      warnings.push(
        'Phase D has no run_shell calls in audit log. ' +
        'Live site testing requires Playwright execution. ' +
        'All Phase D results should be marked UNTESTED if no browser ran.'
      );
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n  ⚠️  HALLUCINATION RISK DETECTED in Phase ${phase}:`);
    warnings.forEach(w => console.warn(`     - ${w}`));
    console.warn('');
  }

  return warnings;
}

// ─── Main orchestration loop ──────────────────────────────────────────────────

async function main() {
  preflight();

  const { onlyPhase, resume } = parseArgs();

  console.log('\n' + '═'.repeat(60));
  console.log('  SJA QA Orchestrator (Gemini Interactions Edition)');
  console.log('═'.repeat(60));
  console.log(`  Repo:    ${REPO_ROOT}`);
  console.log(`  Mode:    ${onlyPhase ? `single phase (${onlyPhase})` : resume ? 'resume' : 'full pipeline'}`);
  console.log(`  Handoffs: ${path.resolve(HANDOFF_DIR)}`);
  console.log(`  Audit:   ${path.resolve(AUDIT_DIR)}`);
  console.log('═'.repeat(60) + '\n');

  // Pre-warm the file cache for Phase A (avoids slow sequential reads)
  if (!onlyPhase || onlyPhase === 'A') {
    console.log('Pre-warming file cache...');
    await warmFileCache(REPO_ROOT!);
    console.log('File cache ready.\n');
  }

  const phasesToRun = onlyPhase ? [onlyPhase] : [...PHASES];

  for (const phase of phasesToRun) {
    const handoffPath = path.join(HANDOFF_DIR, `phase_${phase}.json`);

    // Resume mode: skip completed phases
    if (resume && fs.existsSync(handoffPath)) {
      console.log(`Phase ${phase}: already completed (handoff exists), skipping.`);
      continue;
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  PHASE ${phase}`);
    console.log('─'.repeat(60));

    // Load prior handoffs
    const priorHandoffs: Record<string, unknown> = {};
    for (const prior of PHASES) {
      if (prior === phase) break;
      const p = path.join(HANDOFF_DIR, `phase_${prior}.json`);
      if (fs.existsSync(p)) {
        priorHandoffs[prior] = JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }

    const client = getLlmClient(phase);

    // Run the phase
    let rawHandoff: unknown;
    try {
      rawHandoff = await runPhase(phase, priorHandoffs, client);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌  Phase ${phase} failed: ${msg}`);
      console.error('Pipeline halted. Fix the issue and re-run with --resume');
      process.exit(1);
    }

    // Validate schema
    let handoff: unknown;
    try {
      handoff = await validateWithRetry(phase, rawHandoff, client);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌  ${msg}`);
      process.exit(1);
    }

    // Detect hallucinated results
    detectHallucination(phase, handoff as Record<string, unknown>);

    // Write handoff to disk
    fs.writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));
    console.log(`  ✓ Phase ${phase} handoff written to ${handoffPath}`);

    // Critical blockers gate
    checkCriticalBlockers(phase, handoff as Record<string, unknown>);
  }

  // Final score (only if all phases ran)
  if (!onlyPhase) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('  FINAL RELEASE READINESS REPORT');
    console.log('═'.repeat(60));

    const allHandoffs: Record<string, unknown> = {};
    for (const phase of PHASES) {
      const p = path.join(HANDOFF_DIR, `phase_${phase}.json`);
      if (fs.existsSync(p)) allHandoffs[phase] = JSON.parse(fs.readFileSync(p, 'utf8'));
    }

    const score  = computeFinalScore(allHandoffs);
    const report = buildReadinessReport(score, allHandoffs);

    fs.writeFileSync('./handoffs/FINAL_REPORT.json', JSON.stringify(report, null, 2));

    console.log(`  Overall score:      ${score} / 100`);
    console.log(`  Production ready:   ${report.production_ready ? '✓ YES' : '✗ NO'}`);
    console.log(`  Web Store ready:    ${report.web_store_ready  ? '✓ YES' : '✗ NO'}`);

    if (report.blockers.length > 0) {
      console.log(`\n  Blockers:`);
      report.blockers.forEach((b: string) => console.log(`    ⛔  ${b}`));
    }

    console.log(`\n  Full report: ./handoffs/FINAL_REPORT.json`);
    console.log('═'.repeat(60) + '\n');
  }
}

main().catch(err => {
  console.error('Fatal orchestrator error:', err);
  process.exit(1);
});
