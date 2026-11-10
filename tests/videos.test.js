const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function setup({ authorized = true, databaseError = false, fetchImpl } = {}) {
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
        contains(value) { return this.values.has(value); },
        toggle(value, force) {
          if (force === true || (force === undefined && !this.values.has(value))) this.values.add(value);
          else this.values.delete(value);
        }
      };
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return name === "src" ? this.src : this.attributes[name]; }
    removeAttribute(name) { if (name === "src") this.src = ""; else delete this.attributes[name]; }
    querySelector() { return this.button; }
    reset() { this.resetCalled = true; }
    pause() {}
    load() {}
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
    auth: { getSession: async () => ({ data: { session: authorized ? { user: { id: "editor" } } : null } }) },
    from(table) {
      if (table === "library_editors") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "editor" } }) }) }) };
      }
      return {
        select: () => ({ order: async () => databaseError ? { error: { message: "missing table" } } : { data: shared } }),
        insert: row => ({ select: async () => { shared.push(row); return { data: [row] }; } }),
        delete: () => ({ eq: (column, value) => ({ select: async () => {
          const index = shared.findIndex(item => item[column] === value);
          return { data: index < 0 ? [] : shared.splice(index, 1) };
        } }) })
      };
    }
  };
  const metadata = { files: [
    { name: "1998 Show.avi" },
    { name: "1998 Show.mp4", original: "1998 Show.avi" },
    { name: "1998 Show.ia.mp4", original: "1998 Show.mp4" },
    { name: "1999 Other & show.mp4", source: "original" },
    { name: "notes.txt" }
  ] };
  const window = { STERN_ARCHIVE_CONFIG: { supabaseUrl: "https://example.test", supabaseAnonKey: "key" }, supabase: { createClient: () => client } };
  const context = { document, window, URL, console: { error() {} }, confirm: () => true,
    fetch: fetchImpl || (async () => ({ ok: true, json: async () => metadata })) };
  document.getElementById("addVideoForm").button = new Element();
  document.getElementById("signInForm").button = new Element();
  vm.runInNewContext(fs.readFileSync("videos.js", "utf8"), context);
  return { elements, document, shared };
}

const tick = () => new Promise(resolve => setImmediate(resolve));
const click = element => element.dispatchEvent(new Event("click"));
const submit = element => element.dispatchEvent(new Event("submit", { cancelable: true }));

test("browses deduplicated MP4s, filters, and selects encoded video URLs", async () => {
  const { document } = setup();
  await tick();
  const get = id => document.getElementById(id);
  click(get("videoArchives").children[0].children[2].children[0]);
  await tick();
  assert.match(get("videoStatus").textContent, /2 MP4 videos/);
  assert.match(get("videoEmbed").src, /archive\.org\/embed\/1998/);
  assert.equal(get("videoFiles").children.length, 2);
  get("videoSearch").value = "other";
  get("videoSearch").dispatchEvent(new Event("input"));
  assert.equal(get("videoFiles").children.length, 1);
  click(get("videoFiles").children[0]);
  assert.equal(get("videoPlayer").src, "https://archive.org/download/1998.03.11-blockbuster-awards-e/1999%20Other%20%26%20show.mp4");
  assert.equal(get("videoEmbedContainer").hidden, true);
  assert.equal(get("videoPlayerContainer").hidden, false);
});

test("authorized editors add and remove a shared item and reject duplicates and non-archive URLs", async () => {
  const { document, shared } = setup();
  await tick();
  const get = id => document.getElementById(id);
  assert.equal(get("addVideoBtn").disabled, false);
  get("videoArchiveInput").value = "https://archive.org/download/1999-archive/";
  get("videoArchiveTitle").value = "1999";
  submit(get("addVideoForm"));
  await tick();
  assert.equal(shared.length, 1);
  assert.equal(shared[0].archive_id, "1999-archive");
  assert.equal(get("videoArchives").children.length, 2);
  submit(get("addVideoForm"));
  assert.match(get("videoFormMessage").textContent, /already/);
  get("videoArchiveInput").value = "https://example.com/details/example";
  submit(get("addVideoForm"));
  assert.match(get("videoFormMessage").textContent, /Archive.org/);
  click(get("videoArchives").children[1].children[2].children[1]);
  await tick();
  assert.equal(shared.length, 0);
  assert.equal(get("videoArchives").children.length, 1);
});

test("keeps the built-in archive and reports shared database errors", async () => {
  const { document } = setup({ authorized: false, databaseError: true });
  await tick();
  assert.equal(document.getElementById("addVideoBtn").disabled, true);
  assert.equal(document.getElementById("videoArchives").children.length, 1);
  assert.match(document.getElementById("videoMessage").textContent, /missing table/);
});

test("ignores an older archive's metadata response after selecting another", async () => {
  const pending = [];
  const { document } = setup({ fetchImpl: url => new Promise(resolve => pending.push({ url, resolve })) });
  await tick();
  const get = id => document.getElementById(id);
  click(get("videoArchives").children[0].children[2].children[0]);
  click(get("videoArchives").children[0].children[2].children[0]);
  pending[1].resolve({ ok: true, json: async () => ({ files: [{ name: "new.mp4" }] }) });
  await tick();
  pending[0].resolve({ ok: true, json: async () => ({ files: [{ name: "old.mp4" }] }) });
  await tick();
  assert.equal(get("videoFiles").children[0].textContent, "new");
});
