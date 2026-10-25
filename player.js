const params = new URLSearchParams(window.location.search);

const archiveId = params.get("archiveId");
const title = params.get("title");

document.getElementById("title").textContent =
  title || "Episodes";

fetch(`https://archive.org/metadata/${archiveId}`)
  .then(response => response.json())
  .then(data => {

    const mp3s = data.files.filter(file =>
      file.name.toLowerCase().endsWith(".mp3")
    );

    document.body.innerHTML += `
      <p style="color:white;padding:20px;">
        Found ${mp3s.length} MP3 files
      </p>
    `;

    mp3s.slice(0, 20).forEach(file => {

      const div = document.createElement("div");

      div.style.color = "white";
      div.style.padding = "10px";

      div.textContent = file.name;

      document.body.appendChild(div);

    });

  })
  .catch(err => {
    console.error(err);

    document.body.innerHTML += `
      <p style="color:red;padding:20px;">
        Error loading archive
      </p>
    `;
  });
