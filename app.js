// CalTrack — week 5: daily dashboard (meal names, macro details, edit/delete).

const WEBHOOK_URL = "https://srv1699496.hstgr.cloud/webhook/calorie-upload";

// The publishable (anon) key is safe to ship in frontend code;
// table access is limited by Row Level Security policies.
const SUPABASE_URL = "https://qsrqigptwhwtuyfnpfjy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_erGpGJBL7UgaYdTrgFvkbQ_3pkCUoX2";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
const saveActions = document.getElementById("save-actions");
const saveBtn = document.getElementById("save-btn");
const dismissBtn = document.getElementById("dismiss-btn");
const todayTotalEl = document.getElementById("today-total");
const todayListEl = document.getElementById("today-list");
const todayEmptyEl = document.getElementById("today-empty");

let lastAnalysis = null;

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
  saveActions.hidden = true;
  resultsEl.replaceChildren(el("p", "results-status", message));
}

function showError(message) {
  saveActions.hidden = true;
  resultsEl.replaceChildren(el("p", "results-error", `Error: ${message}`));
}

function showResult(data) {
  const pre = el("pre", "results-json", JSON.stringify(data, null, 2));
  resultsEl.replaceChildren(pre);
  lastAnalysis = data && typeof data === "object" ? data : null;
  saveActions.hidden = lastAnalysis === null;
  saveBtn.disabled = false;
  document.getElementById("results-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Saving to Supabase ---

saveBtn.addEventListener("click", async () => {
  if (!lastAnalysis) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "กำลังบันทึก…";

  const { error } = await db.from("meals").insert({
    eaten_at: new Date().toISOString(),
    items: lastAnalysis.items ?? [],
    total_calories: lastAnalysis.total_calories ?? null,
    note: lastAnalysis.note_th ?? null,
  });

  saveBtn.textContent = "บันทึกมื้อนี้";

  if (error) {
    saveBtn.disabled = false;
    showError(`บันทึกไม่สำเร็จ — ${error.message}`);
    return;
  }

  saveActions.hidden = true;
  resultsEl.replaceChildren(el("p", "results-status", "บันทึกแล้ว ✓"));
  lastAnalysis = null;
  loadTodayMeals();
});

dismissBtn.addEventListener("click", resetToStart);

function resetToStart() {
  lastAnalysis = null;
  saveActions.hidden = true;
  resultsEl.replaceChildren(el("p", "results-empty", "No results yet — take a photo of your food to get started."));
  previewSection.hidden = true;
  previewImage.removeAttribute("src");
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  currentFile = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- Today's meals ---

async function loadTodayMeals() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const { data, error } = await db
    .from("meals")
    .select("id, eaten_at, items, total_calories, note")
    .gte("eaten_at", midnight.toISOString())
    .order("eaten_at", { ascending: false });

  if (error) {
    todayEmptyEl.hidden = false;
    todayEmptyEl.textContent = `โหลดรายการวันนี้ไม่สำเร็จ — ${error.message}`;
    return;
  }

  const total = data.reduce((sum, meal) => sum + (meal.total_calories ?? 0), 0);
  todayTotalEl.textContent = total.toLocaleString("th-TH");

  todayListEl.replaceChildren(...data.map(renderMealItem));
  todayEmptyEl.hidden = data.length > 0;
  todayEmptyEl.textContent = "ยังไม่มีมื้อที่บันทึกวันนี้";
}

function renderMealItem(meal) {
  const li = document.createElement("li");
  li.className = "meal-item";

  const time = new Date(meal.eaten_at).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const items = Array.isArray(meal.items) ? meal.items : [];
  const names = items.map((it) => it.name_th || it.name_en).filter(Boolean).join(", ");

  const header = document.createElement("button");
  header.type = "button";
  header.className = "meal-header";
  header.append(
    el("span", "today-time", `${time} น.`),
    el("span", "meal-names", names || "ไม่ระบุรายการ"),
    el("span", "today-kcal", `${(meal.total_calories ?? 0).toLocaleString("th-TH")} kcal`)
  );

  const details = document.createElement("div");
  details.className = "meal-details";
  details.hidden = true;

  for (const it of items) {
    details.append(
      el(
        "p",
        "meal-detail-row",
        `${it.name_th || it.name_en || "?"} — ${it.calories ?? 0} kcal · โปรตีน ${it.protein_g ?? 0} ก. · คาร์บ ${it.carb_g ?? 0} ก. · ไขมัน ${it.fat_g ?? 0} ก.`
      )
    );
  }
  if (meal.note) details.append(el("p", "meal-note", meal.note));

  const actions = document.createElement("div");
  actions.className = "meal-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn-small";
  editBtn.textContent = "แก้ไขแคลอรี่";
  editBtn.addEventListener("click", () => startEditCalories(meal, details, actions));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn-small btn-danger";
  deleteBtn.textContent = "ลบมื้อนี้";
  deleteBtn.addEventListener("click", async () => {
    const label = `${time} น. (${(meal.total_calories ?? 0).toLocaleString("th-TH")} kcal)`;
    if (!window.confirm(`ลบมื้อ ${label} ใช่ไหม?`)) return;
    deleteBtn.disabled = true;
    const { error } = await db.from("meals").delete().eq("id", meal.id);
    if (error) {
      deleteBtn.disabled = false;
      window.alert(`ลบไม่สำเร็จ — ${error.message}`);
      return;
    }
    loadTodayMeals();
  });

  actions.append(editBtn, deleteBtn);
  details.append(actions);

  header.addEventListener("click", () => {
    details.hidden = !details.hidden;
  });

  li.append(header, details);
  return li;
}

function startEditCalories(meal, details, actions) {
  if (details.querySelector(".meal-edit")) return;

  const wrap = document.createElement("div");
  wrap.className = "meal-edit";

  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.inputMode = "numeric";
  input.className = "meal-edit-input";
  input.value = meal.total_calories ?? 0;

  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.className = "btn-small";
  okBtn.textContent = "บันทึก";
  okBtn.addEventListener("click", async () => {
    const value = Number.parseInt(input.value, 10);
    if (Number.isNaN(value) || value < 0) {
      window.alert("ใส่ตัวเลขแคลอรี่ให้ถูกต้อง");
      return;
    }
    okBtn.disabled = true;
    const { error } = await db.from("meals").update({ total_calories: value }).eq("id", meal.id);
    if (error) {
      okBtn.disabled = false;
      window.alert(`แก้ไขไม่สำเร็จ — ${error.message}`);
      return;
    }
    loadTodayMeals();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-small";
  cancelBtn.textContent = "ยกเลิก";
  cancelBtn.addEventListener("click", () => wrap.remove());

  wrap.append(input, okBtn, cancelBtn);
  details.insertBefore(wrap, actions);
  input.focus();
}

loadTodayMeals();

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
