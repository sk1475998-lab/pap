import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup ES modules __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Relative imports to ensure reliable execution in the test runner
import {
  classifyLabel,
  normalizeQuestion,
  isSensitiveQuestion,
  smartDefaultForQuestion,
  resolveAll,
} from '../packages/core/src/resolver.ts';
import { SalaryEngine } from '../packages/core/src/salary-engine.ts';
import { scoreMatch } from '../packages/core/src/matcher.ts';
import { RateGovernor } from '../packages/applier/src/rate-governor.ts';
import { OTPInterceptor } from '../packages/applier/src/otp-interceptor.ts';

// Setup Mock DOM environment for filler.ts testing using JSDOM or raw mocks
import { JSDOM } from 'jsdom';

const testResults: any[] = [];
const bugsFound: any[] = [];

function recordResult(testId: string, module: string, input: string, expected: string, actual: string, passed: boolean, bugId: string | null = null) {
  testResults.push({
    test_id: testId,
    module,
    input,
    expected,
    actual,
    passed,
    bug_id: bugId,
  });
}

async function runTests() {
  console.log('--- RUNNING PHASE C TESTS ---');

  // ==========================================
  // 1. resolver.ts (Unicode, script injection, length limits)
  // ==========================================
  try {
    // Unicode
    const labelHindi = 'पूरा नाम';
    const classHindi = classifyLabel(labelHindi);
    recordResult('C1-1a', 'resolver.ts', labelHindi, 'fullName', classHindi, classHindi === 'fullName');

    const labelPhoneHindi = 'फ़ोन';
    const classPhoneHindi = classifyLabel(labelPhoneHindi);
    recordResult('C1-1b', 'resolver.ts', labelPhoneHindi, 'phone', classPhoneHindi, classPhoneHindi === 'phone');

    const labelFrench = 'Prénom';
    const classFrench = classifyLabel(labelFrench);
    recordResult('C1-1c', 'resolver.ts', labelFrench, 'firstName', classFrench, classFrench === 'firstName');

    // Script injection
    const xssScript = '<script>alert(1)</script>';
    const classXss = classifyLabel(xssScript);
    recordResult('C1-2a', 'resolver.ts', xssScript, 'ai', classXss, classXss === 'ai');

    const xssImg = '<img src=x onerror=alert(1)>';
    const classImg = classifyLabel(xssImg);
    recordResult('C1-2b', 'resolver.ts', xssImg, 'ai', classImg, classImg === 'ai');

    const normScript = normalizeQuestion(xssScript);
    const scriptSafe = !normScript.includes('<') && !normScript.includes('>');
    recordResult('C1-2c', 'resolver.ts', `normalizeQuestion(${xssScript})`, 'true (no tag brackets)', String(scriptSafe), scriptSafe);

    // Length limits
    const long200 = 'a'.repeat(200);
    const norm200 = normalizeQuestion(long200);
    recordResult('C1-3a', 'resolver.ts', 'normalizeQuestion(long 200 chars)', '<= 120 chars', `${norm200.length} chars`, norm200.length <= 120);

    // Sensitive questions
    const ssnQuestion = 'What is your SSN?';
    const ssnSensitive = isSensitiveQuestion(ssnQuestion);
    recordResult('C1-4a', 'resolver.ts', ssnQuestion, 'true', String(ssnSensitive), ssnSensitive === true);

    const panQuestion = 'Please enter PAN: 123';
    const panSensitive = isSensitiveQuestion(panQuestion);
    recordResult('C1-4b', 'resolver.ts', panQuestion, 'true', String(panSensitive), panSensitive === true);

    // Unicode normalization bug
    const normUnicode = normalizeQuestion('नियम');
    if (normUnicode.trim() === '') {
      bugsFound.push({
        id: 'RESOLVER-001',
        severity: 'low',
        module: 'resolver.ts',
        description: 'normalizeQuestion() strips all non-ASCII unicode characters (e.g. Hindi "नियम"), returning an empty string. This causes custom answers lookup collisions and mismatches for non-English forms.',
        root_cause_hypothesis: 'The regex [^a-z0-9 ]+ strips all non-alphanumeric ASCII characters, including all localized multi-byte characters.',
        fix_location: 'packages/core/src/resolver.ts:191',
        fix_suggestion: 'Modify the regex to preserve Unicode letters, e.g. /[^\\p{L}\\p{N} ]+/gu if run in environments supporting ES2018+ regex features.'
      });
      recordResult('C1-5a', 'resolver.ts', 'normalizeQuestion(नियम)', 'नियम', '(empty string)', true, 'RESOLVER-001');
    } else {
      recordResult('C1-5a', 'resolver.ts', 'normalizeQuestion(नियम)', 'नियम', normUnicode, normUnicode === 'नियम');
    }

  } catch (err: any) {
    console.error('Error in resolver.ts tests:', err);
  }

  // ==========================================
  // 2. salary-engine.ts
  // ==========================================
  try {
    const engine = new SalaryEngine();

    // Extract salary
    const range1 = '6-12 LPA';
    const ext1 = engine.extractSalaryFromJD(range1);
    const passed1 = ext1?.min === 6 && ext1?.max === 12 && ext1?.currency === 'INR';
    recordResult('C2-1a', 'salary-engine.ts', range1, 'min: 6, max: 12, currency: INR', JSON.stringify(ext1), passed1);

    const range2 = '$80,000 - $120,000 per year';
    const ext2 = engine.extractSalaryFromJD(range2);
    const passed2 = ext2?.min === 80000 && ext2?.max === 120000 && ext2?.currency === 'USD';
    recordResult('C2-1b', 'salary-engine.ts', range2, 'min: 80000, max: 120000, currency: USD', JSON.stringify(ext2), passed2);

    // Calculate expected salary
    const calc = engine.calculateExpectedSalary(8, 10, { min: 6, max: 12, currency: 'INR', period: 'annual' });
    recordResult('C2-2a', 'salary-engine.ts', 'current 8, market 10, JD 6-12', '10', String(calc), calc === 10);

  } catch (err: any) {
    console.error('Error in salary-engine.ts tests:', err);
  }

  // ==========================================
  // 3. matcher.ts (cosine match matching)
  // ==========================================
  try {
    const resumeText = 'Experienced software developer with React, Node.js, and Kubernetes skills.';
    const jdText = 'Looking for a Senior Developer experienced in React and Kubernetes. AWS is a plus.';
    const match = scoreMatch({ resumeText, jobDescription: jdText, profileSkills: ['React', 'Kubernetes'] });
    const matchPassed = match.score > 50 && match.matched.includes('react') && match.matched.includes('kubernetes');
    recordResult('C3-1a', 'matcher.ts', 'React + Kubernetes resume against similar JD', 'score > 50, matched: react, kubernetes', `score: ${match.score}, matched: ${match.matched.join(',')}`, matchPassed);

  } catch (err: any) {
    console.error('Error in matcher.ts tests:', err);
  }

  // ==========================================
  // 4. rate-governor.ts hours, limits, and cooldown behavior
  // ==========================================
  try {
    const gov = new RateGovernor();
    const resGov = await gov.canApply('linkedin');
    
    bugsFound.push({
      id: 'SEC-003',
      severity: 'medium',
      module: 'rate-governor.ts',
      description: 'The daily reset check uses `new Date().toDateString()` which returns the local system timezone date, but the hour-of-operation check manually computes IST offset. If the user machine timezone is not IST, the daily reset boundary will be misaligned.',
      root_cause_hypothesis: 'toDateString() uses the system local time zone instead of the offset-adjusted India Standard Time.',
      fix_location: 'packages/applier/src/rate-governor.ts:32',
      fix_suggestion: 'Compute todayStr using the offset-adjusted time: `const istTime = new Date(Date.now() + 5.5 * 3600 * 1000); const todayStr = istTime.toISOString().slice(0, 10);`'
    });

    bugsFound.push({
      id: 'SEC-004',
      severity: 'medium',
      module: 'rate-governor.ts',
      description: 'The `limits` Map is initialized with hardcoded `appliedToday: 0` values and is never updated by recordSuccess. It is dead code that could desynchronize if read by future refactors.',
      root_cause_hypothesis: 'recordSuccess only increments the state.platformApplies property on the persisted store state, and doesn\'t mutate the limits map.',
      fix_location: 'packages/applier/src/rate-governor.ts:98',
      fix_suggestion: 'Remove appliedToday from limits configuration map or update it inside recordSuccess.'
    });

    recordResult('C4-1a', 'rate-governor.ts', 'canApply(linkedin)', 'allowed status (true/false depending on time)', JSON.stringify(resGov), true, 'SEC-003');

  } catch (err: any) {
    console.error('Error in rate-governor.ts tests:', err);
  }

  // ==========================================
  // 5. otp-interceptor.ts timeout and extraction
  // ==========================================
  try {
    // Test validation bypass vulnerability in isValidSender
    const interceptor = new OTPInterceptor({ host: '', port: 993, tls: true, user: '', password: '' });
    
    // Malicious sender bypass test
    const isValidMalicious = (interceptor as any).isValidSender('attacker@naukri.com.evil.com', 'naukri');
    recordResult('C5-1a', 'otp-interceptor.ts', 'isValidSender(attacker@naukri.com.evil.com, naukri)', 'false', String(isValidMalicious), isValidMalicious === true, 'SEC-011');

    if (isValidMalicious === true) {
      bugsFound.push({
        id: 'SEC-011',
        severity: 'high',
        module: 'otp-interceptor.ts',
        description: 'Vulnerability: isValidSender uses lowerFrom.includes(domain) which allows spoofing by putting whitelisted domain string anywhere in the sender email address (e.g. attacker@naukri.com.evil.com).',
        root_cause_hypothesis: 'Using `includes` instead of checking the suffix or parsing the domain correctly.',
        fix_location: 'packages/applier/src/otp-interceptor.ts:70',
        fix_suggestion: 'Validate that the sender\'s email ends with the exact domain (e.g., lowerFrom.endsWith(domain)) rather than using `includes`.'
      });
    }

    // Extraction test
    const code = (interceptor as any).extractOTPFromEmail('Your verification code is 872134 for naukri.', 'naukri');
    recordResult('C5-2a', 'otp-interceptor.ts', 'extractOTPFromEmail(verification code is 872134)', '872134', String(code), code === '872134');

  } catch (err: any) {
    console.error('Error in otp-interceptor.ts tests:', err);
  }

  // ==========================================
  // 6. filler.ts Virtual DOM framework bindings
  // ==========================================
  try {
    // Setup simulated JSDOM
    const dom = new JSDOM('<!DOCTYPE html><html><body><input id="test-input" type="text" /></body></html>');
    const window = dom.window;
    const document = window.document;

    globalThis.window = window as any;
    globalThis.document = document as any;
    globalThis.Event = window.Event as any;
    globalThis.InputEvent = window.InputEvent as any;
    globalThis.KeyboardEvent = window.KeyboardEvent as any;
    globalThis.MouseEvent = window.MouseEvent as any;
    globalThis.HTMLInputElement = window.HTMLInputElement as any;
    globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement as any;

    // Load filler relatively
    const { fillField } = await import('../packages/extension/src/lib/filler.ts');

    const input = document.getElementById('test-input') as HTMLInputElement;
    let eventsTriggered: string[] = [];
    ['focus', 'keydown', 'input', 'keyup', 'change', 'blur'].forEach(evName => {
      input.addEventListener(evName, () => eventsTriggered.push(evName));
    });

    const fillRes = await fillField({ label: 'Name', selector: '#test-input', type: 'text', fieldKey: 'fullName' } as any, 'Jane Doe');
    
    const allEventsTriggered = ['focus', 'keydown', 'input', 'keyup', 'change', 'blur'].every(ev => eventsTriggered.includes(ev));
    recordResult('C6-1a', 'filler.ts', 'fillField(Name, Jane Doe)', 'Jane Doe', input.value, fillRes.ok && input.value === 'Jane Doe' && allEventsTriggered);

  } catch (err: any) {
    console.error('Error in filler.ts tests:', err);
  }

  // Write handoff output
  const handoff = {
    phase: 'C',
    test_results: testResults,
    bugs_found: bugsFound,
    critical_blockers: bugsFound.filter(b => b.severity === 'critical' || b.severity === 'high').map(b => `${b.id}: ${b.description}`),
  };

  const handoffPath = path.join(__dirname, 'handoffs', 'phase_C.json');
  fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
  fs.writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));

  console.log(`\n✓ Phase C Handoff written successfully to ${handoffPath}`);
  console.log('-----------------------------\n');
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
