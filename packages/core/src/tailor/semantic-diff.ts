/**
 * Semantic Diff Engine — Token & Word-level Myers Differ
 * 
 * Computes exact word/phrase-level additions, modifications, and deletions
 * between the candidate's original resume and the tailored resume.
 * 
 * Renders rich visual diffs with vibrant green semantic highlighting
 * for ATS keywords and achievements added or improved.
 * 
 * Based on Myers' O(ND) Difference Algorithm (Myers, 1986) & google/diff-match-patch.
 */

export type DiffType = "added" | "removed" | "unchanged";

export interface DiffSpan {
  type: DiffType;
  text: string;
}

export interface DiffStats {
  addedWords: number;
  removedWords: number;
  unchangedWords: number;
  totalOriginalWords: number;
  totalTailoredWords: number;
  similarityRatio: number;
}

export interface DiffResult {
  spans: DiffSpan[];
  html: string;
  stats: DiffStats;
}

/**
 * Tokenizes text into words and whitespace/punctuation delimiters
 * so diffs highlight cleanly on word boundaries.
 */
export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  // Split on word boundaries while keeping delimiters
  const tokens = text.match(/\S+|\s+/g);
  return tokens ?? [];
}

/**
 * Computes token-level difference between original and revised text
 * using the classic Myers O(ND) algorithm.
 */
export function computeSemanticDiff(originalText: string, tailoredText: string): DiffResult {
  const origTokens = tokenizeWords(originalText);
  const tailTokens = tokenizeWords(tailoredText);

  const n = origTokens.length;
  const m = tailTokens.length;

  // Edge cases
  if (n === 0 && m === 0) {
    return {
      spans: [],
      html: "",
      stats: { addedWords: 0, removedWords: 0, unchangedWords: 0, totalOriginalWords: 0, totalTailoredWords: 0, similarityRatio: 1 }
    };
  }

  if (n === 0) {
    const spans: DiffSpan[] = [{ type: "added", text: tailoredText }];
    return {
      spans,
      html: renderDiffHtml(spans),
      stats: {
        addedWords: countWords(tailoredText),
        removedWords: 0,
        unchangedWords: 0,
        totalOriginalWords: 0,
        totalTailoredWords: countWords(tailoredText),
        similarityRatio: 0
      }
    };
  }

  if (m === 0) {
    const spans: DiffSpan[] = [{ type: "removed", text: originalText }];
    return {
      spans,
      html: renderDiffHtml(spans),
      stats: {
        addedWords: 0,
        removedWords: countWords(originalText),
        unchangedWords: 0,
        totalOriginalWords: countWords(originalText),
        totalTailoredWords: 0,
        similarityRatio: 0
      }
    };
  }

  // Myers diff matrix
  const max = n + m;
  const v: Record<number, number> = { 1: 0 };
  const trace: Record<number, number>[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push({ ...v });
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v[k - 1] ?? 0) < (v[k + 1] ?? 0))) {
        x = v[k + 1] ?? 0;
      } else {
        x = (v[k - 1] ?? 0) + 1;
      }
      let y = x - k;

      while (x < n && y < m && origTokens[x] === tailTokens[y]) {
        x++;
        y++;
      }
      v[k] = x;

      if (x >= n && y >= m) {
        // Traceback to build spans
        const rawSpans = backtrackMyers(trace, origTokens, tailTokens, x, y, d, k);
        const consolidated = consolidateSpans(rawSpans);
        const stats = calculateDiffStats(origTokens, tailTokens, consolidated);
        const html = renderDiffHtml(consolidated);

        return {
          spans: consolidated,
          html,
          stats
        };
      }
    }
  }

  // Fallback: entire text replaced
  const fallbackSpans: DiffSpan[] = [
    { type: "removed", text: originalText },
    { type: "added", text: tailoredText }
  ];
  return {
    spans: fallbackSpans,
    html: renderDiffHtml(fallbackSpans),
    stats: {
      addedWords: countWords(tailoredText),
      removedWords: countWords(originalText),
      unchangedWords: 0,
      totalOriginalWords: countWords(originalText),
      totalTailoredWords: countWords(tailoredText),
      similarityRatio: 0
    }
  };
}

function backtrackMyers(
  trace: Record<number, number>[],
  orig: string[],
  tail: string[],
  startX: number,
  startY: number,
  d: number,
  k: number
): DiffSpan[] {
  let x = startX;
  let y = startY;
  const spans: DiffSpan[] = [];

  for (let step = d; step > 0; step--) {
    const vPrev = trace[step - 1];
    const kPrev = (k === -step || (k !== step && (vPrev[k - 1] ?? 0) < (vPrev[k + 1] ?? 0))) ? k + 1 : k - 1;
    const xPrev = vPrev[kPrev] ?? 0;
    const yPrev = xPrev - kPrev;

    while (x > xPrev && y > yPrev) {
      spans.unshift({ type: "unchanged", text: orig[x - 1] });
      x--;
      y--;
    }

    if (x > xPrev) {
      spans.unshift({ type: "removed", text: orig[x - 1] });
      x--;
    } else if (y > yPrev) {
      spans.unshift({ type: "added", text: tail[y - 1] });
      y--;
    }
    k = kPrev;
  }

  while (x > 0 && y > 0) {
    spans.unshift({ type: "unchanged", text: orig[x - 1] });
    x--;
    y--;
  }

  return spans;
}

/**
 * Consolidates consecutive spans of the same type to minimize fragmentation.
 */
function consolidateSpans(spans: DiffSpan[]): DiffSpan[] {
  const result: DiffSpan[] = [];
  for (const s of spans) {
    const last = result[result.length - 1];
    if (last && last.type === s.type) {
      last.text += s.text;
    } else {
      result.push({ ...s });
    }
  }
  return result;
}

function countWords(str: string): number {
  const words = str.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function calculateDiffStats(orig: string[], tail: string[], spans: DiffSpan[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const s of spans) {
    const words = countWords(s.text);
    if (s.type === "added") added += words;
    else if (s.type === "removed") removed += words;
    else unchanged += words;
  }

  const totalOrig = countWords(orig.join(""));
  const totalTail = countWords(tail.join(""));
  const denominator = (totalOrig + totalTail);
  const similarity = denominator > 0 ? (2 * unchanged) / denominator : 1;

  return {
    addedWords: added,
    removedWords: removed,
    unchangedWords: unchanged,
    totalOriginalWords: totalOrig,
    totalTailoredWords: totalTail,
    similarityRatio: Math.round(similarity * 100) / 100
  };
}

/**
 * Renders HTML markup with vibrant, high-contrast green highlighting for added
 * content, and subtle struck-through styling for removed text.
 */
export function renderDiffHtml(spans: DiffSpan[]): string {
  return spans.map((s) => {
    const escaped = escapeHtml(s.text);
    if (s.type === "added") {
      return `<mark class="diff-added" style="background-color: rgba(16, 185, 129, 0.18); color: #047857; font-weight: 600; padding: 1px 4px; border-radius: 3px; border-bottom: 2px solid #10b981;">${escaped}</mark>`;
    }
    if (s.type === "removed") {
      return `<del class="diff-removed" style="background-color: rgba(239, 68, 68, 0.12); color: #b91c1c; text-decoration: line-through; opacity: 0.7; padding: 1px 4px;">${escaped}</del>`;
    }
    return escaped;
  }).join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
