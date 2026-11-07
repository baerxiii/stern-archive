const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const files = [
  { name: "intro.mp3", source: "original", title: "00 - Introduction", length: "167.56" },
  { name: "intro_64kb.mp3", source: "derivative", original: "intro.mp3", title: "00 - Introduction", length: "02:47" },
  { name: "chapter.mp3", source: "original", title: "01 - Section 01", length: "985.48" },
  { name: "chapter_64kb.mp3", source: "derivative", original: "chapter.mp3", title: "01 - Section 01", length: "16:25" },
  { name: "separate.mp3", source: "original", title: "01 - Section 01", length: "985.48" },
  { name: "lossless.flac", source: "original" },
  { name: "lossless_vbr.mp3", source: "derivative", original: "lossless.flac", title: "Lossless chapter" },
  { name: "lossless_64.mp3", source: "derivative", original: "lossless.flac", title: "Lossless chapter" }
];

async function setup({ query = "?id=book", history = [], old = null, bookFiles = files, responseOk = true } = {}) {
  class Element extends EventTarget {
    constructor() {
      super();
      this.children = [];
      this.textContent = "";
      this.classList = { toggle() {} };
    }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    insertAdjacentText(_where, text) { this.textContent += text; }
    get options() { return this.children; }
  }
  const elements = Object.fromEntries(
    ["bookTitle", "audioPlayer", "chapters", "bookAuthor", "bookDescription", "bookCover", "bookNowPlaying", "chapterSelect"]
      .map(id => [id, new Element()])
  );
  elements.chapterSelect.disabled = true;
  elements.chapterSelect.appendChild(new Element());
  const loads = [];
  const context = {
    URLSearchParams, console, location: { search: query },
    document: { getElementById: id => elements[id], createElement: () => new Element() },
    localStorage: { getItem: () => old && JSON.stringify(old) },
    fetch: async () => ({ ok: responseOk, status: 500, json: async () => ({ files: bookFiles, metadata: { title: "Book" } }) }),
    ListeningHistory: {
      attach: () => ({ load: (item, autoplay) => loads.push({ item, autoplay }) }),
      read: () => history
    }
  };
  vm.runInNewContext(fs.readFileSync("audiobook-player.js", "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));
  return { elements, loads };
}

test("groups actual derivatives, preserves independent chapters, and advances once", async () => {
  const { elements, loads } = await setup();
  assert.equal(elements.chapters.children.length, 4);
  assert.equal(elements.chapterSelect.children.length, 4);
  assert.equal(elements.chapterSelect.disabled, false);
  assert.equal(elements.chapterSelect.value, "0");
  assert.equal(elements.chapters.children[0].children[1].textContent, "2:47");
  assert.equal(elements.chapters.children[1].children[1].textContent, "16:25");
  assert.equal(loads[0].item.trackId, "intro.mp3");
  elements.audioPlayer.dispatchEvent(new Event("ended"));
  assert.equal(loads[1].item.trackId, "chapter.mp3");
  assert.equal(elements.chapterSelect.value, "1");
  elements.audioPlayer.dispatchEvent(new Event("ended"));
  assert.equal(loads[2].item.trackId, "separate.mp3");
});

test("restores and opens the exact saved derivative, including on later chapter clicks", async () => {
  const history = [
    { type: "audiobook", collectionId: "book", trackId: "chapter_64kb.mp3" },
    { type: "audiobook", collectionId: "book", trackId: "intro_64kb.mp3" },
    { type: "audiobook", collectionId: "book", trackId: "intro.mp3" }
  ];
  const { elements, loads } = await setup({ query: "?id=book&track=intro_64kb.mp3", history });
  assert.equal(elements.chapters.children.length, 4);
  assert.equal(loads[0].item.trackId, "intro_64kb.mp3");
  assert.equal(elements.chapterSelect.value, "0");
  elements.audioPlayer.dispatchEvent(new Event("ended"));
  assert.equal(loads[1].item.trackId, "chapter_64kb.mp3");

  const restored = await setup({ history });
  assert.equal(restored.loads[0].item.trackId, "chapter_64kb.mp3");
  assert.equal(restored.elements.chapterSelect.value, "1");
  restored.elements.chapters.children[0].dispatchEvent(new Event("click"));
  assert.equal(restored.loads[1].item.trackId, "intro_64kb.mp3");
  assert.equal(restored.elements.chapterSelect.value, "0");
  restored.elements.chapterSelect.value = "1";
  restored.elements.chapterSelect.dispatchEvent(new Event("change"));
  assert.equal(restored.loads[2].item.trackId, "chapter_64kb.mp3");
  assert.equal(restored.loads[2].autoplay, true);
});

test("restores legacy derivative and reports missing deep links", async () => {
  const restored = await setup({
    old: { identifier: "book", audioUrl: "https://archive.org/download/book/intro_64kb.mp3" }
  });
  assert.equal(restored.loads[0].item.trackId, "intro_64kb.mp3");
  const missing = await setup({ query: "?id=book&track=missing.mp3" });
  assert.equal(missing.loads.length, 0);
  assert.match(missing.elements.chapters.textContent, /no longer available/);
  assert.equal(missing.elements.chapterSelect.selectedIndex, -1);
  missing.elements.chapterSelect.value = "0";
  missing.elements.chapterSelect.dispatchEvent(new Event("change"));
  assert.equal(missing.loads[0].item.trackId, "intro.mp3");
});

test("keeps the selector disabled when no chapters can be loaded", async () => {
  const empty = await setup({ bookFiles: [] });
  assert.equal(empty.elements.chapterSelect.disabled, true);
  assert.equal(empty.elements.chapterSelect.options[0].textContent, "No chapters available");
  const failed = await setup({ responseOk: false });
  assert.equal(failed.elements.chapterSelect.disabled, true);
  assert.equal(failed.elements.chapterSelect.options[0].textContent, "Chapters unavailable");
});
