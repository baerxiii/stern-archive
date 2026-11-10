(() => {
  const defaultArchive = { archive_id: "1998.03.11-blockbuster-awards-e", title: "1998 video archive" };
  const config = window.STERN_ARCHIVE_CONFIG || {};
  const client = window.supabase && config.supabaseUrl && config.supabaseAnonKey
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const el = id => document.getElementById(id);
  const panel = el("addVideoPanel");
  const form = el("addVideoForm");
  const player = el("videoPlayer");
  let archives = [];
  let editor = false;
  let managementReady = false;
  let editingArchive = null;
  let activeArchive = null;
  let files = [];
  let requestNumber = 0;

  function message(element, text, error = false) {
    element.textContent = text;
    element.classList.toggle("error", error);
  }

  function archiveId(value) {
    const input = value.trim();
    let id = input;
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      if (!["archive.org", "www.archive.org"].includes(url.hostname.toLowerCase())) {
        throw new Error("Use an Archive.org item URL or ID.");
      }
      const match = url.pathname.match(/^\/(?:details|download|metadata|embed)\/([^/]+)\/?$/i);
      if (!match) throw new Error("Use a link to an Archive.org item, not an individual file.");
      id = decodeURIComponent(match[1]);
    }
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new Error("Enter a valid Archive.org item URL or ID.");
    return id;
  }

  function videoFiles(metadata) {
    if (!Array.isArray(metadata.files)) throw new Error("Archive.org did not return a file list.");
    const byName = new Map(metadata.files.filter(file => typeof file.name === "string").map(file => [file.name, file]));
    const selected = new Map();
    metadata.files.filter(file => typeof file.name === "string" && /\.mp4$/i.test(file.name)).forEach(file => {
      let original = file;
      const seen = new Set();
      while (original.original && byName.has(original.original) && !seen.has(original.name)) {
        seen.add(original.name);
        original = byName.get(original.original);
      }
      const key = original.name.replace(/\.ia\.mp4$/i, ".mp4").toLowerCase();
      const previous = selected.get(key);
      if (!previous || (/\.ia\.mp4$/i.test(previous.name) && !/\.ia\.mp4$/i.test(file.name))) {
        selected.set(key, file);
      }
    });
    return [...selected.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async function fetchFiles(id) {
    const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error(`Internet Archive returned ${response.status}.`);
    return videoFiles(await response.json());
  }

  function renderArchives() {
    const container = el("videoArchives");
    container.replaceChildren();
    archives.forEach(archive => {
      const card = document.createElement("article");
      card.className = "library-card";
      const title = document.createElement("h2");
      title.textContent = archive.title;
      const actions = document.createElement("div");
      actions.className = "card-actions";
      const browse = document.createElement("button");
      browse.type = "button";
      browse.className = "primary-btn";
      browse.textContent = "Browse videos";
      browse.addEventListener("click", () => openArchive(archive));
      actions.appendChild(browse);
      if (editor && managementReady) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "transport-btn";
        edit.textContent = "Edit";
        edit.setAttribute("aria-label", `Edit ${archive.title}`);
        edit.addEventListener("click", () => showForm(archive));
        actions.appendChild(edit);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-archive-btn";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove ${archive.title}`);
        remove.addEventListener("click", () => removeArchive(archive, remove));
        actions.appendChild(remove);
      }
      card.append(title, actions);
      container.appendChild(card);
    });
  }

  function renderFiles() {
    const list = el("videoFiles");
    const filter = el("videoSearch").value.trim().toLowerCase();
    list.replaceChildren();
    const matches = files.filter(file => file.name.toLowerCase().includes(filter));
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state-text";
      empty.textContent = filter ? "No matching videos." : "No MP4 videos found in this archive.";
      list.appendChild(empty);
    }
    matches.forEach(file => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "episode-button";
      button.textContent = file.name.replace(/\.mp4$/i, "");
      button.addEventListener("click", () => {
        el("videoEmbed").removeAttribute("src");
        el("videoEmbedContainer").hidden = true;
        player.src = `https://archive.org/download/${encodeURIComponent(activeArchive.archive_id)}/${encodeURIComponent(file.name)}`;
        el("videoPlayerContainer").hidden = false;
        el("videoNowPlaying").textContent = `Selected: ${file.name}`;
        message(el("videoStatus"), "Press play to watch the selected video.");
        player.load();
      });
      list.appendChild(button);
    });
  }

  async function openArchive(archive) {
    const request = ++requestNumber;
    activeArchive = archive;
    files = [];
    player.pause();
    player.removeAttribute("src");
    player.load();
    el("videoPlayerContainer").hidden = true;
    el("videoNowPlaying").textContent = "";
    el("videoSearch").value = "";
    el("videoFiles").replaceChildren();
    el("videoBrowser").hidden = false;
    el("videoArchiveHeading").textContent = archive.title;
    el("videoEmbedContainer").hidden = false;
    el("videoEmbed").src = `https://archive.org/embed/${encodeURIComponent(archive.archive_id)}`;
    el("videoSource").href = `https://archive.org/details/${encodeURIComponent(archive.archive_id)}`;
    message(el("videoStatus"), "Loading videos from Internet Archive…");
    try {
      const result = await fetchFiles(archive.archive_id);
      if (request !== requestNumber) return;
      files = result;
      message(el("videoStatus"), `${files.length} MP4 ${files.length === 1 ? "video" : "videos"} available. Choose one to watch.`);
      renderFiles();
    } catch (error) {
      if (request !== requestNumber) return;
      console.error("Could not load videos", error);
      message(el("videoStatus"), `Could not load videos: ${error.message}. Try the Internet Archive link below.`, true);
    }
  }

  async function refresh() {
    if (!client) {
      message(el("videoMessage"), "Shared archives are unavailable. Check your connection and reload.", true);
      renderArchives();
      return;
    }
    managementReady = false;
    try {
      const result = await client.from("shared_video_archives").select("archive_id,title").order("title", { ascending: true });
      if (result.error) throw result.error;
      archives = result.data;
      const migration = await client.from("video_archive_migrations").select("name").eq("name", "managed-default-1998").maybeSingle();
      if (migration.error && !["PGRST205", "42P01"].includes(migration.error.code)) throw migration.error;
      managementReady = Boolean(migration.data);
      if (managementReady) {
        message(el("videoMessage"), "");
      } else {
        if (!archives.some(item => item.archive_id === defaultArchive.archive_id)) archives = [defaultArchive, ...archives];
        message(el("videoMessage"), "Apply database/video-archive-management.sql to enable archive editing and removal.", true);
      }
    } catch (error) {
      console.error("Could not load shared video archives", error);
      message(el("videoMessage"), `Could not load shared archives: ${error.message}. Check your connection and database setup.`, true);
    }
    el("addVideoBtn").disabled = !editor || !managementReady;
    renderArchives();
  }

  async function updateAuth() {
    if (!client) throw new Error("Sign-in is unavailable.");
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;
    editor = false;
    if (user) {
      const { data, error } = await client.from("library_editors").select("user_id").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      editor = Boolean(data);
    }
    el("signInForm").hidden = Boolean(user);
    el("signOutBtn").hidden = !user;
    el("addVideoBtn").disabled = !editor || !managementReady;
    if (!editor) panel.classList.add("hidden");
    message(el("authStatus"), user ? (editor ? "Signed in as an authorized editor." : "This account is not authorized to edit archives.") : "Sign in with an authorized editor account to add shared archives.");
    renderArchives();
  }

  async function removeArchive(archive, button) {
    if (!editor || !managementReady || !confirm(`Remove "${archive.title}" from the video list? The original archive will not be deleted.`)) return;
    button.disabled = true;
    try {
      const result = await client.from("shared_video_archives").delete().eq("archive_id", archive.archive_id).select("archive_id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("The database did not confirm the removal.");
      if (activeArchive?.archive_id === archive.archive_id) {
        ++requestNumber;
        player.pause();
        player.removeAttribute("src");
        player.load();
        el("videoEmbed").removeAttribute("src");
        activeArchive = null;
        el("videoBrowser").hidden = true;
      }
      await refresh();
      if (managementReady) message(el("videoMessage"), "Archive removed from the shared list.");
    } catch (error) {
      console.error("Could not remove video archive", error);
      message(el("videoMessage"), `Could not remove archive: ${error.message}`, true);
      button.disabled = false;
    }
  }

  function showForm(archive = null) {
    editingArchive = archive;
    form.reset();
    el("videoArchiveInput").value = archive?.archive_id || "";
    el("videoArchiveTitle").value = archive?.title || "";
    el("videoFormHeading").textContent = archive ? "Edit video archive" : "Add a video archive";
    message(el("videoFormMessage"), "");
    panel.classList.remove("hidden");
    el("videoArchiveInput").focus();
    panel.scrollIntoView({ block: "nearest" });
  }

  el("addVideoBtn").addEventListener("click", () => showForm());
  el("closeVideoPanel").addEventListener("click", () => {
    editingArchive = null;
    panel.classList.add("hidden");
  });
  el("videoSearch").addEventListener("input", renderFiles);
  player.addEventListener("error", () => {
    if (player.getAttribute("src")) message(el("videoStatus"), "Video playback failed. Try opening the archive on Internet Archive.", true);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    let id;
    try {
      id = archiveId(el("videoArchiveInput").value);
      if (!el("videoArchiveTitle").value.trim()) throw new Error("Enter a display name.");
      if (!editor) throw new Error("Sign in with an authorized editor account.");
      if (!managementReady) throw new Error("Apply the video archive management database migration first.");
      if (archives.some(item => item !== editingArchive && item.archive_id.toLowerCase() === id.toLowerCase())) throw new Error("That archive is already in the list.");
    } catch (error) {
      message(el("videoFormMessage"), error.message, true);
      return;
    }
    button.disabled = true;
    try {
      if (!editingArchive || editingArchive.archive_id !== id) {
        message(el("videoFormMessage"), "Checking archive…");
        const available = await fetchFiles(id);
        if (!available.length) throw new Error("This archive does not contain MP4 videos.");
      }
      const archive = { archive_id: id, title: el("videoArchiveTitle").value.trim() };
      const previous = editingArchive;
      const result = previous
        ? await client.from("shared_video_archives").update(archive).eq("archive_id", previous.archive_id).select("archive_id")
        : await client.from("shared_video_archives").insert(archive).select("archive_id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("The database did not confirm the change.");
      if (previous) {
        archives = archives.map(item => item === previous ? archive : item);
        if (activeArchive?.archive_id === previous.archive_id) {
          if (previous.archive_id === id) {
            activeArchive = archive;
            el("videoArchiveHeading").textContent = archive.title;
          } else {
            await openArchive(archive);
          }
        }
      } else {
        archives.push(archive);
      }
      renderArchives();
      form.reset();
      panel.classList.add("hidden");
      editingArchive = null;
      message(el("videoFormMessage"), "");
      message(el("videoMessage"), previous ? "Archive updated." : "Archive added to the shared list.");
    } catch (error) {
      console.error("Could not save video archive", error);
      message(el("videoFormMessage"), `Could not save archive: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  });

  el("signInForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = el("signInForm").querySelector("button");
    button.disabled = true;
    try {
      if (!client) throw new Error("Sign-in is unavailable.");
      const { error } = await client.auth.signInWithPassword({ email: el("editorEmail").value.trim(), password: el("editorPassword").value });
      if (error) throw error;
      el("editorPassword").value = "";
      await updateAuth();
    } catch (error) {
      console.error("Sign-in failed", error);
      message(el("authStatus"), `Sign-in failed: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  });
  el("signOutBtn").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      message(el("authStatus"), `Sign-out failed: ${error.message}`, true);
      return;
    }
    try {
      await updateAuth();
    } catch (error) {
      message(el("authStatus"), `Could not check editor permissions: ${error.message}`, true);
    }
  });

  async function initialize() {
    try {
      await updateAuth();
    } catch (error) {
      console.error("Could not check editor permissions", error);
      message(el("authStatus"), `Could not check editor permissions: ${error.message}`, true);
    }
    await refresh();
  }
  initialize();
})();
