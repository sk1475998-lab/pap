import * as fs from 'fs';
import * as path from 'path';

/**
 * Local-First Analytics Tracker.
 * Derived from AutoApplyMax telemetry concepts, but purely local.
 * Tracks application velocity, success rates, and daily limits to provide
 * a dashboard overview without relying on external cloud telemetry.
 */

export interface ApplicationMetrics {
    date: string;
    totalApplied: number;
    totalFailed: number;
    totalSkipped: number;
    timeSpentMs: number;
}

export class AnalyticsTracker {
    private dbPath: string;
    private metrics: Map<string, ApplicationMetrics> = new Map();

    constructor(storageDir: string = './.agent_data') {
        this.dbPath = path.join(storageDir, 'analytics_metrics.json');
        this.initializeStorage(storageDir);
        this.loadMetrics();
    }

    private initializeStorage(storageDir: string) {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify({}), 'utf-8');
        }
    }

    private loadMetrics() {
        try {
            const data = fs.readFileSync(this.dbPath, 'utf-8');
            const parsed = JSON.parse(data);
            for (const key of Object.keys(parsed)) {
                this.metrics.set(key, parsed[key]);
            }
        } catch (e) {
            console.error('Failed to load analytics metrics', e);
        }
    }

    private saveMetrics() {
        try {
            const data = Object.fromEntries(this.metrics);
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (e) {
            console.error('Failed to save analytics metrics', e);
        }
    }

    private getTodayKey(): string {
        return new Date().toISOString().split('T')[0];
    }

    private getTodayMetrics(): ApplicationMetrics {
        const today = this.getTodayKey();
        let metric = this.metrics.get(today);
        if (!metric) {
            metric = {
                date: today,
                totalApplied: 0,
                totalFailed: 0,
                totalSkipped: 0,
                timeSpentMs: 0
            };
            this.metrics.set(today, metric);
        }
        return metric;
    }

    public trackApplicationSuccess(timeSpentMs: number): void {
        const today = this.getTodayMetrics();
        today.totalApplied += 1;
        today.timeSpentMs += timeSpentMs;
        this.saveMetrics();
    }

    public trackApplicationFailure(timeSpentMs: number): void {
        const today = this.getTodayMetrics();
        today.totalFailed += 1;
        today.timeSpentMs += timeSpentMs;
        this.saveMetrics();
    }

    public trackApplicationSkipped(): void {
        const today = this.getTodayMetrics();
        today.totalSkipped += 1;
        this.saveMetrics();
    }

    public getDailyStats(dateStr?: string): ApplicationMetrics {
        return this.metrics.get(dateStr || this.getTodayKey()) || {
            date: dateStr || this.getTodayKey(),
            totalApplied: 0,
            totalFailed: 0,
            totalSkipped: 0,
            timeSpentMs: 0
        };
    }

    public getOverallStats(): { totalApplied: number; successRate: number } {
        let applied = 0;
        let failed = 0;
        for (const metric of this.metrics.values()) {
            applied += metric.totalApplied;
            failed += metric.totalFailed;
        }
        const total = applied + failed;
        const successRate = total === 0 ? 0 : (applied / total) * 100;
        return { totalApplied: applied, successRate };
    }
}
