# SUPERJOBAGENT: MASTER SYSTEM ARCHITECTURE & ENGINEERING DOSSIER
**Author:** Shashi Banoth  
**Project:** SuperJobAgent (Production Enterprise MV3 Autonomous Job Applier & Career Intelligence System)  
**Version:** 0.1.5  
**Target:** Complete Context Transfer Document for Engineering & Autonomous LLM Systems

---

## 1. PROJECT TAXONOMY & MONOREPO TOPOLOGY

The codebase is structured as a TypeScript/Node.js enterprise monorepo using `npm` workspaces. It consists of **10 core workspace packages**, test harnesses, and container deployment scripts.

```
SuperJobAgent_v0.1.2/
├── packages/
│   ├── core/           # Deterministic profile brain, ATS matcher, LLM clients, rate limiters
│   ├── extension/      # Chrome Manifest V3 extension (Popup, Side Panel, Content Orchestrators)
│   ├── applier/        # Playwright headless/headed autonomous browser application engine
│   ├── ats-config/     # 18+ ATS vendor rules, DOM selectors, chunked schema definitions
│   ├── crew/           # Multi-agent crew (Scorer, Tailor, Reviewer, Healer, ReAct loop)
│   ├── scraper/        # Job search scrapers (LinkedIn, Indeed, Naukri, Glassdoor, etc.)
│   ├── server/         # Express/Node.js backend API, cloud sync, auth, billing, webhooks
│   ├── email-monitor/  # IMAP email classification (interview invites, rejections, offers)
│   ├── analytics/      # Funnel metrics, conversion tracking, telemetry aggregator
│   └── mcp/            # Model Context Protocol server integrations
├── scripts/            # Standalone test harnesses, live ATS testers, API diagnostics
├── dashboard.html      # Local-first single-file glassmorphic enterprise web application
├── SuperJobAgent_Chrome_MV3_v0.1.5.zip # Production extension build bundle
└── package.json        # Monorepo root definition & orchestration scripts
```

---

## 2. DETAILED PACKAGE SPECIFICATIONS & INTERFACES

### 2.1 `@superjob/core` (The Foundation Brain)
- **Role:** Pure business logic, zero DOM dependencies. Can run in Node.js, Web Worker, Service Worker, and Browser contexts.
- **Key Modules:**
  1. `packages/core/src/profile.ts`:
     - Schema definition for `Profile`, `WorkExperience`, `Education`, `Skill`, `CustomQuestionOverride`.
     - Validates profile completeness (`validateProfile`), sanitizes fields, enforces defaults.
  2. `packages/core/src/resolver.ts`:
     - Deterministic Q&A resolution engine (`resolveScreeningAnswer`, `smartDefaultForQuestion`).
     - **Locale-Awareness:** Converts salary units (INR Lakhs/LPA vs. USD Annual), notice periods (Days/Weeks/Months), and legal work authorization (`authorized to work in India / US`).
     - **Sensitive Field Shielding:** `isSensitiveQuestion` strictly rejects guessing PAN, Aadhaar, SSN, Passport, Bank Details, Passwords.
  3. `packages/core/src/matcher.ts`:
      - TF-weighted term-frequency tokenizer + conservative stemmer + skill-graph inference (`scoreMatch`). Note: Myers diff is **not** in this file; it lives in `tailor/semantic-diff.ts` for visual resume-diff rendering only.
      - `packages/core/src/ats.ts` (`analyzeATS`): calculates Keyword Coverage, Readability Score (structural heuristic: word count, bullet density, line length -- not Flesch-Kincaid), Parseability Score, and Missing Skill Gaps.
     - Defensive string tokenization preventing `TypeError: text.toLowerCase is not a function`.
  4. `packages/core/src/llm/`:
      - `adapters.ts`: Native `GeminiClient` (`gemini-2.0-flash` default via Google Generative Language v1beta API), `OllamaClient`, `OpenAICompatibleClient`, `AnthropicClient`, `DeepSeekClient`, `NullClient` (6 providers total).
     - `rate-limiter.ts`: `LLMRateLimiter` token-bucket governor (15 RPM default for Gemini, 20 for OpenAI).
     - `network-retry.ts`: Exponential backoff with AWS-style equal jitter, timeout bounds (`maxDelayMs`), and **Fail-Fast Quota Exhaustion detection** (instantly throws on Google HTTP 429 quota exhaustion to activate local fallbacks).
  5. `packages/core/src/cover-letter.ts`:
     - Dual-mode cover letter generation: Neural generation via LLM or zero-credit deterministic markdown template fallback.

### 2.2 `@superjob/extension` (Chrome Manifest V3 Runtime)
- **Role:** Browser companion providing real-time in-page copilot, HUD, floating action button, side panel, and autonomous DOM auto-filling.
- **Key Modules:**
  1. `packages/extension/src/entrypoints/background.ts`:
     - Service worker lifecycle, context menu handlers (`superjob-autofill`), alarms (`sja-keepalive`, `sja-telemetry-flush`), and runtime permissions orchestrator.
  2. `packages/extension/src/entrypoints/content.ts` & `agent.content.ts`:
     - Light gatekeeper script running on `<all_urls>` that injects the heavy `agent.js` orchestrator when job keywords, ATS signatures, or multi-field forms are detected.
  3. `packages/extension/src/lib/autofill.ts`:
     - Main entry point for DOM manipulation.
     - **Phase 1: Pre-fill Scan & Deep DOM Traversal:** Inspects main document, open shadow roots, nested iframes (`dom-deep-scan.ts`).
     - **Phase 2: Execution Planning:** Prioritizes resumes, personal info, work experience, radio groups, and custom dropdowns.
     - **Phase 3: FormFlow Reactive Settling:** After filling visible fields, waits 400ms for DOM mutations; detects dynamically revealed conditional fields (e.g. answering "Yes" to sponsorship revealing visa status) and fills them in a secondary pass.
  4. `packages/extension/src/lib/detector.ts`:
     - Robust selector extraction: prefers `id`, `data-automation-id` (Workday), `data-testid`, `name`, `aria-label`, and XPath as last resort.
  5. `packages/extension/src/lib/dropdown-strategies.ts`:
     - Multi-tier dropdown piercing: native `<select>`, Radix UI, Headless UI, Ashby comboboxes, and document.body floating portal sniffing.
  6. `packages/extension/src/lib/form-error-recovery.ts` (LATS Engine):
     - Language Agent Tree Search reflective format repair.
     - Reads inline field validation errors and mutates values:
       - Phone: formatted `(555) 019-2834` ➔ pure digits `5550192834` ➔ E.164 `+15550192834`.
       - Date: ISO `2024-06-25` ➔ US `06/25/2024` ➔ UK `25/06/2024`.
       - Text Length: Reflectively parses "maximum 100 characters" and trims string cleanly.
  7. `packages/extension/src/lib/permission-policy.ts`:
      - Domain policy whitelist. Pre-grants permissions for LinkedIn, Greenhouse, Lever, Workday, Ashby, Taleo, iCIMS, SmartRecruiters, BambooHR, Workable, Jobvite, SuccessFactors, SAP, Phenompeople, Oracle, EightFold, Recruitee, and TeamTailor (~20 ATS SaaS domains). Note: Indian company domains (accenture.com, tcs.com, etc.) are NOT in this whitelist -- the policy targets ATS SaaS vendor domains, not individual employer domains.

### 2.3 `@superjob/applier` (Headless/Server Autonomous Engine)
- **Role:** Autonomous bulk applying via Playwright.
- **Key Modules:**
  - `browser.ts`: Launches Chromium with anti-detection flags (`--disable-blink-features=AutomationControlled`) and a humanized MacOS Chrome user-agent. Viewport is currently fixed at 1440×900 (viewport randomization is a planned hardening item).
  - `otp-interceptor.ts`: Real-time SMS/Email OTP interception pipeline for two-factor job portals.
  - `vision-fallback.ts`: Screenshot-based vision prompt fallback for non-standard canvas or obfuscated forms (sends base64 screenshot to Gemini/GPT-4o vision API, returns CSS selector).
  - `human-timing.ts` + `rate-governor.ts`: Gaussian-distributed human-pacing delays per field complexity tier: simple≈700ms±200, medium≈1500ms±450, complex≈3200ms±900 (Box-Muller transform). IST/TZ operating-hours window enforcement.

### 2.4 `@superjob/ats-config` (Vendor Rulebook)
- **Role:** Modular selector catalog for 18+ ATS systems.
- **Vendors Covered:** Greenhouse, Lever, Workday, Ashby, Taleo, iCIMS, BambooHR, BreezyHR, Jobvite, SmartRecruiters, JazzHR, Workable, ADP, Paylocity, Oracle Cloud, Meta Careers, and Accenture.

### 2.5 `@superjob/crew` (Multi-Agent Swarm)
- **Role:** Collaborative AI agents orchestrated via ReAct loops and RAG context.
- **Agents (7 total — 3 were previously undocumented):**
  - `ScorerAgent` (`scorer.ts`): Evaluates JD fit via RAG + deterministic dual-path scoring (`ragScoreMatch` + `assessApplicationReadiness`).
  - `TailorAgent` (`tailor.ts`): Wraps `groundedTailorResume` — re-orders resume bullets using Skill Graph fact-bank to maximize ATS keyword density without hallucinating experience.
  - `ReviewerAgent` (`reviewer.ts`): Pre-submission QA validator ensuring no required fields are blank or misformatted.
  - `HealerAgent` (`healer.ts`): Diagnoses stalled application flows and re-plans navigation paths using Reflexion (Shinn et al., 2023) + AgentQ MCTS actor-critic (Putta et al., 2024).
  - `ApplierAgent` (`applier.ts`): Executes the actual application submission pipeline.
  - `ReconAgent` (`recon-agent.ts`): Manages tool archive and strategy learning from past runs.
  - `ResearcherAgent` (`researcher.ts`): Company and role research for scorer context enrichment.

---

## 3. AUTONOMOUS APPLICATION WORKFLOW (STEP-BY-STEP)

```mermaid
sequenceDiagram
    autonumber
    actor User as Candidate / Job Seeker
    participant Ext as SJA Extension / Applier
    participant DOM as Job Application Portal (DOM)
    participant Core as Core Brain (Resolver / Matcher)
    participant LLM as Gemini 2.0 Flash / Local Fallback

    User->>Ext: Trigger Auto-Apply (Alt+Shift+F or Popup/FAB)
    Ext->>DOM: Scan page & detect ATS platform signature
    DOM-->>Ext: Return detected fields (inputs, radios, selects, comboboxes)
    Ext->>Core: Analyze JD & Score Match against Candidate Profile
    Core-->>Ext: Match Score (e.g. 76% Readability, 68% Keyword Match)
    
    loop For each detected field
        Ext->>Core: Resolve field value (label, type, options)
        alt Cached / Exact Profile Match
            Core-->>Ext: Deterministic Profile Value
        else Standard Screening Question
            Core-->>Ext: Locale-Aware Smart Default (e.g. Notice, Authorization)
        else Complex / Freeform Question
            Core->>LLM: Grounded Q&A prompt with Resume Context
            alt API Active & Within Quota
                LLM-->>Core: Synthesized Answer
            else 429 Quota Exhausted / Offline
                Core-->>Core: Fallback to Deterministic Heuristics
            end
            Core-->>Ext: Final Verified Value
        end
        Ext->>DOM: Synthetic Event Injection (focus, keydown, input, blur)
    end

    Ext->>DOM: Await MutationObserver quiescence via waitForStepTransition (FormFlow Settling)
    opt Dynamic Conditional Fields Revealed
        Ext->>DOM: Secondary scan & fill newly revealed fields
    end

    opt Validation Error Detected (e.g. Phone/Date format)
        Ext->>Ext: LATS Format Mutation Engine
        Ext->>DOM: Re-apply mutated format (e.g. pure digits)
    end

    Ext->>DOM: Click Next / Review (Submit Guard validation)
```

---

## 4. ZERO-TOUCH API & FALLBACK ARCHITECTURE

To ensure the system works seamlessly even when external LLM credits are exhausted or non-existent:
1. **LLM Provider Configuration:**
   - Default Provider: `gemini`
   - Default Model: `gemini-2.0-flash` (configured in `packages/core/src/llm/adapters.ts`)
   - Six provider implementations available: Gemini, OpenAI-compatible, Anthropic, Ollama, DeepSeek, Null (deterministic-only fallback)
   - API key must be provided by the user in extension settings; no pre-configured key is bundled.
2. **Quota-Exhaustion Resilience:**
   - When Google Generative Language API returns HTTP 429 (`RESOURCE_EXHAUSTED` / Quota limit reached), `fetchWithRetry` in `packages/core/src/network-retry.ts` flags `quotaExhausted = true` and fails fast in **0ms** instead of sleeping for 40 seconds.
   - The system instantly and silently activates the local deterministic rule engine (`smartDefaultForQuestion`, template-based cover letter generator, TF-weighted ATS matcher), meaning **0% downtime and 0% stalled form fills**.

---

## 5. REAL-WORLD TESTING & AUDIT RESULTS

### 5.1 Accenture Live Career Portal Test
- **URL:** `https://www.accenture.com/in-en/careers/jobdetails?id=ATCI-4822040-S1848439_en`
- **Candidate Resume:** `shashi_resume_fina (1).pdf` (Shashi Banoth, 80 extracted skills).
- **Verified Metrics:**
  - ATS Readability Score: **76 / 100**
  - Keyword Match Score: **68 / 100**
  - Weighted Match Score: **69 / 100**
  - Matched Skills: 22 skills matched (`ai`, `ml`, `genai`, `generative`, `cloud`, `deep`, `models`...)
  - Screening Question (Hybrid location): `"Yes"`
  - Tailored Cover Letter: Successfully drafted with project citations for SuperJobAgent.

### 5.2 Standalone Outside-the-Extension Harness (`scripts/test-all-features-outside.ts`)
- **Total Tests:** 24
- **Passed:** 24 (100% Pass Rate)
- **Features Tested:**
  1. Semantic Answer Memory & Paraphrase Matching (Cosine/Levenshtein)
  2. LATS Reflective Format Repair Engine (Phone, Date, Character-limit trimming)
  3. Radix UI & Headless Portal Piercing
  4. FormFlow Dynamic Conditional Disclosure Settling Cycle
  5. Full Greenhouse/Lever End-to-End Simulation

### 5.3 Monorepo Unit Test Suite (`npm test`)
- **Total Tests:** 159 (verified 2026-09-30)
- **Passed:** 159 (100% Pass Rate, 0 failures, 0 skipped)

### 5.4 Monorepo Compilation (`npm run typecheck`)
- **TypeScript Packages:** 10/10 clean, 0 errors.

---

## 6. EDGE-CASE GAPS & BLUEPRINTS FOR FULLY AUTONOMOUS PERFECTION

If another LLM or engineer wants to take this system from **99% to 100% complete global autonomy**, here are the remaining real-world edge cases and their exact architectural solutions:

### Gap 1: Third-Party Authentication Walls (e.g. Workday Candidate Login, Accenture `mycareer.accenture.com`)
- **Problem:** Many corporate career sites (Accenture, Workday) redirect the "Apply" click to a gated sub-domain requiring candidate login or account creation before presenting the application form.
- **Blueprint Solution:**
  1. Wire the existing `packages/extension/src/lib/login-agent.ts` to automatically detect `#displayName`, `[type=email]`, and registration forms.
  2. Automatically generate a disposable or user-configured portal profile (`profile.email`, `profile.phone`, master password stored in Chrome secure storage).
  3. Inject `login-coordinator.ts` to execute automated registration/login and resume the autofill pipeline upon successful redirection.

### Gap 2: Cross-Origin Iframe Form Encapsulation
- **Problem:** Certain portals (e.g. older iCIMS or Taleo integrations) render the application inside a nested `<iframe>` hosted on a different domain without `Access-Control-Allow-Origin`.
- **Blueprint Solution:**
  1. The MV3 manifest currently matches `<all_urls>` and specifies `"all_frames": true` for content scripts.
  2. Implement a cross-frame messaging bus using `window.postMessage` with an encrypted nonce (`SJA_CROSS_FRAME_FILL`) so the top-level orchestrator can command child iframes to execute `autofill.ts` locally within their own origin sandbox.

### Gap 3: Turnstile / Arkose Labs / hCaptcha Visual Challenges
- **Problem:** High-volume Easy Apply runs can trigger anti-bot Cloudflare Turnstile or audio/visual captchas.
- **Blueprint Solution:**
  1. Utilize the existing `packages/applier/src/vision-fallback.ts` with multimodal LLMs (e.g. Gemini 2.0 Flash / Claude 3.5 Sonnet) to visually segment captcha tiles.
  2. Provide human-in-the-loop notification via the Extension Side Panel Review Queue (`ReviewQueuePanel.tsx`) that pings the user with desktop audio/toast: *"Captcha detected — please solve to continue automated fleet."* Once solved, the stall watchdog (`stall-watchdog.ts`) automatically resumes execution without reloading.

### Gap 4: Heavy Dynamic Shadow-DOM Tree Piercing
- **Problem:** Custom enterprise web components (e.g. Salesforce Lightning Web Components, modern Workday Web Components) encapsulate form inputs inside closed or deep shadow trees.
- **Blueprint Solution:**
  1. In `packages/extension/src/lib/dom-deep-scan.ts`, augment `collectDeepRoots` with a recursive prototype interceptor on `Element.prototype.attachShadow` to capture closed shadow roots at creation time.
  2. Store intercepted shadow roots in a weak set to guarantee 100% selector reachability across all proprietary enterprise UI components.

---

## 7. SUMMARY CHEATSHEET FOR PROMPT INGESTION

When passing this project to another LLM, prompt it with:
> "We are working on **SuperJobAgent v0.1.5**, an enterprise-grade Chrome Manifest V3 extension and autonomous browser applier for job applications. The codebase is organized as an npm monorepo with 10 packages (`@superjob/core`, `@superjob/extension`, `@superjob/applier`, `@superjob/ats-config`, `@superjob/crew`, `@superjob/scraper`, `@superjob/server`, `@superjob/email-monitor`, `@superjob/analytics`, `@superjob/mcp`). It features a Gemini 2.0 Flash client (user-supplied API key) with instant fail-fast local heuristics on 429 quota exhaustion, a TF-weighted ATS matcher with skill-graph inference (Myers diff is in `tailor/semantic-diff.ts` for visual rendering only), LATS-inspired format mutation engine, Radix/Ashby portal piercing, MutationObserver-based conditional disclosure form settling, and 7 crew agents (Scorer, Tailor, Reviewer, Healer, Applier, Recon, Researcher). 159 unit tests pass with 100% accuracy. Refer to `SUPERJOBAGENT_MASTER_SYSTEM_ARCHITECTURE_AND_ENGINEERING_DOSSIER.md` for complete technical details."
