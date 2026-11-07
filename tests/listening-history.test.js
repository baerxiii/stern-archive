const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function setup() {
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value))
  };
  class Element extends EventTarget {
    constructor() {
      super();
      this.dataset = {};
      this.textContent = "";
      this.children = [];
    }
    set innerHTML(value) {
      if (value.includes("data-skip")) {
        this.back = new Element();
        this.back.dataset.skip = "-30";
        this.forward = new Element();
        this.forward.dataset.skip = "30";
        this.speed = new Element();
      }
    }
    setAttribute() {}
    insertAdjacentElement(_where, element) {
      this.next = element;
    }
    querySelectorAll() { return [this.back, this.forward]; }
    querySelector() { return this.speed; }
  }
  class Audio extends Element {
    constructor() {
      super();
      this.currentTime = 0;
      this.duration = 200;
      this.ended = false;
    }
    set src(value) {
      this.source = value;
      this.currentTime = 0;
      this.ended = false;
    }
    get src() { return this.source; }
    play() {
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    }
  }
  const document = new EventTarget();
  document.createElement = () => new Element();
  document.visibilityState = "visible";
  const window = new EventTarget();
  const context = { window, document, localStorage: storage, URLSearchParams, console };
  vm.runInNewContext(fs.readFileSync("listening-history.js", "utf8"), context);
  const audio = new Audio();
  return { history: window.ListeningHistory, audio, storage, window };
}

const item = {
  type: "archive", collectionId: "archive", trackId: "one.mp3",
  title: "One", collectionTitle: "Archive", audioUrl: "/one.mp3"
};
const event = name => new Event(name);

test("saves and restores individual tracks, including completion", () => {
  const { history, audio } = setup();
  const player = history.attach(audio);
  const other = { ...item, trackId: "two.mp3", title: "Two", audioUrl: "/two.mp3" };
  player.load(item);
  audio.dispatchEvent(event("loadedmetadata"));
  audio.currentTime = 75;
  audio.dispatchEvent(event("pause"));
  player.load(other);
  audio.dispatchEvent(event("loadedmetadata"));
  audio.currentTime = 25;
  audio.dispatchEvent(event("pause"));
  player.load(item, false);
  audio.dispatchEvent(event("loadedmetadata"));
  assert.equal(audio.currentTime, 75);
  assert.equal(history.find(other).position, 25);
  audio.dispatchEvent(event("play"));
  audio.currentTime = 200;
  audio.ended = true;
  audio.dispatchEvent(event("ended"));
  assert.equal(history.find(item).completed, true);
  player.load(item, false);
  audio.dispatchEvent(event("loadedmetadata"));
  assert.equal(audio.currentTime, 0);
});

test("does not overwrite a saved position before metadata arrives", () => {
  const { history, audio } = setup();
  history.save(item, 90, 200);
  const player = history.attach(audio);
  player.load(item);
  audio.dispatchEvent(event("pause"));
  assert.equal(history.find(item).position, 90);
  audio.dispatchEvent(event("loadedmetadata"));
  assert.equal(audio.currentTime, 90);
});

test("jump controls clamp to the media duration and speed can change", () => {
  const { history, audio } = setup();
  const player = history.attach(audio);
  player.load(item);
  audio.dispatchEvent(event("loadedmetadata"));
  audio.currentTime = 190;
  audio.next.forward.dispatchEvent(event("click"));
  assert.equal(audio.currentTime, 200);
  audio.currentTime = 5;
  audio.next.back.dispatchEvent(event("click"));
  assert.equal(audio.currentTime, 0);
  audio.next.speed.value = "1.5";
  audio.next.speed.dispatchEvent(event("change"));
  assert.equal(audio.playbackRate, 1.5);
});

test("restores legacy archive and audiobook positions", () => {
  const { history, audio, storage } = setup();
  const player = history.attach(audio);
  storage.setItem("archive_one.mp3", "42");
  player.load(item, false);
  audio.dispatchEvent(event("loadedmetadata"));
  assert.equal(audio.currentTime, 42);
  const book = { type: "audiobook", collectionId: "book", trackId: "part one.mp3",
    title: "Part one", collectionTitle: "Book", audioUrl: "https://archive.org/download/book/part%20one.mp3" };
  storage.setItem("currentAudiobook", JSON.stringify({
    identifier: "book", audioUrl: "https://archive.org/download/book/part one.mp3", position: 63
  }));
  player.load(book, false);
  audio.dispatchEvent(event("loadedmetadata"));
  assert.equal(audio.currentTime, 63);
});

test("creates exact-item links for each category", () => {
  const { history } = setup();
  assert.equal(history.urlFor(item), "player.html?archiveId=archive&title=Archive&file=one.mp3");
  assert.equal(history.urlFor({ ...item, type: "podcast", collectionId: "feed?x=1", trackId: "https://example.com/a.mp3" }),
    "podcast-player.html?rss=feed%3Fx%3D1&episode=https%3A%2F%2Fexample.com%2Fa.mp3");
  assert.equal(history.urlFor({ ...item, type: "audiobook", collectionId: "book", trackId: "part 2.mp3" }),
    "audiobook-player.html?id=book&track=part+2.mp3");
});
