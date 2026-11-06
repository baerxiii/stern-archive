const params =
  new URLSearchParams(
    location.search
  );

const rssUrl =
  params.get("rss");

fetch(rssUrl)
  .then(response => response.text())
  .then(xmlText => {

    const parser =
      new DOMParser();

    const xml =
      parser.parseFromString(
        xmlText,
        "text/xml"
      );

    const channelTitle =
      xml.querySelector(
        "channel > title"
      );

    if (channelTitle) {

      document.getElementById(
        "podcastTitle"
      ).textContent =
        channelTitle.textContent;

    }

    const items =
      xml.querySelectorAll(
        "item"
      );

    document.getElementById(
  "episodeCount"
).textContent =
  `${items.length} episodes available`;

    const episodes =
      document.getElementById(
        "episodes"
      );

    items.forEach(item => {

      const title =
        item.querySelector(
          "title"
        )?.textContent;

      const pubDate =
  item.querySelector(
    "pubDate"
  )?.textContent;

const description =
  item.querySelector(
    "description"
  )?.textContent
    ?.replace(/<[^>]*>/g, "")
    ?.trim();

      const enclosure =
        item.querySelector(
          "enclosure"
        );

      const audioUrl =
        enclosure?.getAttribute(
          "url"
        );

      if (!audioUrl) {
        return;
      }

const button =
  document.createElement(
    "button"
  );

button.className =
  "episode-button";

const formattedDate =
  pubDate
    ? new Date(pubDate)
        .toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric"
          }
        )
    : "";

button.innerHTML = `
  <div class="episode-title">
    🎙 ${title}
  </div>

  <div class="episode-date">
    ${formattedDate}
  </div>

  <div class="episode-description">
    ${(description || "")
      .substring(0, 180)}
  </div>
`;

button.addEventListener(
  "click",
  () => {

    const player =
      document.getElementById(
        "audioPlayer"
      );

    player.src =
      audioUrl;

    document.getElementById(
      "episodeDetails"
    ).innerHTML = `
      <h2>${title}</h2>

      <p>
        ${formattedDate}
      </p>

      <p>
        ${description || ""}
      </p>
    `;

    player.play();

  }
);

      episodes.appendChild(
        button
      );

      button.addEventListener(
  "click",
  () => {

    const player =
      document.getElementById(
        "audioPlayer"
      );

    document
      .querySelectorAll(
        ".episode-button"
      )
      .forEach(btn =>
        btn.classList.remove(
          "playing"
        )
      );

    button.classList.add(
      "playing"
    );

    player.src =
      audioUrl;

    document.getElementById(
      "episodeDetails"
    ).innerHTML = `
      <h2>${title}</h2>

      <p>
        ${formattedDate}
      </p>

      <p>
        ${description || ""}
      </p>
    `;

    player.play();

  }
);

    });

  })
  .catch(error => {

    console.error(error);

    document.getElementById(
      "podcastTitle"
    ).textContent =
      "Failed to load podcast feed";

  });
