(() => {
  const card = document.getElementById("homeNowPlaying");
  if (!card) return;

  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function renderRecentlyPlayed() {
    let episode;
    try {
      episode = JSON.parse(localStorage.getItem("currentEpisode") || "null");
    } catch (error) {
      episode = null;
    }

    if (!episode || !episode.archiveId || !episode.fileName) {
      card.innerHTML = `
        <div class="recent-art" aria-hidden="true">♫</div>
        <div class="recent-copy"><span class="status-pill">Ready when you are</span><h3>No episodes played yet</h3><p>Choose an archive and your latest episode will be waiting here.</p><a class="text-link" href="library.html">Browse the library <span aria-hidden="true">→</span></a></div>
      `;
      return;
    }

    const title = episode.archiveTitle || episode.title || "Stern Archive";
    const episodeName = episode.displayName || episode.fileName.replace(/\.[^.]+$/, "").replaceAll("_", " ");
    const playerUrl = `player.html?archiveId=${encodeURIComponent(episode.archiveId)}&title=${encodeURIComponent(title)}`;
    card.innerHTML = `
      <div class="recent-art playing-art" aria-hidden="true"><span>♫</span><div class="mini-wave"><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="recent-copy"><span class="status-pill"><span class="status-dot"></span> Last played</span><h3>${escapeHtml(episodeName)}</h3><p>${escapeHtml(title)}</p></div>
      <a class="resume-link" href="${playerUrl}" aria-label="Resume ${escapeHtml(episodeName)}">Resume <span aria-hidden="true">▶</span></a>
    `;
  }

  renderRecentlyPlayed();
  window.addEventListener("storage", (event) => {
    if (event.key === "currentEpisode") renderRecentlyPlayed();
  });
})();
