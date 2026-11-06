const params =
  new URLSearchParams(
    location.search
  );

const identifier =
  params.get("id");

const title =
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

fetch(
  `https://archive.org/metadata/${identifier}`
)
.then(r => r.json())
.then(data => {

  title.textContent =
    data.metadata.title ||
    identifier;

  const tracks =
    (data.files || [])
      .filter(file =>
        file.name
          ?.toLowerCase()
          .endsWith(".mp3")
      );

  if (!tracks.length) {
    chapters.innerHTML =
      "<p>No audio found.</p>";
    return;
  }

  player.src =
    `https://archive.org/download/${identifier}/${tracks[0].name}`;

  chapters.innerHTML =
    "<h3>Chapters</h3>";

  tracks.forEach(track => {

    const button =
      document.createElement(
        "button"
      );

    button.className =
      "segment-jump";

    button.textContent =
      track.title ||
      track.name;

    button.onclick =
      () => {

        player.src =
          `https://archive.org/download/${identifier}/${track.name}`;

        player.play();

      };

    chapters.appendChild(
      button
    );

  });

});
