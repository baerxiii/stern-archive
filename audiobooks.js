let currentCategory =
  "audio_bookspoetry";

const results =
  document.getElementById(
    "results"
  );

document
  .querySelectorAll(
    ".category-btn"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".category-btn"
          )
          .forEach(btn =>
            btn.classList.remove(
              "active"
            )
          );

        button.classList.add(
          "active"
        );

        currentCategory =
          button.dataset.query;

      }
    );

  });

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

  let query = "";

  if (
    currentCategory ===
    "audio_bookspoetry"
  ) {

    query =
      `${search}
       AND mediatype:(audio)
       AND collection:(audio_bookspoetry)`;

  } else if (
    currentCategory ===
    "oldtimeradio"
  ) {

    query =
      `${search}
       AND collection:(oldtimeradio)`;

  } else {

    query =
      `${search}
       AND mediatype:(audio)
       AND subject:(${currentCategory})`;

  }

  const url =
    "https://archive.org/advancedsearch.php" +
    "?q=" +
    encodeURIComponent(query) +
    "&fl[]=identifier" +
    "&fl[]=title" +
    "&fl[]=creator" +
    "&fl[]=description" +
    "&rows=100" +
    "&page=1" +
    "&output=json";

  try {

    const response =
      await fetch(url);

    const data =
      await response.json();

    const docs =
      data.response.docs.filter(
        item =>
          item.title &&
          !item.title
            .toLowerCase()
            .includes("podcast")
      );

    results.innerHTML = "";

    docs.forEach(book => {

      const card =
        document.createElement(
          "article"
        );

      card.className =
        "library-card card";

      card.innerHTML = `
        <h3>
          ${book.title}
        </h3>

        <p>
          ${book.creator || ""}
        </p>

        <p>
          ${(book.description || "")
            .toString()
            .replace(
              /<[^>]*>/g,
              ""
            )
            .substring(0,150)}
        </p>

        <a href="
          audiobook-player.html?id=${book.identifier}
        ">
          Open Book
        </a>
      `;

      results.appendChild(
        card
      );

    });

  } catch(error) {

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
