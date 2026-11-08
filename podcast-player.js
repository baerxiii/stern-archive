const params = new URLSearchParams(location.search);
const rssUrl = params.get("rss");
const player = document.getElementById("audioPlayer");
const playback = ListeningHistory.attach(player);
const episodes = document.getElementById("episodes");
const details = document.getElementById("episodeDetails");
const corbettFeed = "https://www.corbettreport.com/newrss.xml";
const corbettProxy = "https://uzbbwvihkfzdbnowhglc.supabase.co/functions/v1/Corbett-feed";

async function loadPodcast() {
  if (!rssUrl) throw new Error("Missing podcast feed URL.");
  let response;
  try {
    response = await fetch(rssUrl);
  } catch (error) {
    if (rssUrl !== corbettFeed) {
      console.error("Could not fetch podcast feed", error);
      throw new Error("Could not fetch this feed. Its server may not allow browser access.");
    }
    try {
      response = await fetch(corbettProxy);
    } catch (proxyError) {
      console.error("Could not reach the podcast feed proxy", proxyError);
      throw new Error("Could not reach the feed proxy. Check the connection and proxy deployment.");
    }
    if (!response.ok) {
      throw new Error(`The feed proxy returned HTTP ${response.status}. Check its deployment and feed availability.`);
    }
  }
  if (!response.ok) throw new Error(`Could not load podcast feed (${response.status}).`);
  const xml = new DOMParser().parseFromString(await response.text(), "text/xml");
  if (xml.querySelector("parsererror")) throw new Error("The podcast feed is invalid.");
  const podcastTitle = xml.querySelector("channel > title")?.textContent || "Podcast";
  document.getElementById("podcastTitle").textContent = podcastTitle;
  const items = [...xml.querySelectorAll("item")].filter(item => item.querySelector("enclosure")?.getAttribute("url"));
  document.getElementById("episodeCount").textContent = `${items.length} episodes available`;
  let selected = false;

  items.forEach(item => {
    const title = item.querySelector("title")?.textContent || "Untitled episode";
    const audioUrl = item.querySelector("enclosure").getAttribute("url");
    const date = item.querySelector("pubDate")?.textContent || "";
    const description = (item.querySelector("description")?.textContent || "").replace(/<[^>]*>/g, "").trim();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "episode-button";
    const heading = document.createElement("div");
    heading.className = "episode-title";
    heading.textContent = title;
    const summary = document.createElement("div");
    summary.className = "episode-description";
    summary.textContent = description.substring(0, 180);
    button.append(heading, summary);

    function select(autoplay) {
      episodes.querySelectorAll(".playing").forEach(element => element.classList.remove("playing"));
      button.classList.add("playing");
      document.getElementById("podcastNowPlaying").textContent = title;
      details.replaceChildren();
      const heading = document.createElement("h2");
      heading.textContent = title;
      const dateEl = document.createElement("p");
      dateEl.textContent = date;
      const descriptionEl = document.createElement("p");
      descriptionEl.textContent = description;
      details.append(heading, dateEl, descriptionEl);
      playback.load({ type: "podcast", collectionId: rssUrl, trackId: audioUrl,
        collectionTitle: podcastTitle, title, audioUrl }, autoplay);
    }

    button.addEventListener("click", () => select(true));
    episodes.appendChild(button);
    if (params.get("episode") === audioUrl) {
      select(false);
      selected = true;
    }
  });
  if (params.has("episode") && !selected) {
    details.textContent = "This episode is no longer available in the feed.";
  }
}

loadPodcast().catch(error => {
  console.error(error);
  document.getElementById("podcastTitle").textContent = "Failed to load podcast feed";
  details.textContent = error.message;
});
