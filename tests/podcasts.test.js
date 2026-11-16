const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("authorized editors can add, edit, and delete a shared RSS feed", async () => {
  class Element extends EventTarget {
    constructor() {
      super();
      this.children = [];
      this.value = "";
      this.textContent = "";
      this.attributes = {};
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
    scrollIntoView() {}
    setAttribute(name, value) { this.attributes[name] = value; }
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
  let mutationError = null;
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "editor" } } } }) },
    from(table) {
      if (table === "library_editors") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "editor" } }) }) }) };
      }
      return {
        select: () => ({
          order: async () => ({ data: shared, error: null }),
          eq: (column, id) => ({ then: resolve => resolve({ data: shared.filter(item => item[column] === id), error: null }) })
        }),
        insert: podcast => ({
          select: async () => {
            shared.push({ id: "new-feed", ...podcast });
            return { data: [{ id: "new-feed" }], error: null };
          }
        }),
        update: values => ({
          eq: (column, id) => ({
            select: async () => {
              if (mutationError) return { data: null, error: mutationError };
              const item = shared.find(entry => entry[column] === id);
              Object.assign(item, values);
              return { data: [item], error: null };
            }
          })
        }),
        delete: () => ({
          eq: (column, id) => ({
            select: async () => {
              if (mutationError) return { data: null, error: mutationError };
              const index = shared.findIndex(entry => entry[column] === id);
              return { data: index < 0 ? [] : shared.splice(index, 1), error: null };
            }
          })
        })
      };
    }
  };
  const window = { STERN_ARCHIVE_CONFIG: { supabaseUrl: "https://example.test", supabaseAnonKey: "public" } };
  const context = {
    document, window, URL, URLSearchParams, confirm: () => true, console: { error() {} },
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

  const card = document.getElementById("podcastList").children[1];
  card.children[3].children[0].dispatchEvent(new Event("click"));
  assert.equal(document.getElementById("podcastName").value, "New show");
  document.getElementById("podcastName").value = "Updated show";
  document.getElementById("podcastRss").value = "https://example.com/updated.xml";
  document.getElementById("addPodcastForm").dispatchEvent(new Event("submit", { cancelable: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(shared, [{ id: "new-feed", name: "Updated show", rss: "https://example.com/updated.xml" }]);

  const updatedCard = document.getElementById("podcastList").children[1];
  mutationError = { code: "42501", message: "permission denied for table shared_podcasts" };
  updatedCard.children[3].children[1].dispatchEvent(new Event("click"));
  await new Promise(resolve => setImmediate(resolve));
  assert.match(document.getElementById("podcastMessage").textContent, /database\/shared-podcast-management\.sql/);
  assert.equal(shared.length, 1);
  mutationError = null;
  updatedCard.children[3].children[1].dispatchEvent(new Event("click"));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(shared, []);
  assert.equal(document.getElementById("podcastList").children.length, 1);
});
