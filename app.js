(() => {
  const CUSTOM_LIBRARY_KEY = "sternArchiveCustomLibrary";
  const DEFAULT_CATEGORY = "Stern Show";
  const config = window.STERN_ARCHIVE_CONFIG || {};
  const client = window.supabase && config.supabaseUrl && config.supabaseAnonKey
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;
  const library = document.getElementById("library");
  const message = document.getElementById("libraryMessage");
  const formMessage = document.getElementById("archiveMessage");
  const search = document.getElementById("searchBox");
  const panel = document.getElementById("addArchivePanel");
  const signInForm = document.getElementById("signInForm");
  const authStatus = document.getElementById("authStatus");
  let entries = [];
  let editor = false;
  const openCategories = new Set();

  function showMessage(element, text, isError = false) {
    element.textContent = text;
    element.classList.toggle("error", isError);
  }

  function localEntries() {
    const data = JSON.parse(localStorage.getItem(CUSTOM_LIBRARY_KEY) || "[]");
    if (!Array.isArray(data)) throw new Error("Invalid local library data.");
    return data.map(item => ({ ...item, category: item.category || DEFAULT_CATEGORY, source: "local" }));
  }

  function normalizeArchiveId(value) {
    const cleaned = value.trim();
    const match = cleaned.match(/(?:\/details\/|\/metadata\/|\/download\/)([^/?#]+)/i);
    return (match ? match[1] : cleaned).replace(/[?#].*$/, "").trim();
  }

  function categoryOf(item) {
    return item.category?.trim() || DEFAULT_CATEGORY;
  }

  function render() {
    const filter = search.value.trim().toLowerCase();
    const grouped = new Map();
    entries.filter(item => [item.title, item.year, item.archiveId, categoryOf(item)]
      .some(value => String(value || "").toLowerCase().includes(filter)))
      .forEach(item => {
        const category = categoryOf(item);
        const key = category.toLocaleLowerCase();
        if (!grouped.has(key)) grouped.set(key, { name: category, items: [] });
        grouped.get(key).items.push(item);
      });

    library.replaceChildren();
    if (!grouped.size) {
      const empty = document.createElement("p");
      empty.className = "empty-state-text";
      empty.textContent = filter ? "No matching archives found." : "No archives available yet.";
      library.appendChild(empty);
      return;
    }

    [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name)).forEach(group => {
      const key = group.name.toLocaleLowerCase();
      const details = document.createElement("details");
      details.className = "archive-category";
      details.open = Boolean(filter) || openCategories.has(key);
      details.addEventListener("toggle", () => {
        if (filter) return;
        if (details.open) openCategories.add(key);
        else openCategories.delete(key);
      });
      const summary = document.createElement("summary");
      const title = document.createElement("span");
      title.className = "category-title";
      title.textContent = group.name;
      const count = document.createElement("span");
      count.className = "status-pill";
      count.textContent = `${group.items.length} ${group.items.length === 1 ? "archive" : "archives"}`;
      summary.append(title, count);
      details.appendChild(summary);
      const list = document.createElement("div");
      list.className = "archive-category-list";
      group.items.sort((a, b) => String(b.year || "").localeCompare(String(a.year || ""), undefined, { numeric: true }) ||
        String(a.title).localeCompare(String(b.title)));
      group.items.forEach(item => {
        const row = document.createElement("div");
        row.className = "archive-row";
        const copy = document.createElement("div");
        const heading = document.createElement("h3");
        heading.textContent = item.title || item.archiveId;
        const meta = document.createElement("p");
        meta.textContent = [item.year || "Archive", item.source === "local" ? "Saved in this browser" : ""].filter(Boolean).join(" · ");
        copy.append(heading, meta);
        const actions = document.createElement("div");
        actions.className = "archive-row-actions";
        const link = document.createElement("a");
        link.className = "resume-link";
        link.href = `player.html?${new URLSearchParams({ archiveId: item.archiveId, title: item.title || item.archiveId })}`;
        link.textContent = "Open";
        actions.appendChild(link);
        if (editor) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "delete-archive-btn";
          button.textContent = "Delete";
          button.setAttribute("aria-label", `Delete ${item.title || item.archiveId}`);
          button.addEventListener("click", () => removeArchive(item, button));
          actions.appendChild(button);
        }
        row.append(copy, actions);
        list.appendChild(row);
      });
      details.appendChild(list);
      library.appendChild(details);
    });

    const categories = document.getElementById("archiveCategories");
    categories.replaceChildren();
    [...new Set(entries.map(categoryOf))].forEach(category => {
      const option = document.createElement("option");
      option.value = category;
      categories.appendChild(option);
    });
  }

  async function refresh() {
    const defaultsResponse = await fetch("library.json");
    if (!defaultsResponse.ok) throw new Error("Could not load the default archive library.");
    const defaults = await defaultsResponse.json();
    let remote = [];
    let hidden = new Set();
    let warning = "";
    if (client) {
      try {
        const [customResponse, hiddenResponse] = await Promise.all([
          client.from("custom_library").select("*").order("created_at", { ascending: true }),
          client.from("hidden_default_archives").select("archive_id")
        ]);
        if (customResponse.error) warning = `Could not load shared archives: ${customResponse.error.message}`;
        else remote = customResponse.data;
        if (hiddenResponse.error) warning = `${warning} Shared editing requires the database migration.`.trim();
        else hidden = new Set(hiddenResponse.data.map(item => item.archive_id));
      } catch (error) {
        console.error("Could not load the shared library", error);
        warning = "Shared library is unavailable. Check your connection and reload.";
      }
    } else {
      warning = "Shared library is unavailable. Check your connection and reload.";
    }
    entries = [
      ...defaults.filter(item => !hidden.has(item.archiveId)).map(item => ({ ...item, source: "default" })),
      ...remote.map(item => ({ id: item.id, title: item.title, year: item.year,
        archiveId: item.archive_id, category: item.category, source: "shared" })),
      ...localEntries()
    ];
    showMessage(message, warning, Boolean(warning));
    render();
  }

  async function updateAuth() {
    if (!client) {
      showMessage(authStatus, "Sign-in is unavailable. Check your connection and reload.", true);
      return;
    }
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;
    editor = false;
    if (user) {
      const { data, error } = await client.from("library_editors").select("user_id").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      editor = Boolean(data);
    }
    signInForm.hidden = Boolean(user);
    document.getElementById("signOutBtn").hidden = !user;
    document.getElementById("addArchiveBtn").disabled = !editor;
    if (!editor) panel.classList.add("hidden");
    showMessage(authStatus, user ? (editor ? "Signed in as an authorized editor." : "Signed in, but this account is not authorized to edit the library.") : "Sign in to add or delete shared archives.");
    render();
  }

  async function removeArchive(item, button) {
    if (!editor) {
      showMessage(message, "Sign in with an authorized editor account to delete archives.", true);
      return;
    }
    if (!confirm(`Remove "${item.title || item.archiveId}" from the library? This does not delete the original audio.`)) return;
    button.disabled = true;
    try {
      if (item.source === "local") {
        const remaining = localEntries().filter(entry => entry.id !== item.id);
        localStorage.setItem(CUSTOM_LIBRARY_KEY, JSON.stringify(remaining.map(({ source, ...entry }) => entry)));
      } else {
        const result = item.source === "default"
          ? await client.from("hidden_default_archives").upsert({ archive_id: item.archiveId }).select("archive_id")
          : await client.from("custom_library").delete().eq("id", item.id).select("id");
        if (result.error) throw result.error;
        if (!result.data?.length) throw new Error("The database did not confirm the deletion.");
      }
      await refresh();
    } catch (error) {
      console.error("Could not delete archive", error);
      showMessage(message, `Could not delete archive: ${error.message}`, true);
      button.disabled = false;
    }
  }

  document.getElementById("addArchiveBtn").addEventListener("click", () => {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) document.getElementById("archiveInput").focus();
  });
  document.getElementById("closeArchivePanel").addEventListener("click", () => panel.classList.add("hidden"));
  search.addEventListener("input", render);

  document.getElementById("saveArchiveBtn").addEventListener("click", async event => {
    const button = event.currentTarget;
    const archiveId = normalizeArchiveId(document.getElementById("archiveInput").value);
    const title = document.getElementById("archiveTitle").value.trim() || archiveId;
    const year = document.getElementById("archiveYear").value.trim() || null;
    const category = document.getElementById("archiveCategory").value.trim() || DEFAULT_CATEGORY;
    if (!archiveId) {
      showMessage(formMessage, "Enter an Archive.org URL or archive ID.", true);
      return;
    }
    if (!editor) {
      showMessage(formMessage, "Sign in with an authorized editor account.", true);
      return;
    }
    button.disabled = true;
    try {
      showMessage(formMessage, "Checking archive...");
      const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(archiveId)}`);
      if (!response.ok) throw new Error("Could not find that archive on Archive.org.");
      const data = await response.json();
      if (!(data.files || []).some(file => typeof file.name === "string" && file.name.toLowerCase().endsWith(".mp3"))) {
        throw new Error("This archive does not contain MP3 files.");
      }
      const result = await client.from("custom_library").insert({
        id: `${archiveId}-${crypto.randomUUID()}`, archive_id: archiveId, title, year, category
      }).select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("The database did not confirm the new archive.");
      openCategories.add(category.toLocaleLowerCase());
      await refresh();
      ["archiveInput", "archiveTitle", "archiveYear"].forEach(id => { document.getElementById(id).value = ""; });
      panel.classList.add("hidden");
      showMessage(formMessage, "");
      showMessage(message, "Archive added to the shared library.");
    } catch (error) {
      console.error("Could not add archive", error);
      showMessage(formMessage, `Could not add archive: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  });

  signInForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = signInForm.querySelector("button");
    button.disabled = true;
    try {
      if (!client) throw new Error("Sign-in is unavailable.");
      const { error } = await client.auth.signInWithPassword({
        email: document.getElementById("editorEmail").value.trim(),
        password: document.getElementById("editorPassword").value
      });
      if (error) throw error;
      document.getElementById("editorPassword").value = "";
      await updateAuth();
    } catch (error) {
      console.error("Sign-in failed", error);
      showMessage(authStatus, `Sign-in failed: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById("signOutBtn").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      showMessage(authStatus, `Sign-out failed: ${error.message}`, true);
      return;
    }
    await updateAuth();
  });
  window.addEventListener("storage", event => {
    if (event.key === CUSTOM_LIBRARY_KEY) refresh().catch(error => showMessage(message, error.message, true));
  });

  async function initialize() {
    try {
      await updateAuth();
    } catch (error) {
      console.error("Could not check editor permissions", error);
      showMessage(authStatus, `Could not check editor permissions: ${error.message}`, true);
    }
    try { await refresh(); }
    catch (error) {
      console.error("Could not load library", error);
      showMessage(message, error.message, true);
    }
  }
  initialize();
})();
