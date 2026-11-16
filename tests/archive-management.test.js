const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("authorized editors can edit a shared archive", async () => {
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
    setAttribute() {}
    focus() {}
    scrollIntoView() {}
  }

  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() { return new Element(); }
  };
  const shared = [{ id: "archive-1", archive_id: "show-1", title: "Original", year: "2001", category: "Stern Show" }];
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "editor" } } } }) },
    from(table) {
      if (table === "library_editors") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "editor" } }) }) }) };
      }
      if (table === "custom_library") {
        return {
          select: () => ({ order: async () => ({ data: shared, error: null }) }),
          update: values => ({
            eq: (column, id) => ({
              select: async () => {
                const item = shared.find(entry => entry[column] === id);
                Object.assign(item, values);
                return { data: [{ id }], error: null };
              }
            })
          })
        };
      }
      return {
        select: async () => ({ data: [], error: null })
      };
    }
  };
  const window = new EventTarget();
  window.STERN_ARCHIVE_CONFIG = { supabaseUrl: "https://example.test", supabaseAnonKey: "public" };
  window.supabase = { createClient: () => client };
  const context = {
    document, window, URLSearchParams, console: { error() {} },
    localStorage: { getItem: () => "[]", setItem() {} },
    fetch: async () => ({ ok: true, json: async () => [] })
  };

  vm.runInNewContext(fs.readFileSync("app.js", "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));
  const row = document.getElementById("library").children[0].children[1].children[0];
  row.children[1].children[1].dispatchEvent(new Event("click"));
  assert.equal(document.getElementById("archiveTitle").value, "Original");

  document.getElementById("archiveTitle").value = "Updated";
  document.getElementById("saveArchiveBtn").dispatchEvent(new Event("click"));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(shared[0].title, "Updated");
  assert.equal(document.getElementById("library").children[0].children[1].children[0].children[0].children[0].textContent, "Updated");
  assert.equal(document.getElementById("libraryMessage").textContent, "Archive updated.");
});
