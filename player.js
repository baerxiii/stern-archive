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
        displayName;

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

  const grouped = {};

  mp3s
    .filter(file =>
      file.name
        .toLowerCase()
        .includes(filter.toLowerCase())
    )
    .forEach(file => {

      const match =
        file.name.match(/(\d{4})_(\d{2})_(\d{2})/);

      if (!match) return;

      const year = match[1];
      const month = match[2];
      const day = match[3];

      const date = new Date(
        `${year}-${month}-${day}`
      );

      const monthName =
        date.toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long"
          }
        );

      const displayName =
        date.toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "2-digit"
          }
        );

      if (!grouped[monthName]) {
        grouped[monthName] = [];
      }

      grouped[monthName].push({
        file,
        displayName
      });

    });

  Object.keys(grouped).forEach(month => {

    const header =
      document.createElement("h2");

    header.textContent =
      `📅 ${month}`;

    header.style.marginTop = "30px";

    episodeList.appendChild(header);

    grouped[month].forEach(item => {

      const card =
        document.createElement("div");

      card.className = "card";

      card.style.cursor =
        "pointer";

      card.innerHTML = `
        <h3>▶ ${item.displayName}</h3>
      `;

      card.addEventListener(
        "click",
        () => loadEpisode(item.file)
      );

      episodeList.appendChild(card);

    });

  });

}

let displayName = file.name;

if (match) {

  const year = match[1];
  const month = match[2];
  const day = match[3];

  const date = new Date(
    `${year}-${month}-${day}`
  );

  displayName = date.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "2-digit"
    }
  );
}

card.innerHTML = `
  <h3>▶ ${displayName}</h3>
`;


          card.addEventListener("click", () => {

  loadEpisode(file);

  setTimeout(() => {
    mainPlayer.play().catch(err => {
      console.log("Autoplay blocked:", err);
    });
  }, 100);

});

          episodeList.appendChild(card);

        });

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
