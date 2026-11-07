const params =
  new URLSearchParams(
    location.search
  );

const identifier =
  params.get("id");

const titleEl =
  document.getElementById(
    "bookTitle"
  );

const player =
  document.getElementById(
    "audioPlayer"
  );

const chapters =
  document.getElementById(
    "chapters"
  );

const descriptionEl =
  document.getElementById(
    "bookDescription"
  );

const authorEl =
  document.getElementById(
    "bookAuthor"
  );

const coverEl =
  document.getElementById(
    "bookCover"
  );

const STORAGE_KEY =
  "currentAudiobook";

fetch(
  `https://archive.org/metadata/${identifier}`
)
  .then(r => r.json())
  .then(data => {

    titleEl.textContent =
      data.metadata?.title ||
      identifier;

    authorEl.textContent =
      data.metadata?.creator ||
      "";

   const cleanDescription =
  (data.metadata?.description || "")
    .toString()
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

descriptionEl.textContent =
  cleanDescription;

    if (
      data.misc &&
      data.misc.image
    ) {

      coverEl.src =
        data.misc.image;

    }

    const tracks =
      (data.files || [])
        .filter(file =>
          file.name
            ?.toLowerCase()
            .endsWith(".mp3")
        );

    if (!tracks.length) {

      chapters.innerHTML =
        "<p>No audio files found.</p>";

      return;

    }

    function loadTrack(
      track
    ) {

      const audioUrl =
        `https://archive.org/download/${identifier}/${track.name}`;

      player.src =
        audioUrl;

      const saved =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "null"
        );

      if (
        saved &&
        saved.audioUrl ===
          audioUrl
      ) {

        player.addEventListener(
          "loadedmetadata",
          () => {

            player.currentTime =
              saved.position || 0;

          },
          { once: true }
        );

      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          identifier,
          title:
            data.metadata?.title ||
            identifier,
          audioUrl
        })
      );

      player.play();

    }

    loadTrack(
      tracks[0]
    );

    chapters.innerHTML =
      "<h3>📖 Chapters</h3>";

    tracks.forEach(track => {

      const button =
        document.createElement(
          "button"
        );

      button.className =
        "chapter-btn";

      button.innerHTML = `
        <strong>
          ${track.title || track.name}
        </strong>

        ${
          track.length
          ? `
            <span class="chapter-duration">
              ${track.length}
            </span>
          `
          : ""
        }
      `;

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".chapter-btn"
            )
            .forEach(btn =>
              btn.classList.remove(
                "playing"
              )
            );

          button.classList.add(
            "playing"
          );

          loadTrack(track);

        }
      );

      chapters.appendChild(
        button
      );

    });

    setInterval(() => {

      if (!player.src) {
        return;
      }

      const existing =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "{}"
        );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...existing,
          position:
            player.currentTime
        })
      );

    }, 5000);

  })
  .catch(error => {

    console.error(error);

    titleEl.textContent =
      "Failed to load audiobook";

  });
