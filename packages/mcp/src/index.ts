import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
// Note: We use dynamic imports for SuperJobAgent modules to ensure we can load them 
// within the Node.js runtime gracefully if there are setup delays.
// import { executePipeline } from "@superjob/applier/src/pipeline.js";

export const server = new Server(
  {
    name: "superjob-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

export const TOOLS = [
  {
    name: "superjob_apply",
    description: "Autonomously applies to a job using the headless Playwright SuperJobAgent engine.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The direct URL of the job to apply to (e.g., LinkedIn Easy Apply URL or generic ATS URL)",
        },
        dryRun: {
          type: "boolean",
          description: "If true, navigates and fills the form but stops right before clicking final submit.",
          default: true,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "superjob_search",
    description: "Searches for jobs on supported platforms (Arbeitnow, RemoteOK, Indeed, Lever, Greenhouse) and returns their URLs.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Job title or keywords (e.g., 'Frontend Developer')",
        },
        location: {
          type: "string",
          description: "Job location (e.g., 'Remote', 'San Francisco')",
        },
        limit: {
          type: "number",
          description: "Maximum number of jobs to fetch (default 10)",
          default: 10,
        }
      },
      required: ["keywords", "location"],
    },
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "superjob_apply") {
    const url = String(request.params.arguments?.url);
    const dryRun = Boolean(request.params.arguments?.dryRun ?? true);

    try {
      // Lazy load to avoid blocking the MCP server boot
      const { launchBrowser, createGenericAdapter, runPipeline, DEFAULT_SEARCH } = await import("@superjob/applier");
      
      const genericAdapter = createGenericAdapter([url]);
      const launched = await launchBrowser({ headless: true });

      let report;
      try {
        report = await runPipeline(
          launched.browser,
          genericAdapter,
          {
            ...DEFAULT_SEARCH,
            keywords: "MCP Apply",
            location: "Remote",
            limit: 1,
            minScore: 0,
            dryRun: dryRun,
            maxApplications: 1,
          }
        );
      } finally {
        // Guaranteed cleanup of browser process to prevent zombie processes
        await launched.close().catch(() => {});
      }

      const result = report.results[0];
      let msg = "Job processing complete.\n";
      if (result) {
        msg += `Outcome: ${result.outcome}\nFilled Fields: ${result.filledFields}\n`;
        if (result.error) msg += `Error: ${result.error}\n`;
      } else {
        msg += `Status: ${report.haltReason ?? "completed"}, Discovered: ${report.discovered}, Applied: ${report.applied}\n`;
      }

      return {
        content: [{ type: "text", text: msg }],
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error executing pipeline: ${e.message}` }],
        isError: true,
      };
    }
  }

  if (request.params.name === "superjob_search") {
    const keywords = String(request.params.arguments?.keywords);
    const location = String(request.params.arguments?.location);
    const limit = Number(request.params.arguments?.limit ?? 10);

    try {
      const { defaultAggregator } = await import("@superjob/scraper");
      const jobs = await defaultAggregator.discover(keywords, location, limit);

      if (jobs.length === 0) {
        return {
          content: [{ type: "text", text: `No jobs found matching "${keywords}" in "${location}".` }],
        };
      }

      const urls = jobs.map((j) => `- [${j.source ?? "board"}] ${j.title} at ${j.company}: ${j.url}`).join("\n");
      
      return {
        content: [{ type: "text", text: `Found ${jobs.length} jobs:\n${urls}` }],
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error searching jobs: ${e.message}` }],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

export async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SuperJobAgent MCP Server running on stdio");
}

// Auto-run only when directly invoked as the main module
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith("index.js") || 
  process.argv[1].endsWith("index.ts")
) && !process.env.VITEST && !process.env.NODE_TEST_CONTEXT;

if (isDirectRun) {
  runServer().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}
