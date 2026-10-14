const CONFIRMATION_PATTERNS = [
  /\bthank you for (?:applying|your application)\b/i,
  /\b(?:your )?application (?:has been |was )?(?:successfully )?(?:submitted|received)\b/i,
  /\bwe(?:'ve| have) received your application\b/i,
  /\byou have successfully applied\b/i,
  /\byou have applied\b/i,
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function hasExternalSubmissionConfirmation(doc: Document = document): boolean {
  const pageText = doc.body?.innerText ?? doc.body?.textContent ?? "";
  const normalizedText = pageText.replace(/\s+/g, " ");
  return CONFIRMATION_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

export async function waitForExternalSubmissionConfirmation(
  timeoutMs = 8_000,
  doc: Document = document
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    if (hasExternalSubmissionConfirmation(doc)) return true;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return false;
    await sleep(Math.min(250, remainingMs));
  } while (true);
}

export type ExternalSubmissionOutcome = "not-clicked" | "unconfirmed" | "confirmed";

export async function attemptExternalSubmission(
  clickSubmit: () => boolean,
  waitForConfirmation: () => Promise<boolean>,
  recordApplication: () => Promise<void>,
  onUnconfirmed: () => void
): Promise<ExternalSubmissionOutcome> {
  if (!clickSubmit()) return "not-clicked";
  if (!(await waitForConfirmation())) {
    onUnconfirmed();
    return "unconfirmed";
  }
  await recordApplication();
  return "confirmed";
}
