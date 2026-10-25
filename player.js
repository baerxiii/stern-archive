const params = new URLSearchParams(window.location.search);

const archiveId = params.get("archiveId");
const title = params.get("title");

document.getElementById("title").textContent =
  title || "Episodes";

fetch(`https://archive.org/metadata/${archiveId}`)
  .then(response => response.json())
  .then(data => {

    const mp3s = data.files.filter(file =>
      file.name.toLowerCase().endsWith(".mp3")
    );

    const playerArea = document.createElement("div");

    playerArea.className = "card";

    playerArea.innerHTML = `
      <h2 id="nowPlaying">Select an Episode</h2>

      <audio
        id="mainPlayer"
        controls
        style="width:100%;margin-top:10px;"
      ></audio>
    `;

    document.body.appendChild(playerArea);

    const mainPlayer =
      document.getElementById("mainPlayer");

    const nowPlaying =
      document.getElementById("nowPlaying");

    const search =
      document.createElement("input");

    search.type = "text";
    search.placeholder =
      "Search episodes...";

    search.style.width = "100%";
    search.style.padding = "12px";
    search.style.margin = "20px 0";
    search.style.background = "#1d1d1d";
    search.style.color = "white";
    search.style.border = "none";
    search.style.borderRadius = "8px";

    document.body.appendChild(search);

    const episodeList =
      document.createElement("div");

    episodeList.className = "episode-list";

    document.body.appendChild(episodeList);

    function loadEpisode(file) {

      const audioUrl =
        `https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`;

      const positionKey =
        `${archiveId}_${file.name}`;

      mainPlayer.src = audioUrl;

      nowPlaying.textContent =
        file.name;

      localStorage.setItem(
        "currentEpisode",
        JSON.stringify({
          archiveId,
          fileName: file.name,
          audioUrl
        })
      );

      const savedPosition =
        localStorage.getItem(positionKey);

      if (savedPosition) {

        mainPlayer.addEventListener(
          "loadedmetadata",
          function restorePosition() {

            mainPlayer.currentTime =
              parseFloat(savedPosition);

            mainPlayer.removeEventListener(
              "loadedmetadata",
              restorePosition
            );

          },
          { once: true }
        );

      }

      mainPlayer.play();
    }

    function renderEpisodes(filter = "") {

      episodeList.innerHTML = "";

      mp3s
        .filter(file =>
          file.name
            .toLowerCase()
            .includes(filter.toLowerCase())
        )
        .forEach(file => {

          const card =
            document.createElement("div");

          card.className = "card";
          card.style.cursor = "pointer";

          card.innerHTML = `
            <h3>${file.name}</h3>
          `;

          card.addEventListener(
            "click",
            () => loadEpisode(file)
          );

          episodeList.appendChild(card);

        });

    }

    search.addEventListener(
      "input",
      () => renderEpisodes(search.value)
    );

    renderEpisodes();

    setInterval(() => {

      const currentEpisode =
        JSON.parse(
          localStorage.getItem("currentEpisode")
        );

      if (
        !currentEpisode ||
        !mainPlayer.currentTime
      ) {
        return;
      }

      const key =
        `${currentEpisode.archiveId}_${currentEpisode.fileName}`;

      localStorage.setItem(
        key,
        mainPlayer.currentTime
      );

    }, 5000);

    const lastEpisode =
      JSON.parse(
        localStorage.getItem("currentEpisode")
      );

    if (
      lastEpisode &&
      lastEpisode.archiveId === archiveId
    ) {

      mainPlayer.src =
        lastEpisode.audioUrl;

      nowPlaying.textContent =
        `Resume: ${lastEpisode.fileName}`;

      const key =
        `${lastEpisode.archiveId}_${lastEpisode.fileName}`;

      const savedPosition =
        localStorage.getItem(key);

      if (savedPosition) {

        mainPlayer.addEventListener(
          "loadedmetadata",
          () => {

            mainPlayer.currentTime =
              parseFloat(savedPosition);

          },
          { once: true }
        );

      }

    }

  })
  .catch(error => {

    console.error(error);

    document.body.innerHTML += `
      <p style="color:red;padding:20px;">
        Error loading archive.
      </p>
    `;

  });
