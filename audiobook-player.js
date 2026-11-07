const params = new URLSearchParams(location.search);
const identifier = params.get("id");
const titleEl = document.getElementById("bookTitle");
const player = document.getElementById("audioPlayer");
const chapters = document.getElementById("chapters");
const playback = ListeningHistory.attach(player);

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
  if (data.misc?.image) document.getElementById("bookCover").src = data.misc.image;

  const tracks = (data.files || []).filter(file => typeof file.name === "string" && file.name.toLowerCase().endsWith(".mp3"));
  if (!tracks.length) {
    chapters.textContent = "No audio files found.";
    return;
  }

  let currentIndex = -1;
  const buttons = [];
  function select(index, autoplay) {
    const track = tracks[index];
    if (!track) return;
    currentIndex = index;
    buttons.forEach((button, i) => button.classList.toggle("playing", i === index));
    const audioUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(track.name)}`;
    playback.load({ type: "audiobook", collectionId: identifier, trackId: track.name,
      collectionTitle: bookTitle, title: track.title || track.name, audioUrl }, autoplay);
  }

  tracks.forEach((track, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chapter-btn";
    const label = document.createElement("strong");
    label.textContent = track.title || track.name;
    button.appendChild(label);
    if (track.length) {
      const duration = document.createElement("span");
      duration.className = "chapter-duration";
      duration.textContent = track.length;
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
  let index = requested ? tracks.findIndex(track => track.name === requested) : -1;
  if (requested && index < 0) {
    chapters.insertAdjacentText("afterbegin", "This chapter is no longer available.");
    return;
  }
  if (!requested) {
    try {
      const latest = ListeningHistory.read().find(item => item.type === "audiobook" && item.collectionId === identifier);
      if (latest) index = tracks.findIndex(track => track.name === latest.trackId);
      if (index < 0) {
        const old = JSON.parse(localStorage.getItem("currentAudiobook") || "null");
        if (old?.identifier === identifier) {
          index = tracks.findIndex(track => old.audioUrl === `https://archive.org/download/${identifier}/${track.name}` ||
            old.audioUrl === `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(track.name)}`);
        }
      }
    } catch (error) {
      console.error("Could not find the last audiobook chapter", error);
    }
  }
  select(index < 0 ? 0 : index, false);
}

loadBook().catch(error => {
  console.error(error);
  titleEl.textContent = "Failed to load audiobook";
  chapters.textContent = error.message;
});
