import { loadQuestions } from "./questions.js";

/* ----------------- DOM helpers ----------------- */
const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];

const listsRoot = $("#lists");
const searchInput = $("#search-input");
const revealPointsToggle = $("#reveal-points-toggle"); // switch
const selCounter = $("#sel-counter");
const posSum = $("#pos-sum");
const negSum = $("#neg-sum");
const rawScore = $("#raw-score");
const username = $("#username");
const bgSelect = $("#bg-select");
const userHelp = $("#user-help");
const showBtn = $("#show-results");
const canvas = /** @type {HTMLCanvasElement} */ ($("#result-canvas"));
const dlBtn = $("#download-btn");
const progressWrap  = $("#progress");
const progressBar   = $("#progress__bar");
const progressLabel = $("#progress__label");

if (!progressWrap) {
  const frag = document.createElement("div");
  frag.innerHTML = `
    <div id="progress" class="topbar__progress" role="progressbar"
         aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
         aria-label="Answered questions">
      <div id="progress__bar" class="topbar__progress-bar"></div>
      <div id="progress__label" class="topbar__progress-label">0/0 · 0%</div>
    </div>`;
  const toggleParent = revealPointsToggle?.closest("*") || document.body;
  toggleParent.parentNode.insertBefore(frag.firstElementChild, toggleParent);
}

$(".chip-group")?.remove();

/* ----------------- State ----------------- */
let MODE = null;
let CATALOG = [];
let ALL_ITEMS = [];
let selected = new Set();

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const PROFANITY = /\b(fuck|shit|cunt|bitch|nig+|retard|slut|whore|fag+|kys)\b/i;

const RANKS = [
  { name: "iron", min: 0, label: "Iron" },
  { name: "bronze", min: 10, label: "Bronze" },
  { name: "silver", min: 20, label: "Silver" },
  { name: "gold", min: 30, label: "Gold" },
  { name: "platinum", min: 40, label: "Platinum" },
  { name: "emerald", min: 50, label: "Emerald" },
  { name: "diamond", min: 60, label: "Diamond" },
  { name: "master", min: 70, label: "Master" },
  { name: "grandmaster", min: 80, label: "Grandmaster" },
  { name: "challenger", min: 90, label: "Challenger" }
];

const RANK_COPY = {
  iron: {
    l1: [
      "Reflect on your behavior and gameplay.",
      "This run was rough—time to reset and refocus."
    ],
    l2: [
      "Toxicity has no place here.",
      "Take a breather, learn, and come back stronger."
    ]
  },
  bronze: {
    l1: [
      "Step back and assess your decisions.",
      "Foundations first—clean up the basics."
    ],
    l2: [
      "Identify a few habits to fix.",
      "Small consistent improvements beat big swings."
    ]
  },
  silver: {
    l1: [
      "You’re struggling, but the path is clear.",
      "Skill grows fastest with calm focus."
    ],
    l2: [
      "Cut the tilt, sharpen the fundamentals.",
      "Minimize mistakes and be a force for good."
    ]
  },
  gold: {
    l1: [
      "You’re showing promise—keep grinding.",
      "Solid progress, keep the momentum."
    ],
    l2: [
      "Lock in good habits and clarity.",
      "Improve decision-making under pressure."
    ]
  },
  platinum: {
    l1: [
      "You’re on the right track!",
      "This is where discipline pays off."
    ],
    l2: [
      "Stay respectful, even when it’s hard.",
      "Refine macro and timing to level up."
    ]
  },
  emerald: {
    l1: [
      "Good work—consistency is showing.",
      "You’re getting closer to your ceiling."
    ],
    l2: [
      "Keep focus and keep iterating.",
      "Turn strengths into win conditions."
    ]
  },
  diamond: {
    l1: [
      "Skilled play with a strong attitude.",
      "You set the tone for your team."
    ],
    l2: [
      "Lead by example—in comms and plays.",
      "Push for clean setups and execution."
    ]
  },
  master: {
    l1: [
      "Exceptional performance.",
      "You’re operating at a high level."
    ],
    l2: [
      "Stay humble and keep sharpening.",
      "Seek edges: tempo, vision, objectives."
    ]
  },
  grandmaster: {
    l1: [
      "Outstanding run—top tier energy.",
      "You’re setting a standard in game."
    ],
    l2: [
      "Lift teammates and keep precision high.",
      "Never stop iterating on the details."
    ]
  },
  challenger: {
    l1: [
      "Legend in the making.",
      "Elite flow—calm, clean, clinical."
    ],
    l2: [
      "Keep shining and elevate others.",
      "A true role model—own the server."
    ]
  }
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ----------------- Mode ----------------- */
function renderModeMenu() {
  const app = $("#app");
  app.insertAdjacentHTML(
    "afterbegin",
    `
    <div id="mode-overlay" style="position:sticky; top:0; z-index:10;">
      <div style="display:grid; place-items:center; padding:28px; margin-bottom:12px;
                  background: var(--panel); border:1px solid var(--border); border-radius:14px;">
        <div style="text-align:center; max-width:720px;">
          <h2 style="margin:.2em 0 0;">Welcome</h2>
          <p style="color:var(--muted); margin:.6em 0 1.2em;">
            Welcome to the League of Legends Purity Test (v3). This version expands and refines previous tests. <br> Here is how it works: Tick all statements that apply to you, then enter a name and pick a background. <br> Finally, click "Show Results" to generate your Purity Index!
          </p>
          <h2 style="margin:.2em 0 0;">Choose test version</h2>
          <p style="color:var(--muted); margin:.6em 0 1.2em;">
            <b>All Questions</b> includes everything. <b>SFW only</b> hides nsfw questions and normalizes scoring accordingly.
          </p>
          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
            <button id="btn-mode-full">All Questions</button>
            <button id="btn-mode-sfw" style="background:#6a88ff">SFW only</button>
          </div>
        </div>
      </div>
    </div>
    `
  );

  $("#btn-mode-full").addEventListener("click", () => startWithMode("full"));
  $("#btn-mode-sfw").addEventListener("click", () => startWithMode("sfw"));
}

async function startWithMode(mode) {
  MODE = mode;
  $("#mode-overlay")?.remove();
  selected.clear();

  try {
    if (CATALOG.length === 0) CATALOG = await loadQuestions();
    ALL_ITEMS = (MODE === "full") ? [...CATALOG] : CATALOG.filter(q => !q.nsfw);

    if (ALL_ITEMS.length === 0) {
      listsRoot.innerHTML = `<div class="group"><div class="group__head">
        <h3 class="group__title">No Questions</h3></div>
        <div class="group__body" style="padding:12px;">SFW mode filtered out all items. Add non-NSFW questions.</div></div>`;
      return;
    }

    renderLists();
    validateReady();
    updateProgress();
  } catch (e) {
    console.error(e);
    listsRoot.innerHTML = `<div class="group"><div class="group__head">
      <h3 class="group__title">Load error</h3></div>
      <div class="group__body" style="padding:12px;">${String(e?.message || e)}</div></div>`;
  }
}

function updateProgress() {
  const total = ALL_ITEMS.length || 0;
  const answered = selected.size || 0;
  const pct = total ? Math.round((answered / total) * 100) : 0;

  const bar = $("#progress__bar");
  const lab = $("#progress__label");
  const wrap = $("#progress");

  if (bar)  bar.style.width = pct + "%";
  if (lab)  lab.textContent = `${answered}/${total} · ${pct}%`;
  if (wrap) wrap.setAttribute("aria-valuenow", String(pct));

  document.body.classList.toggle("progress-empty", answered === 0);
}

/* ----------------- Render ----------------- */
function groupByCategory(items) {
  const map = new Map();
  for (const it of items) {
    const arr = map.get(it.category) || [];
    arr.push(it);
    map.set(it.category, arr);
  }
  return map;
}

function renderLists() {
  listsRoot.innerHTML = "";
  const grouped = groupByCategory(ALL_ITEMS);

  for (const [cat, items] of grouped.entries()) {
    const section = document.createElement("section");
    section.className = "group";

    const head = document.createElement("div");
    head.className = "group__head";
    head.innerHTML = `
      <h3 class="group__title">${cat}</h3>
      <span class="group__count">${items.length} items</span>
    `;

    const body = document.createElement("div");
    body.className = "group__body";

    items.forEach(it => {
      const row = document.createElement("div");
      row.className = "item";
      row.dataset.id = it.id;
      row.dataset.weight = String(it.weight);

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = it.id;
      cb.addEventListener("change", () => {
        if (cb.checked) selected.add(it.id); else selected.delete(it.id);
        validateReady();
        updateProgress();
      });

      const label = document.createElement("label");
      label.htmlFor = it.id;
      label.textContent = it.text;

      const badge = document.createElement("span");
      badge.className = "badge " + (it.weight > 0 ? "pos" : it.weight < 0 ? "neg" : "zero");
      badge.title = (it.nsfw && MODE === "full") ? `NSFW • weight ${it.weight}` : `weight ${it.weight}`;
      badge.textContent = it.weight > 0 ? `+${it.weight}` : String(it.weight);

      row.append(cb, label, badge);
      body.append(row);
    });

    section.append(head, body);
    listsRoot.append(section);
  }
  updateProgress();
}

/* ----------------- Validation ----------------- */
function validateName(name) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, msg: "Enter a username (3–22 chars)." };
  if (trimmed.length < 3) return { ok: false, msg: "Too short (min 3)." };
  if (trimmed.length > 22) return { ok: false, msg: "Too long (max 22)." };
  if (PROFANITY.test(trimmed)) return { ok: false, msg: "Please choose a different name." };
  if (!/^[A-Za-z0-9._ \-#]+$/.test(trimmed)) return { ok: false, msg: "Only letters, numbers, space, # _ - . allowed." };
  return { ok: true, msg: "" };
}

function validateReady() {
  const nameOk = validateName(username.value);
  if (userHelp) userHelp.textContent = nameOk.msg;
  const bgOk = !!bgSelect.value;
  const ready = !!MODE && nameOk.ok && bgOk && selected.size > 0;
  if (showBtn) showBtn.disabled = !ready;
  return ready;
}

/* ----------------- Canvas ----------------- */
function purityIndex() {
  let posMax = 0, negMin = 0;
  for (const it of ALL_ITEMS) {
    if (it.weight > 0) posMax += it.weight;
    if (it.weight < 0) negMin += it.weight;
  }
  let raw = 0;
  selected.forEach(id => {
    const w = Number($(`.item[data-id="${id}"]`)?.dataset.weight || 0);
    raw += w;
  });
  const scale = posMax - negMin || 1;
  const p = Math.round(100 * (raw - negMin) / scale);
  return { raw, p };
}

function pickRank(p) {
  let last = RANKS[0];
  for (const r of RANKS) { if (p >= r.min) last = r; else break; }
  return last;
}

async function loadImage(src) {
  const img = new Image(); img.decoding = "async"; img.src = src;
  await img.decode().catch(() => {});
  return img;
}

async function drawResult() {
  const { raw, p } = purityIndex();
  const rank = pickRank(p);

  const w = 1920, h = 1080;
  canvas.hidden = false;
  if (DPR !== 1) { canvas.width = w * DPR; canvas.height = h * DPR; canvas.style.width = w + "px"; canvas.style.height = h + "px"; }
  else { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);

  const bgKey = bgSelect.value;
  const bgImg = await loadImage(`./images/${bgKey}.png`);
  ctx.drawImage(bgImg, 0, 0, w, h);

  const emote = p >= 90 ? "10ez" :
                p >= 80 ? "9nice" :
                p >= 70 ? "8love" :
                p >= 60 ? "7gj" :
                p >= 50 ? "6okay" :
                p >= 40 ? "5great" :
                p >= 30 ? "4nicetry" :
                p >= 20 ? "3what" :
                p >= 10 ? "2kidding" : "1breakdown";

  const copy = RANK_COPY[rank.name] || RANK_COPY.iron;
  const line1 = pick(copy.l1).replace("{raw}", String(raw)).replace("{p}", String(p));
  const line2 = pick(copy.l2).replace("{raw}", String(raw)).replace("{p}", String(p));

  const rankImg = await loadImage(`./ranks/${rank.name}.png`);
  const emoteImg = await loadImage(`./emotes/${emote}.png`);
  ctx.drawImage(rankImg, 250, 230, 350, 350);
  ctx.drawImage(emoteImg, 1350, 230, 350, 350);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 80px Beaufort, system-ui";
  ctx.fillText(`Your Score: ${raw}`, w/2, 320);

  ctx.fillStyle = "#ffd7be";
  ctx.font = "700 54px Beaufort, system-ui";
  ctx.fillText(`Purity Index: ${p}% • ${rank.label}`, w/2, 400);

  const pos = [...selected].reduce((acc, id) => {
    const wv = Number($(`.item[data-id="${id}"]`)?.dataset.weight || 0);
    return acc + (wv > 0 ? wv : 0);
  }, 0);
  const neg = [...selected].reduce((acc, id) => {
    const wv = Number($(`.item[data-id="${id}"]`)?.dataset.weight || 0);
    return acc + (wv < 0 ? wv : 0);
  }, 0);

  const modeLabel = MODE === "sfw" ? "SFW" : "All";
  const name = username.value.trim().replace(/\s+/g, " ");

  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "600 36px Beaufort, system-ui";
  ctx.fillText(`You picked ${selected.size} items • +${pos} / ${neg}`, w/2, 470);

  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "600 50px Beaufort, system-ui";
  ctx.fillText(line1, w/2, 650);
  ctx.fillText(line2, w/2, 740);

  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "600 40px Beaufort, system-ui";
  ctx.fillText(`Mode: ${modeLabel} • Score for: ${name}`, w/2, 930);

  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.font = "600 40px Beaufort, system-ui";
  ctx.shadowColor = "rgba(0,0,0,.9)";
  ctx.shadowBlur = 5;
  ctx.fillText(`Create you own on timfernix.github.io/purity`, w/2, 1030);

  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.font = "600 52px Beaufort, system-ui";
  ctx.fillText(`League of Legends Purity Test`, w/2, 150);
}

revealPointsToggle?.addEventListener("change", () => {
  const on = revealPointsToggle.checked;
  document.body.classList.toggle("spoiler-hidden", !on);
  revealPointsToggle.setAttribute("aria-checked", String(on));
});

(function syncInitialSpoiler() {
  const hidden = document.body.classList.contains("spoiler-hidden");
  if (revealPointsToggle) {
    revealPointsToggle.checked = !hidden;
    revealPointsToggle.setAttribute("aria-checked", String(!hidden));
  }
})();

username?.addEventListener("input", validateReady);
bgSelect?.addEventListener("change", validateReady);

showBtn?.addEventListener("click", async () => {
  if (!validateReady()) return;
  await drawResult();
  dlBtn.disabled = false;
});

dlBtn?.addEventListener("click", () => {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "league-purity-test.png";
  a.click();
});

/* ----------------- Init ----------------- */
(function init() {
  renderModeMenu();
})();
