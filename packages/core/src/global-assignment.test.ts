import { test } from "node:test";
import assert from "node:assert/strict";
import { solveAssignment, assignFieldsGlobally, hungarianMin } from "./global-assignment.js";

test("hungarianMin assigns a perfect permutation optimally (2x2 swap)", () => {
  // Row0 is cheapest in col1, row1 cheapest in col0; a swap is optimal (0+0=0).
  const cost = [
    [10, 0],
    [0, 10],
  ];
  const a = hungarianMin(cost);
  assert.deepEqual([...a].slice(0, 2), [1, 0]); // row0->col1, row1->col0 => total 0
});

test("hungarianMin identity cost", () => {
  const cost = [
    [0, 5],
    [5, 0],
  ];
  const a = hungarianMin(cost);
  assert.deepEqual([...a].slice(0, 2), [0, 1]); // diagonal 0+0 < off-diagonal 10
});

test("solveAssignment maximizes total score (greedy trap)", () => {
  // Field A strongly prefers key 1; field B moderately prefers key 1 too.
  // Greedy: A->1, B gets nothing usable. Global: A->1, B->0 still possible,
  // but with B->0 positive it must choose that to maximize.
  const scores = [
    [50, 100],
    [80, 30],
  ];
  const m = solveAssignment(scores);
  // Global optimum = A->1 (100) + B->0 (80) = 180 vs A->0+B->1 = 80.
  assert.equal(m.get(0), 1);
  assert.equal(m.get(1), 0);
});

test("solveAssignment leaves low-confidence fields unmatched (partial assignment)", () => {
  const scores = [
    [100, 1],
    [1, 2],
    [0.5, 0.2],
  ];
  const m = solveAssignment(scores, { minScore: 1 });
  assert.equal(m.get(0), 0); // strong
  assert.equal(m.has(1), true); // 2 >= 1
  assert.equal(m.has(2), false); // below minScore
});

test("assignFieldsGlobally returns injective map for duplicate labels", () => {
  // Two "Start date" fields on a repeated work block page; the generic resolver
  // must not give both the same key. Keys: experienceStartMonth, experienceEndMonth.
  const fields = ["Start date", "End date"];
  const keys = ["experienceStartMonth", "experienceEndMonth"];
  const score = (label: string, key: string) => {
    if (label === "Start date" && key === "experienceStartMonth") return 9;
    if (label === "Start date" && key === "experienceEndMonth") return 1;
    if (label === "End date" && key === "experienceStartMonth") return 1;
    if (label === "End date" && key === "experienceEndMonth") return 9;
    return 0;
  };
  const m = assignFieldsGlobally(fields, keys, score);
  assert.equal(m.get("Start date"), "experienceStartMonth");
  assert.equal(m.get("End date"), "experienceEndMonth");
});

test("3-field assignment beats greedy when labels are ambiguous", () => {
  const fields = ["Name", "Full name", "Email"];
  const keys = ["firstName", "fullName", "email"];
  const score = (l: string, k: string) => {
    const t = new Map<string, Map<string, number>>([
      ["Name", new Map([["firstName", 6], ["fullName", 5]])],
      ["Full name", new Map([["fullName", 9], ["firstName", 2]])],
      ["Email", new Map([["email", 10]])],
    ]);
    return t.get(l)?.get(k) ?? 0;
  };
  const m = assignFieldsGlobally(fields, keys, score);
  assert.equal(m.size, 3);
  assert.equal(m.get("Email"), "email");
  assert.equal(m.get("Full name"), "fullName");
  assert.equal(m.get("Name"), "firstName");
});
