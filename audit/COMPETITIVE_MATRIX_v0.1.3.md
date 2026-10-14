# Master Competitive Matrix — Super Job Agent v0.1.3 (condensed)

Legend: ✅ shipped & verified · 🟡 shipped, needs live-site verification · ❌ absent

## Scope of comparison
Every row below compares SJA against the **9 repositories actually shallow-cloned and structurally analyzed**
in `/tmp/refs` during this project (capability presence assessed from their real source trees, not marketing):

| Clone | Identity (from its own README/name) | License (actual file) |
|---|---|---|
| `FormFilla` | Form-filling engine | Proprietary — "All rights reserved" |
| `autoApplylinkedin` | "Easy Apply LinkedIn" Chrome extension | MIT text **restricted to personal, non-commercial** use |
| `Auto_job_applier_linkedIn` | LinkedIn auto-applier | MIT |
| `job-apply-plugin` | Job apply plugin | MIT |
| `10xProductivity` | Multi-agent productivity/job tooling | MIT |
| `first2apply` | First-2-Apply (job agent) | MIT |
| `AutoApplyMax` | Auto-apply system | AGPL-3.0 |
| `job-bot-ollama` | "JobHuntr" — resume-in/interviews-out autopilot | no license file |
| `job-copilot` | "JobCopilot" — event-driven ATS job-matching backend | no license file |

## Capability comparison
| Capability | SJA v0.1.3 | Best external reference (of the 9) | Notes |
|---|---|---|---|
| Deterministic field-label classification (label→canonical key) | ✅ `resolver.ts` (~60 patterns) | FormFilla | SJA is local/deterministic; FormFilla proprietary — study-only |
| Multi-signal matching (label+name+id+placeholder+aria) | ✅ `schemas.buildResilientSelectors` + detector chain | FormFilla / JobHuntr (`job-bot-ollama`) | fallback chain ordered, cache-backed |
| Per-site ATS configs (18 sites: Workday, Greenhouse, Lever, Ashby, iCIMS, Oracle, Avature + India boards) | ✅ chunks + web-accessible lazy load | autoApplylinkedin / job-apply-plugin | SJA breadth is wider |
| Pattern/selector memory (learns per host, IDB, TTL) | ✅ `pattern-cache.ts` (14-day TTL) | — | no reference offers this |
| Repeated-block / list-field detection | 🟡 `entity-processor`, `dom-deep-scan` | FormFilla | needs live validation |
| Generic (non-ATS) job detection (JSON-LD/OG) | ✅ `generic-detector.ts` | — | differentiator |
| Iframe (cross-origin form) filling | ✅ `iframe-manager.ts` + `iframe-autofill.ts` | FormFilla | |
| LinkedIn Easy Apply click→fill→advance→submit w/ confirm | 🟡 `linkedin-autopilot-engine.ts` | autoApplylinkedin / Auto_job_applier_linkedIn | needs live LinkedIn session |
| External ATS hand-off (never hijack jobs tab) | ✅ prompt+bg-tab, user-controlled | autoApplylinkedin | deliberate anti-pattern fix |
| Humanized interaction (mouse paths, timing) | ✅ `mouse-path`, `human-timing`, `mimic-user` | — | stronger than refs |
| Rate governance / stagnation / CAPTCHA pause | ✅ `rate-governor`, `stagnant-detector` | JobHuntr / AutoApplyMax | |
| Review-first safety defaults (explicit opt-in) | ✅ (fixed this cycle) | — | enforced by integration test |
| Application tracker + status machine + dedupe | ✅ `lifecycle/*`, `app-state`, `submit-guard` | JobHuntr (`job-bot-ollama`) | duplicate-application prevention |
| Resume tailoring (job-specific DOCX) | ✅ `docx.ts`, `resume-version` | JobCopilot / JobHuntr | |
| ATS-scoring / readiness / risk advice | ✅ `ats.ts`, `application-readiness`, `job-risk` | AutoApplyMax / JobHuntr | |
| India-specific engine (Naukri CTC/notice/visa, India Coach) | ✅ `india-intelligence`, `salary-engine` | — | clear differentiator (user locale: India) |
| Local-first, no-LLM fast path | ✅ matcher/resolver run locally; LLM optional | 10xProductivity | privacy + cost |
| Agent crew (researcher/scorer/tailor/applier) + scheduler | ✅ `crew` + `event-scheduler` | 10xProductivity / job-apply-plugin | |
| Email monitor + auto-reply for application emails | ✅ `email-monitor` (IMAP/SMTP, tracker-sync) | — | differentiator |
| Dashboard (popup 9 tabs + side panel + in-page panel) | ✅ | JobCopilot | |
| CLI applier + scraper aggregators (Indeed/RemoteOK/Arbeitnow/Naukri…) | ✅ | first2apply | first2apply MIT |
| Credential vault + login/OTP agent | 🟡 `credential-store`, `login-coordinator` | — | round-trip untested live |
| Telemetry with PII anonymizer | ✅ `telemetry/anonymizer.ts` | — | privacy-preserving |

## License posture (why nothing was copied)
Study-only (never mergeable without permission): **FormFilla** (proprietary), **autoApplylinkedin** (MIT text but
explicitly personal & non-commercial only), **JobHuntr/job-bot-ollama** and **JobCopilot/job-copilot** (no license
file → no rights granted). Permissive references: **10xProductivity, first2apply, job-apply-plugin,
Auto_job_applier_linkedIn** (MIT). Copyleft: **AutoApplyMax** (AGPL). All capabilities above were
**independently re-implemented concepts** in SJA's own architecture — no external source file was merged into the
project, so none of these obligations attach. Capability parity was used only as a specification aid.
