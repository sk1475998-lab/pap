/**
 * Global-optimal field assignment.
 *
 * Capability source: FormFilla's documented *approach* — model a form as a
 * maximum-weight bipartite matching problem between detected form fields and
 * candidate profile keys, then solve it globally (Kuhn–Munkres / Hungarian)
 * instead of assigning each field greedily. The algorithm here is an original,
 * dependency-free implementation of the standard rectangular assignment
 * problem. No source code was taken from FormFilla (closed-source); only the
 * documented idea is independently re-implemented.
 *
 * When is this worth it? Greedy first-match is fine when every field label
 * unambiguously maps to one key. It misfires when the same label appears more
 * than once on a page (repeated school/work blocks), when several labels could
 * match one key ("Name", "Full name", "Your name"), or when a layout reorders
 * two similar fields. Global assignment spreads the available keys across all
 * fields so the *sum* of match confidences is maximized and no key is claimed
 * twice.
 *
 * Note: For typical forms with very unequal signal quality, greedy + a few
 * disambiguation rules is competitive and cheaper. Use global assignment for
 * scans of repeated-block / generic forms (the "deep scan" path), where
 * ambiguity is high and field counts are modest (< 200).
 */

export interface GlobalAssignmentOptions {
  /** Minimum score for a field->key edge to be considered at all. */
  minScore?: number;
  /** Only keep edges that are >= bestEdgeForThatField * keepFactor. */
  keepFactor?: number;
}

/**
 * Solve the rectangular maximum-weight bipartite matching problem.
 *
 * rows = detected fields (row i), cols = candidate keys (col j), score(i,j) is
 * the confidence that field i should map to key j. Returns a Map row->col that
 * maximizes the total score with each row and column used at most once
 * (partial assignment allowed).
 *
 * Implementation: reduce to the classic square assignment problem by padding
 * with zero-cost dummy edges (allowing rows/cols to go unmatched), negate to a
 * minimization, and solve with the O(n^3) Hungarian algorithm with potentials.
 * Only pairs whose score clears `minScore` survive; `keepFactor` prunes edges
 * far below each row's best so noise can't displace a strong signal.
 */
export function solveAssignment(
  scores: number[][],
  opts: GlobalAssignmentOptions = {},
): Map<number, number> {
  const rows = scores.length;
  if (rows === 0) return new Map();
  const cols = scores[0]?.length ?? 0;
  if (cols === 0) return new Map();

  const { minScore = 0, keepFactor = 0 } = opts;

  // Edge pruning per row: keep a field->key edge only if it is at least
  // keepFactor of the row's own best score and above minScore.
  const pruned: number[][] = scores.map((row) => {
    const rowBest = row.length ? Math.max(...row) : 0;
    const threshold = Math.max(minScore, rowBest * keepFactor);
    return row.map((s) => (s >= threshold ? s : -Infinity));
  });

  // Build a square cost matrix of size n = rows + cols, with dummy edges at 0
  // cost so unmatched rows/cols are allowed. Real edges get cost = -score so
  // minimizing cost maximizes score.
  const n = rows + cols;
  const cost: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = pruned[r]?.[c] ?? -Infinity;
      cost[r]![c] = Number.isFinite(s) && s > 0 ? -s : 1; // 1 = "don't pick"
    }
  }

  const assignment = hungarianMin(cost);
  const result = new Map<number, number>();
  for (let r = 0; r < rows; r++) {
    const c = assignment[r];
    // Only real columns (c < cols) are kept. Edges pruned by threshold were
    // encoded as positive cost, so the solver prefers leaving the field
    // unmatched (dummy cost 0) over a sub-threshold real pairing — which means
    // any real edge chosen here already cleared minScore/keepFactor.
    if (c !== undefined && c >= 0 && c < cols) {
      const s = scores[r]?.[c] ?? 0;
      if (s > 0) result.set(r, c);
    }
  }
  return result;
}

/**
 * Hungarian algorithm (O(n^3)) for the square minimum-cost assignment problem.
 * `cost` must be an n x n matrix of finite numbers. Returns array `assign` such
 * that row i is assigned to column assign[i].
 */
export function hungarianMin(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  // Standard potentials implementation (1-indexed arrays internally).
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0); // p[j] = row matched to column j
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    // Augmenting path.
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }

  const assign = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0) assign[p[j]! - 1] = j - 1;
  }
  return assign;
}

/**
 * Convenience wrapper for the "repeated labels" scenario: given N detected
 * fields and M candidate keys plus a per-pair confidence function, produce the
 * globally optimal injective field->key map.
 */
export function assignFieldsGlobally<TField, TKey>(
  fields: TField[],
  keys: TKey[],
  score: (field: TField, key: TKey) => number,
  opts?: GlobalAssignmentOptions,
): Map<TField, TKey> {
  const m = solveAssignment(
    fields.map((f) => keys.map((k) => score(f, k))),
    opts,
  );
  const out = new Map<TField, TKey>();
  for (const [r, c] of m) {
    out.set(fields[r]!, keys[c]!);
  }
  return out;
}
