setInterval(() => {

  const player =
    document.getElementById(
      "audioPlayer"
    );

  if (!player.src) {
    return;
  }

  localStorage.setItem(
    "audiobookPosition",
    JSON.stringify({
      src: player.src,
      position: player.currentTime
    })
  );

}, 5000);

const saved =
  JSON.parse(
    localStorage.getItem(
      "audiobookPosition"
    ) || "null"
  );

if (
  saved &&
  saved.src === audioUrl
) {

  player.addEventListener(
    "loadedmetadata",
    () => {

      player.currentTime =
        saved.position;

    },
    { once: true }
  );

}
