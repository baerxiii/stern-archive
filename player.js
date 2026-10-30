const params = new URLSearchParams(window.location.search);
const archiveId = params.get("archiveId");
const title = params.get("title");
const archiveYear = (() => {
  const match = (title || archiveId || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
})();

let metadata = {};


fetch("metadata.json")
  .then(response => response.json())
  .then(data => {
    metadata = data;
    console.log("Metadata loaded:", metadata);
  })
  .catch(error => {
    console.error("Failed to load metadata.json", error);
  });

 
const pageTitle = document.getElementById("title");
if (pageTitle) {
  pageTitle.textContent = title || "Episodes";
}

const nowPlaying = document.getElementById("nowPlaying");

if (!archiveId) {
  document.body.innerHTML += `
    <p style="color:#f8d7da;padding:20px;">
      Missing archiveId in the URL.
    </p>
  `;
  throw new Error("Missing archiveId");
}

const mainPlayer = document.getElementById("audioPlayer");
if (!mainPlayer) {
  console.error("No audioPlayer element found on the page.");
}

function parseDateFromFileName(fileName) {

  let match =
    fileName.match(/(\d{4})_(\d{2})_(\d{2})/);

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  match =
    fileName.match(/(\d{2})-(\d{2})-(\d{2})/);

  if (match) {
    return new Date(
      2000 + Number(match[3]),
      Number(match[1]) - 1,
      Number(match[2])
    );
  }

  return null;
}

function formatEpisodeLabel(fileName) {

  const date =
    parseDateFromFileName(fileName);

  if (!date) {
    return fileName
      .replace(".mp3", "")
      .replaceAll("_", " ");
  }

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  );
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getMonthKey(fileName) {

  const date =
    parseDateFromFileName(fileName);

  if (!date) return null;

  return {
    date,

    monthLabel:
      date.toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long"
        }
      ),

    dayLabel:
      date.toLocaleDateString(
        "en-US",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        }
      )
  };
}

fetch(`https://archive.org/metadata/${archiveId}`)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Failed to load archive metadata: ${response.status}`);
    }

    return response.json();
  })
  .then(data => {
    if (!mainPlayer) {
      throw new Error("audioPlayer element is missing.");
    }

    const mp3s = (data.files || [])
      .filter(file => typeof file?.name === "string" && file.name.toLowerCase().endsWith(".mp3"))
      .sort((a, b) => {
        const aDate = parseDateFromFileName(a.name, archiveYear)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = parseDateFromFileName(b.name, archiveYear)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate || a.name.localeCompare(b.name);
      });

    const controls = document.createElement("div");
    controls.className = "transport-controls";

    const prevButton = document.createElement("button");
    prevButton.textContent = "◀ Prev";
    prevButton.className = "transport-btn";

    const nextButton = document.createElement("button");
    nextButton.textContent = "Next ▶";
    nextButton.className = "transport-btn";

    const timeDisplay = document.createElement("div");
    timeDisplay.className = "time-display";
    timeDisplay.textContent = "0:00 / 0:00";

    controls.appendChild(prevButton);
    controls.appendChild(nextButton);
    controls.appendChild(timeDisplay);

    mainPlayer.insertAdjacentElement("afterend", controls);

    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search episodes...";
    search.className = "episode-search";
    search.style.marginTop = "18px";
    mainPlayer.parentElement.insertBefore(search, controls.nextSibling);

    const episodeList = document.createElement("div");
    episodeList.className = "episode-list";
    mainPlayer.parentElement.insertBefore(episodeList, search.nextSibling);

    const showNotes = document.createElement("div");
showNotes.id = "showNotes";
showNotes.className = "show-notes";

episodeList.parentElement.insertBefore(
  showNotes,
  episodeList
);

    let currentIndex = -1;

    function updateTimeDisplay() {
      const current = Number(mainPlayer.currentTime) || 0;
      const duration = Number(mainPlayer.duration) || 0;
      timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    }

    function saveCurrentEpisode(file, audioUrl) {
      const displayName = formatEpisodeLabel(file.name);
      localStorage.setItem(
        "currentEpisode",
        JSON.stringify({
          archiveId,
          fileName: file.name,
          displayName,
          audioUrl
        })
      );
    }

function renderNotes(fileName) {

  const date =
    parseDateFromFileName(fileName);

  if (!date) {
    showNotes.innerHTML = "";
    return;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year =
    String(date.getFullYear()).slice(-2);

  const marksFrigginUrl =
    `https://www.marksfriggin.com/news${year}/${month}-${day}.htm`;

  showNotes.innerHTML = `
    <div class="card">
      <h3>📖 Show Notes</h3>

      <a
        href="${marksFrigginUrl}"
        target="_blank"
        class="episode-link">

        Open MarksFriggin Summary

      </a>
    </div>
  `;
}

    function renderNotes(fileName) {

  const date =
    parseDateFromFileName(fileName);

  if (!date || !showNotes) {
    return;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year =
    String(date.getFullYear()).slice(-2);

  const marksFrigginUrl =
    `https://www.marksfriggin.com/news${year}/${month}-${day}.htm`;

  showNotes.innerHTML = `
    <div class="card">

      <h3>📖 Show Notes</h3>

      <p>
        Listen while following along with the
        show summary and segment breakdown.
      </p>

      <a
        href="${marksFrigginUrl}"
        target="_blank"
        class="episode-link"
      >
        Open MarksFriggin Summary
      </a>

    </div>
  `;
}

    
    function loadEpisode(file, { skipResume = false } = {}) {
      if (!file) return;

      currentIndex = mp3s.findIndex(item => item.name === file.name);
      const audioUrl = `https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`;
      const positionKey = `${archiveId}_${file.name}`;
      const displayName = formatEpisodeLabel(file.name);
      renderNotes(file.name);

      mainPlayer.src = audioUrl;
      if (nowPlaying) {
        nowPlaying.textContent = displayName;
      }
      saveCurrentEpisode(file, audioUrl);

      prevButton.disabled = currentIndex <= 0;
      nextButton.disabled = currentIndex >= mp3s.length - 1;

      if (!skipResume) {
        const savedPosition = localStorage.getItem(positionKey);
        if (savedPosition) {
          const restorePosition = () => {
            mainPlayer.currentTime = parseFloat(savedPosition);
            mainPlayer.removeEventListener("loadedmetadata", restorePosition);
          };
          mainPlayer.addEventListener("loadedmetadata", restorePosition, { once: true });
        }
      }

      mainPlayer.play().catch(() => {});
    }

    function goToEpisode(offset) {
      if (currentIndex < 0) {
        if (mp3s.length) {
          loadEpisode(mp3s[0]);
        }
        return;
      }

      const nextIndex = currentIndex + offset;
      if (nextIndex >= 0 && nextIndex < mp3s.length) {
        loadEpisode(mp3s[nextIndex]);
      }
    }

    prevButton.addEventListener("click", () => goToEpisode(-1));
    nextButton.addEventListener("click", () => goToEpisode(1));

    mainPlayer.addEventListener("loadedmetadata", updateTimeDisplay);
    mainPlayer.addEventListener("timeupdate", updateTimeDisplay);
    mainPlayer.addEventListener("ended", () => {
      if (currentIndex >= 0 && currentIndex < mp3s.length - 1) {
        loadEpisode(mp3s[currentIndex + 1]);
      }
    });

    function renderEpisodes(filter = "") {
      episodeList.innerHTML = "";

      const grouped = {};
      const normalizedFilter = filter.trim().toLowerCase();

      mp3s
        .filter(file => file.name.toLowerCase().includes(normalizedFilter))
        .forEach(file => {
          const monthInfo = getMonthKey(file.name);
          const monthKey = monthInfo ? monthInfo.monthLabel : "Unsorted";
          const displayName = monthInfo ? monthInfo.dayLabel : file.name.replace(/\.[^/.]+$/, "");

          if (!grouped[monthKey]) {
            grouped[monthKey] = [];
          }

          grouped[monthKey].push({
            file,
            displayName,
            date: monthInfo ? monthInfo.date : new Date(0)
          });
        });

      if (Object.keys(grouped).length === 0) {
        episodeList.innerHTML = `<p class="empty-state-text">No episodes found.</p>`;
        return;
      }

      const monthEntries = Object.entries(grouped).sort(([a], [b]) => {
        const aTime = new Date(a).getTime();
        const bTime = new Date(b).getTime();
        if (a === "Unsorted") return 1;
        if (b === "Unsorted") return -1;
        return aTime - bTime;
      });

      monthEntries.forEach(([month, entries], index) => {
        const group = document.createElement("details");
        group.className = "month-group";
        group.open = index === 0;

        const summary = document.createElement("summary");
        summary.className = "month-summary";
        summary.innerHTML = `<span>📅 ${month}</span><span class="month-count">${entries.length}</span>`;

        const list = document.createElement("div");
        list.className = "month-list";

        entries
          .sort((a, b) => a.date - b.date)
          .forEach(item => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "episode-card";
            card.textContent = item.displayName;
            card.addEventListener("click", () => loadEpisode(item.file));
            list.appendChild(card);
          });

        group.appendChild(summary);
        group.appendChild(list);
        episodeList.appendChild(group);
      });
    }

    search.addEventListener("input", event => {
      renderEpisodes(event.target.value);
    });

    renderEpisodes();

    setInterval(() => {
      const currentEpisode = JSON.parse(localStorage.getItem("currentEpisode") || "null");
      if (!currentEpisode || !mainPlayer.src) {
        return;
      }

      const position = Number(mainPlayer.currentTime);
      if (!Number.isFinite(position) || position <= 0) {
        return;
      }

      const key = `${currentEpisode.archiveId}_${currentEpisode.fileName}`;
      localStorage.setItem(key, String(position));
    }, 5000);

    const lastEpisode = JSON.parse(localStorage.getItem("currentEpisode") || "null");

    if (lastEpisode && lastEpisode.archiveId === archiveId) {
      const resumeButton = document.createElement("button");
      resumeButton.textContent = "Resume last episode";
      resumeButton.className = "resume-btn";

      resumeButton.addEventListener("click", () => {
        const file = mp3s.find(item => item.name === lastEpisode.fileName);
        if (file) {
          loadEpisode(file, { skipResume: false });
        }
      });

      mainPlayer.parentElement.insertBefore(resumeButton, search);
      if (nowPlaying) {
        nowPlaying.textContent = `Resume: ${lastEpisode.displayName || lastEpisode.fileName}`;
      }

      const file = mp3s.find(item => item.name === lastEpisode.fileName);
      if (file) {
        loadEpisode(file, { skipResume: false });
      } else {
        mainPlayer.src = lastEpisode.audioUrl;
      }

      const key = `${lastEpisode.archiveId}_${lastEpisode.fileName}`;
      const savedPosition = localStorage.getItem(key);
      if (savedPosition) {
        mainPlayer.addEventListener(
          "loadedmetadata",
          () => {
            mainPlayer.currentTime = parseFloat(savedPosition);
          },
          { once: true }
        );
      }
    }
  })
  .catch(error => {
    console.error(error);
    document.body.innerHTML += `
      <p style="color:#f8d7da;padding:20px;">
        Error loading archive.
      </p>
    `;
  });
