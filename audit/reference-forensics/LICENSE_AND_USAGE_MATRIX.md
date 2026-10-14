# Reference Repositories — License & Usage Matrix

Date: 2026-09-03 · Authoritative for every copy/adapt decision below.
Method: each clone's `LICENSE` / `LICENSE.txt` / `package.json` `license` field /
README declaration was read directly. Where nothing exists, copyright law's
default ("all rights reserved") applies — copying is not permitted.

| # | Repo (owner / URL) | Head commit (clone date) | Actual license | Copy code into SJA? | Disposition |
|---|---|---|---|---|---|
| 1 | **10xProductivity** (ZhixiangLuo/10xProductivity) | 9a7da40 2026-07-12 | **MIT** (LICENSE, Copyright 2026 10xProductivity Contributors) | ✅ Yes (attribution + MIT notice preserved) | Direct-adapt capabilities; best-of-both with our pacing/mimic |
| 2 | **AutoApplyMax** (Azoo92i/AutoApplyMax) | f712141 2026-04-17 | **AGPL-3.0** | ⚠️ Copyleft — would force SJA distribution under AGPL-3.0 | Concept-only clean-room (already: job gates, limit-wall, filters). Flag for decision if full copy wanted |
| 3 | **Auto_job_applier_linkedIn** (GodsScion/…) | 0ca5550 2026-08-10 (relicense → MIT) | **MIT** (Copyright 2024-2026 Sai Vignesh Golla) | ✅ Yes (attribution preserved) | Direct-adapt question config, salary/CTC math, apply-loop learnings |
| 4 | **FormFilla / R10** (AhmadHassan-BTed/FormFilla) | 9cf587e 2026-07-24 | **Proprietary** — "All rights reserved", closed source; repo is docs/release hub only | ❌ No code exists to copy (docs only) | Analyze documented architecture; clean-room only. Functional behavior Not Verified |
| 5 | **autoApplylinkedin** (IliyaBrook/autoApplylinkedin) | da3cb1a 2026-05-08 | **Custom non-commercial** license (personal & non-commercial only) | ❌ No (SJA is commercial); functionality only | Clean-room re-implementation of fuzzy field-matching concepts; document provenance |
| 6 | **first2apply** (beastx-ro/first2apply) | 1113ae1 2026-08-11 | **MIT** (package.json + LICENSE.txt) | ✅ Yes (attribution preserved) | Direct-adapt parsers (LinkedIn/board listings, JD parsing) + scanner ideas |
| 7 | **job-apply-plugin** (neonwatty/job-apply-plugin) | 370204c 2026-09-01 | **MIT** (Copyright 2025 Jeremy Watt) | ✅ Yes (attribution preserved) | Direct-adapt fixture/oracle contracts + ATS apply policy patterns to our QA/autopilot |
| 8 | **job-bot-ollama** (lookr-fyi/…bot-by-ollama-ai) | 410d6b9 2026-02-15 | **No LICENSE file** (all rights reserved) | ❌ No code in repo | DOCUMENTED/SOURCE UNAVAILABLE — repo = marketing/docs for hosted JobHuntr |
| 9 | **job-copilot** (AhmadSaleh22/job-copilot) | dfde365 2025-07-09 | **No LICENSE file**; README claims "MIT © 2025 Ahmad Saleh" | ⚠️ Ambiguous — claim exists but no grant text shipped | Treat as clean-room unless author ships LICENSE; low priority (CRUD microservices) |

### Rules applied in the analysis doc
- **DIRECT** = code may be brought in (MIT/ISC/BSD/Apache) with required notices kept. Attribution file: `THIRD_PARTY_NOTICES.md` (repo root).
- **CLEAN-ROOM** = no code copied; capability re-implemented independently; provenance noted in module headers and this doc.
- **FLAG** = copyleft (AGPL) or ambiguous license; requires explicit go/no-go (AutoApplyMax, job-copilot).
- **DOC-ONLY** = no source available (FormFilla, job-bot-ollama).

This matrix supersedes the earlier assumption that all references were "proprietary/no-copy": repos 1, 3, 6, 7 are permissively licensed and their code **can** be directly adapted with attribution.
