(() => {
  const config = window.STERN_ARCHIVE_CONFIG || {};
  const client = window.supabase && config.supabaseUrl && config.supabaseAnonKey
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;
  const container = document.getElementById("podcastList");
  const message = document.getElementById("podcastMessage");
  const authStatus = document.getElementById("authStatus");
  const signInForm = document.getElementById("signInForm");
  const addButton = document.getElementById("addPodcastBtn");
  const addPanel = document.getElementById("addPodcastPanel");
  const addForm = document.getElementById("addPodcastForm");
  const formMessage = document.getElementById("podcastFormMessage");
  let podcasts = [];
  let editor = false;

  function showMessage(element, text, isError = false) {
    element.textContent = text;
    element.classList.toggle("error", isError);
  }

  function render() {
    container.replaceChildren();
    podcasts.forEach(podcast => {
      const card = document.createElement("article");
      card.className = "library-card";
      const label = document.createElement("span");
      label.className = "status-pill";
      label.textContent = "Podcast";
      const title = document.createElement("h2");
      title.textContent = podcast.name;
      const link = document.createElement("a");
      link.className = "resume-link";
      link.href = `podcast-player.html?${new URLSearchParams({ rss: podcast.rss })}`;
      link.textContent = "Browse episodes";
      card.append(label, title, link);
      container.appendChild(card);
    });
  }

  async function refresh() {
    const response = await fetch("podcasts.json");
    if (!response.ok) throw new Error(`Could not load podcasts (${response.status}).`);
    const defaults = await response.json();
    let shared = [];
    if (!client) {
      showMessage(message, "Shared podcasts are unavailable. The built-in podcast list is still available.", true);
    } else {
      try {
        const result = await client.from("shared_podcasts").select("id,name,rss").order("created_at", { ascending: true });
        if (result.error) throw result.error;
        shared = result.data;
        showMessage(message, "");
      } catch (error) {
        console.error("Could not load shared podcasts", error);
        showMessage(message, `Could not load shared podcasts: ${error.message}. Run database/library-editors.sql if the migration has not been applied.`, true);
      }
    }

    const seenFeeds = new Set();
    podcasts = [...defaults, ...shared].filter(podcast => {
      const key = podcast.rss.trim();
      if (seenFeeds.has(key)) return false;
      seenFeeds.add(key);
      return true;
    });
    render();
  }

  async function updateAuth() {
    if (!client) {
      addButton.disabled = true;
      showMessage(authStatus, "Sign-in is unavailable. Shared podcast editing requires the database configuration.", true);
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
    addButton.disabled = !editor;
    if (!editor) addPanel.classList.add("hidden");
    showMessage(authStatus, user
      ? (editor ? "Signed in as an authorized editor." : "Signed in, but this account is not authorized to edit podcasts.")
      : "Sign in with an authorized editor account to add shared podcasts.");
  }

  addButton.addEventListener("click", () => {
    addPanel.classList.toggle("hidden");
    if (!addPanel.classList.contains("hidden")) document.getElementById("podcastName").focus();
  });
  document.getElementById("closePodcastPanel").addEventListener("click", () => addPanel.classList.add("hidden"));

  addForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = addForm.querySelector('button[type="submit"]');
    const name = document.getElementById("podcastName").value.trim();
    let rss;
    try {
      const url = new URL(document.getElementById("podcastRss").value.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use an HTTP or HTTPS RSS feed URL.");
      rss = url.href;
    } catch (error) {
      showMessage(formMessage, error.message === "Invalid URL" ? "Enter a valid RSS feed URL." : error.message, true);
      return;
    }
    if (!name) {
      showMessage(formMessage, "Enter a podcast name.", true);
      return;
    }
    if (!editor) {
      showMessage(formMessage, "Sign in with an authorized editor account.", true);
      return;
    }
    if (podcasts.some(podcast => podcast.rss.trim() === rss)) {
      showMessage(formMessage, "That RSS feed is already on the podcast page.", true);
      return;
    }

    button.disabled = true;
    try {
      showMessage(formMessage, "Saving podcast…");
      const result = await client.from("shared_podcasts").insert({ name, rss }).select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("The database did not confirm the new podcast.");
      podcasts.push({ name, rss });
      render();
      addForm.reset();
      addPanel.classList.add("hidden");
      showMessage(formMessage, "");
      showMessage(message, "Podcast added to the shared list.");
    } catch (error) {
      console.error("Could not add podcast", error);
      showMessage(formMessage, `Could not add podcast: ${error.message}`, true);
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

  async function initialize() {
    try {
      await updateAuth();
    } catch (error) {
      console.error("Could not check editor permissions", error);
      showMessage(authStatus, `Could not check editor permissions: ${error.message}`, true);
    }
    try {
      await refresh();
    } catch (error) {
      console.error("Could not load podcasts", error);
      showMessage(message, error.message, true);
    }
  }

  initialize();
})();
