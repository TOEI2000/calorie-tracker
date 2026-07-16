// CalTrack — week 2: photo capture + preview, analysis via n8n webhook.

const WEBHOOK_URL = "https://srv1699496.hstgr.cloud/webhook/calorie-upload";

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

const resultsEl = document.getElementById("results");

analyzeBtn.addEventListener("click", async () => {
  if (!currentFile) {
    showError("No photo selected yet — take a photo first.");
    return;
  }

  const formData = new FormData();
  formData.append("photo", currentFile, currentFile.name || "photo.jpg");

  analyzeBtn.disabled = true;
  showStatus("Analyzing…");

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    showResult(data);
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    analyzeBtn.disabled = false;
  }
});

function showStatus(message) {
  resultsEl.replaceChildren(el("p", "results-status", message));
}

function showError(message) {
  resultsEl.replaceChildren(el("p", "results-error", `Error: ${message}`));
}

function showResult(data) {
  const pre = el("pre", "results-json", JSON.stringify(data, null, 2));
  resultsEl.replaceChildren(pre);
  document.getElementById("results-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

// textContent (not innerHTML) so server responses can't inject markup
function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

// Register the service worker (relative path so it works on GitHub Pages subpaths)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch((err) => console.error("Service worker registration failed:", err));
  });
}
