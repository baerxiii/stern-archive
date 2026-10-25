let libraryData = [];

fetch("library.json")
  .then(response => response.json())
  .then(data => {
    libraryData = data;
    buildLibrary(data);
    buildContinueListening();
  });

function buildLibrary(items) {
  const library = document.getElementById("library");

  if (!library) return;

  library.innerHTML = "";

  items.forEach(item => {
    library.innerHTML += `
      <article class="library-card card">
        <div class="card-topline">
          <span class="status-pill">${item.year}</span>
        </div>
        <h3>${item.title}</h3>
        <p>Archive collection</p>
        <a href="player.html?archiveId=${item.archiveId}&title=${encodeURIComponent(item.title)}">
          Open archive
        </a>
      </article>
    `;
  });
}

const searchBox = document.getElementById("searchBox");

if (searchBox) {
  searchBox.addEventListener("input", () => {
    const search = searchBox.value.toLowerCase();

    const filtered = libraryData.filter(item =>
      item.title.toLowerCase().includes(search)
    );

    buildLibrary(filtered);
  });
}

function buildContinueListening() {
  const card = document.getElementById("continueCard");

  if (!card) return;

  const lastPlayed = JSON.parse(
    localStorage.getItem("lastPlayed")
  );

  if (!lastPlayed) {
    card.innerHTML = `
      <div class="continue-card empty-state">
        <p>No recent listening yet.</p>
        <a href="library.html">Browse library</a>
      </div>
    `;
    return;
  }

  card.innerHTML = `
    <div class="continue-card">
      <span class="status-pill">Resume</span>
      <h3>${lastPlayed.title}</h3>
      <p>Pick up where you left off.</p>
      <a href="${lastPlayed.url}">Resume listening</a>
    </div>
  `;
}
