import assert from "node:assert/strict";
import test from "node:test";
import { resolveProxyConfig } from "./browser.js";

test("resolveProxyConfig returns explicit opts.proxy when configured", () => {
  const explicitProxy = {
    server: "http://127.0.0.1:8888",
    username: "testuser",
    password: "secretpassword",
    bypass: "localhost,127.0.0.1",
  };
  const resolved = resolveProxyConfig({ proxy: explicitProxy });
  assert.deepEqual(resolved, explicitProxy);
});

test("resolveProxyConfig parses HTTP_PROXY environment variable with credentials", () => {
  const originalEnv = process.env.HTTP_PROXY;
  const originalNoProxy = process.env.NO_PROXY;
  try {
    process.env.HTTP_PROXY = "http://myuser:mypass@proxy.corp.internal:3128";
    process.env.NO_PROXY = "internal.net,localhost";

    const resolved = resolveProxyConfig({});
    assert.ok(resolved);
    assert.equal(resolved?.server, "http://proxy.corp.internal:3128");
    assert.equal(resolved?.username, "myuser");
    assert.equal(resolved?.password, "mypass");
    assert.equal(resolved?.bypass, "internal.net,localhost");
  } finally {
    if (originalEnv !== undefined) process.env.HTTP_PROXY = originalEnv;
    else delete process.env.HTTP_PROXY;
    if (originalNoProxy !== undefined) process.env.NO_PROXY = originalNoProxy;
    else delete process.env.NO_PROXY;
  }
});

test("resolveProxyConfig returns undefined when no proxy options or env variables are present", () => {
  const originalHttp = process.env.HTTP_PROXY;
  const originalHttps = process.env.HTTPS_PROXY;
  const originalAll = process.env.ALL_PROXY;
  try {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.ALL_PROXY;

    const resolved = resolveProxyConfig({});
    assert.equal(resolved, undefined);
  } finally {
    if (originalHttp !== undefined) process.env.HTTP_PROXY = originalHttp;
    if (originalHttps !== undefined) process.env.HTTPS_PROXY = originalHttps;
    if (originalAll !== undefined) process.env.ALL_PROXY = originalAll;
  }
});
