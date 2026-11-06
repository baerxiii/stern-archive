const params =
  new URLSearchParams(
    location.search
  );

const rssUrl =
  params.get('rss');

const rssProxy =
  `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;

fetch(rssProxy)
  .then(r => r.text())
  .then(xmlText => {

    const parser =
      new DOMParser();

    const xml =
      parser.parseFromString(
        xmlText,
        'text/xml'
      );

    const items =
      xml.querySelectorAll(
        'item'
      );

    const episodes =
      document.getElementById(
        'episodes'
      );

    items.forEach(item => {

      const title =
        item.querySelector(
          'title'
        )?.textContent;

      const enclosure =
        item.querySelector(
          'enclosure'
        );

      const audioUrl =
        enclosure?.getAttribute(
          'url'
        );

      if (!audioUrl)
        return;

      const button =
        document.createElement(
          'button'
        );

      button.textContent =
        title;

      button.onclick = () => {

        document
          .getElementById(
            'audioPlayer'
          )
          .src =
          audioUrl;

      };

      episodes.appendChild(
        button
      );

    });

  });
