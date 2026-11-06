const results =
  document.getElementById(
    "results"
  );

async function searchBooks() {

  const search =
    document
      .getElementById(
        "searchBox"
      )
      .value
      .trim();

  if (!search) {
    return;
  }

  results.innerHTML =
    "<p>Searching...</p>";

  const url =
  "https://archive.org/advancedsearch.php" +
  "?q=" +
  encodeURIComponent(
    `${search} AND mediatype:(audio) AND (collection:(librivoxaudio) OR collection:(audio_bookspoetry))`
  )
+
    "&fl[]=identifier" +
    "&fl[]=title" +
    "&fl[]=description" +
    "&rows=100" +
    "&page=1" +
    "&output=json";

  try {

    const response =
      await fetch(url);

    const data =
      await response.json();
    data.response.docs =
  data.response.docs.filter(
    book =>
      book.title &&
      !book.title
        .toLowerCase()
        .includes("podcast")
  );

    results.innerHTML = "";

    data.response.docs
      .forEach(book => {

        const card =
          document.createElement(
            "article"
          );

        card.className =
          "library-card card";

        card.innerHTML = `
          <h3>
            ${book.title || "Untitled"}
          </h3>

          <p>
            ${(book.description || "")
              .toString()
              .substring(0, 180)}
          </p>

          <a href="
            audiobook-player.html?id=${book.identifier}
          ">
            Open Book
          </a>
        `;

        results.appendChild(card);

      });

  } catch (error) {

    console.error(error);

    results.innerHTML =
      "<p>Search failed.</p>";

  }

}

document
  .getElementById(
    "searchBtn"
  )
  .addEventListener(
    "click",
    searchBooks
  );

document
  .getElementById(
    "searchBox"
  )
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {
        searchBooks();
      }

    }
  );
