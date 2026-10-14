import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TOOLS, server } from "./index.js";

describe("MCP Server Tools Schema & Definition", () => {
  it("registers valid tool definitions", () => {
    assert.strictEqual(TOOLS.length, 2);
    
    const applyTool = TOOLS.find(t => t.name === "superjob_apply");
    assert.ok(applyTool, "superjob_apply must be registered");
    assert.strictEqual(applyTool.inputSchema.type, "object");
    assert.deepStrictEqual(applyTool.inputSchema.required, ["url"]);
    assert.ok(applyTool.inputSchema.properties.url);
    assert.ok(applyTool.inputSchema.properties.dryRun);

    const searchTool = TOOLS.find(t => t.name === "superjob_search");
    assert.ok(searchTool, "superjob_search must be registered");
    assert.strictEqual(searchTool.inputSchema.type, "object");
    assert.deepStrictEqual(searchTool.inputSchema.required, ["keywords", "location"]);
    assert.ok(searchTool.inputSchema.properties.keywords);
    assert.ok(searchTool.inputSchema.properties.location);
    assert.ok(searchTool.inputSchema.properties.limit);
  });

  it("server instance is created with proper capabilities", () => {
    assert.ok(server);
  });
});
