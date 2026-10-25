let libraryData = [];
const CUSTOM_LIBRARY_KEY = "sternArchiveCustomLibrary";

const SUPABASE_URL = (window.STERN_ARCHIVE_CONFIG && window.STERN_ARCHIVE_CONFIG.supabaseUrl) || "";
const SUPABASE_ANON_KEY = (window.STERN_ARCHIVE_CONFIG && window.STERN_ARCHIVE_CONFIG.supabaseAnonKey) || "";
const supabaseClient = window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function loadLocalCustomLibrary() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_LIBRARY_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function saveLocalCustomLibrary(items) {
  localStorage.setItem(CUSTOM_LIBRARY_KEY, JSON.stringify(items));
}

async function getCurrentUser() {
  if (!supabaseClient) return null;

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function loadCustomLibrary() {
  if (supabaseClient) {
    const user = await getCurrentUser();
    if (user) {
      const { data, error } = await supabaseClient
        .from("custom_library")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        return data.map((item) => ({
          id: item.id,
          title: item.title,
          year: item.year,
          archiveId: item.archive_id,
        }));
      }
    }
  }

  return loadLocalCustomLibrary();
}

async function saveCustomLibrary(items) {
  if (supabaseClient) {
    const user = await getCurrentUser();
    if (user) {
      const remoteItems = items.map((item) => ({
        id: item.id || `${item.archiveId}-${Date.now()}`,
        user_id: user.id,
        archive_id: item.archiveId,
        title: item.title,
        year: item.year,
      }));

      const { error } = await supabaseClient
        .from("custom_library")
        .upsert(remoteItems, { onConflict: "id" });

      if (!error) {
        return;
      }
    }
  }

  saveLocalCustomLibrary(items);
}

async function getAllLibraryEntries() {
  const customLibrary = await loadCustomLibrary();
  return [...(window.__DEFAULT_LIBRARY__ || []), ...customLibrary];
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

async function syncLibrary() {
  const allEntries = await getAllLibraryEntries();
  libraryData = allEntries;
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

      const customLibrary = await loadCustomLibrary();
      const newEntry = {
        id: `${normalizedArchiveId}-${Date.now()}`,
        title: customTitle,
        year: customYear,
        archiveId: normalizedArchiveId,
      };

      customLibrary.push(newEntry);
      await saveCustomLibrary(customLibrary);

      archiveInput.value = "";
      archiveTitle.value = "";
      archiveYear.value = "";
      archivePanel.classList.add("hidden");
      archiveMessage.textContent = "";

      await syncLibrary();
    } catch (error) {
      archiveMessage.textContent = error.message || "Could not add that archive.";
      archiveMessage.classList.add("error");
    }
  });
}

async function initializeLibrary() {
  try {
    const response = await fetch("library.json");
    const data = await response.json();
    window.__DEFAULT_LIBRARY__ = data;
  } catch (error) {
    console.error("Failed to load library.json", error);
    window.__DEFAULT_LIBRARY__ = [];
  }

  await syncLibrary();
  setupArchiveForm();
  setupAuthControls();
}

const searchBox = document.getElementById("searchBox");

if (searchBox) {
  searchBox.addEventListener("input", async () => {
    const search = searchBox.value.toLowerCase();
    const available = await getAllLibraryEntries();
    const filtered = available.filter(item =>
      item.title.toLowerCase().includes(search)
    );

    buildLibrary(filtered);
  });
}

function buildContinueListening() {
  const card = document.getElementById("continueCard");
  if (!card) return;

  const lastPlayed = JSON.parse(localStorage.getItem("lastPlayed") || "null");

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

function setupAuthControls() {
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const signInBtn = document.getElementById("signInBtn");
  const signUpBtn = document.getElementById("signUpBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const authStatus = document.getElementById("authStatus");

  if (!supabaseClient || !emailInput || !passwordInput || !signInBtn || !signUpBtn || !signOutBtn) {
    return;
  }

  const updateStatus = async () => {
    const user = await getCurrentUser();
    if (authStatus) {
      authStatus.textContent = user ? `Signed in as ${user.email}` : "Not signed in";
    }

    signOutBtn.disabled = !user;
    signInBtn.disabled = !!user;
    signUpBtn.disabled = !!user;
  };

  signInBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      if (authStatus) authStatus.textContent = "Enter both email and password.";
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      if (authStatus) authStatus.textContent = error.message;
      return;
    }

    passwordInput.value = "";
    await updateStatus();
    await syncLibrary();
  });

  signUpBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      if (authStatus) authStatus.textContent = "Enter both email and password.";
      return;
    }

    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      if (authStatus) authStatus.textContent = error.message;
      return;
    }

    passwordInput.value = "";
    if (authStatus) authStatus.textContent = "Account created. Check your email to confirm.";
  });

  signOutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    await updateStatus();
    await syncLibrary();
  });

  updateStatus();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeLibrary);
} else {
  initializeLibrary();
}

window.addEventListener("load", () => {
  const authStatus = document.getElementById("authStatus");
  if (authStatus && !supabaseClient) {
    authStatus.textContent = "Local-only mode: add your Supabase config to enable syncing across devices.";
  }
});
