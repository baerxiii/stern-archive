const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

async function load(url, fetch) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { textContent: "" });
      return elements.get(id);
    }
  };
  const context = {
    location: { search: `?${new URLSearchParams({ rss: url })}` },
    document,
    URLSearchParams,
    ListeningHistory: { attach: () => ({}) },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector: selector => selector === "channel > title" ? { textContent: "Example" } : null,
          querySelectorAll: () => []
        };
      }
    },
    fetch,
    console: { error() {} }
  };
  vm.runInNewContext(fs.readFileSync("podcast-player.js", "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));
  return elements;
}

test("uses the Corbett proxy only when direct fetch fails", async () => {
  const calls = [];
  const feed = "https://www.corbettreport.com/newrss.xml";
  const elements = await load(feed, async url => {
    calls.push(url);
    if (url === feed) throw new TypeError("Failed to fetch");
    return { ok: true, text: async () => "<rss />" };
  });
  assert.deepEqual(calls, [
    feed,
    "https://uzbbwvihkfzdbnowhglc.supabase.co/functions/v1/Corbett-feed"
  ]);
  assert.equal(elements.get("podcastTitle").textContent, "Example");
});

test("does not proxy other feeds or successful direct requests", async () => {
  const calls = [];
  const elements = await load("https://example.com/feed.xml", async url => {
    calls.push(url);
    throw new TypeError("Failed to fetch");
  });
  assert.equal(calls.length, 1);
  assert.match(elements.get("episodeDetails").textContent, /may not allow browser access/);

  const directCalls = [];
  await load("https://www.corbettreport.com/newrss.xml", async url => {
    directCalls.push(url);
    return { ok: true, text: async () => "<rss />" };
  });
  assert.equal(directCalls.length, 1);
});

test("shows an actionable error when the proxy is unavailable", async () => {
  const elements = await load("https://www.corbettreport.com/newrss.xml", async url => {
    if (url.includes("corbettreport.com")) throw new TypeError("Failed to fetch");
    return { ok: false, status: 404 };
  });
  assert.match(elements.get("episodeDetails").textContent, /proxy returned HTTP 404/);
});
