import * as fs from 'fs';
import * as path from 'path';

/**
 * Autonomous Agent Session Manager.
 * Derived from 10xProductivity session architecture.
 * Ensures that the job application orchestrator can pause (e.g., due to rate limits)
 * and safely resume across browser or system restarts without losing track of
 * active job applications.
 */

export interface JobSessionState {
    jobId: string;
    url: string;
    status: 'active' | 'review' | 'completed' | 'abandoned' | 'rate_limited';
    pendingFields: string[];
    createdAt: number;
    updatedAt: number;
}

export class AgentSessionManager {
    private sessionFilePath: string;
    private sessions: Map<string, JobSessionState> = new Map();

    constructor(storageDir: string = './.agent_data') {
        this.sessionFilePath = path.join(storageDir, 'agent_sessions.json');
        this.initializeStorage(storageDir);
        this.loadSessions();
    }

    private initializeStorage(storageDir: string) {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
        if (!fs.existsSync(this.sessionFilePath)) {
            fs.writeFileSync(this.sessionFilePath, JSON.stringify({}), 'utf-8');
        }
    }

    private loadSessions() {
        try {
            const data = fs.readFileSync(this.sessionFilePath, 'utf-8');
            const parsed = JSON.parse(data);
            for (const key of Object.keys(parsed)) {
                this.sessions.set(key, parsed[key]);
            }
        } catch (e) {
            console.error('Failed to load agent sessions', e);
        }
    }

    private saveSessions() {
        try {
            const data = Object.fromEntries(this.sessions);
            fs.writeFileSync(this.sessionFilePath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (e) {
            console.error('Failed to save agent sessions', e);
        }
    }

    public startOrResumeSession(jobId: string, url: string): JobSessionState {
        let session = this.sessions.get(jobId);
        if (!session) {
            session = {
                jobId,
                url,
                status: 'active',
                pendingFields: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            this.sessions.set(jobId, session);
            this.saveSessions();
        }
        return session;
    }

    public updateSessionStatus(jobId: string, status: JobSessionState['status']): void {
        const session = this.sessions.get(jobId);
        if (session) {
            session.status = status;
            session.updatedAt = Date.now();
            this.saveSessions();
        }
    }

    public markRateLimited(jobId: string): void {
        this.updateSessionStatus(jobId, 'rate_limited');
        console.warn(`[Agent] Rate limit hit. Session ${jobId} paused and persisted. Restart agent later to resume.`);
    }

    public getActiveSessions(): JobSessionState[] {
        return Array.from(this.sessions.values()).filter(s => s.status === 'active' || s.status === 'rate_limited');
    }
}
