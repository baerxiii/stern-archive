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

async function setup({ query = "?id=book", history = [], old = null } = {}) {
  class Element extends EventTarget {
    constructor() {
      super();
      this.children = [];
      this.textContent = "";
      this.classList = { toggle() {} };
    }
    appendChild(child) { this.children.push(child); }
    insertAdjacentText(_where, text) { this.textContent += text; }
  }
  const elements = Object.fromEntries(
    ["bookTitle", "audioPlayer", "chapters", "bookAuthor", "bookDescription", "bookCover", "bookNowPlaying"]
      .map(id => [id, new Element()])
  );
  const loads = [];
  const context = {
    URLSearchParams, console, location: { search: query },
    document: { getElementById: id => elements[id], createElement: () => new Element() },
    localStorage: { getItem: () => old && JSON.stringify(old) },
    fetch: async () => ({ ok: true, json: async () => ({ files, metadata: { title: "Book" } }) }),
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
  assert.equal(elements.chapters.children[0].children[1].textContent, "2:47");
  assert.equal(elements.chapters.children[1].children[1].textContent, "16:25");
  assert.equal(loads[0].item.trackId, "intro.mp3");
  elements.audioPlayer.dispatchEvent(new Event("ended"));
  assert.equal(loads[1].item.trackId, "chapter.mp3");
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
  elements.audioPlayer.dispatchEvent(new Event("ended"));
  assert.equal(loads[1].item.trackId, "chapter_64kb.mp3");

  const restored = await setup({ history });
  assert.equal(restored.loads[0].item.trackId, "chapter_64kb.mp3");
  restored.elements.chapters.children[0].dispatchEvent(new Event("click"));
  assert.equal(restored.loads[1].item.trackId, "intro_64kb.mp3");
});

test("restores legacy derivative and reports missing deep links", async () => {
  const restored = await setup({
    old: { identifier: "book", audioUrl: "https://archive.org/download/book/intro_64kb.mp3" }
  });
  assert.equal(restored.loads[0].item.trackId, "intro_64kb.mp3");
  const missing = await setup({ query: "?id=book&track=missing.mp3" });
  assert.equal(missing.loads.length, 0);
  assert.match(missing.elements.chapters.textContent, /no longer available/);
});
