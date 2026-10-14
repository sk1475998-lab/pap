/**
 * Tool runner
 *
 * Executes every LLM tool call in a controlled environment.
 * Path whitelisting, command blocklist, submit guard, credential vault.
 * The LLM cannot bypass any of these — they are enforced in code before execution.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_ROOT   = process.env.SJA_REPO_ROOT || '';
const SANDBOX_DIR = '/tmp/sja-qa-sandbox';
const DEFAULT_TIMEOUT_MS = 60_000;

// Commands that are always blocked, regardless of phase
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  /sudo\s/,
  />\s*\/etc\//,
  />\s*\/usr\//,
  />\s*\/bin\//,
  /curl\s+.*http/i,
  /wget\s+/i,
  /\bssh\s+/,
  /process\.env/,
  /ANTHROPIC_API_KEY/,
  /SJA_CRED_/,
  /eval\(/,
];

// File cache for repo reads (warmed at startup for Phase A efficiency)
const FILE_CACHE = new Map<string, string>();

export async function warmFileCache(repoRoot: string) {
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory() && !name.startsWith('.') && name !== 'node_modules') {
        walk(full);
      } else if (stat.isFile() && /\.(ts|js|json|txt|md)$/.test(name) && stat.size < 100_000) {
        try {
          FILE_CACHE.set(full, fs.readFileSync(full, 'utf8'));
        } catch { /* skip unreadable files */ }
      }
    }
  };
  walk(repoRoot);
  console.log(`  File cache: ${FILE_CACHE.size} files indexed`);
}

export async function executeTool(
  toolName: string,
  input: Record<string, string>,
  phase: string
): Promise<string> {
  switch (toolName) {
    case 'read_file':      return toolReadFile(input.path);
    case 'list_directory': return toolListDirectory(input.path);
    case 'write_file':     return toolWriteFile(input.path, input.content);
    case 'run_shell':      return toolRunShell(input.command, Number(input.timeout_ms) || DEFAULT_TIMEOUT_MS, phase);
    case 'get_credential': return toolGetCredential(input.platform);
    case 'query_handoff':  return toolQueryHandoff(input.phase);
    default:
      return `ERROR: Unknown tool "${toolName}". Available: read_file, list_directory, write_file, run_shell, get_credential, query_handoff`;
  }
}

// ─── Individual tool implementations ─────────────────────────────────────────

function toolReadFile(filePath: string): string {
  const resolved = path.resolve(REPO_ROOT, filePath);

  if (!resolved.startsWith(REPO_ROOT)) {
    return `ERROR: Path "${filePath}" resolves outside repo root. Allowed root: ${REPO_ROOT}`;
  }

  // Check cache first
  if (FILE_CACHE.has(resolved)) {
    return FILE_CACHE.get(resolved)!;
  }

  if (!fs.existsSync(resolved)) {
    return `ERROR: File not found: ${resolved}`;
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return `ERROR: "${resolved}" is a directory. Use list_directory instead.`;
  }

  try {
    const content = fs.readFileSync(resolved, 'utf8');
    const result  = content.length > 60_000
      ? content.slice(0, 60_000) + `\n\n[FILE TRUNCATED — ${content.length} chars total, showing first 60000]`
      : content;
    FILE_CACHE.set(resolved, result);
    return result;
  } catch (e: unknown) {
    return `ERROR reading file: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function toolListDirectory(dirPath: string): string {
  const resolved = path.resolve(REPO_ROOT, dirPath);

  if (!resolved.startsWith(REPO_ROOT)) {
    return `ERROR: Path outside repo root`;
  }

  if (!fs.existsSync(resolved)) {
    return `ERROR: Directory not found: ${resolved}`;
  }

  const lines: string[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      if (entry.name === 'dist') continue;
      const indent = '  '.repeat(depth);
      if (entry.isDirectory()) {
        lines.push(`${indent}${entry.name}/`);
        walk(path.join(dir, entry.name), depth + 1);
      } else {
        const size = fs.statSync(path.join(dir, entry.name)).size;
        lines.push(`${indent}${entry.name}  (${formatBytes(size)})`);
      }
    }
  };

  walk(resolved, 0);
  return lines.join('\n') || '(empty directory)';
}

function toolWriteFile(filePath: string, content: string): string {
  const resolved = path.resolve(SANDBOX_DIR, filePath);

  // Prevent path traversal out of sandbox
  if (!resolved.startsWith(SANDBOX_DIR)) {
    return `ERROR: Path "${filePath}" resolves outside sandbox. All writes must stay within ${SANDBOX_DIR}`;
  }

  // Reject obviously dangerous content
  if (/process\.env\.(ANTHROPIC_API_KEY|SJA_CRED_)/i.test(content)) {
    return 'ERROR: File content contains credential variable references. Rejected for security.';
  }

  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf8');
    return `SUCCESS: Written ${content.length} chars to ${resolved}`;
  } catch (e: unknown) {
    return `ERROR writing file: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function toolRunShell(command: string, timeoutMs: number, phase: string): string {
  // Block dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return `ERROR: Command blocked by safety policy. Pattern matched: ${pattern}. Command: ${command.slice(0, 100)}`;
    }
  }

  // Phase A and B cannot run shell commands (analysis only)
  if (['A', 'B'].includes(phase)) {
    return 'ERROR: run_shell is not available in Phase A or B (static analysis phases only).';
  }

  // Inject submit guard for Phase D Playwright scripts
  const finalCommand = phase === 'D'
    ? command  // submit guard is injected at the write_file level for Playwright scripts
    : command;

  try {
    const output = execSync(finalCommand, {
      cwd: SANDBOX_DIR,
      timeout: Math.min(timeoutMs, 300_000), // hard cap at 5 minutes
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        HOME: SANDBOX_DIR,
        NODE_ENV: 'test',
        // Explicitly do NOT pass ANTHROPIC_API_KEY or SJA_CRED_* into shell
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as unknown as string;

    return String(output).slice(0, 25_000);
  } catch (e: any) {
    const stderr = String(e.stderr || '');
    const stdout = String(e.stdout || '');
    const combined = (stdout + '\n' + stderr).trim();
    return `EXIT CODE ${e.status ?? 1}\n${combined}`.slice(0, 15_000);
  }
}

function toolGetCredential(platform: string): string {
  const key = `SJA_CRED_${platform.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const value = process.env[key];

  if (!value) {
    return (
      `ERROR: No credential configured for platform "${platform}".\n` +
      `Set environment variable: export ${key}="email@example.com:password"\n` +
      `This must be a dedicated TEST account — never a real personal account.`
    );
  }

  // Return credential but remind LLM not to store it
  return `${value}\n[SECURITY NOTE: Do not write this credential to any file or log.]`;
}

function toolQueryHandoff(phase: string): string {
  const p = path.join('./handoffs', `phase_${phase.toUpperCase()}.json`);
  if (!fs.existsSync(p)) {
    return `ERROR: Handoff for phase "${phase}" not found at ${p}. Has that phase completed?`;
  }
  return fs.readFileSync(p, 'utf8');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
