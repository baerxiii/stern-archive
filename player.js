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

  mp3s.forEach(file => {

  const audioUrl =
    `https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`;

  const div = document.createElement("div");

  div.style.padding = "10px";
  div.style.margin = "10px";
  div.style.background = "#1d1d1d";
  div.style.borderRadius = "10px";

  div.innerHTML = `
    <h3 style="color:white">${file.name}</h3>

    <audio controls style="width:100%;">
      <source src="${audioUrl}" type="audio/mpeg">
    </audio>
  `;

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
