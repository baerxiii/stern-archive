(() => {
  const audio = document.getElementById("audioPlayer");
  if (!audio) return;

  // Remember playback intent across app/background transitions. A normal pause
  // while the player is visible clears the intent, so returning won't override it.
  let playbackIntent = false;
  let resumeAfterInterruption = false;

  audio.addEventListener("play", () => {
    playbackIntent = true;
    resumeAfterInterruption = false;
  });

  audio.addEventListener("pause", () => {
    if (!audio.ended && document.visibilityState === "visible" && document.hasFocus()) {
      playbackIntent = false;
      resumeAfterInterruption = false;
    } else if (!audio.ended && playbackIntent) {
      resumeAfterInterruption = true;
    }
  });

  const markInterruption = () => {
    if (playbackIntent && !audio.ended) resumeAfterInterruption = true;
  };

  window.addEventListener("blur", markInterruption);
  window.addEventListener("pagehide", markInterruption);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      markInterruption();
      return;
    }
    attemptResume();
  });
  window.addEventListener("focus", attemptResume);

  function attemptResume() {
    if (!resumeAfterInterruption || !playbackIntent || !audio.paused || audio.ended) return;
    resumeAfterInterruption = false;
    const playRequest = audio.play();
    if (playRequest && typeof playRequest.catch === "function") {
      playRequest.catch(() => {
        // Mobile browsers may require a user gesture after a call or app switch.
        resumeAfterInterruption = true;
      });
    }
  }
})();
