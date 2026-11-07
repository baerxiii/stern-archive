(() => {
  const KEY = "sternListeningHistoryV1";

  function read() {
    try {
      const entries = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(entries)) throw new Error("Invalid listening history");
      return entries;
    } catch (error) {
      console.error("Could not read listening history", error);
      throw error;
    }
  }

  function write(entries) {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }

  function idFor(item) {
    return JSON.stringify([item.type, item.collectionId, item.trackId]);
  }

  function urlFor(item) {
    const query = new URLSearchParams();
    if (item.type === "archive") {
      query.set("archiveId", item.collectionId);
      query.set("title", item.collectionTitle);
      query.set("file", item.trackId);
      return `player.html?${query}`;
    }
    if (item.type === "podcast") {
      query.set("rss", item.collectionId);
      query.set("episode", item.trackId);
      return `podcast-player.html?${query}`;
    }
    query.set("id", item.collectionId);
    query.set("track", item.trackId);
    return `audiobook-player.html?${query}`;
  }

  function find(item) {
    return read().find(entry => entry.id === idFor(item));
  }

  function save(item, position, duration, completed = false) {
    const entries = read();
    const id = idFor(item);
    const entry = {
      ...item, id, position: Math.max(0, position),
      duration: Number.isFinite(duration) && duration > 0 ? duration : null,
      completed, updatedAt: Date.now()
    };
    write([entry, ...entries.filter(existing => existing.id !== id)]);
  }

  function legacyPosition(item) {
    if (item.type === "archive") {
      const value = Number(localStorage.getItem(`${item.collectionId}_${item.trackId}`));
      return Number.isFinite(value) && value > 0 ? value : 0;
    }
    if (item.type === "audiobook") {
      try {
        const old = JSON.parse(localStorage.getItem("currentAudiobook") || "null");
        if (old && old.identifier === item.collectionId &&
            (old.audioUrl === item.audioUrl || old.audioUrl === `https://archive.org/download/${item.collectionId}/${item.trackId}`)) {
          return Number(old.position) || 0;
        }
      } catch (error) {
        console.error("Could not read previous audiobook position", error);
      }
    }
    return 0;
  }

  function attach(audio) {
    let current = null;
    let started = false;
    let restoring = false;
    let restoreHandler = null;
    let lastSave = 0;

    const status = document.createElement("p");
    status.className = "playback-status";
    status.setAttribute("role", "status");
    const controls = document.createElement("div");
    controls.className = "playback-extras";
    controls.innerHTML = '<button type="button" data-skip="-30" aria-label="Back 30 seconds">↶ 30 sec</button><button type="button" data-skip="30" aria-label="Forward 30 seconds">30 sec ↷</button><label>Speed <select aria-label="Playback speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>';
    audio.insertAdjacentElement("afterend", controls);
    controls.insertAdjacentElement("afterend", status);

    controls.querySelectorAll("[data-skip]").forEach(button => {
      button.addEventListener("click", () => {
        if (!current || !Number.isFinite(audio.duration)) return;
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + Number(button.dataset.skip)));
      });
    });
    controls.querySelector("select").addEventListener("change", event => {
      audio.playbackRate = Number(event.target.value);
    });

    function flush(completed = false) {
      if (!current || !started || restoring || !Number.isFinite(audio.currentTime)) return;
      try {
        save(current, audio.currentTime, audio.duration, completed);
        status.textContent = "";
        lastSave = Date.now();
      } catch (error) {
        console.error("Could not save listening position", error);
        status.textContent = "Could not save your listening position. Check your browser storage.";
      }
    }

    audio.addEventListener("play", () => { started = true; flush(); });
    audio.addEventListener("timeupdate", () => {
      if (Date.now() - lastSave >= 5000) flush(audio.ended);
    });
    audio.addEventListener("seeked", () => flush());
    audio.addEventListener("pause", () => flush(audio.ended));
    audio.addEventListener("ended", () => flush(true));
    audio.addEventListener("error", () => {
      status.textContent = "Audio could not be loaded. The source may be unavailable.";
    });
    window.addEventListener("pagehide", () => flush(audio.ended));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(audio.ended);
    });

    function load(item, autoplay = true) {
      flush(audio.ended);
      if (restoreHandler) audio.removeEventListener("loadedmetadata", restoreHandler);
      current = item;
      started = false;
      restoring = true;
      let position = 0;
      try {
        const saved = find(item);
        position = saved ? (saved.completed ? 0 : saved.position) : legacyPosition(item);
      } catch (error) {
        status.textContent = "Could not read your listening history. Check your browser storage.";
      }
      restoreHandler = () => {
        if (Number.isFinite(position) && position > 0) {
          audio.currentTime = Number.isFinite(audio.duration) ? Math.min(position, audio.duration) : position;
        }
        restoring = false;
        restoreHandler = null;
        if (started) flush();
      };
      audio.addEventListener("loadedmetadata", restoreHandler, { once: true });
      audio.src = item.audioUrl;
      if (autoplay) {
        const request = audio.play();
        if (request) request.catch(error => {
          console.error("Playback could not start", error);
          status.textContent = "Press play to start listening.";
        });
      }
    }

    return { load, flush };
  }

  window.ListeningHistory = { read, find, save, idFor, urlFor, attach, key: KEY };
})();
