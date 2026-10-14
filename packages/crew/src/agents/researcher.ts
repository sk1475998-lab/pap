/**
 * Researcher Agent — discovers jobs.
 *
 * Uses a pluggable JobSource to find job postings. The default source reads
 * from a curated URL list or a JSON file; you can swap in a scraper (JobSpy,
 * the applier's LinkedIn adapter) by implementing the JobSource interface.
 */
import type { Agent, AgentContext } from "../framework.js";
import type { Job as JobType } from "@superjob/core";
import { nanoid } from "nanoid";

export interface JobSource {
  discover(keywords: string, location: string, limit: number): Promise<JobType[]>;
}

/** A simple source that turns a URL list into Job objects. */
export class UrlListSource implements JobSource {
  constructor(private urls: string[]) {}
  async discover(_keywords: string, _location: string, limit: number): Promise<JobType[]> {
    return this.urls.slice(0, limit).map((url) => ({
      id: `job_${nanoid(8)}`,
      url,
      title: "",
      company: "",
      location: "",
      description: "",
      salary: "",
      remote: false,
      source: "url-list",
      savedAt: Date.now(),
    }));
  }
}

/** A source that returns pre-loaded jobs (e.g. from a scraper or JSON file). */
export class StaticJobSource implements JobSource {
  constructor(private jobs: JobType[]) {}
  async discover(): Promise<JobType[]> {
    return this.jobs;
  }
}

export function createResearcher(source: JobSource): Agent {
  return {
    name: "Researcher",
    role: "Job Discovery Specialist",
    goal: "Find relevant job openings matching the candidate's search criteria",
    backstory:
      "An expert recruiter who knows where to look and how to surface the best " +
      "opportunities before anyone else does.",
    async execute(ctx: AgentContext): Promise<string> {
      const { searchParams } = ctx.blackboard;
      ctx.log(`Searching for "${searchParams.keywords}" in ${searchParams.location}…`);

      const jobs = await source.discover(
        searchParams.keywords,
        searchParams.location,
        searchParams.limit
      );

      // dedupe by URL
      const seen = new Set<string>();
      ctx.blackboard.discovered = jobs.filter((j) => {
        if (seen.has(j.url)) return false;
        seen.add(j.url);
        return true;
      });

      ctx.log(`Found ${ctx.blackboard.discovered.length} unique jobs.`);
      return `Discovered ${ctx.blackboard.discovered.length} jobs`;
    },
  };
}
