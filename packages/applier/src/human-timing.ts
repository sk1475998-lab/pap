export class HumanTiming {
  /**
   * Gaussian randomized number generator using the Box-Muller transform.
   */
  private gaussian(mean: number, std: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, mean + std * z);
  }

  /**
   * Keystroke delay in milliseconds.
   */
  keystrokeDelay(): number {
    return this.gaussian(95, 30); // Average 95ms delay with std 30
  }

  /**
   * Wait interval between filling individual fields.
   */
  fieldTransitionDelay(complexity: 'simple' | 'medium' | 'complex'): number {
    const configs = {
      simple: { mean: 700, std: 200 },
      medium: { mean: 1500, std: 450 },
      complex: { mean: 3200, std: 900 },
    };
    const { mean, std } = configs[complexity];
    return this.gaussian(mean, std);
  }

  /**
   * Natural reading/thinking delay on encountering forms or open ended questions.
   */
  thinkingPause(isOpenQuestion: boolean): number {
    if (!isOpenQuestion) return 0;
    if (Math.random() < 0.25) {
      return this.gaussian(4500, 1200); // 4.5 seconds thinking pause
    }
    return this.gaussian(1200, 400);
  }

  /**
   * Mouse movement scroll delay.
   */
  scrollPause(): number {
    return this.gaussian(500, 150);
  }

  /**
   * Click delay offset.
   */
  clickDelay(): number {
    return this.gaussian(150, 50);
  }

  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.round(ms)));
  }
}

export const humanTiming = new HumanTiming();
