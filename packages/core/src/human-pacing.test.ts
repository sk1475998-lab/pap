import test from "node:test";
import assert from "node:assert/strict";
import {
  randomIntIn,
  randomFloatIn,
  keystrokeDelayMs,
  postKeystrokePauseMs,
  hesitationPauseMs,
  inputModeForLength,
  equalJitterDelayMs,
  equalJitterDelayHours,
  secondsUntilNextLocalMidnight,
  humanTypeText,
  type TypeSink,
} from "./human-pacing.js";

/** Deterministic rnd: first N calls return 0 (low), then 0.99 (high). */
function seqRnd(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test("randomIntIn stays inside inclusive bounds (lo and hi)", () => {
  assert.equal(randomIntIn(5, 5), 5);
  assert.equal(randomIntIn(0, 0), 0);
  // rnd=0 -> lo, rnd=~1 -> hi
  assert.equal(randomIntIn(3, 9, () => 0), 3);
  assert.equal(randomIntIn(3, 9, () => 0.999999), 9);
  // reversed bounds are normalized (best-effort robustness)
  assert.equal(randomIntIn(9, 3, () => 0), 3);
});

test("randomFloatIn stays inside [min,max)", () => {
  const v0 = randomFloatIn(1, 2, () => 0);
  const v1 = randomFloatIn(1, 2, () => 0.5);
  const v2 = randomFloatIn(1, 2, () => 0.999999);
  assert.ok(v0 >= 1 && v0 < 2);
  assert.ok(v1 >= 1.49 && v1 <= 1.51);
  assert.ok(v2 >= 1 && v2 < 2);
  assert.ok(Number.isFinite(v0) && Number.isFinite(v1) && Number.isFinite(v2));
});

test("keystrokeDelayMs is uniform within [min,max] inclusive", () => {
  const lo = keystrokeDelayMs({ minMs: 50, maxMs: 200, rnd: () => 0 });
  const hi = keystrokeDelayMs({ minMs: 50, maxMs: 200, rnd: () => 0.999999 });
  assert.equal(lo, 50);
  assert.equal(hi, 200);
  const mid = keystrokeDelayMs({ minMs: 50, maxMs: 200, rnd: () => 0.5 });
  assert.ok(mid >= 50 && mid <= 200);
});

test("postKeystrokePauseMs follows character-class bands", () => {
  const space = postKeystrokePauseMs(" ", () => 0);
  const newline = postKeystrokePauseMs("\n", () => 0);
  const tab = postKeystrokePauseMs("\t", () => 0.999999);
  const period = postKeystrokePauseMs(".", () => 0);
  const comma = postKeystrokePauseMs(",", () => 0);
  const colon = postKeystrokePauseMs(":", () => 0);
  const question = postKeystrokePauseMs("?", () => 0.999999);
  const slash = postKeystrokePauseMs("/", () => 0.5);
  // whitespace band 40-220
  assert.ok(space >= 40 && space <= 220);
  assert.ok(newline >= 40 && newline <= 220);
  assert.ok(tab >= 40 && tab <= 220);
  // punctuation band 120-380
  assert.ok(period >= 120 && period <= 380);
  assert.ok(comma >= 120 && comma <= 380);
  assert.ok(colon >= 120 && colon <= 380);
  assert.ok(question >= 120 && question <= 380);
  // slash band 80-200
  assert.ok(slash >= 80 && slash <= 200);
  // ordinary letters get no extra pause
  assert.equal(postKeystrokePauseMs("a"), 0);
  assert.equal(postKeystrokePauseMs("Z"), 0);
  assert.equal(postKeystrokePauseMs("1"), 0);
});

test("hesitationPauseMs returns 0 mostly and honors thresholds", () => {
  // rnd first draw high (>=0.06) and second high (>=0.015) -> 0
  assert.equal(hesitationPauseMs({}, seqRnd([0.5, 0.5])), 0);
  // first draw low -> "thinking" pause in 250-900
  const think = hesitationPauseMs({}, seqRnd([0.0, 0.5]));
  assert.ok(think >= 250 && think <= 900);
  // first draw >= thinkP but second < hesitateP -> long hesitation 900-1800
  const hesitate = hesitationPauseMs({}, seqRnd([0.06, 0.0]));
  assert.ok(hesitate >= 900 && hesitate <= 1800);
  // custom probabilities: thinkP=1.0 forces think; hesitateP=1.0 but thinkP=0 forces hesitate
  assert.equal(hesitationPauseMs({ thinkP: 1 }, () => 0) >= 250, true);
  assert.equal(hesitationPauseMs({ thinkP: 0, hesitateP: 1 }, () => 0) >= 900, true);
});

test("inputModeForLength scales paste probability with length", () => {
  // short text, low rnd -> type
  assert.equal(inputModeForLength("hi", {}, () => 0), "type");
  // short text but rnd ~ 0.99 (> 0.82) -> paste
  assert.equal(inputModeForLength("hi there", {}, () => 0.99), "paste");
  // medium: p(type)=0.52
  assert.equal(inputModeForLength("m".repeat(100), {}, () => 0.6), "paste");
  assert.equal(inputModeForLength("m".repeat(100), {}, () => 0.0), "type");
  // long: p(type)=0.28 -> paste for rnd 0.5
  assert.equal(inputModeForLength("x".repeat(500), {}, () => 0.5), "paste");
  // custom policy overrides
  assert.equal(inputModeForLength("long text", { shortLen: 200, shortTypeP: 1 }, () => 0), "type");
});

test("equalJitterDelayMs is uniform in [base/2, base]", () => {
  assert.equal(equalJitterDelayMs(0), 0);
  assert.equal(equalJitterDelayMs(1000, () => 0), 500);
  assert.ok(equalJitterDelayMs(1000, () => 0.999999) <= 1000);
  assert.ok(equalJitterDelayMs(1000, () => 0.999999) >= 500);
  const mid = equalJitterDelayMs(1000, () => 0.5);
  assert.ok(mid >= 500 && mid <= 1000);
});

test("equalJitterDelayHours scales the base in hours", () => {
  assert.equal(equalJitterDelayHours(0), 0);
  const h = equalJitterDelayHours(4, () => 0);
  assert.equal(h, 2); // half of 4h
  const h2 = equalJitterDelayHours(4, () => 0.999999);
  assert.ok(h2 > 2 && h2 <= 4);
});

test("secondsUntilNextLocalMidnight counts up to local midnight", () => {
  const midday = new Date(2026, 0, 15, 12, 0, 0, 0); // local noon
  const s = secondsUntilNextLocalMidnight(midday);
  assert.equal(s, 12 * 3600);
  const justBefore = new Date(2026, 0, 15, 23, 59, 59, 0);
  assert.ok(secondsUntilNextLocalMidnight(justBefore) <= 2);
  // never negative
  assert.ok(secondsUntilNextLocalMidnight() >= 0);
});

test("humanTypeText types chars with per-key delays and pauses", async () => {
  const events: Array<[string, number]> = [];
  const sleeps: number[] = [];
  const sink: TypeSink = {
    typeChar: (ch, d) => void events.push([ch, d]),
    insertText: (t) => void events.push(["#paste", t.length]),
    sleep: (ms) => void sleeps.push(ms),
  };
  // Force typing mode and skip pauses so the char stream is exact.
  await humanTypeText(sink, "Ab c.", { mode: "type", pauses: false, minKeyMs: 5, maxKeyMs: 5 });
  assert.equal(events.map(([c]) => c).join(""), "Ab c.");
  assert.ok(events.every(([, d]) => d === 5));
  assert.equal(sleeps.length, 0);
});

test("humanTypeText pastes long text and pauses around it", async () => {
  const events: Array<[string, number]> = [];
  const sleeps: number[] = [];
  const sink: TypeSink = {
    typeChar: (ch, d) => void events.push([ch, d]),
    insertText: (t) => void events.push(["#paste", t.length]),
    sleep: (ms) => void sleeps.push(ms),
  };
  const long = "x".repeat(500);
  await humanTypeText(sink, long, { pauses: true, rnd: () => 0.99, minKeyMs: 5, maxKeyMs: 5 });
  // rnd 0.99 on length 500 -> paste; then sleeps before/after
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], ["#paste", 500]);
  assert.equal(sleeps.length, 2);
});

test("humanTypeText skips carriage returns but maps newlines through sink", async () => {
  const chars: string[] = [];
  const sink: TypeSink = {
    typeChar: (ch) => void chars.push(ch),
    insertText: () => {},
    sleep: () => {},
  };
  await humanTypeText(sink, "a\r\nb", { mode: "type", pauses: false, minKeyMs: 1, maxKeyMs: 1 });
  assert.deepEqual(chars, ["a", "\n", "b"]);
});
