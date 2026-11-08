const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function setup(fetch) {
  let handler;
  const source = fs.readFileSync("supabase/functions/corbett-feed/index.ts", "utf8");
  vm.runInNewContext(source, {
    Deno: { serve: callback => { handler = callback; } },
    fetch, Response, Uint8Array, AbortSignal,
    console: { error() {} }
  });
  return handler;
}

test("proxy requests only the fixed feed and returns its contents", async () => {
  const calls = [];
  const handler = setup(async (url, options) => {
    calls.push({ url, redirect: options.redirect });
    return new Response("<rss />");
  });
  const result = await handler({ method: "GET", url: "https://example.test/?url=http://localhost/" });
  assert.deepEqual(calls, [{ url: "https://www.corbettreport.com/newrss.xml", redirect: "error" }]);
  assert.equal(result.status, 200);
  assert.equal(await result.text(), "<rss />");
  assert.equal(result.headers.get("access-control-allow-origin"), "https://baerxiii.github.io");
});

test("proxy reports upstream errors and refuses other methods", async () => {
  const handler = setup(async () => new Response("Not found", { status: 404 }));
  assert.equal((await handler({ method: "GET" })).status, 502);
  assert.equal((await handler({ method: "POST" })).status, 405);
});
