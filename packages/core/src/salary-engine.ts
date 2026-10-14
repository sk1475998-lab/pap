export interface SalaryExpectation {
  min?: number;
  max?: number;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  period: 'annual' | 'monthly' | 'hourly';
}

export class SalaryEngine {
  /**
   * Parse salary boundaries from raw job description text.
   * Handles LPA, Lakhs, USD, and numeric ranges with symbols.
   */
  extractSalaryFromJD(jdText: string): SalaryExpectation | null {
    if (!jdText) return null;
    const cleanJd = jdText.replace(/,/g, '');

    // India LPA Patterns: e.g. "6-12 LPA", "₹ 8,00,000 - ₹ 15,00,000", "8 to 15 Lakhs"
    const inrLpaPattern = /(?:₹|rs\.?|inr)?\s*([\d.]+)\s*(?:-|to)\s*(?:₹|rs\.?|inr)?\s*([\d.]+)\s*(?:lpa|l\.p\.a|lakhs?|lacs?)/i;
    const matchLpa = cleanJd.match(inrLpaPattern);
    if (matchLpa) {
      return {
        min: parseFloat(matchLpa[1]!),
        max: parseFloat(matchLpa[2]!),
        currency: 'INR',
        period: 'annual',
      };
    }

    // Direct Lakhs Numbers (e.g. "800000 - 1500000")
    const inrDirectPattern = /(?:₹|rs\.?|inr)\s*([\d]{5,7})\s*(?:-|to)\s*(?:₹|rs\.?|inr)?\s*([\d]{5,7})/i;
    const matchDirect = cleanJd.match(inrDirectPattern);
    if (matchDirect) {
      return {
        min: parseFloat(matchDirect[1]!) / 100000, // convert to LPA
        max: parseFloat(matchDirect[2]!) / 100000,
        currency: 'INR',
        period: 'annual',
      };
    }

    // Global USD/EUR annual range patterns (e.g. "$80,000 - $120,000")
    const globalAnnualPattern = /(?:\$|€|£)\s*([\d]{4,6})\s*(?:-|to)\s*(?:\$|€|£)?\s*([\d]{4,6})\s*(?:per\s*year|annually)/i;
    const matchGlobal = cleanJd.match(globalAnnualPattern);
    if (matchGlobal) {
      const isEur = cleanJd.includes('€');
      const isGbp = cleanJd.includes('£');
      return {
        min: parseFloat(matchGlobal[1]!),
        max: parseFloat(matchGlobal[2]!),
        currency: isEur ? 'EUR' : isGbp ? 'GBP' : 'USD',
        period: 'annual',
      };
    }

    return null;
  }

  /**
   * Determine the best expected salary value to input.
   * Focuses on India LPA standard calculations.
   */
  calculateExpectedSalary(
    userCurrentSalary: number, // in local currency or LPA
    marketMedianSalary: number | null,
    jdRange: SalaryExpectation | null
  ): number {
    const targets: number[] = [];

    // Rule 1: target 25% hike on current salary
    targets.push(userCurrentSalary * 1.25);

    // Rule 2: target 10% above market median if available
    if (marketMedianSalary) {
      targets.push(marketMedianSalary * 1.10);
    }

    // Rule 3: target upper 60% segment of JD advertised range
    if (jdRange?.max && jdRange?.min) {
      targets.push(jdRange.min + (jdRange.max - jdRange.min) * 0.6);
    }

    // Sort to obtain median value
    targets.sort((a, b) => a - b);
    const result = targets[Math.floor(targets.length / 2)]!;

    // Round to nearest 0.5 for LPA or nearest 1000 for full currency numbers
    if (userCurrentSalary < 100) {
      return Math.round(result * 2) / 2; // e.g. 12.5 LPA
    }
    return Math.round(result / 1000) * 1000;
  }
}
