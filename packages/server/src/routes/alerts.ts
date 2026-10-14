/**
 * Job Alerts Route
 * Keyword/company-based alerts with live multi-board discovery triggers
 */
import { Router } from "express";
import { getStore } from "@superjob/core";
import { discover } from "../lib/discovery.js";
import { asyncRoute } from "../lib/tenant.js";

export const alertsRouter = Router();

export interface JobAlert {
  id: string;
  name: string;
  keywords: string[];
  companies?: string[];
  location?: string;
  minSalaryLpa?: number;
  minMatchScore?: number;
  frequency: "instant" | "daily" | "weekly";
  active: boolean;
  createdAt: number;
  lastTriggered?: number;
  triggerCount: number;
  sources: string[];
}

// GET /api/alerts
alertsRouter.get(
  "/",
  asyncRoute(async (_req, res) => {
    const store = getStore();
    const alerts = (await store.get<JobAlert[]>("job_alerts")) ?? [];
    res.json({ ok: true, data: alerts });
  }),
);

// POST /api/alerts — create alert
alertsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const store = getStore();
    const alerts = (await store.get<JobAlert[]>("job_alerts")) ?? [];
    const alert: JobAlert = {
      id: `alert_${Date.now()}`,
      name: req.body.name || "New Alert",
      keywords: req.body.keywords || [],
      companies: req.body.companies || [],
      location: req.body.location || "",
      minSalaryLpa: req.body.minSalaryLpa || 0,
      minMatchScore: req.body.minMatchScore || 70,
      frequency: req.body.frequency || "daily",
      active: true,
      createdAt: Date.now(),
      triggerCount: 0,
      sources: req.body.sources || ["linkedin", "indeed", "glassdoor", "naukri"],
    };
    alerts.push(alert);
    await store.set("job_alerts", alerts);
    res.json({ ok: true, data: alert });
  }),
);

// PATCH /api/alerts/:id
alertsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const store = getStore();
    const alerts = (await store.get<JobAlert[]>("job_alerts")) ?? [];
    const idx = alerts.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Alert not found" });
    alerts[idx] = { ...alerts[idx], ...req.body };
    await store.set("job_alerts", alerts);
    res.json({ ok: true, data: alerts[idx] });
  }),
);

// DELETE /api/alerts/:id
alertsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const store = getStore();
    let alerts = (await store.get<JobAlert[]>("job_alerts")) ?? [];
    alerts = alerts.filter((a) => a.id !== req.params.id);
    await store.set("job_alerts", alerts);
    res.json({ ok: true });
  }),
);

// POST /api/alerts/test/:id — trigger live test match using genuine discovery
alertsRouter.post(
  "/test/:id",
  asyncRoute(async (req, res) => {
    const store = getStore();
    const alerts = (await store.get<JobAlert[]>("job_alerts")) ?? [];
    const alert = alerts.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ ok: false, error: "Alert not found" });

    const query = alert.keywords.join(" ") || alert.name || "software engineer";
    const { jobs } = await discover(query, alert.location || "", 15);

    // Filter against alert criteria without fake static mocks
    const matches = jobs
      .filter((j) => {
        const text = `${j.title} ${j.company} ${j.description}`.toLowerCase();
        const matchKeywords = alert.keywords.length === 0 || alert.keywords.some((kw) => text.includes(kw.toLowerCase()));
        const matchCompany = !alert.companies?.length || alert.companies.some((c) => j.company.toLowerCase().includes(c.toLowerCase()));
        return matchKeywords && matchCompany;
      })
      .slice(0, 10);

    res.json({
      ok: true,
      matches,
      alertName: alert.name,
      queryUsed: query,
      totalDiscovered: jobs.length,
    });
  }),
);
