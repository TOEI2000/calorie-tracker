// CalTrack — week 1: photo capture + preview only.
// AI analysis and persistence arrive in later weeks.

const cameraInput = document.getElementById("camera-input");
const galleryInput = document.getElementById("gallery-input");
const takePhotoBtn = document.getElementById("take-photo-btn");
const galleryBtn = document.getElementById("gallery-btn");
const previewSection = document.getElementById("preview-section");
const previewImage = document.getElementById("preview-image");
const analyzeBtn = document.getElementById("analyze-btn");

let currentObjectUrl = null;
let currentFile = null;

takePhotoBtn.addEventListener("click", () => cameraInput.click());
galleryBtn.addEventListener("click", () => galleryInput.click());

cameraInput.addEventListener("change", handlePhotoSelected);
galleryInput.addEventListener("change", handlePhotoSelected);

function handlePhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Release the previous preview's memory before creating a new one
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  currentFile = file;
  currentObjectUrl = URL.createObjectURL(file);
  previewImage.src = currentObjectUrl;
  previewSection.hidden = false;
  previewSection.scrollIntoView({ behavior: "smooth", block: "start" });

  // Allow re-selecting the same file to fire "change" again
  event.target.value = "";
}

analyzeBtn.addEventListener("click", () => {
  // Week 2+: send the photo to an AI vision model and render calories here
  console.log("Analyze clicked — AI analysis coming in a future week.", {
    name: currentFile?.name,
    type: currentFile?.type,
    sizeKB: currentFile ? Math.round(currentFile.size / 1024) : 0,
  });
});

// Register the service worker (relative path so it works on GitHub Pages subpaths)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch((err) => console.error("Service worker registration failed:", err));
  });
}
