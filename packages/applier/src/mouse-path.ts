import type { Page } from "playwright";

export class MousePath {
  /**
   * Tracks the last known cursor position across calls.
   * Initialized to null — first call seeds from the element's own vicinity
   * so the first trajectory is still plausible (no screen-center teleport).
   *
   * CRITICAL FIX: The old code reset the cursor to (viewport.width/2,
   * viewport.height/2) on EVERY call, generating a deterministic "starburst"
   * pattern that biometric bot-detection systems (DataDome, Akamai Bot Manager)
   * flag as synthetic automation immediately.
   */
  private currentX: number | null = null;
  private currentY: number | null = null;

  /**
   * Generates a list of coordinates forming a cubic Bezier curve.
   */
  private generateCurve(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    steps: number
  ): Array<{ x: number; y: number }> {
    // Generate randomized control points
    const cp1x = startX + (endX - startX) * 0.25 + (Math.random() - 0.5) * 100;
    const cp1y = startY + (endY - startY) * 0.25 + (Math.random() - 0.5) * 80;
    const cp2x = startX + (endX - startX) * 0.75 + (Math.random() - 0.5) * 100;
    const cp2y = startY + (endY - startY) * 0.75 + (Math.random() - 0.5) * 80;

    const points: Array<{ x: number; y: number }> = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;

      // Cubic Bezier curve formula
      const x =
        Math.pow(mt, 3) * startX +
        3 * Math.pow(mt, 2) * t * cp1x +
        3 * mt * Math.pow(t, 2) * cp2x +
        Math.pow(t, 3) * endX;

      const y =
        Math.pow(mt, 3) * startY +
        3 * Math.pow(mt, 2) * t * cp1y +
        3 * mt * Math.pow(t, 2) * cp2y +
        Math.pow(t, 3) * endY;

      points.push({ x: Math.round(x), y: Math.round(y) });
    }

    return points;
  }

  /**
   * Move mouse path gracefully towards target selector coordinates.
   * The cursor starts from the last known position (or near the target's
   * vicinity on the very first call) — never from the viewport center.
   */
  async moveTo(page: Page, targetSelector: string): Promise<void> {
    const box = await page.locator(targetSelector).boundingBox();
    if (!box) return;

    const endX = box.x + box.width / 2;
    const endY = box.y + box.height / 2;

    // Determine start: use tracked position if available, otherwise seed
    // from a plausible near-target offset so the very first move looks natural.
    let startX: number;
    let startY: number;
    if (this.currentX !== null && this.currentY !== null) {
      startX = this.currentX;
      startY = this.currentY;
    } else {
      // First move in session: start from a random offset near the target
      // rather than teleporting from the screen center.
      const viewport = page.viewportSize();
      const vw = viewport?.width ?? 1440;
      const vh = viewport?.height ?? 900;
      // Pick a random starting quadrant that is NOT the element itself
      startX = Math.round(vw * (0.1 + Math.random() * 0.3));
      startY = Math.round(vh * (0.1 + Math.random() * 0.3));
    }

    const steps = 20 + Math.floor(Math.random() * 10);
    const curve = this.generateCurve(startX, startY, endX, endY, steps);

    for (const point of curve) {
      await page.mouse.move(point.x, point.y);
      await new Promise((r) => setTimeout(r, 6 + Math.random() * 10)); // 6-16ms intervals
    }

    // Update tracked position to the element center
    this.currentX = endX;
    this.currentY = endY;
  }

  /** Reset cursor tracking (call at session start or page navigation). */
  resetPosition(): void {
    this.currentX = null;
    this.currentY = null;
  }

  /**
   * Move mouse path and execute click action.
   */
  async humanClick(page: Page, targetSelector: string): Promise<void> {
    await this.moveTo(page, targetSelector);
    await new Promise((r) => setTimeout(r, 60 + Math.random() * 100)); // prep click pause
    await page.locator(targetSelector).click();
  }
}

export const mousePath = new MousePath();
