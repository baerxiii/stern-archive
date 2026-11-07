(() => {
  const sections = {
    archive: document.getElementById("archiveHistory"),
    podcast: document.getElementById("podcastHistory"),
    audiobook: document.getElementById("audiobookHistory")
  };
  const errorEl = document.getElementById("historyError");

  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const remainder = String(seconds % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
  }

  function render() {
    let entries;
    try {
      entries = ListeningHistory.read().sort((a, b) => b.updatedAt - a.updatedAt);
      errorEl.textContent = "";
    } catch (error) {
      errorEl.textContent = "Could not read your listening history. Check your browser storage.";
      return;
    }

    Object.entries(sections).forEach(([type, container]) => {
      container.replaceChildren();
      const items = entries.filter(entry => entry.type === type);
      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "history-empty";
        empty.textContent = "Nothing played here yet.";
        container.appendChild(empty);
        return;
      }
      items.forEach(item => {
        const card = document.createElement("article");
        card.className = "history-item";
        const copy = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = item.title;
        const collection = document.createElement("p");
        collection.textContent = item.collectionTitle;
        const meta = document.createElement("p");
        meta.className = "history-meta";
        const progress = item.completed ? "Finished" : `${formatTime(item.position)}${item.duration ? ` / ${formatTime(item.duration)}` : ""}`;
        meta.textContent = `${progress} · Last played ${new Date(item.updatedAt).toLocaleString()}`;
        copy.append(title, collection, meta);
        const link = document.createElement("a");
        link.className = "resume-link";
        link.href = ListeningHistory.urlFor(item);
        link.textContent = item.completed ? "Play again" : "Resume";
        card.append(copy, link);
        container.appendChild(card);
      });
    });
  }

  render();
  window.addEventListener("storage", event => {
    if (event.key === ListeningHistory.key) render();
  });
})();
