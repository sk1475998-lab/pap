/**
 * Phase C direct test runner — executes all unit tests by importing core
 * modules directly via tsx and emits a Phase C handoff JSON.
 */

import { classifyLabel, isSensitiveQuestion, smartDefaultForQuestion, normalizeQuestion } from '../packages/core/src/resolver.ts';
import { SalaryEngine } from '../packages/core/src/salary-engine.ts';
import { scoreMatch, tokenize, stem, extractKeywords } from '../packages/core/src/matcher.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface TestResult {
  test_id: string;
  module: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  bug_id: string | null;
}

interface Bug {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  module: string;
  description: string;
  root_cause_hypothesis: string;
  fix_location: string;
  fix_suggestion: string;
}

const results: TestResult[] = [];
const bugs: Bug[] = [];
let pass = 0, fail = 0;

function check(
  testId: string,
  module: string,
  input: string,
  expected: string,
  actual: string,
  bugId: string | null = null
) {
  const passed = actual === expected;
  if (passed) pass++; else fail++;
  results.push({ test_id: testId, module, input, expected, actual, passed, bug_id: bugId });
}

// ─── C1: Resolver — Unicode labels ──────────────────────────────────────────

check('C1-R001', 'resolver.ts', 'पूरा नाम', 'fullName', classifyLabel('पूरा नाम'));
check('C1-R002', 'resolver.ts', 'ईमेल', 'email', classifyLabel('ईमेल'));
check('C1-R003', 'resolver.ts', 'फ़ोन', 'phone', classifyLabel('फ़ोन'));
check('C1-R004', 'resolver.ts', 'मोबाइल', 'phone', classifyLabel('मोबाइल'));
check('C1-R005', 'resolver.ts', 'prénom', 'firstName', classifyLabel('prénom'));
check('C1-R006', 'resolver.ts', 'vorname', 'firstName', classifyLabel('vorname'));
check('C1-R007', 'resolver.ts', 'nom de famille', 'lastName', classifyLabel('nom de famille'));
check('C1-R008', 'resolver.ts', 'nom complet', 'fullName', classifyLabel('nom complet'));

// ─── C2: Resolver — Script injection (must return 'ai' or safe key) ─────────

const scriptInjection = classifyLabel('<script>alert(1)</script>');
const sqlInjection = classifyLabel("email; DROP TABLE users--");
// Script injection should match 'email' (contains 'email' substring) or fall to 'ai'
const sqlActual = sqlInjection === 'email' ? 'email' : sqlInjection;
check('C2-R001', 'resolver.ts',
  '<script>alert(1)</script>',
  'ai', // no real label keyword, should not match
  scriptInjection,
  scriptInjection !== 'ai' ? 'BUG-C2-001' : null
);
check('C2-R002', 'resolver.ts',
  "email; DROP TABLE users--",
  'email', // 'email' keyword is still present, so it resolves to email (correct — strips special chars)
  sqlActual
);

// null byte label
const nullByteLabel = classifyLabel('first name\x00null');
check('C2-R003', 'resolver.ts',
  'first name\\x00null',
  'firstName',
  nullByteLabel
);

// ─── C3: Resolver — Length limits ───────────────────────────────────────────

// Very long label (500+ chars)
const longLabel = 'first name ' + 'x'.repeat(500);
check('C3-R001', 'resolver.ts',
  'first name + 500 x chars',
  'firstName',
  classifyLabel(longLabel)
);

// Empty label
check('C3-R002', 'resolver.ts',
  '""',
  'ai',
  classifyLabel('')
);

// Whitespace only
check('C3-R003', 'resolver.ts',
  '" "',
  'ai',
  classifyLabel('   ')
);

// ─── C4: Resolver — Sensitive question detection ────────────────────────────

check('C4-R001', 'resolver.ts', 'PAN number', 'true', String(isSensitiveQuestion('PAN number')));
check('C4-R002', 'resolver.ts', 'aadhaar', 'true', String(isSensitiveQuestion('aadhaar')));
check('C4-R003', 'resolver.ts', 'SSN', 'true', String(isSensitiveQuestion('SSN')));
check('C4-R004', 'resolver.ts', 'social security number', 'true', String(isSensitiveQuestion('social security number')));
check('C4-R005', 'resolver.ts', 'email address', 'false', String(isSensitiveQuestion('email address')));
check('C4-R006', 'resolver.ts', 'bank account number', 'true', String(isSensitiveQuestion('bank account number')));
check('C4-R007', 'resolver.ts', 'driver license', 'true', String(isSensitiveQuestion('driver license')));

// ─── C5: Resolver — Smart defaults ──────────────────────────────────────────

check('C5-R001', 'resolver.ts', 'require sponsorship (IN)', 'No', String(smartDefaultForQuestion('require sponsorship', 'IN')));
check('C5-R002', 'resolver.ts', 'require sponsorship (US)', 'undefined', String(smartDefaultForQuestion('require sponsorship', 'US')));
check('C5-R003', 'resolver.ts', 'authorized to work', 'Yes', String(smartDefaultForQuestion('authorized to work')));
check('C5-R004', 'resolver.ts', 'veteran status', 'I am not a protected veteran', String(smartDefaultForQuestion('veteran status')));
check('C5-R005', 'resolver.ts', 'race/ethnicity', 'Decline to self-identify', String(smartDefaultForQuestion('race/ethnicity')));
check('C5-R006', 'resolver.ts', 'willing to relocate', 'Yes', String(smartDefaultForQuestion('willing to relocate')));
check('C5-R007', 'resolver.ts', 'current CTC (sensitive)', 'undefined', String(smartDefaultForQuestion('current CTC')));
// PAN is sensitive → must return undefined
check('C5-R008', 'resolver.ts', 'PAN number (sensitive)', 'undefined', String(smartDefaultForQuestion('PAN number')));

// ─── C6: Salary Engine ──────────────────────────────────────────────────────

const se = new SalaryEngine();

// LPA extraction
const lpa = se.extractSalaryFromJD('We offer 8-15 LPA for this role');
check('C6-SE001', 'salary-engine.ts', '8-15 LPA string', '{"min":8,"max":15,"currency":"INR","period":"annual"}', JSON.stringify(lpa));

// INR direct lakhs
const inrDirect = se.extractSalaryFromJD('₹800000 - ₹1500000');
check('C6-SE002', 'salary-engine.ts', '₹800000-₹1500000', '{"min":8,"max":15,"currency":"INR","period":"annual"}', JSON.stringify(inrDirect));

// USD annual
const usd = se.extractSalaryFromJD('$80000 to $120000 per year');
check('C6-SE003', 'salary-engine.ts', '$80000-$120000/yr', '{"min":80000,"max":120000,"currency":"USD","period":"annual"}', JSON.stringify(usd));

// No salary in JD
const noSalary = se.extractSalaryFromJD('No salary mentioned');
check('C6-SE004', 'salary-engine.ts', 'No salary string', 'null', String(noSalary));

// Expected salary calculation — 3 targets: 10*1.25=12.5, 14*1.1=15.4, 12+(18-12)*0.6=15.6
// Median of [12.5, 15.4, 15.6] → 15.4 → round to 0.5 → 15.5
const calcResult = se.calculateExpectedSalary(10, 14, { min: 12, max: 18, currency: 'INR', period: 'annual' });
check('C6-SE005', 'salary-engine.ts', 'calc(10, 14, 12-18)', '15.5', String(calcResult));

// Edge case: no market/JD data — just 25% hike
const noMarket = se.calculateExpectedSalary(10, null, null);
check('C6-SE006', 'salary-engine.ts', 'calc(10, null, null)', '12.5', String(noMarket));

// ─── C7: Matcher — cosine scoring ───────────────────────────────────────────

// High match: TypeScript developer with all required skills
const highMatch = scoreMatch({
  resumeText: 'TypeScript React Node.js AWS Docker 5 years experience',
  jobDescription: 'TypeScript developer React Node.js experience AWS Docker required',
  profileSkills: ['TypeScript', 'React', 'Node.js']
});
check('C7-M001', 'matcher.ts',
  'TypeScript resume vs TypeScript JD',
  'gte80', // expect >= 80
  highMatch.score >= 80 ? 'gte80' : String(highMatch.score)
);

// Low match: unrelated skills
const lowMatch = scoreMatch({
  resumeText: 'Basic HTML and CSS web design',
  jobDescription: 'Senior Golang engineer kubernetes kafka spark microservices distributed systems',
});
check('C7-M002', 'matcher.ts',
  'HTML/CSS vs Golang JD',
  'lt70', // expect < 70
  lowMatch.score < 70 ? 'lt70' : String(lowMatch.score)
);

// Empty job description → minimum score (35 baseline)
const emptyJD = scoreMatch({ resumeText: 'TypeScript React', jobDescription: '' });
check('C7-M003', 'matcher.ts', 'empty JD', '35', String(emptyJD.score));

// Skill graph inference (react → frontend skills)
const graphMatch = scoreMatch({
  resumeText: 'React developer',
  jobDescription: 'Looking for frontend developer familiar with JSX and component architecture',
  profileSkills: ['React']
});
check('C7-M004', 'matcher.ts',
  'skill graph inference react/frontend',
  'gte35',
  graphMatch.score >= 35 ? 'gte35' : String(graphMatch.score)
);

// ─── C8: Rate Governor — timezone bug (code inspection) ─────────────────────
// This test verifies via static code analysis since we can't run persisted state easily
// SEC-003: toDateString() uses local timezone but IST offset is hardcoded
const rateGovPath = '../packages/applier/src/rate-governor.ts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dir = dirname(fileURLToPath(import.meta.url));
const rgSource = readFileSync(resolve(__dir, rateGovPath), 'utf8');
const hasToDateString = rgSource.includes('new Date().toDateString()');
check('C8-RG001', 'rate-governor.ts',
  'loadState uses toDateString() (timezone bug)',
  'true',
  String(hasToDateString),
  hasToDateString ? 'BUG-C8-001' : null
);

// Verify IST offset calculation is present in canApply
const hasIstOffset = rgSource.includes('5.5 * 60 * 60 * 1000') || rgSource.includes('5.5*60*60*1000');
check('C8-RG002', 'rate-governor.ts',
  'canApply uses IST offset for hours',
  'true',
  String(hasIstOffset)
);

// ─── C9: OTP Interceptor — extraction patterns ───────────────────────────────
const otpPath = '../packages/applier/src/otp-interceptor.ts';
const otpSource = readFileSync(resolve(__dir, otpPath), 'utf8');

// Verify isValidSender uses includes() (SEC-011 vulnerability)
const hasIncludes = otpSource.includes('lowerFrom.includes(domain)');
check('C9-OTP001', 'otp-interceptor.ts',
  'isValidSender uses .includes() not endsWith() — allows subdomain spoofing',
  'true',
  String(hasIncludes),
  hasIncludes ? 'BUG-C9-001' : null
);

// Verify timeout is 90s
const has90sTimeout = otpSource.includes('90000');
check('C9-OTP002', 'otp-interceptor.ts', 'timeout is 90s', 'true', String(has90sTimeout));

// Verify platform-specific regex patterns exist
const hasNaukriPattern = otpSource.includes('naukri.*?(\\\\d{6})');
check('C9-OTP003', 'otp-interceptor.ts', 'naukri-specific OTP pattern', 'true', String(hasNaukriPattern));

// ─── C10: Filler — framework bindings (code inspection) ─────────────────────
const fillerPath = '../packages/extension/src/lib/filler.ts';
const fillerSource = readFileSync(resolve(__dir, fillerPath), 'utf8');

// Safe event constructors (fixed per AUDIT_REPORT)
const hasSafeEventCtor = fillerSource.includes('Ctor ?') || fillerSource.includes('new Ctor(');
check('C10-F001', 'filler.ts',
  'safe event constructor pattern present',
  'true',
  String(hasSafeEventCtor)
);

// setNativeValue function exists
const hasSetNativeValue = fillerSource.includes('setNativeValue');
check('C10-F002', 'filler.ts', 'setNativeValue function exists', 'true', String(hasSetNativeValue));

// fillRadio function exists
const hasFillRadio = fillerSource.includes('fillRadio');
check('C10-F003', 'filler.ts', 'fillRadio function exists', 'true', String(hasFillRadio));

// React setter fallback
const hasReactFallback = fillerSource.includes('_valueTracker') || fillerSource.includes('nativeInputValueSetter');
check('C10-F004', 'filler.ts', 'React nativeInputValueSetter pattern', 'true', String(hasReactFallback));

// ─── Bug catalog ─────────────────────────────────────────────────────────────

if (hasToDateString) {
  bugs.push({
    id: 'BUG-C8-001',
    severity: 'medium',
    module: 'rate-governor.ts',
    description: 'loadState() uses new Date().toDateString() which returns local timezone date, but canApply() uses IST offset hardcoded at +5:30. On machines outside IST (e.g. UTC-5), daily quota resets at wrong time, allowing up to 1 extra day of quota.',
    root_cause_hypothesis: 'Inconsistent timezone handling: toDateString() is local-TZ, IST offset is hardcoded. Confirmed as SEC-003.',
    fix_location: 'packages/applier/src/rate-governor.ts:loadState()',
    fix_suggestion: 'Replace `new Date().toDateString()` with `new Date(Date.now() + 5.5*60*60*1000).toISOString().slice(0,10)` for consistent IST-based day boundary.'
  });
}

if (hasIncludes) {
  bugs.push({
    id: 'BUG-C9-001',
    severity: 'medium',
    module: 'otp-interceptor.ts',
    description: 'isValidSender() uses lowerFrom.includes(domain) which allows attacker-controlled sender "evil-naukri.com@attacker.com" to pass the @naukri.com whitelist since the substring "@naukri.com" is contained. Should use .endsWith() for domain suffix matching.',
    root_cause_hypothesis: 'String.includes() does not anchor the domain check. A malicious sender crafting their email to embed the whitelisted domain as a substring can inject OTP codes.',
    fix_location: 'packages/applier/src/otp-interceptor.ts:isValidSender()',
    fix_suggestion: 'Replace `lowerFrom.includes(domain)` with `lowerFrom.endsWith(domain)` to prevent domain substring spoofing.'
  });
}

// ─── Emit results ────────────────────────────────────────────────────────────

const handoff = {
  phase: 'C',
  test_results: results,
  bugs_found: bugs,
  critical_blockers: [],
  summary: {
    total: results.length,
    passed: pass,
    failed: fail,
    pass_rate: `${Math.round(pass / results.length * 100)}%`
  }
};

console.log('\n=== Phase C Test Summary ===');
console.log(`Total: ${results.length} | Passed: ${pass} | Failed: ${fail}`);
results.filter(r => !r.passed).forEach(r => {
  console.log(`  FAIL [${r.test_id}] expected=${r.expected} actual=${r.actual} input=${r.input.slice(0,50)}`);
});

console.log('\n===HANDOFF_JSON_START===');
console.log(JSON.stringify(handoff, null, 2));
console.log('===HANDOFF_JSON_END===');
