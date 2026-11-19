const params = new URLSearchParams(window.location.search);
const archiveId = params.get("archiveId") || "";
const title = params.get("title");

const archiveYear = (() => {
  const fullYearMatch = archiveId.match(/(19|20)\d{2}/);
  if (fullYearMatch) {
    return Number(fullYearMatch[0]);
  }

  const shortYearMatch = archiveId.match(/-(\d{2})-cf/i);
  if (shortYearMatch) {
    const yy = Number(shortYearMatch[1]);
    return yy >= 70 ? 1900 + yy : 2000 + yy;
  }

  return null;
})();

console.log("archiveYear =", archiveYear);

document.getElementById("backButton")?.addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.location.href = "library.html";
  }
});

let segmentData = {};
let segmentOffsetMinutes = 0; // Per-show offset in minutes (negative for commercial-free edits)

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
const playback = ListeningHistory.attach(mainPlayer);

function normalizeTwoDigitYear(yy, fallbackYear = archiveYear) {
  const num = Number(yy);
  if (!Number.isFinite(num)) return null;
  if (fallbackYear && fallbackYear % 100 === num) {
    return fallbackYear;
  }
  return num >= 65 ? 1900 + num : 2000 + num;
}

function parseDateFromFileName(fileName, fallbackYear = archiveYear) {
  if (!fileName) return null;

  // 1. 4-digit year first: YYYY_MM_DD, YYYY-MM-DD, YYYY.MM.DD
  let match = fileName.match(/(19\d{2}|20\d{2})[._-](\d{2})[._-](\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  // 2. Compact 8-digit date: YYYYMMDD
  match = fileName.match(/(?:^|[^0-9])(19\d{2}|20\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  // 3. MM-DD-YY or MM_DD_YY
  match = fileName.match(/(?:^|[^0-9])(\d{2})[-_](\d{2})[-_](\d{2})(?:[^0-9]|$)/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = normalizeTwoDigitYear(match[3], fallbackYear);
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  // 4. YY-MM-DD or YY_MM_DD (when first number looks like year or matches archiveYear % 100)
  match = fileName.match(/(?:^|[^0-9])(\d{2})[-_](\d{2})[-_](\d{2})(?:[^0-9]|$)/);
  if (match && fallbackYear && Number(match[1]) === fallbackYear % 100) {
    const year = fallbackYear;
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  return null;
}

function toLocalDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatEpisodeLabel(fileName) {
  const date = parseDateFromFileName(fileName, archiveYear);
  if (!date) {
    return fileName.replace(/\.[^/.]+$/, "").replaceAll("_", " ");
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
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
  const date = parseDateFromFileName(fileName, archiveYear);
  if (!date) return null;

  return {
    date,
    monthLabel: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long"
    }),
    dayLabel: date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  };
}

async function loadSegmentFile(year) {
  try {
    console.log("Trying to load:", `segments/${year}.json`);
    const response = await fetch(`segments/${year}.json`);
    console.log("Response status:", response.status);

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    console.log("Loaded keys:", Object.keys(data).length);
    return data;
  } catch (error) {
    console.error("Segment loading failed:", error);
    return {};
  }
}

function parseBroadcastTimeToMinutes(timeString) {
  if (!timeString) return null;

  const amPmMatch = String(timeString).trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (amPmMatch) {
    let hour = Number(amPmMatch[1]);
    const minute = Number(amPmMatch[2]);
    const period = amPmMatch[3].toLowerCase();

    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    return hour * 60 + minute;
  }

  const twentyFourMatch = String(timeString).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourMatch) {
    return Number(twentyFourMatch[1]) * 60 + Number(twentyFourMatch[2]);
  }

  return null;
}

function estimateSegmentSeconds(timeString, duration, showStartHour = 6, offsetMinutes = segmentOffsetMinutes) {
  const broadcastMins = parseBroadcastTimeToMinutes(timeString);
  if (broadcastMins === null) return 0;

  const startMins = showStartHour * 60;
  const adjustedMins = (broadcastMins - startMins) + Number(offsetMinutes || 0);
  const elapsedSeconds = Math.max(0, adjustedMins * 60);

  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(elapsedSeconds, Math.max(0, duration - 1));
  }

  return elapsedSeconds;
}

function getOffsetStorageKey(fileName) {
  return `sternSegmentOffset:${archiveId}:${fileName}`;
}

function loadSavedOffset(fileName) {
  if (!fileName) return 0;
  try {
    const raw = localStorage.getItem(getOffsetStorageKey(fileName));
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveOffset(fileName, mins) {
  if (!fileName) return;
  try {
    localStorage.setItem(getOffsetStorageKey(fileName), String(mins));
  } catch (error) {
    console.warn("Could not save segment offset:", error);
  }
}

function findSegmentEntry(dateKey) {
  if (!dateKey || !segmentData || typeof segmentData !== "object") return null;
  if (segmentData[dateKey]) return segmentData[dateKey];

  const targetTime = new Date(`${dateKey}T12:00:00`).getTime();
  for (const [key, value] of Object.entries(segmentData)) {
    const candidateTime = new Date(`${key}T12:00:00`).getTime();
    if (Number.isFinite(candidateTime) && Math.abs(targetTime - candidateTime) <= 86400000) {
      return value;
    }
  }

  return null;
}

fetch(`https://archive.org/metadata/${archiveId}`)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Failed to load archive metadata: ${response.status}`);
    }
    return response.json();
  })
  .then(async data => {
    if (!mainPlayer) {
      throw new Error("audioPlayer element is missing.");
    }

    if (archiveYear) {
      segmentData = await loadSegmentFile(archiveYear);
      console.log("Loaded segment file:", archiveYear, "entries:", Object.keys(segmentData).length);
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
    prevButton.type = "button";
    prevButton.textContent = "◀ Prev";
    prevButton.className = "transport-btn";

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.textContent = "Next ▶";
    nextButton.className = "transport-btn";

    const timeDisplay = document.createElement("div");
    timeDisplay.className = "time-display";
    timeDisplay.textContent = "0:00 / 0:00";

    controls.appendChild(prevButton);
    controls.appendChild(nextButton);
    controls.appendChild(timeDisplay);

    document.querySelector(".sticky-player")?.appendChild(controls);

    const archiveEpisodes = document.getElementById("archiveEpisodes");

    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search episodes...";
    search.className = "episode-search";
    search.style.marginTop = "18px";
    archiveEpisodes.appendChild(search);

    const episodeList = document.createElement("div");
    episodeList.className = "episode-list";
    archiveEpisodes.appendChild(episodeList);

    const showNotes = document.createElement("div");
    showNotes.id = "showNotes";
    showNotes.className = "show-notes";
    episodeList.parentElement.insertBefore(showNotes, episodeList);

    let currentIndex = -1;
    let currentFileName = "";

    function updateSegmentTimeHints() {
      const duration = Number(mainPlayer.duration) || 0;
      showNotes.querySelectorAll(".segment-jump").forEach(btn => {
        const rawTime = btn.dataset.time || "";
        const estSec = estimateSegmentSeconds(rawTime, duration, 6, segmentOffsetMinutes);
        const hintEl = btn.querySelector(".segment-offset-time");
        if (hintEl && rawTime) {
          hintEl.textContent = `(~${formatTime(estSec)})`;
        }
      });
    }

    function highlightActiveSegment() {
      if (!showNotes || !mainPlayer) return;
      const buttons = [...showNotes.querySelectorAll(".segment-jump")];
      if (!buttons.length) return;

      const currentTime = Number(mainPlayer.currentTime) || 0;
      const duration = Number(mainPlayer.duration) || 0;

      let activeButton = null;
      for (const btn of buttons) {
        const segStart = estimateSegmentSeconds(btn.dataset.time, duration, 6, segmentOffsetMinutes);
        if (segStart <= currentTime) {
          activeButton = btn;
        } else {
          break;
        }
      }

      buttons.forEach(btn => btn.classList.toggle("is-active", btn === activeButton));
    }

    function setSegmentOffset(newOffset) {
      segmentOffsetMinutes = Number(newOffset) || 0;
      if (currentFileName) {
        saveOffset(currentFileName, segmentOffsetMinutes);
      }

      const input = showNotes.querySelector("#segmentOffsetInput");
      if (input) {
        input.value = String(segmentOffsetMinutes);
      }

      updateSegmentTimeHints();
      highlightActiveSegment();
    }

    function renderSegments(fileName) {
      currentFileName = fileName || "";
      segmentOffsetMinutes = loadSavedOffset(currentFileName);

      const date = parseDateFromFileName(fileName, archiveYear);
      if (!showNotes) return;

      const dateKey = toLocalDateKey(date);
      const entry = findSegmentEntry(dateKey);

      const offsetBarHtml = `
        <div class="segment-offset-bar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;font-size:0.9rem;">
          <label for="segmentOffsetInput"><strong>Time Offset (min):</strong></label>
          <button type="button" class="offset-nudge" data-delta="-5">-5m</button>
          <button type="button" class="offset-nudge" data-delta="-1">-1m</button>
          <input
            id="segmentOffsetInput"
            type="number"
            step="1"
            value="${segmentOffsetMinutes}"
            style="width:70px;"
          />
          <button type="button" class="offset-nudge" data-delta="1">+1m</button>
          <button type="button" class="offset-nudge" data-delta="5">+5m</button>
          <button type="button" class="offset-reset">Reset</button>
        </div>
      `;

      if (!entry || !Array.isArray(entry.segments) || entry.segments.length === 0) {
        showNotes.innerHTML = `
          <div class="card">
            <h3>📖 Topics Discussed</h3>
            ${offsetBarHtml}
            <p>No segment data available for this episode.</p>
          </div>
        `;
        return;
      }

      const duration = Number(mainPlayer.duration) || 0;

      showNotes.innerHTML = `
        <div class="card">
          <h3>📖 Topics Discussed</h3>
          ${offsetBarHtml}
          <ul class="segment-list">
            ${entry.segments
              .map((segment, idx) => {
                const rawTime = segment.time || "";
                const estSec = estimateSegmentSeconds(rawTime, duration, 6, segmentOffsetMinutes);
                const labelTime = rawTime ? `${rawTime} ` : "";
                const hintTime = rawTime ? `<span class="segment-offset-time">(~${formatTime(estSec)})</span>` : "";

                return `
                  <li>
                    <button
                      type="button"
                      class="segment-jump"
                      data-index="${idx}"
                      data-time="${rawTime}"
                    >
                      <strong>${labelTime}</strong>${hintTime} - ${segment.title}
                    </button>
                  </li>
                `;
              })
              .join("")}
          </ul>
        </div>
      `;

      highlightActiveSegment();
    }

    showNotes.addEventListener("click", event => {
      const nudgeBtn = event.target.closest(".offset-nudge");
      if (nudgeBtn) {
        const delta = Number(nudgeBtn.dataset.delta) || 0;
        setSegmentOffset(segmentOffsetMinutes + delta);
        return;
      }

      const resetBtn = event.target.closest(".offset-reset");
      if (resetBtn) {
        setSegmentOffset(0);
        return;
      }

      const jumpBtn = event.target.closest(".segment-jump");
      if (!jumpBtn || !mainPlayer) return;

      const seekTo = estimateSegmentSeconds(
        jumpBtn.dataset.time,
        mainPlayer.duration || 0,
        6,
        segmentOffsetMinutes
      );

      const applySeek = () => {
        mainPlayer.currentTime = seekTo;
        highlightActiveSegment();
        mainPlayer.play().catch(() => {});
      };

      if (mainPlayer.readyState >= 1) {
        applySeek();
      } else {
        mainPlayer.addEventListener("loadedmetadata", applySeek, { once: true });
      }
    });

    showNotes.addEventListener("change", event => {
      if (event.target?.id === "segmentOffsetInput") {
        setSegmentOffset(Number(event.target.value) || 0);
      }
    });

    function updateTimeDisplay() {
      const current = Number(mainPlayer.currentTime) || 0;
      const duration = Number(mainPlayer.duration) || 0;
      timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    }

    function saveCurrentEpisode(file, audioUrl) {
      const displayName = formatEpisodeLabel(file.name);
      try {
        localStorage.setItem(
          "currentEpisode",
          JSON.stringify({
            archiveId,
            fileName: file.name,
            displayName,
            audioUrl,
            archiveTitle: title || "Stern Archive"
          })
        );
      } catch (error) {
        console.error("Could not save the last archive episode", error);
        const statusEl = document.querySelector(".playback-status");
        if (statusEl) {
          statusEl.textContent = "Could not save the last archive episode. Check your browser storage.";
        }
      }
    }

    function loadEpisode(file, { autoplay = true } = {}) {
      if (!file) return;

      currentIndex = mp3s.findIndex(item => item.name === file.name);
      const audioUrl = `https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`;
      const displayName = formatEpisodeLabel(file.name);
      renderSegments(file.name);

      if (nowPlaying) {
        nowPlaying.textContent = displayName;
      }
      saveCurrentEpisode(file, audioUrl);

      prevButton.disabled = currentIndex <= 0;
      nextButton.disabled = currentIndex >= mp3s.length - 1;

      playback.load(
        {
          type: "archive",
          collectionId: archiveId,
          trackId: file.name,
          collectionTitle: title || "Stern Archive",
          title: displayName,
          audioUrl
        },
        autoplay
      );
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

    mainPlayer.addEventListener("loadedmetadata", () => {
      updateTimeDisplay();
      updateSegmentTimeHints();
      highlightActiveSegment();
    });

    mainPlayer.addEventListener("timeupdate", () => {
      updateTimeDisplay();
      highlightActiveSegment();
    });

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

    const lastEpisode = JSON.parse(localStorage.getItem("currentEpisode") || "null");
    const requestedFile = params.get("file");

    if (requestedFile) {
      const file = mp3s.find(item => item.name === requestedFile);
      if (file) loadEpisode(file, { autoplay: false });
      else if (nowPlaying) nowPlaying.textContent = "This episode is no longer available in the archive.";
    } else if (lastEpisode && lastEpisode.archiveId === archiveId) {
      const resumeButton = document.createElement("button");
      resumeButton.textContent = "Resume last episode";
      resumeButton.className = "resume-btn";

      resumeButton.addEventListener("click", () => {
        const file = mp3s.find(item => item.name === lastEpisode.fileName);
        if (file) {
          loadEpisode(file);
        }
      });

      archiveEpisodes.insertBefore(resumeButton, search);
      if (nowPlaying) {
        nowPlaying.textContent = `Resume: ${lastEpisode.displayName || lastEpisode.fileName}`;
      }

      const file = mp3s.find(item => item.name === lastEpisode.fileName);
      if (file) {
        loadEpisode(file, { autoplay: false });
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
