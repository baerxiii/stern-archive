const params = new URLSearchParams(window.location.search);

const archiveId = params.get("archiveId");
const title = params.get("title");

document.getElementById("title").textContent =
  title || "Episodes";

fetch(`https://archive.org/metadata/${archiveId}`)
  .then(response => response.json())
  .then(data => {

    const files = data.files.filter(file =>
      file.name.toLowerCase().endsWith(".mp3")
    );

    const container = document.createElement("div");
    container.className = "episode-list";

    files.forEach(file => {

      const audioUrl =
        `https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`;

      const card = document.createElement("div");

      card.className = "card";

      card.innerHTML = `
  <h3>${file.name}</h3>

  <audio
      controls
      preload="none"
      src="${audioUrl}">
  </audio>
`;

      const player = card.querySelector("audio");

      const key = archiveId + "_" + file.name;

      player.addEventListener("loadedmetadata", () => {
        const saved = localStorage.getItem(key);

        if (saved) {
          player.currentTime = parseFloat(saved);
        }
      });

      player.addEventListener("timeupdate", () => {
        localStorage.setItem(
          key,
          player.currentTime
        );
      });

      player.addEventListener("play", () => {
        localStorage.setItem(
          "lastPlayed",
          JSON.stringify({
            title: file.name,
            url: window.location.href
          })
        );
      });

      container.appendChild(card);

    });

    
  })
  .catch(error => {
    console.error(error);
    document.body.innerHTML +=
      "<p>Failed to load archive metadata.</p>";
  });
