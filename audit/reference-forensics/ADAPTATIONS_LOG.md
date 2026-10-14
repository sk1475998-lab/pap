# Reference Capability Adaptations — Master Log

Date: 2026-09-03 (Asia/Calcutta)
Scope: standing user mandate — clone every listed repo (done), analyze every
file (done at forensic depth), adapt genuine capabilities into the product.
License stance (updated for DIRECT adaptations): per `LICENSE_AND_USAGE_MATRIX.md`,
code from **MIT-licensed** references (10xProductivity, Auto_job_applier_linkedIn,
first2apply, job-apply-plugin) may be directly adapted with attribution and the
MIT notice preserved (`THIRD_PARTY_NOTICES.md`, file headers). Code from AGPL /
non-commercial / proprietary / no-license references is **never copied** —
those capabilities are re-implemented clean-room and attributed in headers.
Phrase/lexeme lists that describe external platforms' public UI copy are treated
as facts of those external products, not creative expression of the reference
authors.

Every module below lives in `packages/core/src/`, is exported from the core
`index.ts`, is covered by its own `node:test` suite wired into the core `npm test`
script, and typechecks across core / applier / extension.

## Consolidated verified status (2026-09-03)
- Core: 153 assertions (index.test.ts) + 105 node-test cases (1 index + 6
  global-assignment + 7 job-gating + 7 linkedin-controls + 10 session-guardrails
  + 12 human-pacing + 14 screening-answers + 6 network-retry + 11 field-similarity
  + 8 qa-fixtures + 7 linkedin-results + 16 llm-robust)
  = all green (`npm test --workspace @superjob/core` exit 0).
- Applier + extension + root `tsc --noEmit`: 0 errors.
- Integration battery (headed Chromium + MV3 worker): 51/51 pass, 0 skipped.
- Docker validation: 37 passed. Demo E2E: completed, 18 fields filled.
- Live-credential checks (real LinkedIn session, actual daily-limit wall,
  actual external-apply run) remain **NOT VERIFIED** — no fabrication.

---

## Adaptation 1 — Global field assignment (Hungarian / rectangular matching)
- Origin concept: FormFilla (R10 Chrome-store listing: free local-first form
  filler using Hungarian-algorithm page mapping for jobs/scholarships/
  admissions) and job-apply-plugin fixture mapping heuristics.
- Landed: `packages/core/src/global-assignment.ts` (exported via index.ts).
- Purpose: maximum-weight assignment between ambiguous/repeated form keys and
  profile values so multi-page forms do not mis-fill duplicate fields.
- Tests: `packages/core/src/global-assignment.test.ts` — 6/6.
- Attribution header present; independent implementation (typescript,
  rectangular max-weight with cost matrix, own scoring/fallbacks).
- Integration: exported from core; consumable by applier page-fill and
  extension autofill. Direct runtime wiring tracked in roadmap backlog.

## Adaptation 2 — Job gating (blacklist + multilingual years-required)
- Origin concept: AutoApplyMax (`content-simple.js`) and autoApplylinkedin
  company-blacklist / experience filters.
- Landed: `packages/core/src/job-gating.ts` (exported via index.ts).
  API: `parseBlacklist`, `extractYearsRequiredMultilingual`,
  `evaluateJobGates` (title+company+description scan; EN/FR/ES/DE/IT units).
- Tests: `packages/core/src/job-gating.test.ts` — 7/7.
- Runtime integration: `packages/applier` — optional `SearchParams.gates`
  (`blacklistKeywords`, `maxYearsRequired`); new `ApplyOutcome` value
  `"skipped-gate"`; pipeline evaluates right after score/risk/minScore checks
  and before `hooks.onApplyStart`, skipping with the gate reason in `error`.
- Verified: core tests 7/7, applier typecheck 0 errors, integration 51/51.

## Adaptation 3 — Dual-UI LinkedIn apply-control intelligence
- Origin concept: autoApplylinkedin / Auto_job_applier_linkedIn / AutoApplyMax
  LinkedIn DOM handling: legacy `aria-label^="LinkedIn Apply to"` buttons vs the
  newer SDUI `openSDUIApplyFlow` apply surface and the external-apply route.
- Landed: `packages/core/src/linkedin-controls.ts` (exported via index.ts).
  API: `classifyLinkedInApplyControl` (→ easy-apply | external-apply |
  filter-pill | other) and Playwright selector builders
  `linkedInEasyApplySelectors()` / `linkedInExternalApplySelectors()`.
- Tests: `packages/core/src/linkedin-controls.test.ts` — 7/7.
- Runtime integration: `packages/applier/src/sources/linkedin.ts`
  `openEasyApply` now probes `linkedInEasyApplySelectors()` first (SDUI
  apply-flow link + legacy aria-label prefix + jobs-apply-button) before
  text/class fallbacks. Regression-verified (integration 51/51, headed).
- Live LinkedIn interaction and real SDUI DOM remain **NOT VERIFIED**.

## Adaptation 4 — Session guardrails (daily-limit wall + stall watchdog)
- Origin concept: AutoApplyMax (`content-simple.js`) — pattern-matches
  LinkedIn's "daily Easy Apply limit" wall copy and stops the session, and
  tracks last-activity to detect a stuck run after a silence budget.
- Landed: `packages/core/src/session-guardrails.ts` (exported via index.ts).
  API: `LINKEDIN_DAILY_LIMIT_PHRASES`, `normalizeUiText`,
  `detectLimitWall`, `detectLinkedInDailyLimit`, `detectLimitWallInElements`,
  `createStallWatchdog` (injectable clock; exactly-once per-episode onStall).
  Defensive normalizer (case folding, curly apostrophes, punctuation) is new
  vs. the reference's raw `includes()` matching.
- Tests: `packages/core/src/session-guardrails.test.ts` — 10/10.
- Runtime integration: `packages/applier` —
  - `types.ts`: `ApplyOutcome` += `"daily-limit"`; `PipelineReport` +=
    optional `haltReason`.
  - `pipeline.ts`: per-job wall probe at job start; per-iteration wall probe
    mid-form; wall probe after submit before counting `applied`; per-job
    90 s `createStallWatchdog` (bail to requires-review on stall); whole
    session halts with `haltReason` once a wall is seen.
- Verified: core 10/10, applier typecheck 0 errors, integration 51/51
  (mock/LinkedIn-normal flows). The real wall event on live LinkedIn is
  **NOT VERIFIED** (requires a live session past the daily budget).

## Adaptation 5 — Human pacing governor (DIRECT, MIT)
- Origin: `10xProductivity` (MIT, Copyright 2026 10xProductivity Contributors)
  `workflows/linkedin_automation/pacing/{typing_human,delays}.py`.
- Landed: `packages/core/src/human-pacing.ts` (exported via index.ts).
  API: `randomIntIn`, `randomFloatIn`, `keystrokeDelayMs`, `postKeystrokePauseMs`
  (key-class micro-pauses: whitespace 40–220 ms, `.,!?;:` 120–380 ms, `/`
  80–200 ms), `hesitationPauseMs` (default 6 % think 250–900 ms, 1.5 %
  hesitate 900–1800 ms), `inputModeForLength` (graduated type-vs-paste policy:
  ≤72 → 82 %, ≤160 → 52 %, else 28 %), `equalJitterDelayMs/Hours`,
  `secondsUntilNextLocalMidnight`, `humanTypeText` (drives an injectable
  TypeSink). All samplers take an injectable `rnd` for deterministic tests.
  License: direct TS port under MIT — notice preserved in
  `THIRD_PARTY_NOTICES.md` and the file header.
- Best-of-both: SJA already had a Gaussian `humanTiming` engine and per-char
  typing; the port ADDS the missing cadence (key-class pauses, hesitation,
  graduated paste policy) while keeping SJA's Gaussian field-transition delays.
- Tests: `packages/core/src/human-pacing.test.ts` — 12/12.
- Runtime wiring: `packages/applier/src/page-fill.ts` `fillText` now uses
  `inputModeForLength` + per-char `keystrokeDelayMs` + `postKeystrokePauseMs` +
  `hesitationPauseMs` (imports from @superjob/core).
- Verified: core 12/12, core typecheck 0, applier typecheck 0, real-Chromium
  headless applier fill integration pass (1/1). Realism against live
  bot-detectors is inherently **NOT VERIFIED** (no ground truth in sandbox).
- Applied at runtime: `network-retry.ts` `RetryOptions.jitter` now accepts
  `"equal"` (equal jitter via `equalJitterDelayMs`); pure helper
  `retryBackoffDelayMs(attempt, opts)` exposed + 6/6 tests (network-retry.test.ts).
  Default behavior (jitter `true` = ±20% band, cap after jitter) is unchanged.

## Adaptation 6 — Screening-answer policy (DIRECT, MIT)
- Origin: `Auto_job_applier_linkedIn` (MIT, Copyright 2024-2026 Sai Vignesh
  Golla) `config/questions.py` (answer bank: years/visa/citizenship/salary/CTC/
  notice/name/links) + `runAiBot.py` `answer_questions`/`answer_common_questions`
  (label→answer decision table; lakhs = ÷100000 rounded 2dp, monthly = ÷12,
  notice months = days÷30, weeks = days÷7).
- Landed: `packages/core/src/screening-answers.ts` (exported via index.ts).
  API: `ScreeningAnswersConfig`, `normalizeQuestionText`, `detectScreeningIntent`
  (structured intents incl. salary kind+unit and notice unit), `resolveScreeningAnswer`
  (never-guess: returns `matched:false` for how-heard/essays/missing config so
  callers can fall back to the LLM), `salaryInLakhs`, `salaryMonthly`,
  `noticePeriodForUnit`, `booleanOptionCandidates`, `booleanAnswerText`, per-question
  `overrides`.
- Changes vs reference (independent re-engineering): TypeScript, declarative
  intent classification instead of one large if/elif, unit/modifiers structured,
  essays guarded by a years-number pattern (bare "experience" no longer triggers
  a numeric answer), and no random answer fallback ever.
- Tests: `packages/core/src/screening-answers.test.ts` — 14/14 (incl. the
  reference's own numeric examples: 2400000→"24.00"/"200000", 850000→"8.50"/
  "70833", notice 66→2 months/9 weeks, 15→0 months/2 weeks).
- Runtime wiring: exported for the extension/dashboard screening-answer config.
  The headless applier does NOT auto-consume it yet: applier fills are gated by
  `decideFieldPolicy` (EEO/credential/salary fields require explicit profile
  values + opt-ins), and this module must be bridged to the same rules before
  it feeds the pipeline. Wiring point identified: `page-fill.ts` step 2→3
  (custom-answer lookup) behind an explicit screening config; scheduled.
- Verified: core 14/14, core suite 57 node cases + 153 assertions green, core
  typecheck 0 errors.

## Adaptation 7 — Field/option similarity scorer (CLEAN-ROOM)
- Origin concept: `autoApplylinkedin/content/utils.js` (IliyaBrook) — fuzzy
  field-matching library (Levenshtein/Jaro-Winkler/stem/token/ngram +
  threshold findBestMatch). License is **custom non-commercial**, so this is a
  clean-room re-implementation of only standard published algorithms
  (Jaro–Winkler 1990, Dice 1945, Jaccard) with original code, weights,
  thresholds and structure. No code copied.
- Landed: `packages/core/src/field-similarity.ts` (exported via index.ts).
  API: `normalizeFieldText`, `tokenizeFieldText`, `jaroWinklerSimilarity`,
  `bigramDiceSimilarity`, `tokenJaccardSimilarity`, `blendedSimilarity`
  (weights char 0.55 / bigram 0.25 / token 0.2), `findBestMatch` (exact
  short-circuit + threshold + ranked list), `bestOptionMatch` (label+value
  aware for select/radio option resolution). Type `BestMatchResult<T>`.
- Best-of-both: SJA `resolver.ts` already has regex-rule exact + Levenshtein
  word-overlap fuzzy. The new module adds **length-independent** char-level and
  character-ngram scoring for short, typo-prone labels/options.
- Tests: `packages/core/src/field-similarity.test.ts` — 11/11 (incl. the
  classic Jaro pairs MARTHA/MARHTA, DWAYNE/DUANE and Dice NIGHT/NACHT).
- Runtime wiring: `packages/applier/src/page-fill.ts` `fuzzyPickOption` now
  first scores options with `bestOptionMatch` (threshold 0.72), falling back to
  the existing Levenshtein tier.
- Verified: core 11/11, full core suite 74 node cases + 153 assertions green,
  core/applier/extension typechecks 0 errors, real-Chromium applier fill
  integration pass, headed integration battery 51/51.
- Note: an environment reset in this cycle wiped /tmp/node22 + node_modules +
  Playwright system deps; toolchain re-provisioned (node v22.14.0, npm ci,
  playwright install-deps) and all checks re-ran green from scratch.

## Adaptation 8 — QA fixture/oracle contract validator (DIRECT, MIT)
- Origin: `job-apply-plugin` (MIT, Copyright 2025 Jeremy Watt) `qa/contracts.py`
  (schema constants: FIXTURE_ID/CAPTURE_MONTH/SHA256 regexes, per-record key
  sets, semantic field catalog) + the fixture/oracle JSON structure in
  `qa/fixtures/*`.
- Landed: `packages/core/src/qa-fixtures.ts` (exported via index.ts).
  API: `FIXTURE_SCHEMA_VERSION`, `FIXTURE_ID_RE`, `CAPTURE_MONTH_RE`,
  `SHA256_RE`, key-set constants (`FIXTURE_KEYS`, `STEP_KEYS`, `CONTROL_KEYS`,
  `PROVENANCE_KEYS`, `FINAL_ACTION_KEYS`, `ORACLE_KEYS`), semantic
  `FIXTURE_FIELD_CATALOG` (33 canonical field ids → widget role + label),
  TS types (`QaFixture`, `QaStep`, `QaControl`, `QaProvenance`), and a
  structural `validateQaFixture()` returning typed path/message issue lists,
  plus `isQaFixtureValid`/`firstQaFixtureIssue` helpers.
- Changes vs reference: TypeScript types; validator returns a typed issue list
  instead of Python membership asserts; regexes compiled once; structural
  recursion into steps/controls.
- Tests: `packages/core/src/qa-fixtures.test.ts` — 8/8 (valid fixture clean;
  bad id/captureMonth/sha256/schemaVersion; unknown keys at fixture/step/
  control level; step-kind and control-label enforcement; missing provenance/
  oracle; root guards).
- Runtime: pure QA-tooling surface exported from core for the integration
  battery and future oracle-replay lane (no live-session dependency).
- Verified: core 8/8, full core suite 82 node cases + 153 assertions green,
  core/applier/extension typechecks 0 errors.

## Adaptation 9 — LinkedIn results layout strategy + no-results detection (DIRECT, MIT)
- Origin: `first2apply` (MIT, beastx-ro) `_shared/parsers/linkedin.ts`
  `parseLinkedInJobs`: versioned results-list probing (v1 legacy
  `.jobs-search__results-list`; v2 logged-in `li[data-occludable-job-id]` /
  `.scaffold-layout__list`; v3 feed modules `data-view-name`; v4 AI search
  `componentkey=SearchResultsMainContent`) and no-results selectors.
- Landed: `packages/core/src/linkedin-results.ts` (exported via index.ts).
  API: `LINKEDIN_NO_RESULTS_SELECTORS`, `LINKEDIN_RESULTS_STRATEGIES` (v1–4
  container+card), `pickLinkedInResultsVersion(flags)`,
  `summarizeLinkedInResults(flags)` (no-results vs empty-list vs found),
  `linkedInResultsContainerSelectors()`, `parseLinkedInRelativeDate`,
  `parseLinkedInAbsoluteDate`. Pure functions — Playwright adapter probes the
  DOM then calls the pure pickers.
- Changes vs reference: no DOMParser dependency (DOM-presence flags instead);
  added date normalization helpers; card selector for AI-search simplified.
- Tests: `packages/core/src/linkedin-results.test.ts` — 7/7.
- Runtime wiring: `packages/applier/src/sources/linkedin.ts` `collectCards`
  now (a) fast-exits when a no-results empty state is visible and (b) waits on
  the full versioned container set from core.
- Verified: core 7/7, full core suite 89 node cases + 153 assertions green,
  applier typecheck 0 errors. Live LinkedIn layouts remain **NOT VERIFIED**
  (needs a real session against each LinkedIn layout).

## Adaptation 10 — LLM robustness toolkit (DIRECT, MIT)
- Origins (both MIT):
  - Auto_job_applier_linkedIn (Sai Vignesh Golla) — `modules/ai/connections.py`
    `select_option` snapping (exact → case-insensitive → substring) and
    `modules/ai/prompts.py` five-bucket skill extraction + plain-JSON fallback.
  - first2apply (beastx-ro) — `_shared/openAI.ts` cost accounting (prefer
    provider-reported cost; fall back to list-price estimate).
- Landed: `packages/core/src/llm/robust.ts` (exported via `llm/index.ts`).
  API: `parseModelJson` (fence-stripping, first balanced container, scalar
  fallback), `snapAnswerToOptions` (exact→case-insens→substring→fuzzy blend
  from Adaptation 7; returns raw when nothing is close — never invents),
  `SKILL_EXTRACTION_SYSTEM` / `buildSkillExtractionUserMessage` /
  `normalizeSkillBuckets` (camelCase+snake_case) / `extractSkillsStructured`
  (JSON-mode + resilient parse; no structured-output dependency),
  `estimateCallCostUsd` (reported>estimated>zero).
- Best-of-both with SJA: SJA's `answerQuestion` grounded on resume with an
  options prompt; it lacked a deterministic post-snap and any structured-output
  JSON fallback. `answerQuestion` now snaps the model reply onto the real option
  set before returning.
- Tests: `packages/core/src/llm/robust.test.ts` — 16/16 (stub-driven; no network).
- Verified: core 16/16, full core suite 105 node cases + 153 assertions green,
  core/applier/extension typechecks 0, release build integrity passed, headed
  integration battery 51/51 (0 skipped) with the answerQuestion change live.
- Not verified: real-provider structured extraction + OpenRouter cost reporting
  (no API keys in sandbox).

## Notes for the final report
- Per-repo 40.13 forensic records (all 9 + R10) remain to be written under
  this directory; adaptation provenance above is authoritative for the eight
  landed modules (+ the network-retry equal-jitter merge under #5).
- R10 (FormFilla) functional behavior: Not Verified — the store listing was
  read (chunk 0 of 3) but no CRX was downloadable in the sandbox.
