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
      <div class="card">
        <h3>${item.title}</h3>
        <p>${item.year}</p>

        <a href="player.html?archiveId=${item.archiveId}&title=${encodeURIComponent(item.title)}">
          Browse Episodes
        </a>
      </div>
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
    card.innerHTML = "<p>No recent listening.</p>";
    return;
  }

  card.innerHTML = `
    <div class="card">
      <h3>${lastPlayed.title}</h3>

      <a href="${lastPlayed.url}">
        Resume Listening
      </a>
    </div>
  `;
}
