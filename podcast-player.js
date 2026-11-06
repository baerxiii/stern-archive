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

    const episodes =
      document.getElementById(
        "episodes"
      );

    items.forEach(item => {

      const title =
        item.querySelector(
          "title"
        )?.textContent;

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

      button.textContent =
        title;

      button.addEventListener(
        "click",
        () => {

          const player =
            document.getElementById(
              "audioPlayer"
            );

          player.src =
            audioUrl;

          player.play();

        }
      );

      episodes.appendChild(
        button
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
