const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("sorts each category oldest first and puts undated entries last", async () => {
  class Element extends EventTarget {
    constructor() {
      super();
      this.children = [];
      this.value = "";
      this.textContent = "";
      this.classList = { toggle() {}, add() {} };
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
  }
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() { return new Element(); }
  };
  const defaults = [
    { title: "Year 2002", archiveId: "2002", year: "2002" },
    { title: "Year 2006", archiveId: "2006", year: "2006" }
  ];
  const remote = [
    { title: "Year 1997", archive_id: "1997", year: "1997", category: "Stern Show" },
    { title: "B 2002", archive_id: "b-2002", year: "2002", category: "Stern Show" },
    { title: "Other 2010", archive_id: "other-2010", year: "2010", category: "Other" },
    { title: "Other 2000", archive_id: "other-2000", year: "2000", category: "Other" }
  ];
  const local = [
    { title: "A undated", archiveId: "undated-a", year: "  " },
    { title: "B undated", archiveId: "undated-b", year: null }
  ];
  const client = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from(table) {
      if (table === "custom_library") {
        return { select: () => ({ order: async () => ({ data: remote, error: null }) }) };
      }
      return { select: async () => ({ data: [], error: null }) };
    }
  };
  const window = new EventTarget();
  window.STERN_ARCHIVE_CONFIG = { supabaseUrl: "https://example.test", supabaseAnonKey: "public" };
  window.supabase = { createClient: () => client };
  const context = {
    document, window, URLSearchParams, console,
    localStorage: { getItem: () => JSON.stringify(local) },
    fetch: async () => ({ ok: true, json: async () => defaults })
  };
  vm.runInNewContext(fs.readFileSync("app.js", "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));

  const groups = document.getElementById("library").children;
  const titles = group => group.children[1].children.map(row => row.children[0].children[0].textContent);
  assert.equal(groups[0].children[0].children[0].textContent, "Other");
  assert.deepEqual(titles(groups[0]), ["Other 2000", "Other 2010"]);
  assert.equal(groups[1].children[0].children[0].textContent, "Stern Show");
  assert.deepEqual(titles(groups[1]), [
    "Year 1997", "B 2002", "Year 2002", "Year 2006", "A undated", "B undated"
  ]);
});
