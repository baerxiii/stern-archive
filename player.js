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

    playerArea.innerHTML = `
      <div class="card">
        <h2 id="nowPlaying">Select an Episode</h2>

        <audio
          id="mainPlayer"
          controls
          style="width:100%;margin-top:10px;"
        ></audio>
      </div>
    `;

    document.body.appendChild(playerArea);

    const mainPlayer =
      document.getElementById("mainPlayer");

    const nowPlaying =
      document.getElementById("nowPlaying");

    const search = document.createElement("input");

    search.type = "text";
    search.placeholder = "Search episodes...";
    search.style.width = "100%";
    search.style.padding = "12px";
    search.style.margin = "20px 0";

    document.body.appendChild(search);

    const episodeList =
      document.createElement("div");

    episodeList.className =
      "episode-list";

    document.body.appendChild(episodeList);

    function renderEpisodes(filter = "") {

      episodeList.innerHTML = "";

      mp3s
        .filter(file =>
          file.name
            .toLowerCase()
            .includes(filter.toLowerCase())
        )
        .forEach(file => {

          const audioUrl =
            `https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`;

          const item =
            document.createElement("div");

          item.className = "card";

          item.style.cursor = "pointer";

          item.innerHTML = `
            <h3>${file.name}</h3>
          `;

          item.addEventListener(
            "click",
            () => {

              mainPlayer.src = audioUrl;

              nowPlaying.textContent =
                file.name;

              localStorage.setItem(
                "lastPlayed",
                JSON.stringify({
                  archiveId,
                  fileName: file.name,
                  audioUrl
                })
              );

              mainPlayer.play();

            }
          );

          episodeList.appendChild(item);

        });
    }

    search.addEventListener(
      "input",
      () => renderEpisodes(search.value)
    );

    renderEpisodes();

  })
  .catch(error => {
    console.error(error);
  });
