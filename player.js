const params = new URLSearchParams(window.location.search);
const archiveId = params.get("archiveId");
const title = params.get("title");

const pageTitle = document.getElementById("title");
if (pageTitle) {
  pageTitle.textContent = title || "Episodes";
}

if (!archiveId) {
  document.body.innerHTML += `
    <p style="color:#f8d7da;padding:20px;">
      Missing archiveId in the URL.
    </p>
  `;
  throw new Error("Missing archiveId");
}

function parseDateFromFileName(fileName) {
  const match = fileName.match(/(\d{4})_(\d{2})_(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(`${year}-${month}-${day}T00:00:00`);
}

function formatEpisodeLabel(fileName) {
  const date = parseDateFromFileName(fileName);
  if (!date) {
    return fileName;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit"
  });
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
  const date = parseDateFromFileName(fileName);
  if (!date) return null;

  return {
    date,
    monthLabel: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long"
    }),
    dayLabel: formatEpisodeLabel(fileName)
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
    const mp3s = (data.files || [])
      .filter(file => typeof file?.name === "string" && file.name.toLowerCase().endsWith(".mp3"))
      .sort((a, b) => {
        const aDate = parseDateFromFileName(a.name)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = parseDateFromFileName(b.name)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate || a.name.localeCompare(b.name);
      });

    const playerArea = document.createElement("div");
    playerArea.className = "card";
    playerArea.innerHTML = `
      <h2 id="nowPlaying">Select an Episode</h2>
      <audio id="mainPlayer" controls style="width:100%;margin-top:10px;"></audio>
    `;
    document.body.appendChild(playerArea);

    const mainPlayer = document.getElementById("mainPlayer");
    const nowPlaying = document.getElementById("nowPlaying");

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "10px";
    controls.style.alignItems = "center";
    controls.style.margin = "12px 0 20px";
    controls.style.flexWrap = "wrap";

    const prevButton = document.createElement("button");
    prevButton.textContent = "◀ Prev";
    prevButton.style.padding = "10px 14px";
    prevButton.style.border = "none";
    prevButton.style.borderRadius = "8px";
    prevButton.style.background = "#2d2d2d";
    prevButton.style.color = "white";
    prevButton.style.cursor = "pointer";

    const nextButton = document.createElement("button");
    nextButton.textContent = "Next ▶";
    nextButton.style.padding = "10px 14px";
    nextButton.style.border = "none";
    nextButton.style.borderRadius = "8px";
    nextButton.style.background = "#2d2d2d";
    nextButton.style.color = "white";
    nextButton.style.cursor = "pointer";

    const timeDisplay = document.createElement("div");
    timeDisplay.textContent = "0:00 / 0:00";
    timeDisplay.style.fontSize = "14px";
    timeDisplay.style.color = "#d0d0d0";
    timeDisplay.style.marginLeft = "6px";

    controls.appendChild(prevButton);
    controls.appendChild(nextButton);
    controls.appendChild(timeDisplay);
    document.body.appendChild(controls);

    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search episodes...";
    search.style.width = "100%";
    search.style.padding = "12px";
    search.style.margin = "20px 0";
    search.style.background = "#1d1d1d";
    search.style.color = "white";
    search.style.border = "none";
    search.style.borderRadius = "8px";
    document.body.appendChild(search);

    const episodeList = document.createElement("div");
    episodeList.className = "episode-list";
    document.body.appendChild(episodeList);

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

    function loadEpisode(file, { skipResume = false } = {}) {
      if (!file) return;

      currentIndex = mp3s.findIndex(item => item.name === file.name);
      const audioUrl = `https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`;
      const positionKey = `${archiveId}_${file.name}`;
      const displayName = formatEpisodeLabel(file.name);

      mainPlayer.src = audioUrl;
      nowPlaying.textContent = displayName;
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

      mainPlayer.play().catch(err => {
        console.log("Autoplay blocked:", err);
      });
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
          if (!monthInfo) return;

          if (!grouped[monthInfo.monthLabel]) {
            grouped[monthInfo.monthLabel] = [];
          }

          grouped[monthInfo.monthLabel].push({
            file,
            displayName: monthInfo.dayLabel,
            date: monthInfo.date
          });
        });

      if (Object.keys(grouped).length === 0) {
        episodeList.innerHTML = `<p style="padding:12px;">No episodes found.</p>`;
        return;
      }

      Object.keys(grouped)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .forEach(month => {
          const header = document.createElement("h2");
          header.textContent = `📅 ${month}`;
          header.style.marginTop = "30px";
          episodeList.appendChild(header);

          grouped[month]
            .sort((a, b) => a.date - b.date)
            .forEach(item => {
              const card = document.createElement("div");
              card.className = "card";
              card.style.cursor = "pointer";
              card.innerHTML = `<h3>▶ ${item.displayName}</h3>`;
              card.addEventListener("click", () => loadEpisode(item.file));
              episodeList.appendChild(card);
            });
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
      resumeButton.style.margin = "12px 0 20px";
      resumeButton.style.padding = "10px 14px";
      resumeButton.style.border = "none";
      resumeButton.style.borderRadius = "8px";
      resumeButton.style.background = "#2d2d2d";
      resumeButton.style.color = "white";
      resumeButton.style.cursor = "pointer";

      resumeButton.addEventListener("click", () => {
        const file = mp3s.find(item => item.name === lastEpisode.fileName);
        if (file) {
          loadEpisode(file, { skipResume: false });
        }
      });

      document.body.insertBefore(resumeButton, search);
      nowPlaying.textContent = `Resume: ${lastEpisode.displayName || lastEpisode.fileName}`;

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
