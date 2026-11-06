fetch('podcasts.json')
  .then(r => r.json())
  .then(podcasts => {

    const container =
      document.getElementById(
        'podcastList'
      );

    podcasts.forEach(
      podcast => {

        const btn =
          document.createElement(
            'button'
          );

        btn.textContent =
          podcast.name;

        btn.onclick = () => {

          window.location =
            `podcast-player.html?rss=${
              encodeURIComponent(
                podcast.rss
              )
            }`;

        };

        container.appendChild(btn);

      }
    );

  });
