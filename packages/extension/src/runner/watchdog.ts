/**
 * Watchdog and Fallback Click strategies.
 * Derived from AutoApplyMax for robustness during automated runs.
 */

export class WatchdogTimer {
    private timeoutMs: number;
    private timerId: NodeJS.Timeout | null = null;
    private onStuck: () => void;

    constructor(timeoutMs = 120000, onStuck: () => void) {
        this.timeoutMs = timeoutMs;
        this.onStuck = onStuck;
    }

    /**
     * Call this method every time a meaningful interaction happens to reset the stuck timer.
     */
    public ping(): void {
        this.stop();
        this.timerId = setTimeout(() => {
            console.warn(`Watchdog triggered: No activity for ${this.timeoutMs}ms.`);
            this.onStuck();
        }, this.timeoutMs);
    }

    public stop(): void {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }
}

/**
 * Brute-force fallback click dispatcher.
 * Attempts standard click, MouseEvent, and Focus+Enter.
 */
export function exhaustiveClick(element: HTMLElement): boolean {
    if (!element || typeof element.click !== 'function') {
        return false;
    }

    try {
        // 1. Standard programmatic click
        element.click();
        
        // 2. MouseEvent dispatch (bypasses some simplistic event preventions)
        const mouseEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        });
        element.dispatchEvent(mouseEvent);

        // 3. Focus and Enter (accessibility fallback)
        element.focus();
        const keyboardEvent = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13
        });
        element.dispatchEvent(keyboardEvent);
        
        return true;
    } catch (e) {
        console.error('Exhaustive click failed:', e);
        return false;
    }
}
