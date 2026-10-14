# Super Job Agent — Complete Repository Intelligence, Competitor Reverse Engineering, and Rebuild Roadmap

**Audit date:** 2026-07-02  
**Workspace root audited:** `project_input/extracted/super-job-agent`  
**User constraint honored:** every file outside `node_modules` was inventoried/read programmatically; `node_modules` was intentionally excluded. Binary assets were inspected as file artifacts with metadata/hash/size because they do not contain line-readable source text.  
**Primary detailed inventory:** `audit/generated/file_inventory.csv` and `audit/generated/file_inventory.json`  
**Manifest summary:** `audit/generated/manifest_summary.json`  
**Dependency audit:** `audit/generated/npm-audit.json`

---

## 0. Executive Decision

Super Job Agent is already a serious Chrome-extension monorepo, not a toy project. It contains:

- local-first profile/resume/intelligence core,
- Chrome MV3 extension built with WXT + React,
- ATS configuration package,
- automation/applier package,
- scraper, crew, email monitor, analytics,
- generated production extension output,
- competitor CRX extracts and prior Markdown reports.

The current biggest product opportunity is **not** to copy competitor code. It is to combine the best observed competitor patterns into a smaller, safer, faster, local-first job application operating system:

1. Jobscan-style low-friction save/scan buttons and remote selector cache.
2. Teal-style persistent side panel and tracker UX.
3. Jobright/Simplify-style broad ATS intelligence, but lazily loaded only on job pages.
4. JobWizard-style referral agent, chat, keyboard shortcuts, demo mode, and voice-like assisted workflow.
5. Huntr-style application pipeline and notes.
6. LinkedIn Resume Builder-style localization/minimal permission discipline.
7. JobOwl-style lightweight popup with server-state caching and clean toasts.
8. Super Job Agent’s own local-first profile, resume parsing, Indian-market intelligence, and autonomous agent modules.

The current project should be rebuilt incrementally around a **thin always-on detector + lazy feature modules + trusted side panel + typed message bus + policy-gated autopilot** architecture.

---

## 1. Scope Verification

### 1.1 Files inspected

Inventory run excluding `node_modules`:

- **Files read/inventoried:** 1,557
- **Total bytes:** 117.68 MB
- **Text/readable files:** 1,370
- **Binary/assets:** 187

Top-level file counts:

| Area | Files |
|---|---:|
| `packages` | 673 |
| `crrrrrrx` | 577 |
| `zippi` | 127 |
| `zippia-extract` | 114 |
| `test` | 35 |
| `integration` | 10 |
| `docker` | 7 |
| `error` | 3 |

Extension/file-type counts:

| Extension | Count |
|---|---:|
| `.svg` | 356 |
| `.ts` | 317 |
| `.map` | 208 |
| `.js` | 197 |
| `.json` | 132 |
| `.png` | 115 |
| `.css` | 41 |
| `.tsx` | 25 |
| `.html` | 16 |
| `.md` | 12 |
| `.zip` | 8 |

The full file-by-file data is in `audit/generated/file_inventory.csv`. It includes path, purpose, dependencies/imports, exports, browser APIs, side effects, risk signals, maintainability score, risk level, and refactoring suggestion.

---

## 2. Repository Architecture Audit

### 2.1 Monorepo packages

| Package | Purpose | Key observation |
|---|---|---|
| root `super-job-agent` | workspace orchestration | Broad scripts for extension, core, apply, crew, docker, scraper, email monitor |
| `@superjob/core` | local-first profile/resume/matching/LLM logic | Strong domain model; tests pass; includes sensitive profile fields |
| `@superjob/extension` | WXT Chrome extension | Rich feature set, large content/orchestrator logic, broad permissions |
| `@superjob/ats-config` | ATS detection/scanning/autofill config | Best architectural package; should become canonical ATS engine |
| `@superjob/applier` | Playwright/job application automation | Useful for backend/desktop automation but high risk if mixed with extension autopilot |
| `@superjob/scraper` | job discovery/search | Can become discovery feed source |
| `@superjob/crew` | campaign scheduling | Needs strong rate/ethics controls |
| `@superjob/email-monitor` | email status monitoring | Valuable retention feature; introduces credential/privacy risk |
| `@superjob/analytics` | event bus/metrics | Should be privacy-preserving and opt-in |

### 2.2 Extension architecture currently observed

Important files:

- `packages/extension/wxt.config.ts`
- `packages/extension/src/entrypoints/background.ts`
- `packages/extension/src/entrypoints/content.ts`
- `packages/extension/src/entrypoints/orchestrator.content.ts`
- `packages/extension/src/lib/orchestrator.ts`
- `packages/extension/src/lib/side-panel.ts`
- `packages/extension/src/lib/autofill.ts`
- `packages/extension/src/lib/filler.ts`
- `packages/extension/src/lib/ats-detector.ts`
- `packages/extension/src/lib/autopilot/*`
- `packages/extension/src/lib/auth/*`
- `packages/extension/src/lib/lifecycle/*`
- `packages/extension/src/lib/panel-react/*`

Current execution flow:

1. `content.ts` loads on `<all_urls>` at `document_idle`.
2. It performs a heuristic check: LinkedIn jobs URL, ATS detection, inputs >= 4 plus job-ish URL.
3. If page appears relevant, it asks background to inject `content-scripts/orchestrator.js`.
4. Background dynamically injects orchestrator using `chrome.scripting.executeScript`.
5. Orchestrator mounts panel, installs network monitor, page observer, user interaction monitor, LinkedIn/external autopilot engines, submit guard, state tracking, and message listeners.

This is directionally good: it is closer to a thin detector + lazy orchestrator than most competitors. However, the detector still runs on all URLs, and broad host permissions remain.

### 2.3 Build/test status

Actions performed:

- Downloaded and extracted project ZIP.
- Installed dependencies with `npm install --ignore-scripts`.
- Ran core tests.
- Ran workspace typecheck.
- Ran npm audit.

Results:

| Check | Result |
|---|---|
| `@superjob/core` tests | Passed: 146 assertions |
| Workspace TypeScript packages | `applier`, `core`, `crew`, `email-monitor`, `scraper` typechecked successfully |
| Extension typecheck | Failed because packaged `packages/extension/node_modules/.bin/wxt` was not executable / permission issue in extracted artifact |
| npm audit | 11 vulnerabilities: 1 low, 2 moderate, 5 high, 3 critical |

Dependency vulnerabilities observed:

| Package | Severity | Notes |
|---|---|---|
| `web-ext-run` | critical | via `fx-runner`, `node-notifier`, `tmp`; fix suggests WXT major upgrade |
| `fx-runner` | critical | via `shell-quote` |
| `shell-quote` | critical | vulnerable range present transitively |
| `wxt` | high | fix available as semver-major `0.20.27` |
| `nodemailer` | high | fix available as major `9.0.3` |
| `tar` | high | via WXT/giget path |
| `tmp` | high | via web-ext-run |
| `esbuild` | low | fix available |

---

## 3. Complete Competitor Reverse Engineering Summary

Detailed competitor reports were read from `crrrrrrx/reports/*.md`, and manifests were separately parsed from extracted extensions.

### 3.1 Competitor manifest comparison

| Competitor | Version | Primary UI | Permissions posture | Key architectural idea | Major risk |
|---|---:|---|---|---|---|
| Simplify Copilot | 2.6.5 | Content overlay + offscreen | Very broad: cookies, webRequest, offscreen, unlimitedStorage, all hosts | Massive remote ATS config, offscreen document, full AI resume/job workflow | Heavy bundles, broad network/connect CSP |
| Huntr | 2.0.45 | Content overlay | Broad HTTP/HTTPS, scripting, unlimitedStorage | Application tracker with rich state, job parser service | jQuery/content SPA on all pages, large bundle |
| Jobright | 1.15.0 | Content overlay | Broad: cookies, DNR, scripting, all URLs | Multi-script architecture, strong filler, Workday/React-select fiber techniques | 6MB content SPA on all URLs, cookie/DNR risk |
| Jobscan | 2.2.8 | Popup + injected iframe/buttons | Best targeted permissions among job-board tools | Very lightweight content script, save/scan buttons, remote selector cache | Limited site support, device-valet auth weakness |
| JobWizard | 1.1.11 | Sidebar/content UI | Broad HTTPS, cookies, scripting | Referral agent, chat, voice signals, keyboard shortcuts, demo mode | 12MB extension, many CSS/assets, broad cookie access |
| LinkedIn Resume Builder | 1.29 | Popup/content on LinkedIn | Minimal: storage + one API host | LinkedIn-focused resume tailoring, 50+ locales | Narrow product, large Ant icon chunk |
| JobOwl | 2.2.1 | Popup | Moderate: storage, activeTab, webNavigation, https hosts | Lightweight Plasmo popup, React Query, toasts | Depends heavily on API; no explicit CSP |
| Teal | 4.0.8 | Chrome Side Panel | Moderate: storage, tabs, activeTab, sidePanel | Persistent side panel, tracker, remote config, badge state | 1.4MB content script on all URLs |
| Zippia extract | 2.9.3 | Content autofill | Very broad: cookies, webRequest, tabCapture, all URLs | Autofill and offscreen/background automation | Very high permission surface |

### 3.2 Best patterns to adapt, without copying code

| Pattern | Source | Adaptation for Super Job Agent |
|---|---|---|
| Thin targeted content script | Jobscan | Keep always-on detector under ~30KB; inject modules only on eligible pages |
| Remote selector/config cache with fallback | Jobscan, Teal, Simplify | Signed ATS config CDN with bundled fallback and version/hash validation |
| Persistent Chrome side panel | Teal | Make side panel the primary dashboard/tracker; popup becomes quick action |
| Badge/status indicators | Teal | Show active job, applications today, blocked state, or quota-free local status |
| Multi-handler background architecture | Jobright | Replace monolithic switch with typed router modules and sender validation |
| Strong ATS/filler patterns | Jobright, Simplify | Keep native setters, event sequence, dropdown/React-select strategies, but sandbox them |
| Referral agent | JobWizard | Build ethical referral discovery with user-confirmed outreach only |
| Demo mode/onboarding | JobWizard, Jobscan | Add interactive demo job page and pin/first-run education |
| Tracker/notes pipeline | Huntr, Teal, Jobscan | Strengthen application CRM: saved/applied/interview/offer/rejected/follow-up |
| Localization | LinkedIn Resume Builder | Add English + Hindi first, then global locales |
| Query/cache model | JobOwl | Use typed local query cache for API/server state and offline mode |

### 3.3 Practices to avoid

- Do not ship multi-megabyte content scripts to every page.
- Do not request `cookies`, `webRequest`, `declarativeNetRequest`, or `tabCapture` unless a specific paid/enterprise feature absolutely requires it.
- Do not use `postMessage('*')` where a specific origin is known.
- Do not depend on React fiber internals as the normal path; use only as last-resort platform adapter with kill switch.
- Do not store raw passwords/API keys unencrypted.
- Do not use unauthenticated remote config.
- Do not auto-submit applications without a visible human confirmation policy.

---

## 4. Competitor Knowledge Graph

```text
Market-winning product =
  Trust + speed + coverage + guidance + tracking + monetization

Trust =
  local-first profile vault
  + minimal permissions
  + explicit autofill preview
  + no surprise submit
  + clear privacy policy

Speed =
  thin detector
  + lazy orchestrator
  + cached ATS configs
  + small side panel chunks
  + no all-page heavy React

Coverage =
  ATS registry
  + remote signed selectors
  + generic scanner
  + dropdown strategies
  + iframe strategy
  + LinkedIn Easy Apply
  + Workday/Greenhouse/Lever/Ashby/iCIMS/etc.

Guidance =
  match score
  + missing-field assistant
  + custom question answerer
  + resume tailoring
  + cover letter
  + salary/location/visa advice

Tracking =
  saved jobs
  + application state machine
  + email monitor
  + follow-up reminders
  + interview prep

Monetization =
  free local autofill
  + premium AI tailoring
  + premium campaigns
  + referral assistant
  + enterprise team dashboard
  + API/ATS config licensing
```

---

## 5. Audit of Current Project Weaknesses

### 5.1 Critical/high-risk issues

| Priority | Issue | Evidence | Root cause | Permanent solution |
|---|---|---|---|---|
| Critical | Broad `<all_urls>` host permission | `wxt.config.ts`, generated manifest | Maximum coverage chosen before permission minimization | Use optional host permissions + runtime injection; default to known job domains |
| Critical | CSP permits `wasm-unsafe-eval` | `wxt.config.ts`, generated manifest | PDF.js worker/wasm convenience | Isolate PDF parsing to extension page/offscreen; remove unless required by tested PDF path |
| Critical | Dynamic script injection from background | `background.ts` `SJA:INJECT_ORCHESTRATOR` | Lazy injection design but insufficient sender/url policy | Validate sender tab URL, only inject on eligible origins, add idempotency and audit event |
| Critical | Message router lacks schema validation and sender authorization | `background.ts`, `message-router.ts` | Ad-hoc message switch evolved organically | Central typed message bus with Zod schemas, sender context, permissions per message |
| Critical | Sensitive profile fields stored in profile model | `packages/core/src/profile.ts` includes PAN, Aadhaar, SSN, passport, default passwords | Product wants full autofill coverage | Split PII vault from general profile; encrypt high-risk fields; never include in LLM context by default |
| Critical | Credential/password features need stronger encryption default | `credential-store`, settings fields | Convenience for auto-login | Require vault passphrase/WebCrypto; never store raw default password |
| High | Autopilot/application automation risks accidental submission | `orchestrator.ts`, `autopilot/*`, submit guard exists | Ambitious autonomous mode | Policy engine: require per-site trust level, preview, countdown, explicit final submit opt-in |
| High | PostMessage fallback still uses `*` inside injected iframe handler | `packages/ats-config/src/iframe-manager.ts` handler script posts to `*` | Cross-origin iframe complexity | Parent-origin nonce handshake; injected handler must echo nonce and target known parent origin |
| High | Large source/config files | `ats-configs-data.ts` 26k lines | Config embedded as TS | Move to compressed JSON chunks with registry index and lazy per-platform loading |
| High | Dependency vulnerabilities | `npm audit` | Old WXT/transitives, nodemailer | Upgrade WXT, nodemailer, lockfile refresh, CI audit gate |
| High | Generated artifacts committed | `.output`, `dist` files present | Build outputs included in archive | Remove from source repo; generate in CI; keep only release artifacts separately |
| High | Duplicate Zippia extracts | `zippi/zippia-extract` and `zippia-extract` | Research artifact duplication | Deduplicate competitor research folders; preserve one canonical copy + notes |

### 5.2 Performance issues

| Issue | Impact | Fix |
|---|---|---|
| Broad detector on all URLs | privacy/perf concern | optional domains + micro-detector only |
| Orchestrator bundle includes many concerns | parse/compile cost | split into `autofill`, `tracker`, `ai`, `linkedin`, `auth`, `panel` chunks |
| `ats-configs-data.ts` 26k lines | bundle bloat | remote/bundled signed JSON per platform |
| Panel implementation duplicated/transitioning | maintainability | choose React side panel as canonical; delete DOM string builder after migration |
| PDF worker in extension output | bundle weight | lazy load only in resume upload path |
| MutationObservers need strict debounce/lifecycle cleanup | CPU leaks on SPAs | central observer manager with disconnect on unload/navigation |

### 5.3 UX issues

| Issue | User impact | Fix |
|---|---|---|
| Too many advanced settings visible | overwhelm | progressive disclosure: Beginner / Power / Enterprise |
| Autopilot trust unclear | fear of accidental applying | visible policy: “never submit without you” default |
| Popup and panel responsibilities overlap | confusion | popup = quick actions; side panel = workspace |
| Onboarding asks API key early | friction | local-first free mode first; AI setup after value moment |
| Missing marketplace-quality demo | lower activation | demo job page + guided autofill simulation |

---

## 6. Root Cause Analysis

| Root cause | Symptoms | Affected modules | Solution |
|---|---|---|---|
| Coverage-first extension design | all URLs, broad host permission, large configs | extension manifest, content scripts, ATS data | permission minimization + signed registry + optional host grants |
| Feature accretion in orchestrator | one large coordinator owns many responsibilities | `orchestrator.ts`, `side-panel.ts` | domain modules + event bus + lifecycle manager |
| PII mixed with general profile | sensitive fields can flow into lookup/LLM | `profile.ts`, stores, resolver | vault separation + field policy + redaction gates |
| Research artifacts mixed with product | build outputs, CRX extracts, generated files | repository root, crrrrrrx, zippia folders | repo hygiene, `/research` ignored, CI-only dist |
| Unvalidated messaging | possible spoof/invalid payloads | background/content/panel | typed message schemas + sender policy |
| Competitor-inspired broad ambition | many features but uneven maturity | autopilot, auth, campaigns, email | staged product tiers and completion criteria |

---

## 7. New Production Architecture

### 7.1 Target architecture

```text
packages/
  core/                  local-first profile, resume, match, answer engine
  vault/                 encrypted PII/credential vault using WebCrypto
  ats-registry/          signed ATS configs, domain registry, platform chunks
  autofill-engine/       DOM scanner, filler, dropdown, iframe, submit policy
  extension/
    src/
      background/
        index.ts
        router.ts
        handlers/*.ts
        permission-policy.ts
        config-cache.ts
        telemetry.ts
      content/
        detector.content.ts       <= tiny always-on detector
        autofill.content.ts       <= runtime injected
        page-save.content.ts      <= runtime injected
      sidepanel/
        App.tsx
        routes/*
      popup/
        App.tsx
      shared/
        messages.ts
        schemas.ts
        permissions.ts
  tracker/               applications, reminders, status machine
  ai/                    prompt versions, LLM router, local cache, evals
  referral/              referral discovery and outreach drafts
  email-monitor/         optional IMAP/Gmail connector
  analytics/             local event bus + opt-in telemetry
```

### 7.2 Runtime flow

1. Tiny detector checks URL/domain/text heuristics without reading sensitive page data.
2. If eligible, it asks background for injection permission.
3. Background validates URL against registry or user-approved optional host permission.
4. Autofill module injects and scans fields.
5. Side panel displays job context, match score, missing fields, and actions.
6. User chooses Fill / Tailor / Save / Track / Ask / Referral.
7. Autofill uses profile lookup filtered by field policy.
8. Sensitive vault fields require explicit unlock.
9. Submit is blocked by default until user confirms.
10. Tracker stores local application record and optional email follow-up monitoring.

---

## 8. Missing Feature Report

High-value features to build/adapt:

| Feature | Inspired by | User value | Monetization |
|---|---|---|---|
| Chrome Side Panel workspace | Teal | persistent job search command center | premium analytics/tracker |
| Save + Scan buttons | Jobscan | one-click save/match on job boards | free activation + premium scan depth |
| Signed remote ATS registry | Jobscan/Teal/Simplify | faster fixes without store updates | enterprise ATS coverage SKU |
| Referral finder | JobWizard | referrals increase interview rate | premium credits |
| Demo mode | JobWizard/Jobscan | activation and trust | conversion |
| Localization | LinkedIn Resume Builder | India/global adoption | market expansion |
| Application CRM | Huntr/Teal | retention | premium pipeline/followups |
| Email outcome monitor | current project | automatic status updates | premium automation |
| Interview prep pack | Super Job Agent + competitors | downstream value | premium |
| Company intelligence | JobWizard | informed applications | premium |
| Resume versioning and A/B outcome tracking | current project + Jobscan | improve conversion over time | premium analytics |

---

## 9. Business Opportunity Report

### 9.1 Positioning

**“The private AI job application co-pilot that fills applications, tailors resumes, finds referrals, and tracks outcomes — without selling your career data.”**

### 9.2 Free tier

- Local profile vault.
- Basic autofill.
- Save jobs.
- Basic tracker.
- Limited match scores.
- Manual final submit only.

### 9.3 Premium tier

- AI custom answers.
- Resume tailoring and versioning.
- Cover letters.
- Referral finder.
- Email follow-up/status automation.
- Advanced ATS coverage.
- Interview prep.
- Outcome analytics.

### 9.4 Enterprise/campus tier

- Team dashboard.
- Placement cell analytics.
- Resume quality scoring.
- Private model/API gateway.
- ATS-config API.
- Compliance controls.

---

## 10. File-by-File Implementation Plan

The exhaustive file-by-file inventory is in `audit/generated/file_inventory.csv`. Implementation should proceed by module, not random patching.

### 10.1 Keep and harden

| Area | Files | Action |
|---|---|---|
| Core profile/resume/match | `packages/core/src/*` | Keep; add vault redaction and more tests |
| ATS engine | `packages/ats-config/src/*` | Keep; fix iframe postMessage nonce/origin; split config |
| Extension lazy injection concept | `content.ts`, `background.ts` | Keep; add URL policy and message validation |
| Lifecycle/status machine | `packages/extension/src/lib/lifecycle/*` | Keep; make central status source |
| Panel React components | `packages/extension/src/lib/panel-react/*` | Promote to canonical side panel UI |

### 10.2 Refactor heavily

| Area | Files | Refactor |
|---|---|---|
| Orchestrator | `packages/extension/src/lib/orchestrator.ts` | Split into feature coordinators; keep only lifecycle wiring |
| Side panel DOM builder | `packages/extension/src/lib/side-panel.ts` | Replace with React/sidePanel API; remove string DOM mutation paths |
| ATS data | `packages/extension/src/lib/ats-configs-data.ts` | Convert to JSON chunks + schema validation + lazy load |
| Store/credentials | `store.ts`, `credential-store.ts`, `auth/*` | Move sensitive fields to encrypted vault |
| Messaging | `message-router.ts`, `messaging.ts`, background switch | One typed router with Zod schemas and sender validation |
| Autopilot | `autopilot/*`, `linkedin-autopilot.ts` | Add policy engine, trust levels, final-submit confirmation |

### 10.3 Remove from source repository

| Area | Reason |
|---|---|
| `packages/*/dist` | generated build outputs |
| `packages/extension/.output` | generated extension output |
| duplicate `zippi/zippia-extract` or `zippia-extract` | duplicate research artifact |
| competitor ZIPs inside product repo | move to research archive not production source |
| `node_modules` | should never be committed/distributed as source |

---

## 11. Step-by-Step Rebuild Roadmap

### Phase A — Safety and repo hygiene, 1–2 days

1. Move CRX extracts and generated reports under `/research` or external artifact storage.
2. Remove generated `dist`, `.output`, and bundled `node_modules` from source repo.
3. Upgrade WXT and vulnerable dependencies.
4. Add CI: install, typecheck, test, audit, build extension.
5. Add `.npmrc`/lockfile hygiene and reproducible builds.

### Phase B — Permission and security hardening, 2–4 days

1. Replace default `<all_urls>` host permission with optional permissions plus known job-board allowlist.
2. Validate every runtime message payload and sender.
3. Add explicit CSP without unnecessary eval/wasm exceptions unless proven required.
4. Build encrypted vault package.
5. Redact sensitive profile fields before LLM calls.
6. Fix iframe postMessage target origins and nonce handshake.

### Phase C — Product shell, 4–7 days

1. Implement side panel as primary workspace.
2. Popup becomes quick action launcher.
3. Add onboarding/demo mode.
4. Add job save/scan buttons on LinkedIn/Indeed/Greenhouse/Lever first.
5. Add trust indicators and “never submit without confirmation” default.

### Phase D — ATS/autofill excellence, 1–2 weeks

1. Split ATS registry into signed chunks.
2. Add per-platform tests with HTML fixtures.
3. Harden dropdown strategies.
4. Add iframe scanner/filler tests.
5. Add Workday/Greenhouse/Lever/Ashby/iCIMS/Phinom first-class adapters.
6. Add missing-fields assistant.

### Phase E — AI and monetization, 1–2 weeks

1. Prompt versioning and structured outputs.
2. Local LLM result cache.
3. Resume tailor pipeline.
4. Cover letter/outreach generator.
5. Referral finder.
6. Premium gating and usage accounting.

### Phase F — Chrome Web Store readiness, 3–5 days

1. Permission justification document.
2. Privacy policy.
3. Store screenshots/demo video.
4. Accessibility pass.
5. Performance budget proof.
6. Security review checklist.

---

## 12. Test Strategy

Required test layers:

| Layer | Tests |
|---|---|
| Unit | profile lookup, field policy, detectors, scanner, filler, dropdown matcher, ATS registry |
| Integration | background-content-panel messaging, storage/vault, config cache, LLM cache |
| E2E | LinkedIn Easy Apply, Greenhouse, Lever, Workday, generic form, iframe form |
| Security | message sender spoof tests, postMessage origin tests, vault redaction tests, CSP tests |
| Performance | content detector parse budget, orchestrator lazy-load time, memory after SPA navigation |
| Regression | fixture suite for every supported ATS platform |
| Failure injection | network failure, stale DOM, iframe timeout, service worker restart, storage quota |

Acceptance gates:

- Detector content script under 30KB gzip.
- No all-page heavy UI injection.
- No raw credential storage.
- No final submission without explicit user policy.
- 90%+ unit coverage for core/autofill/ATS packages.
- E2E green on top ATS platforms.

---

## 13. Deployment Strategy

1. GitHub Actions or equivalent CI.
2. On PR: install, typecheck, unit tests, integration tests, lint, audit.
3. Nightly: Playwright E2E against fixtures and controlled demo pages.
4. Release branch: WXT build + zip + manifest validation.
5. Store staged rollout: 5% → 25% → 100% with crash/error monitoring.
6. Remote ATS config rollout separately with signature/hash and kill switch.
7. Maintain rollback package for previous stable extension.

---

## 14. Chrome Web Store Readiness Checklist

- [ ] Manifest MV3 compliant.
- [ ] No unnecessary `<all_urls>` by default.
- [ ] Permission justification for every permission.
- [ ] Privacy policy explains local-first storage, AI calls, telemetry opt-in.
- [ ] No remote executable code.
- [ ] CSP explicit and minimal.
- [ ] Host permissions optional or narrowed.
- [ ] Icons 16/32/48/128 complete.
- [ ] Screenshots show value without misleading automation claims.
- [ ] Autofill does not auto-submit by default.
- [ ] User can export/delete data.
- [ ] Sensitive fields encrypted or excluded by default.
- [ ] Accessibility: keyboard navigation, contrast, labels.
- [ ] Performance budget documented.

---

## 15. Risk Register

| Risk | Severity | Probability | Mitigation |
|---|---|---:|---|
| Chrome review rejects broad permissions | Critical | High | optional permissions and clear justifications |
| Autofill fills wrong sensitive field | Critical | Medium | field policy, preview, confidence threshold, vault unlock |
| Autopilot submits unintentionally | Critical | Medium | submit guard, final confirmation, disabled by default |
| Remote config compromise | Critical | Low/Medium | signed configs, pinned public key, kill switch |
| ATS DOM changes break autofill | High | High | fixture tests, remote config, fallback generic scanner |
| Service worker lifecycle loses state | High | Medium | persistent state machine and idempotent messages |
| LLM hallucinated answers | High | Medium | structured outputs, profile-grounded prompts, user review |
| Dependency vulnerabilities | High | Medium | automated audit and scheduled upgrades |
| Bundle bloat slows pages | High | High | strict budgets, lazy load, chunking |
| Privacy trust loss | Critical | Medium | local-first defaults, transparent data controls |

---

## 16. Prioritized Execution Backlog

### Critical

1. Remove generated artifacts and `node_modules` from source.
2. Upgrade vulnerable dependencies, especially WXT/web-ext-run and nodemailer path.
3. Add typed message validation and sender authorization.
4. Replace default all-host behavior with optional permissions/allowlist.
5. Build encrypted PII/credential vault and LLM redaction policy.
6. Fix iframe postMessage nonce + target-origin protocol.
7. Add CI gates for build/typecheck/test/audit.

### High

1. Promote side panel as canonical UX.
2. Split orchestrator into feature modules.
3. Split ATS configs into lazy signed chunks.
4. Add top ATS fixture tests.
5. Build demo/onboarding flow.
6. Add save/scan button workflow.
7. Strengthen submit/autopilot policy engine.
8. Add application tracker pipeline improvements.

### Medium

1. Add referral assistant.
2. Add resume version A/B tracking.
3. Add email monitor opt-in flow.
4. Add localization framework.
5. Add offline mode for tracker/profile.
6. Add badge indicators.

### Low

1. Visual polish, animations, delightful microinteractions.
2. Additional job boards.
3. Enterprise team features.
4. Public ATS config API.

---

## 17. Implementation Impact Estimates

| Change | Complexity | Performance impact | Security impact | User value |
|---|---|---|---|---|
| Thin detector + lazy modules | Medium | Very high | Medium | High |
| Optional permissions | Medium | Medium | Very high | High trust |
| Encrypted vault | Medium/High | Low | Very high | High trust |
| Typed message bus | Medium | Low | Very high | Reliability |
| Side panel workspace | Medium | Medium | Medium | Very high |
| ATS config chunking | Medium | High | Medium | High |
| Demo/onboarding | Low/Medium | Low | Low | High activation |
| Referral assistant | Medium | Low | Medium | High premium value |

---

## 18. Final CTO Recommendation

Do **not** attempt a one-shot rewrite. The project has too many valuable working modules. The winning strategy is a controlled rebuild:

1. Preserve `core`, `ats-config`, and working autofill logic.
2. Harden security and permissions first.
3. Replatform UX around a modern side panel.
4. Split large logic into lazy feature modules.
5. Add competitor-proven workflows: save/scan, tracker, referral, demo, localization.
6. Make privacy and local-first trust the central market differentiator.

The next implementation step should be **Phase A + Phase B**: repository hygiene, dependency/security upgrades, permission policy, typed messaging, and vault separation. After that, product reinvention can happen safely without shipping a risky extension.
