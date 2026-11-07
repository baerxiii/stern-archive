fetch("podcasts.json")
  .then(response => {
    if (!response.ok) throw new Error(`Could not load podcasts (${response.status}).`);
    return response.json();
  })
  .then(podcasts => {
    const container = document.getElementById("podcastList");
    podcasts.forEach(podcast => {
      const card = document.createElement("article");
      card.className = "library-card";
      const label = document.createElement("span");
      label.className = "status-pill";
      label.textContent = "Podcast";
      const title = document.createElement("h2");
      title.textContent = podcast.name;
      const link = document.createElement("a");
      link.className = "resume-link";
      link.href = `podcast-player.html?${new URLSearchParams({ rss: podcast.rss })}`;
      link.textContent = "Browse episodes";
      card.append(label, title, link);
      container.appendChild(card);
    });
  })
  .catch(error => {
    console.error(error);
    document.getElementById("podcastList").textContent = "Could not load podcasts. Please try again.";
  });
