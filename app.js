let libraryData = [];
const CUSTOM_LIBRARY_KEY = "sternArchiveCustomLibrary";

function loadCustomLibrary() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_LIBRARY_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function saveCustomLibrary(items) {
  localStorage.setItem(CUSTOM_LIBRARY_KEY, JSON.stringify(items));
}

function getAllLibraryEntries() {
  const customLibrary = loadCustomLibrary();
  return [...libraryData, ...customLibrary];
}

function normalizeArchiveId(rawValue) {
  if (!rawValue) return "";

  const cleaned = rawValue.trim();
  if (!cleaned) return "";

  const match = cleaned.match(/(?:\/details\/|\/metadata\/|\/download\/)([^/?#]+)/i);
  const directId = match ? match[1] : cleaned;

  return directId.replace(/\?.*$/, "").replace(/#.*$/, "").trim();
}

async function validateArchiveId(archiveId) {
  const response = await fetch(`https://archive.org/metadata/${archiveId}`);

  if (!response.ok) {
    throw new Error("That archive could not be found on Archive.org.");
  }

  const data = await response.json();
  const mp3Exists = (data.files || []).some(file =>
    typeof file?.name === "string" && file.name.toLowerCase().endsWith(".mp3")
  );

  if (!mp3Exists) {
    throw new Error("This archive does not appear to contain MP3 files.");
  }

  return data;
}

function buildLibrary(items) {
  const library = document.getElementById("library");

  if (!library) return;

  library.innerHTML = "";

  items.forEach(item => {
    library.innerHTML += `
      <article class="library-card card">
        <div class="card-topline">
          <span class="status-pill">${item.year || "Archive"}</span>
        </div>
        <h3>${item.title}</h3>
        <p>Archive collection</p>
        <a href="player.html?archiveId=${item.archiveId}&title=${encodeURIComponent(item.title)}">
          Open archive
        </a>
      </article>
    `;
  });
}

function syncLibrary() {
  libraryData = getAllLibraryEntries();
  buildLibrary(libraryData);
  buildContinueListening();
}

function setupArchiveForm() {
  const addArchiveBtn = document.getElementById("addArchiveBtn");
  const archivePanel = document.getElementById("addArchivePanel");
  const closeArchivePanel = document.getElementById("closeArchivePanel");
  const saveArchiveBtn = document.getElementById("saveArchiveBtn");
  const archiveMessage = document.getElementById("archiveMessage");
  const archiveInput = document.getElementById("archiveInput");
  const archiveTitle = document.getElementById("archiveTitle");
  const archiveYear = document.getElementById("archiveYear");

  if (!addArchiveBtn || !archivePanel || !saveArchiveBtn) return;

  addArchiveBtn.addEventListener("click", () => {
    archivePanel.classList.toggle("hidden");
    if (!archivePanel.classList.contains("hidden")) {
      archiveInput.focus();
    }
  });

  closeArchivePanel?.addEventListener("click", () => {
    archivePanel.classList.add("hidden");
    archiveMessage.textContent = "";
  });

  saveArchiveBtn.addEventListener("click", async () => {
    const rawValue = archiveInput.value;
    const normalizedArchiveId = normalizeArchiveId(rawValue);

    if (!normalizedArchiveId) {
      archiveMessage.textContent = "Please enter a valid Archive.org URL or archive ID.";
      archiveMessage.classList.add("error");
      return;
    }

    const customTitle = archiveTitle.value.trim() || normalizedArchiveId;
    const customYear = archiveYear.value.trim() || new Date().getFullYear();

    try {
      archiveMessage.textContent = "Checking archive...";
      archiveMessage.classList.remove("error");

      await validateArchiveId(normalizedArchiveId);

      const customLibrary = loadCustomLibrary();
      const newEntry = {
        id: `${normalizedArchiveId}-${Date.now()}`,
        title: customTitle,
        year: customYear,
        archiveId: normalizedArchiveId
      };

      customLibrary.push(newEntry);
      saveCustomLibrary(customLibrary);

      archiveInput.value = "";
      archiveTitle.value = "";
      archiveYear.value = "";
      archivePanel.classList.add("hidden");
      archiveMessage.textContent = "";

      libraryData = getAllLibraryEntries();
      buildLibrary(libraryData);
    } catch (error) {
      archiveMessage.textContent = error.message || "Could not add that archive.";
      archiveMessage.classList.add("error");
    }
  });
}

fetch("library.json")
  .then(response => response.json())
  .then(data => {
    libraryData = data;
    syncLibrary();
    setupArchiveForm();
  })
  .catch(error => {
    console.error("Failed to load library.json", error);
    libraryData = [];
    syncLibrary();
    setupArchiveForm();
  });

const searchBox = document.getElementById("searchBox");

if (searchBox) {
  searchBox.addEventListener("input", () => {
    const search = searchBox.value.toLowerCase();

    const filtered = libraryData.filter(item =>
      item.title.toLowerCase().includes(search)
    );

    buildLibrary(filtered);
  });
}

function buildContinueListening() {
  const card = document.getElementById("continueCard");

  if (!card) return;

  const lastPlayed = JSON.parse(
    localStorage.getItem("lastPlayed")
  );

  if (!lastPlayed) {
    card.innerHTML = `
      <div class="continue-card empty-state">
        <p>No recent listening yet.</p>
        <a href="library.html">Browse library</a>
      </div>
    `;
    return;
  }

  card.innerHTML = `
    <div class="continue-card">
      <span class="status-pill">Resume</span>
      <h3>${lastPlayed.title}</h3>
      <p>Pick up where you left off.</p>
      <a href="${lastPlayed.url}">Resume listening</a>
    </div>
  `;
}
