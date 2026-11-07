const params = new URLSearchParams(location.search);
const identifier = params.get("id");
const titleEl = document.getElementById("bookTitle");
const player = document.getElementById("audioPlayer");
const chapters = document.getElementById("chapters");
const playback = ListeningHistory.attach(player);

function groupTracks(files) {
  const filesByName = new Map(files.filter(file => typeof file.name === "string")
    .map(file => [file.name, file]));
  const groups = new Map();
  for (const file of files) {
    if (typeof file.name !== "string" || !file.name.toLowerCase().endsWith(".mp3")) continue;
    let root = file;
    const visited = new Set([root.name]);
    while (typeof root.original === "string" && root.original && !visited.has(root.original)) {
      visited.add(root.original);
      root = filesByName.get(root.original) || { name: root.original };
    }
    if (!groups.has(root.name)) groups.set(root.name, []);
    groups.get(root.name).push(file);
  }
  return [...groups.values()].map(variants => ({
    variants,
    track: variants.find(file => file.source === "original") || variants[0]
  }));
}

function formatDuration(length) {
  if (length === undefined || length === null || length === "") return "";
  const value = String(length);
  if (value.includes(":")) return value;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return value;
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const remainder = String(whole % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

async function loadBook() {
  if (!identifier) throw new Error("Missing audiobook ID.");
  const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!response.ok) throw new Error(`Could not load audiobook (${response.status}).`);
  const data = await response.json();
  const bookTitle = data.metadata?.title || identifier;
  titleEl.textContent = bookTitle;
  document.getElementById("bookAuthor").textContent = data.metadata?.creator || "";
  document.getElementById("bookDescription").textContent = (data.metadata?.description || "")
    .toString().replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (data.misc?.image) {
    const cover = document.getElementById("bookCover");
    cover.src = data.misc.image;
    cover.hidden = false;
  }

  const tracks = groupTracks(data.files || []);
  if (!tracks.length) {
    chapters.textContent = "No audio files found.";
    return;
  }

  let currentIndex = -1;
  const buttons = [];
  function select(index, autoplay) {
    const group = tracks[index];
    if (!group) return;
    const track = group.track;
    currentIndex = index;
    document.getElementById("bookNowPlaying").textContent = track.title || track.name;
    buttons.forEach((button, i) => button.classList.toggle("playing", i === index));
    const audioUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(track.name)}`;
    playback.load({ type: "audiobook", collectionId: identifier, trackId: track.name,
      collectionTitle: bookTitle, title: track.title || track.name, audioUrl }, autoplay);
  }

  tracks.forEach((group, index) => {
    const track = group.track;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chapter-btn";
    const label = document.createElement("strong");
    label.textContent = track.title || track.name;
    button.appendChild(label);
    if (track.length) {
      const duration = document.createElement("span");
      duration.className = "chapter-duration";
      duration.textContent = formatDuration(track.length);
      button.appendChild(duration);
    }
    button.addEventListener("click", () => select(index, true));
    buttons.push(button);
    chapters.appendChild(button);
  });
  player.addEventListener("ended", () => {
    if (currentIndex + 1 < tracks.length) select(currentIndex + 1, true);
  });

  const requested = params.get("track");
  const findVariant = name => {
    const index = tracks.findIndex(group => group.variants.some(track => track.name === name));
    if (index >= 0) tracks[index].track = tracks[index].variants.find(track => track.name === name);
    return index;
  };
  let index = -1;
  try {
    const saved = ListeningHistory.read().filter(item => item.type === "audiobook" && item.collectionId === identifier);
    const restored = new Set();
    for (const item of saved) {
      const groupIndex = tracks.findIndex(group => group.variants.some(track => track.name === item.trackId));
      if (groupIndex >= 0 && !restored.has(groupIndex)) {
        findVariant(item.trackId);
        restored.add(groupIndex);
        if (index < 0) index = groupIndex;
      }
    }
    if (!requested && index < 0) {
      const old = JSON.parse(localStorage.getItem("currentAudiobook") || "null");
      if (old?.identifier === identifier) {
        const track = tracks.flatMap(group => group.variants).find(file =>
          old.audioUrl === `https://archive.org/download/${identifier}/${file.name}` ||
          old.audioUrl === `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(file.name)}`);
        if (track) index = findVariant(track.name);
      }
    }
  } catch (error) {
    console.error("Could not find the last audiobook chapter", error);
  }
  if (requested) {
    index = findVariant(requested);
    if (index < 0) {
      chapters.insertAdjacentText("afterbegin", "This chapter is no longer available.");
      return;
    }
  }
  select(index < 0 ? 0 : index, false);
}

loadBook().catch(error => {
  console.error(error);
  titleEl.textContent = "Failed to load audiobook";
  chapters.textContent = error.message;
});
