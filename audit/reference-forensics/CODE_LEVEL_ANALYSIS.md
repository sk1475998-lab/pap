# Reference Code-Level Analysis — What Each Repo Does and How SJA Uses It

Date: 2026-09-03 · Author: SJA Agent (per user mandate: clone → analyse every file →
identify most useful capabilities → adapt best-of-both → test function by function).
Full per-file line inventories are saved under `audit/reference-forensics/inventory/*.lines.txt`.
Usage disposition (DIRECT / CLEAN-ROOM / FLAG / DOC-ONLY) is per
`LICENSE_AND_USAGE_MATRIX.md`.

Legend: relevance to Super Job Agent = **H** high / **M** medium / **L** low.
"Already in SJA" = the capability exists in our codebase today; "Best-of-both" =
merge strongest technique from reference with ours.

---

## 0. Executive summary (ranked usefulness for SJA)

| Rank | Repo | Why it matters to SJA | License posture |
|---|---|---|---|
| 1 | Auto_job_applier_linkedIn | The only reference with a full LinkedIn **Easy Apply answer/decision engine**: config-driven Q&A bank, LPA/CTC/visa question math, resume existence handling, submit-follow logic | DIRECT (MIT) |
| 2 | autoApplylinkedin | Deepest **fuzzy field-matching** library (Levenshtein/Jaro-Winkler/stem/token/ngram + threshold findBestMatch) and dual-UI (legacy/SDUI) detection | CLEAN-ROOM only (non-commercial) |
| 3 | job-apply-plugin | **Fixture/oracle QA contracts** for real apply flows (LinkedIn Easy Apply, Greenhouse, Lever, Ashby) + bounded auto-submit policy store — model for our QA oracle + autopilot guardrails | DIRECT (MIT) |
| 4 | 10xProductivity | **Human pacing governor** (per-keystroke jitter, key-class pauses, hesitation bursts, paste-vs-type policy, equal-jitter backoff) for LinkedIn automation | DIRECT (MIT) |
| 5 | AutoApplyMax | Daily-limit wall detector, no-logo/no-apply filters, activity/stuck watchdog, storage-driven session counters | FLAG (AGPL) — concepts already adapted clean-room |
| 6 | first2apply | Supabase-edge **board/listing parsers** (LinkedIn etc.) + job-description parser + desktop job scanner | DIRECT (MIT) |
| 7 | job-copilot | Job fetch/match + notification microservices (RemoteOK source, JWT auth) | FLAG (no LICENSE file) |
| 8 | FormFilla (R10) | Documented architecture: DOM scanner + Hungarian matching + repeated-block detector + abbreviation normalizer | DOC-ONLY (proprietary) |
| 9 | job-bot-ollama | Marketing/docs for hosted JobHuntr (universal apply, LinkedIn audit) — no source | DOC-ONLY |

---

## 1. Auto_job_applier_linkedIn (MIT — DIRECT)

Owner: Sai Vignesh Golla (GodsScion). Python/Selenium. 26 code files, ~4.9k LOC
(+ vendored JS). This is the closest single reference to SJA's LinkedIn mission.

### File map & review
| File (LOC) | What it does | Use in SJA |
|---|---|---|
| `config/questions.py` (167) | Central Easy-Apply **answer bank**: years experience, visa sponsorship, citizenship enum, desired salary, website/LinkedIn URLs, work authorization enums, and the documented **lakhs/CTC & monthly conversion math** (append "." before last 5 digits for lakhs; ÷12 for monthly; numbers-only fields) | **H — DIRECT.** SJA already parses India LPA/notice formats (`india-intelligence`), but a reusable config-driven screening-answer policy + salary normalization is missing. Best-of-both with SJA profile store → new core module `screening-answers`. |
| `runAiBot.py` (1248) | The apply loop: CSV job list → login → search → iterate results → open Easy Apply → fill common question types → decide Next/Review/Submit; skip/retry counters; stops at daily-limit | **H.** Compare with SJA pipeline loop; adopt decision taxonomy (already partly mirrored). Read-only learning; our pipeline is TypeScript/Playwright so reuse = concepts. |
| `modules/clickers_and_finders.py` (166) | XPath/CSS finders + clickers for Easy Apply UI (both UI generations), continue/review/submit | **M** — validates SJA `linkedin-controls` selector set. |
| `modules/validator.py` (221) | Pre-flight config validation (salary/year/visa types) → fail fast | **H** — mirrors SJA `validateProfile`; candidate: validation of new screening-answers config. |
| `modules/ai/connections.py` (298) + `prompts.py` | Optional AI to answer unseen custom questions + extract skills from resume | **M** — SJA has stronger LLM routing; nothing to copy. |
| `config_schema.py` (286) | Formal typed config schema + overrides (`config/_overrides.py`) | **M** — config layering idea for SJA params. |
| `config/personals.py`, `resume.py`, `search.py`, `secrets.py`, `settings.py` | Personal/resume/search/secrets knobs | **L** — pattern only. |
| `modules/resumes/extractor.py`, `generator.py` | Resume text extraction & GPT-generated custom resumes (deprecated) | **L** — SJA has resume text ingestion. |
| `modules/javascript/unfollow_companies.js` | Unfollow-companies DOM helper | **L**. |
| `tests/*` (3 files) | Pytest fixtures for config/ai/app integration | **M** — shape for SJA screening-answers tests. |

### Adaptation plan (DIRECT, best-of-both) — **LANDED (Adaptation 6, core)**
1. **Core `screening-answers` policy module — LANDED**: config-driven
   question-intent → answer mapping (years / visa / citizenship / salary with
   lakhs + monthly normalization / notice-period units / links / name variants /
   overrides), 14/14 tests. Applier runtime auto-use is intentionally gated
   behind `decideFieldPolicy` (EEO/credential/salary opt-ins) — wiring point
   identified (`page-fill.ts` step 2→3) but not enabled by default.

---

## 2. autoApplylinkedin (non-commercial — CLEAN-ROOM)

Owner: IliyaBrook. Plain-JS browser extension (content scripts + popup). 17 JS files, ~7.0k LOC. The reference with the *best* pure matching + UI-generation detection, but its license forbids commercial use → **no code copied**; capabilities re-expressed in SJA's own core modules with provenance headers.

### File map & review
| File (LOC) | What it does | Use in SJA |
|---|---|---|
| `content/content.js` (2335) | Main job-card walker: click job items, read details, detect Easy Apply vs external, open form, answer per-field with matching, Next/Review/Submit with **confirmation-observed accounting** (`submitNotConfirmed`, `noSubmitButton`, `titleSkip`, `badWord`, `alreadyApplied`, `external`, `clickFailed`, …) — outcome strings that make false-positive submits impossible | **H** — SJA pipeline outcomes (`skipped-*`, `failed`, `daily-limit`, …) already overlap; the "confirm submission actually happened before recording applied" is now enforced by our Adaptation 4 wall check. |
| `content/utils.js` (1416) | The matching core: `normalizeString`, `setNativeValue` (React-safe native setter), `levenshteinDistance`, `stem`/`tokenize`/stop-words, `jaroWinkler`, `ngramSimilarity`, `tokenSimilarity`, `calculateSimilarity`, `findBestMatch` (threshold + exact-match short-circuit + return rankings); `findEasyApplyModal`; dual-UI detect (`detectJobsUI` legacy/new) | **H — clean-room.** SJA core `global-assignment.ts` gives global (Hungarian) assignment; a *local* scorer ranking for single-field lookup would strengthen page-fill. Best-of-both: adopt algorithm *shapes* (Jaro-Winkler + bigram) as independent TS under core `field-similarity.ts`, with our own tests. |
| `background.js` (497) | Tab/queue orchestration, run pause/resume, badge counts | **M**. |
| `popup/*` (formControl/cvManager/applyHistory/filterSettings/externalApply ~1.4k) | CV library, apply-history view, blacklist/exclusion filters, external-apply lane | **M** — matches SJA dashboard features. |
| `pack-extension-firefox*.js` | Firefox packing | **L**. |

### Adaptation plan (CLEAN-ROOM)
1. Core `field-similarity` scorer (independent TS): normalization, tokenization/stemming light, Jaro-Winkler + n-gram blend, threshold findBestMatch with exact-match precedence. Tests per function against a golden field table (do not port their constant values verbatim — derive fresh).

---

## 3. job-apply-plugin (MIT — DIRECT)

Owner: Jeremy Watt (neonwatty). Python + browser-extension QA toolkit, 30 code files ~25.5k LOC, with curated **fixtures** (LinkedIn Easy Apply screening, Greenhouse single-page, Lever application, Ashby application) each with `fixture.json` (steps/controls), `approval.json` (final-action oracle), `provenance.json` (sha256 of source capture).

### File map & review
| File (LOC) | What it does | Use in SJA |
|---|---|---|
| `qa/contracts.py` | The **schema contracts**: FIXTURE_KEYS/STEP_KEYS/CONTROL_KEYS/PROVENANCE_KEYS/FINAL_ACTION_KEYS/ORACLE_KEYS + regex validators (`FIXTURE_ID`, `CAPTURE_MONTH`, `SHA256`) + the semantic **field CATALOG** (`contact.full_name`, `employment.current_company`, `authorization.sponsorship`, …) with kind/label | **H — DIRECT.** A versioned catalog + fixture schema is exactly what SJA integration tests need to stay honest across ATS changes. Port schema concept to a JSON schema + TS validators in `@superjob/core` `qa-fixtures`. |
| `qa/oracle.py`, `qa/server.py`, `qa/recorder.mjs`, `qa/recorder_fs.py`, `qa/compiler.py`, `qa/promote.py` | Record a real apply session in browser → compile to fixture + provenance → serve as an oracle replay (QA server) for the agent-under-test | **H.** SJA has real-browser tests; an oracle-replay lane would let autopilot changes be regression-tested against recorded real flows. Long-term roadmap. |
| `qa/scenarios/{greenhouse,lever,ashby,linkedin}-…/profile.json + expected.json` | Complete-profile scenarios per ATS: given a profile, expected field mapping/values | **H — DIRECT.** Golden mapping tables to grow SJA's ATS-config corpus. |
| `scripts/job_apply_policy.py` (1138) | Inert **local policy authority** for bounded auto-submit campaigns: HMAC-signed policy records, application cap (default 10), max duration (4h), 5-min leases, url fingerprint (sha256), per-ATS configs; deliberately no browser control | **H — DIRECT concepts.** SJA has `rate-governor`; a signed campaign-policy record (cap, TTL, lease, fingerprint) mirrors and strengthens our guardrails — clean-room port later. |
| `scripts/job-apply-store.py` (917) | Local store for campaign/application/answer/lease/receipt records with locking | **M.** |
| `scripts/qa-chrome.py`, `qa-replay.py`, `check-final-action-docs.py`, `tests*`, `tests_js/*` | Drive Chrome for capture/replay + a very large test suite | **M** — QA methodology to emulate. |

### Adaptation plan (DIRECT)
1. Port fixture **contract schema + field catalog** as TS types/validators with the fixtures imported as test data (attribution kept) — first step toward an oracle suite. Function-by-function: each validator + catalog entry tested.

---

## 4. 10xProductivity (MIT — DIRECT)

Owner: ZhixiangLuo. Python agent automation framework (~11k LOC) + docs. Broad scope (Slack/Drive/Teams/SSO + LinkedIn engagement automation), but the gold is its LinkedIn **pacing** and engagement modules.

### File map & review
| File (LOC) | What it does | Use in SJA |
|---|---|---|
| `workflows/linkedin_automation/pacing/typing_human.py` (102) | **Human typing governor**: uniform jitter per keystroke (`human_type`), rich keyboard path with **key-class micro-pauses** (space/newline 0.04–0.22 s; `.,!?;:` 0.12–0.38 s; `/` 0.08–0.2 s), **hesitation bursts** (6 % → 0.25–0.9 s; 1.5 % → 0.9–1.8 s), comment-vs-paste policy by length (≤72 chars 82 % human … >160 28 %), dynamic type() timeout scaling | **H — DIRECT.** SJA's mimic-user types char-by-char with uniform random delay only; adopting key-class + hesitation cadence + policy is best-of-both. |
| `pacing/delays.py` (43) | `pause_uniform`, **equal-jitter** backoff (OpenOutreach shape), `seconds_until_local_midnight` | **H — DIRECT.** SJA `network-retry`/rate-governor can gain equal-jitter. |
| `pacing/scheduler.py` (133) | Scheduled run pacing (start/stop windows, per-action cadence planner) | **M**. |
| `workflows/linkedin_automation/engage.py`, `post_comment.py` (598), `search_posts.py` (1410), `fetch_next_post.py`, `like_post.py`, `read_post_comments.py`, `send_connection_request.py` | LinkedIn *engagement* automation (search/posts/comment/like/connect) | **L** for SJA (job apply product), though `fetch_next_post`/`search_posts` pagination + activity pacing is reusable logic. |
| `workflows/discover-ui-surface/assets/har_to_map.py` (411) + `observe_session.py` (622) + `shared_utils/traffic_sniffer.py` (417) | Record a browser session (HAR/network) → map UI surface; session observing | **M** — complements SJA learning agent. |
| `runtime/*`, `tool_connections/*` | Agent runtime + SSO/tool connectors (Google, Slack, M365, Salesforce) | **L** — out of product scope. |

### Adaptation plan (DIRECT, best-of-both) — **LANDED (Adaptation 5)**
1. Core `human-pacing.ts`: TS port of the governor + equal-jitter helpers merged with SJA's existing `humanTiming` semantics; 12/12 unit tests, wired into applier `page-fill.ts` (real-Chromium fill integration passed). See `ADAPTATIONS_LOG.md` #5. Remaining: adopt `equalJitterDelay*`/`secondsUntilNextLocalMidnight` in SJA `network-retry`/`rate-governor` (next cycle).

---

## 5. AutoApplyMax (AGPL — FLAG; concepts already adapted)

Owner: Azoo92i. JS Chrome extension (~5k LOC, French UI). AGPL-3.0 → no code copied into SJA. Capabilities captured earlier and adapted **clean-room** into SJA core `job-gating.ts` (blacklist/experience filters), `session-guardrails.ts` (daily-limit wall + stall watchdog), `global-assignment.ts` context, plus `ApplyOutcome` `daily-limit`.

| File | What it does | SJA state |
|---|---|---|
| `content-simple.js` (1975) | Click-through apply loop; per-click activity stamp + `STUCK_TIMEOUT` stuck detection; **daily-limit wall phrase matcher** on body + modal/toast/feedback containers; resume upload; company-follow checkbox handling; "no logo, no apply" | Wall detection → **Adaptation 4**; stuck watchdog → **Adaptation 4**; apply-loop decisions inform pipeline. Company-follow marketing checkbox skip → mirrors SJA Easy-Apply safety test. |
| `popup.js` (565), `popup-improvements.js` (459) | Session start/stop UI, applied/skipped counters, status display, validation, onboarding | SJA dashboard already covers; storage-driven counters pattern noted. |
| `background.js` (30) | Service worker: storage init (`isRunning`, counters, `appliedJobs`) + increment/set message API | SJA `app-state` equivalent exists. |

## 6. first2apply (MIT — DIRECT)

Owner: beastx-ro. Monorepo (Next.js + Supabase edge functions + Electron "desktopProbe"), 275 TS/TSX files ~28k LOC.

### File map & review (most useful to SJA)
| File (LOC) | What it does | Use in SJA |
|---|---|---|
| `apps/backend/supabase/functions/_shared/parsers/linkedin.ts` (699) | LinkedIn **jobs-search HTML/API parser** (title, company, location, date, URL, salary when present) → normalized Job objects | **H — DIRECT** candidate for SJA collectors; validate against SJA scraper tests. |
| `_shared/jobListParser.ts` (1379) | Multi-board job list parser (several job sites) | **H** — extend SJA ATS/board adapters corpus. |
| `_shared/jobDescriptionParser.ts` (668) | JD field extraction (skills/salary/remote/experience) | **M** — SJA `jd-analyzer` already strong; harvest techniques. |
| `_shared/customJobsParser.ts` (417) | Custom/user-submitted job link parsing | **M**. |
| `apps/desktopProbe/src/server/jobScanner.ts` (453) | Desktop job scanning/probing flow | **M**. |
| `apps/invoiceDownloader/.../invoiceManagement.ts` (791) | Invoicing | **L** — out of scope. |
| `libraries/ui`, `apps/desktopProbe/src/components/*` | React UI for job tabs/details/notes | **L** — SJA has its own UI. |

### Adaptation plan (DIRECT) — **LANDED (Adaptation 9)**
1. `linkedin-results.ts` ported the multi-version results-layout strategy + no-results detection + date normalization into core (7/7 tests) and wired it into applier `collectCards` (fast no-results exit + versioned container wait). JD/listing field-set already covered by SJA collectors/JD analyzer — no further normalization port needed.

## 7. job-copilot (no LICENSE — FLAG / clean-room at most)

Owner: AhmadSaleh22. TS microservices monorepo (~956 LOC code). README claims MIT but **no LICENSE file shipped** → treat as clean-room.
Services: `job-fetcher` (RemoteOK source, `matchJobs.ts` scoring, JWT auth), `profile-manager` (CV upload, preferences, Prisma), `job-notifier` (cover letter via LLM, email, pub/sub via GCP), terraform, domain-events lib.
SJA value: **M/L** — patterns (pub/sub eventing, preference-driven job matching, cover-letter generation) exist in SJA already. Nothing new worth copying; no code copied.

## 8. FormFilla / R10 (Proprietary — DOC-ONLY)

Owner: Ahmad Hassan (B-Ted). Repo = public documentation, issue tracking, release hub; **core is closed-source** (no CRX obtainable in sandbox). License matrix: Proprietary.
Documented architecture (from README + store listing) worth comparing to SJA:
- Recursive DOM scan incl. same-origin frames → find inputs/selects/textareas.
- **Repeated-block detector** for School/Work card grids (multi-instance experience/education rows).
- Signal extraction (label/placeholder/id/name) → normalizer (tokenize, case, abbreviation expansion) → tokens.
- **Kuhn-Munkres maximum-weight bipartite matching** (global, not greedy) — matches our Adaptation 1 `global-assignment.ts`.
- Local-first, in-memory; multi-page forms; framework-agnostic (React/Vue/Angular), file uploads; Hungarian mapping.
SJA status: Adaptation 1 re-implements the matching concept; block-detector idea for repeating work/education rows is a candidate enhancement to our page-scan (worth scoping next cycle). Functional behavior Not Verified (closed source).

## 9. job-bot-ollama (no LICENSE — DOC-ONLY)

Owner: lookr-fyi. Repository contains **no application code** — marketing/landing + release notes for hosted "JobHuntr" desktop agent (Universal company-career-page apply, LinkedIn profile audit, ATS resume threshold, Infinite Hunt, multi-board search). Nothing to copy; product direction notes:
- "Company career page apply on any website" → validates SJA's generic ATS adapter ambition.
- "ATS Resume Threshold" tuning → SJA resume optimization config idea.

---

## 9A. LLM code-level survey (across all references)

| Repo | LLM files | What they do | SJA disposition |
|---|---|---|---|
| Auto_job_applier_linkedIn (MIT) | `modules/ai/connections.py` (298), `modules/ai/prompts.py` (50) | Provider-agnostic LangChain client (OpenAI-compatible incl. Ollama/LM Studio/DeepSeek + Gemini); **five-bucket structured skill extraction** with plain-JSON fallback; **LangGraph answer pipeline** that grounds on user_information + JD + company + options and then deterministically **snaps the answer onto an allowed option** (exact → case-insensitive → substring); error dialogs + critical-error log | **DIRECT — Adaptation 10 (llm/robust.ts)**: snapAnswerToOptions, parseModelJson, SKILL_EXTRACTION_SYSTEM, extractSkillsStructured, normalizeSkillBuckets. `answerQuestion` now snaps replies onto real options. |
| first2apply (MIT) | `_shared/openAI.ts`, `_shared/advancedMatching.ts` | OpenRouter routing with `provider.require_parameters` (structured outputs never silently degrade), reasoning off, **real-cost in usage + list-price fallback**, per-user usage logging RPC; LLM blacklist-company/exclusion decisions against a user prompt | **DIRECT — Adaptation 10**: `estimateCallCostUsd` (reported→estimated→zero). Advanced-matching prompt-exclusion overlaps SJA job-gating (Adaptation 2) + job-recommendation — no new port. |
| 10xProductivity (MIT) | `runtime/agent_clients/claude.py`, `cursor.py`, `tool_connections/google-ai-mode/google_ai_mode.py` (534) | Drive Claude Code / Cursor agent CLIs and Google AI-mode SSO browsing for engagement workflows | Out of product scope (agent runtime, not job apply). No adaptation. |
| job-copilot (no LICENSE) | `services/job-notifier/src/coverLetter.ts` | LLM cover-letter generation in a notifier service | Clean-room only; SJA cover-letter generation already stronger. No adaptation. |
| FormFilla (proprietary) | README only | Explicitly **no AI** (deterministic matching) | Documented; feeds Adaptation 1 context. |
| autoApplylinkedin, AutoApplyMax, job-bot-ollama | — / docs | No substantive LLM code (AutoApplyMax + autoApplylinkedin are heuristic DOM; JobHuntr is closed hosted) | None. |

**SJA-native LLM layer (context for best-of-both):** `packages/core/src/llm/*` —
adapters (Anthropic/OpenAI-compatible/Ollama/Null), cache, `LLMRateLimiter`,
CostRouter (complexity-tier pre-routing), `answerQuestion` (resume-grounded,
options prompt, fallback). Adaptation 10 adds what was missing: deterministic
post-snap, robust JSON fallback for structured extraction, and call-cost
estimation.

---

## 10. Synthesis: cross-repo capability map → SJA gap actions

| SJA area | References with capability | Action |
|---|---|---|
| Screening-question answering | Auto_job_applier_linkedIn (#1) | **DIRECT**: `screening-answers` core module LANDED (Adaptation 6); applier wiring pending policy-gate bridge |
| Human-like typing/pacing | 10xProductivity (#4), AutoApplyMax (AGPL) | **DIRECT**: `human-pacing` core module LANDED (Adaptation 5); equal-jitter applied to `network-retry` |
| Field matching | autoApplylinkedin (non-commercial), FormFilla (docs), SJA `global-assignment` | clean-room scorer LANDED (Adaptation 7: field-similarity, Jaro-Winkler/bigram/token blended + bestOptionMatch, wired into applier fuzzyPickOption); block-detector still scoping |
| LLM answer robustness / cost tracking | Auto_job_applier_linkedIn (MIT) + first2apply (MIT) | **DIRECT** LANDED (Adaptation 10: llm/robust.ts — option snapping, model-JSON parsing, 5-bucket structured skill extraction, call-cost estimate; wired into answerQuestion) |
| QA oracle / fixtures | job-apply-plugin (#3) | **DIRECT**: fixture contract schema + field catalog LANDED (Adaptation 8: qa-fixtures validator, 8/8 tests); oracle-replay lane still roadmap |
| Daily-limit + guardrails | AutoApplyMax (AGPL) | done clean-room (Adaptations 2/4) |
| Listing/JD parsing | first2apply (#6) | **DIRECT**: results-layout strategy LANDED (Adaptation 9: linkedin-results, 7/7 tests, wired into collectCards); JD field-set already covered |
| Job fetch/match/notify | job-copilot (FLAG) | none (clean-room only; low value) |
| LinkedIn engagement (posts/comments) | 10xProductivity | out of scope (not job apply) |

## 11. Execution & test status (function-by-function)
Maintained in `ADAPTATIONS_LOG.md`. Each landed module ships its own node:test suite registered in the core `npm test` script; applier/extension typechecks + headed MV3 integration battery (57/57 after the §9B sink-audit additions) gate every integration.

## 9B. Side-panel & page-fill sink audit (product wiring — no reference code)

Verdict from a full source trace + headed MV3 verification (user doubt: "side panel and
information filling in main website has no sink"):

**The in-page docked panel IS a live bidirectional sink (proven, was real before this audit).**
`lib/orchestrator/autofill-runner.ts` (runAutofill) maps every `onProgress` → `panel.setStatus`,
every filled field → `panel.addFillLogEntry` + persisted fill history, and post-run →
`setMissingFields` + `setNeedsUser` + status summary + `scheduleStepRefill`; `track` runs also
`addApplication` to `chrome.storage.local`. `lib/side-panel.ts` (React path, flag `reactPanel=true`)
forwards all handle calls into `panel-react/panel-store.ts` (useSyncExternalStore); the panel
components re-render live. Panel buttons bind to real closures (runAutofill / fillField +
profile persist + engine resume / clickNext / submit / cancel countdown). Field fill itself is
reconciled by `verifyFill` read-back + retries in `lib/filler.ts`.

**Two genuine disconnects found and FIXED (this audit):**

1. **Browser side panel stayed stale while open.** `entrypoints/sidepanel/SidePanelApp.tsx` loaded
   profile/applications once at mount and never listened for storage writes, so a fill performed
   while the panel was open never appeared until close/reopen.
   Fix: `loadSnapshot` reload + `chrome.storage.onChanged` (area `local`, 150 ms trailing debounce)
   + window-focus active-tab refresh.

2. **First user-facing fill/score command was a dead click when the content agent hadn't been
   injected into the tab yet.** `SJA:INJECT_ORCHESTRATOR` is content-only by design (security), so
   popup/sidepanel `SJA:AUTOFILL`/`SJA:GET_MATCH` sent too early were consumed by the `<all_urls>`
   gatekeeper (which triggered injection but never answered) → raw "message port closed" error and
   no fill. Fix: `sendToActiveTabWithBootstrap` in `lib/ui.ts` — try direct, else poke
   `SJA:INJECT_ORCHESTRATOR` at the tab / fall back to executing `content-scripts/content.js`, then
   poll the action until the booted agent answers. Wired into popup `api.autofill/match` and the
   side panel Autofill/Check-match actions.

**Verification:** new headed MV3 assertion set in `integration/extension-real-browser.test.ts`
(fixture pre-onboarding-complete): docked panel mounts and shows live status + fill log
("First Name", "Fill Log", "filled") after `SJA:AUTOFILL`; the already-open browser side panel
Tracker live-updates to the new application without reload; fill history persisted. New unit
regression `integration/ui-bootstrap.test.ts` (6 cases: fast path, inject-then-retry,
executeScript fallback, bounded give-up, non-retryable passthrough, non-http rejection).
Gates after fixes: typechecks 0, core 105/105, headed MV3 integration 57/57 (0 skipped), Docker
37/37, secrets clean. Release zip refreshed (`SuperJobAgent_v0.1.4-chrome-mv3-final.zip`).

## 9C. Enterprise UI iteration (product — no reference code)

One visual language across user-facing surfaces with zero functionality loss:
- Browser side panel (`entrypoints/sidepanel/SidePanelApp.tsx`) rebuilt as a dark enterprise
  workspace (ambient depth, brand mark, segmented nav + focus rings, active-page/agent-control
  card, gradient CTA, pipeline stats, stage-accented tracker cards, profile card w/ avatar +
  skill chips, trust cards). All user-visible strings and semantics preserved so the headed
  MV3 regression assertions still pass unchanged.
- In-page docked panel design tokens refined (`panel-react/panel-theme.css` — deeper surface
  ramp, refined borders, antialiasing + font-features, softer panel shadow).
- Popup shell polished to a light enterprise console (`entrypoints/popup/App.tsx`: brand
  header, gradient active nav, breadcrumb toolbar, structured error surface). Tab internals
  untouched.
- Screenshots from real Chromium: `/home/user/ui-shots/{01-popup,02-sidepanel-today,
  03-sidepanel-tracker,04-sidepanel-profile,05-job-page-with-panel,06-docked-panel}.png`.
- Re-verified after UI: typechecks 0; core 105/105; headed MV3 integration 57/57 (0 skipped);
  Docker 37/37; secrets clean. Release zip refreshed (sha `f42e8ebc…`).
