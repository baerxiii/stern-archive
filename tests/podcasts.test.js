const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("authorized editors can add a shared RSS feed to the podcast list", async () => {
  class Element extends EventTarget {
    constructor() {
      super();
      this.children = [];
      this.value = "";
      this.textContent = "";
      this.classList = {
        values: new Set(),
        add(value) { this.values.add(value); },
        remove(value) { this.values.delete(value); },
        contains(value) { return this.values.has(value); },
        toggle(value) {
          if (this.values.has(value)) this.values.delete(value);
          else this.values.add(value);
        }
      };
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    querySelector() { return this.button; }
    reset() { this.resetCalled = true; }
    focus() {}
  }

  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() { return new Element(); }
  };
  const shared = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "editor" } } } }) },
    from(table) {
      if (table === "library_editors") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "editor" } }) }) }) };
      }
      return {
        select: () => ({ order: async () => ({ data: shared, error: null }) }),
        insert: podcast => ({
          select: async () => {
            shared.push({ id: "new-feed", ...podcast });
            return { data: [{ id: "new-feed" }], error: null };
          }
        })
      };
    }
  };
  const window = { STERN_ARCHIVE_CONFIG: { supabaseUrl: "https://example.test", supabaseAnonKey: "public" } };
  const context = {
    document, window, URL, URLSearchParams, console: { error() {} },
    fetch: async () => ({ ok: true, json: async () => [{ name: "Built-in", rss: "feeds/builtin.xml" }] })
  };
  window.supabase = { createClient: () => client };
  const submitButton = new Element();
  document.getElementById("addPodcastForm").button = submitButton;

  vm.runInNewContext(fs.readFileSync("podcasts.js", "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.getElementById("podcastList").children.length, 1);
  assert.equal(document.getElementById("addPodcastBtn").disabled, false);

  document.getElementById("podcastName").value = "New show";
  document.getElementById("podcastRss").value = "https://example.com/feed.xml";
  document.getElementById("addPodcastForm").dispatchEvent(new Event("submit", { cancelable: true }));
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(shared.map(({ name, rss }) => ({ name, rss })), [
    { name: "New show", rss: "https://example.com/feed.xml" }
  ]);
  assert.equal(document.getElementById("podcastList").children.length, 2);
  assert.match(document.getElementById("podcastList").children[1].children[2].href, /podcast-player\.html\?rss=/);
  assert.equal(document.getElementById("addPodcastForm").resetCalled, true);
});
