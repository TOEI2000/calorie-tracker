// CalTrack — week 7: polish (image compression, loading states, retry, offline queue).

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
const queueBanner = document.getElementById("queue-banner");
const queueTextEl = document.getElementById("queue-text");
const queueAnalyzeBtn = document.getElementById("queue-analyze-btn");
const saveActions = document.getElementById("save-actions");
const saveBtn = document.getElementById("save-btn");
const dismissBtn = document.getElementById("dismiss-btn");
const todayTotalEl = document.getElementById("today-total");
const todayListEl = document.getElementById("today-list");
const todayEmptyEl = document.getElementById("today-empty");
const goalFillEl = document.getElementById("goal-fill");
const goalStatusEl = document.getElementById("goal-status");
const goalEditBtn = document.getElementById("goal-edit-btn");
const goalEditEl = document.getElementById("goal-edit");
const goalInputEl = document.getElementById("goal-input");
const chartPlotEl = document.getElementById("chart-plot");
const chartDaysEl = document.getElementById("chart-days");
const chartReadoutEl = document.getElementById("chart-readout");
const historyListEl = document.getElementById("history-list");

let lastAnalysis = null;

// --- Image compression (multi-MB camera photos -> a few hundred KB) ---

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.85;

async function compressImage(file) {
  try {
    // "from-image" applies the EXIF rotation so the photo arrives upright
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    console.log(`Compressed photo: ${Math.round(file.size / 1024)} KB -> ${Math.round(blob.size / 1024)} KB`);
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file; // compression is best-effort; the original still works
  }
}

// --- Analyze (with timeout, retry, and offline queueing) ---

const ANALYZE_TIMEOUT_MS = 60000;

analyzeBtn.addEventListener("click", () => analyzePhoto(currentFile));

async function analyzePhoto(file, { skipCompress = false, queueOnFailure = true } = {}) {
  if (!file) {
    showError("ยังไม่ได้เลือกรูป — ถ่ายรูปก่อนนะครับ");
    return false;
  }

  analyzeBtn.disabled = true;

  try {
    let photo = file;
    if (!skipCompress) {
      showStatus("กำลังเตรียมรูป…", { spinner: true });
      photo = await compressImage(file);
    }

    if (!navigator.onLine) {
      if (queueOnFailure) {
        await queueAdd(photo);
        await updateQueueBanner();
        showStatus("ออฟไลน์อยู่ — เก็บรูปไว้ในคิวแล้ว จะวิเคราะห์ได้เมื่อกลับมาออนไลน์");
      } else {
        showError("ยังออฟไลน์อยู่ — ลองใหม่เมื่อมีเน็ตครับ");
      }
      return false;
    }

    showStatus("กำลังวิเคราะห์…", { spinner: true });

    const formData = new FormData();
    formData.append("photo", photo, photo.name || "photo.jpg");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`เซิร์ฟเวอร์ตอบ ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      showResult(data);
      return true;
    } catch (err) {
      if (err.name === "AbortError") {
        showAnalyzeError("หมดเวลารอ (60 วินาที)", photo);
      } else if (err instanceof TypeError) {
        // fetch network failure (connection dropped mid-flight)
        if (queueOnFailure) {
          await queueAdd(photo);
          await updateQueueBanner();
          showStatus("ส่งไม่สำเร็จ (เน็ตมีปัญหา) — เก็บรูปไว้ในคิวแล้ว");
        } else {
          showAnalyzeError("ส่งไม่สำเร็จ (เน็ตมีปัญหา)", photo);
        }
      } else {
        showAnalyzeError(err.message || String(err), photo);
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  } finally {
    analyzeBtn.disabled = false;
  }
}

function showAnalyzeError(message, photo) {
  saveActions.hidden = true;
  const wrap = el("div", "results-error-wrap", "");
  wrap.append(el("p", "results-error", `ผิดพลาด: ${message}`));
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn-small";
  retry.textContent = "ลองใหม่";
  retry.addEventListener("click", () => analyzePhoto(photo, { skipCompress: true }));
  wrap.append(retry);
  resultsEl.replaceChildren(wrap);
}

// --- Offline queue (IndexedDB) ---

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("caltrack-queue", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("photos", { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueAdd(blob) {
  const qdb = await openQueueDb();
  await new Promise((resolve, reject) => {
    const tx = qdb.transaction("photos", "readwrite");
    tx.objectStore("photos").add({ blob, queuedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  qdb.close();
}

async function queueGetAll() {
  const qdb = await openQueueDb();
  const entries = await new Promise((resolve, reject) => {
    const req = qdb.transaction("photos", "readonly").objectStore("photos").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  qdb.close();
  return entries;
}

async function queueRemove(id) {
  const qdb = await openQueueDb();
  await new Promise((resolve, reject) => {
    const tx = qdb.transaction("photos", "readwrite");
    tx.objectStore("photos").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  qdb.close();
}

async function updateQueueBanner() {
  const entries = await queueGetAll().catch(() => []);
  queueBanner.hidden = entries.length === 0;
  if (entries.length > 0) {
    queueTextEl.textContent = `📥 มีรูปรอวิเคราะห์ ${entries.length} รูป`;
  }
}

queueAnalyzeBtn.addEventListener("click", async () => {
  const entries = await queueGetAll().catch(() => []);
  if (entries.length === 0) {
    updateQueueBanner();
    return;
  }
  const oldest = entries[0];
  const file = new File([oldest.blob], "queued-photo.jpg", {
    type: oldest.blob.type || "image/jpeg",
  });

  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentFile = file;
  currentObjectUrl = URL.createObjectURL(file);
  previewImage.src = currentObjectUrl;
  previewSection.hidden = false;

  const ok = await analyzePhoto(file, { skipCompress: true, queueOnFailure: false });
  if (ok) {
    await queueRemove(oldest.id);
  }
  updateQueueBanner();
});

window.addEventListener("online", updateQueueBanner);
updateQueueBanner();

function showStatus(message, { spinner = false } = {}) {
  saveActions.hidden = true;
  const status = el("p", "results-status", message);
  if (spinner) status.prepend(el("span", "spinner", ""));
  resultsEl.replaceChildren(status);
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
  loadDashboard();
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

// --- Daily goal (stored per device) ---

const GOAL_KEY = "caltrack_daily_goal";
const GOAL_DEFAULT = 2000;

function getGoal() {
  const stored = Number.parseInt(localStorage.getItem(GOAL_KEY), 10);
  return Number.isNaN(stored) || stored < 1 ? GOAL_DEFAULT : stored;
}

goalEditBtn.addEventListener("click", () => {
  goalInputEl.value = getGoal();
  goalEditEl.hidden = false;
  goalEditBtn.hidden = true;
  goalInputEl.focus();
});

document.getElementById("goal-cancel-btn").addEventListener("click", () => {
  goalEditEl.hidden = true;
  goalEditBtn.hidden = false;
});

document.getElementById("goal-save-btn").addEventListener("click", () => {
  const value = Number.parseInt(goalInputEl.value, 10);
  if (Number.isNaN(value) || value < 1) {
    window.alert("ใส่ตัวเลขเป้าหมายให้ถูกต้อง");
    return;
  }
  localStorage.setItem(GOAL_KEY, String(value));
  goalEditEl.hidden = true;
  goalEditBtn.hidden = false;
  loadDashboard();
});

function renderGoal(todayTotal) {
  const goal = getGoal();
  const pct = Math.min((todayTotal / goal) * 100, 100);
  goalFillEl.style.width = `${pct}%`;
  goalFillEl.classList.toggle("goal-fill-over", todayTotal > goal);

  const goalText = goal.toLocaleString("th-TH");
  if (todayTotal > goal) {
    goalStatusEl.textContent = `เกินเป้า ${(todayTotal - goal).toLocaleString("th-TH")} kcal (เป้า ${goalText})`;
  } else {
    goalStatusEl.textContent = `เหลืออีก ${(goal - todayTotal).toLocaleString("th-TH")} kcal จากเป้า ${goalText}`;
  }
}

// --- Dashboard (today + last 7 days) ---

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const dayKey = (date) => startOfDay(date).getTime();

async function loadDashboard() {
  const todayStart = startOfDay(new Date());
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - 6);

  const { data, error } = await db
    .from("meals")
    .select("id, eaten_at, items, total_calories, note")
    .gte("eaten_at", rangeStart.toISOString())
    .order("eaten_at", { ascending: false });

  if (error) {
    todayEmptyEl.hidden = false;
    todayEmptyEl.textContent = `โหลดรายการไม่สำเร็จ — ${error.message}`;
    return;
  }

  // Today's detail list
  const todayMeals = data.filter((m) => new Date(m.eaten_at) >= todayStart);
  const todayTotal = todayMeals.reduce((sum, m) => sum + (m.total_calories ?? 0), 0);
  todayTotalEl.textContent = todayTotal.toLocaleString("th-TH");
  todayListEl.replaceChildren(...todayMeals.map(renderMealItem));
  todayEmptyEl.hidden = todayMeals.length > 0;
  todayEmptyEl.textContent = "ยังไม่มีมื้อที่บันทึกวันนี้";

  renderGoal(todayTotal);

  // Bucket all 7 days (oldest -> newest)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(todayStart);
    date.setDate(date.getDate() - i);
    days.push({ date, total: 0, mealCount: 0 });
  }
  const byKey = new Map(days.map((d) => [dayKey(d.date), d]));
  for (const meal of data) {
    const bucket = byKey.get(dayKey(new Date(meal.eaten_at)));
    if (!bucket) continue;
    bucket.total += meal.total_calories ?? 0;
    bucket.mealCount += 1;
  }

  renderWeekChart(days);
  renderHistoryList(days);
}

function dayLabel(date) {
  return date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
}

function renderWeekChart(days) {
  const goal = getGoal();
  const scaleMax = Math.max(goal, ...days.map((d) => d.total)) * 1.08;

  chartPlotEl.replaceChildren(
    ...days.map((day, i) => {
      const col = document.createElement("div");
      col.className = "chart-col";

      const isToday = i === days.length - 1;
      const value = el("span", "chart-value", day.total.toLocaleString("th-TH"));
      value.hidden = !isToday; // selective label: only today by default

      const bar = document.createElement("button");
      bar.type = "button";
      bar.className = "chart-bar";
      bar.style.height = `${Math.max((day.total / scaleMax) * 100, day.total > 0 ? 2 : 0.5)}%`;
      bar.setAttribute("aria-label", `${dayLabel(day.date)} ${day.total.toLocaleString("th-TH")} kcal`);
      bar.addEventListener("click", () => {
        chartReadoutEl.textContent = `${dayLabel(day.date)} — ${day.total.toLocaleString("th-TH")} kcal (${day.mealCount} มื้อ)`;
        chartPlotEl.querySelectorAll(".chart-value").forEach((v, j) => (v.hidden = j !== i));
      });

      col.append(value, bar);
      return col;
    })
  );

  // Dashed goal line, positioned as a fraction of the plot height
  const goalLine = document.createElement("div");
  goalLine.className = "goal-line";
  goalLine.style.bottom = `${(goal / scaleMax) * 100}%`;
  const goalTag = el("span", "goal-line-tag", `เป้า ${goal.toLocaleString("th-TH")}`);
  goalLine.append(goalTag);
  chartPlotEl.append(goalLine);

  chartDaysEl.replaceChildren(
    ...days.map((day, i) => {
      const label = day.date.toLocaleDateString("th-TH", { weekday: "narrow" });
      const num = day.date.getDate();
      return el("span", "chart-day", i === days.length - 1 ? "วันนี้" : `${label} ${num}`);
    })
  );
}

function renderHistoryList(days) {
  const goal = getGoal();
  historyListEl.replaceChildren(
    ...[...days].reverse().map((day, i) => {
      const li = document.createElement("li");
      const name = i === 0 ? "วันนี้" : i === 1 ? "เมื่อวาน" : dayLabel(day.date);
      const detail =
        day.mealCount > 0
          ? `${day.mealCount} มื้อ · ${day.total.toLocaleString("th-TH")} kcal${day.total > goal ? " · เกินเป้า" : ""}`
          : "ไม่มีบันทึก";
      li.append(
        el("span", "history-day", name),
        el("span", day.total > goal ? "history-kcal history-over" : "history-kcal", detail)
      );
      return li;
    })
  );
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
    loadDashboard();
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
    loadDashboard();
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

loadDashboard();

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
