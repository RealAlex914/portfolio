const E = "cubic-bezier(0.22, 1, 0.36, 1)";
const SLIDE = 90; // px each box travels horizontally

const welcome = document.getElementById("welcome");
const wSmall = document.getElementById("wSmall");
const wBig = document.getElementById("wBig");
const wHint = document.getElementById("wHint");
const site = document.getElementById("site");
const themeBtn = document.getElementById("themeBtn");
const smoothContent = document.getElementById("smoothContent");
const timeline = document.getElementById("timeline");
const tlFill = document.getElementById("tlFill");
const tlArrow = document.getElementById("tlArrow");
const hud = document.getElementById("hud");
const hudTime = document.getElementById("hudTime");
const hudCount = document.getElementById("hudCount");
const hudLabel = document.getElementById("hudLabel");
const heroVids = Array.from(document.querySelectorAll(".hero-videos .vid"));

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(pointer: coarse)").matches;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- dark mode ---------- */
function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {}
}
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved ? saved === "dark" : prefersDark);
})();
if (themeBtn) {
  themeBtn.addEventListener("click", () =>
    applyTheme(!document.documentElement.classList.contains("dark"))
  );
}

/* ---------- split the splash "here's alex" into letters for a wave ---------- */
(function buildWave() {
  if (!wBig) return;
  const makeChars = (text) =>
    Array.from(text).map((ch) => {
      const s = document.createElement("span");
      s.className = "wch";
      s.textContent = ch === " " ? String.fromCharCode(160) : ch;
      return s;
    });
  const frag = document.createDocumentFragment();
  wBig.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      makeChars(node.textContent).forEach((s) => frag.appendChild(s));
    } else if (node.nodeType === 1) {
      const clone = node.cloneNode(false); // keep .cycle wrapper (color hue-rotate)
      makeChars(node.textContent).forEach((s) => clone.appendChild(s));
      frag.appendChild(clone);
    }
  });
  wBig.replaceChildren(frag);
  wBig.querySelectorAll(".wch").forEach((s, i) => s.style.setProperty("--wi", i));
})();

/* ---------- reveal setup: give every box a slide direction ---------- */
const revealEls = Array.from(document.querySelectorAll("#site [data-reveal]"));
revealEls.forEach((el, i) => {
  el._item = el.closest(".tl-item");
  if (el.style.getPropertyValue("--dx")) return; // explicit direction set in HTML
  let dx;
  if (el._item) dx = el._item.classList.contains("right") ? SLIDE : -SLIDE;
  else dx = i % 2 === 0 ? -SLIDE : SLIDE; // hero: gentle alternation
  el.style.setProperty("--dx", dx + "px");
});
// small stagger down the hero
document.querySelectorAll(".hero [data-reveal]").forEach((el, i) => el.style.setProperty("--i", i));

/* ---------- intro: welcome splash → swipe into the site ---------- */
async function startIntro() {
  if (reduceMotion) {
    welcome.classList.remove("show");
    welcome.style.display = "none";
    revealSite();
    return;
  }
  await playWelcome();
  await waitForGesture();
  await swipeIntoSite();
}
startIntro();

/* ---------- WAAPI welcome intro (does NOT auto-advance) ---------- */
async function playWelcome() {
  [welcome, wSmall, wBig, wHint].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
  welcome.style.transform = "";
  welcome.style.display = "";
  welcome.classList.add("show");

  await wSmall.animate(
    [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: 600, easing: E, fill: "both" }
  ).finished;

  await wBig.animate(
    [{ opacity: 0, transform: "translateY(34px) scale(0.96)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
    { duration: 850, easing: E, fill: "both" }
  ).finished;

  // fade the "scroll to enter" hint in (opacity only — CSS bob owns transform)
  wHint.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: E, fill: "both" });
}

// resolve on the first "go" gesture: scroll down, swipe up, click, or a key
function waitForGesture() {
  return new Promise((resolve) => {
    let done = false;
    let touchY = null;
    const fire = () => { if (done) return; done = true; cleanup(); resolve(); };
    const onWheel = (e) => { if (e.deltaY > 0) fire(); };
    const onKey = (e) => { if (["ArrowDown", " ", "Enter", "PageDown"].includes(e.key)) fire(); };
    const onClick = () => fire();
    const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e) => { if (touchY !== null && touchY - e.touches[0].clientY > 28) fire(); };
    function cleanup() {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      welcome.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    }
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    welcome.addEventListener("click", onClick);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
  });
}

// slow swipe: the splash lifts away, revealing the site beneath
async function swipeIntoSite() {
  site.setAttribute("aria-hidden", "false");
  site.classList.add("reveal");

  await welcome.animate(
    [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
    { duration: 1300, easing: "cubic-bezier(0.76, 0, 0.24, 1)", fill: "both" }
  ).finished;

  welcome.classList.remove("show");
  welcome.style.display = "none";
  welcome.getAnimations().forEach((a) => a.cancel());

  document.body.classList.remove("locked");
  window.scrollTo(0, 0);
  sc = 0;
  enableSmooth();
  siteActive = true;
  startHud();
  enterVideosSoon();
}

/* ---------- reveal the site + turn on scroll systems ---------- */
let siteActive = false;
let smoothing = false;
let sc = 0; // smoothed scroll position

function revealSite() {
  document.body.classList.remove("locked"); // release scroll now that the site is showing
  site.setAttribute("aria-hidden", "false");
  site.classList.add("reveal");
  window.scrollTo(0, 0);
  sc = 0;
  enableSmooth();
  siteActive = true;
  startHud();
  enterVideosSoon();
}

// text animates in first; the video collage fades in (staggered) shortly after
function enterVideosSoon() {
  setTimeout(() => {
    heroVids.forEach((v, i) => setTimeout(() => v.classList.add("in"), i * 130));
  }, 900);
}

function enableSmooth() {
  smoothing = !reduceMotion && !isTouch;
  if (smoothing) {
    smoothContent.classList.add("smoothing");
    smoothContent.style.transform = "translate3d(0,0,0)";
    setBodyHeight();
  } else {
    smoothContent.classList.remove("smoothing");
    smoothContent.style.transform = "";
    document.body.style.height = "";
  }
}

function setBodyHeight() {
  if (!smoothing) return;
  document.body.style.height = smoothContent.getBoundingClientRect().height + "px";
}
window.addEventListener("resize", () => { if (siteActive) setBodyHeight(); });

/* ---------- the one loop: smooth scroll + reveals + timeline ---------- */
function loop() {
  if (siteActive) {
    if (smoothing) {
      const target = window.scrollY;
      sc += (target - sc) * 0.08;
      if (Math.abs(target - sc) < 0.06) sc = target;
      smoothContent.style.transform = `translate3d(0, ${-sc}px, 0)`;
    }
    updateReveals();
    updateTimeline();
    updateHud();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function updateReveals() {
  const vh = window.innerHeight;
  for (const el of revealEls) {
    const r = el.getBoundingClientRect();
    const show = r.top < vh * 0.85 && r.bottom > vh * 0.1;
    el.classList.toggle("in", show);
    if (el._item) el._item.classList.toggle("active", show);
  }
}

// geometry-dash color zones the arrow triggers as it travels down
const GD_COLORS = ["#ff5e5e", "#ffa63d", "#ffe14d", "#57e389", "#4dd2ff", "#b57bff"];
let lastZone = -1;

function updateTimeline() {
  if (!timeline || !tlFill) return;
  const r = timeline.getBoundingClientRect();
  const denom = r.height - window.innerHeight;
  const p = denom > 0 ? clamp(-r.top / denom, 0, 1) : (r.top <= 0 ? 1 : 0);

  tlFill.style.transform = `scaleY(${p})`;
  if (tlArrow) tlArrow.style.transform = `translate(-50%, ${p * r.height}px)`;

  const zone = clamp(Math.floor(p * GD_COLORS.length), 0, GD_COLORS.length - 1);
  if (zone !== lastZone) {
    lastZone = zone;
    const c = GD_COLORS[zone];
    if (tlArrow) tlArrow.style.color = c;
    tlFill.style.background = c;
  }
}

/* ---------- live activity HUD ---------- */
// how many "things" alex does per second on the site — pure flavor
const ACTIVITIES = [
  { label: "ideas sketched", rate: 0.14 },
  { label: "lines of code", rate: 1.3 },
  { label: "pixels nudged", rate: 11 },
  { label: "coffees brewed", rate: 0.02 },
  { label: "songs played", rate: 0.05 },
  { label: "bugs squashed", rate: 0.08 },
];
let hudStart = 0, hudLastSec = -1, hudIdx = -1;

function startHud() {
  hudStart = performance.now();
  hudLastSec = -1;
  hudIdx = -1;
  hud.classList.add("show");
  hud.setAttribute("aria-hidden", "false");
}
function stopHud() {
  hud.classList.remove("show");
  hud.setAttribute("aria-hidden", "true");
  hudStart = 0;
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function updateHud() {
  if (!hudStart) return;
  const elapsed = (performance.now() - hudStart) / 1000;
  const sec = Math.floor(elapsed);
  if (sec === hudLastSec) return; // only touch the DOM once per second
  hudLastSec = sec;
  hudTime.textContent = fmtTime(sec);

  const idx = Math.floor(sec / 3) % ACTIVITIES.length; // rotate the metric every 3s
  if (idx !== hudIdx) {
    hudIdx = idx;
    hudLabel.textContent = ACTIVITIES[idx].label;
    // WAAPI pop when the metric changes
    hudCount.animate(
      [{ transform: "scale(1.35)" }, { transform: "scale(1)" }],
      { duration: 420, easing: E }
    );
  }
  hudCount.textContent = Math.max(0, Math.floor(elapsed * ACTIVITIES[hudIdx].rate));
}

/* ---------- résumé version switcher ---------- */
(function resumeSwitcher() {
  const tabs = document.getElementById("resumeTabs");
  const crop = document.getElementById("resumeCrop");
  const frame = document.getElementById("resumeFrame");
  const dl = document.getElementById("resumeDownload");
  if (!tabs || !crop || !frame || !dl) return;

  const PDF_PARAMS = "#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH";

  // rebuild the <object> so the PDF reliably reloads on every switch
  function buildDoc(file) {
    const obj = document.createElement("object");
    obj.className = "resume-doc";
    obj.type = "application/pdf";
    obj.data = file + PDF_PARAMS;
    const fb = document.createElement("span");
    fb.className = "resume-fallback";
    fb.innerHTML =
      '<span class="resume-fallback-ic">📄</span>' +
      "<span>This résumé isn't added yet — drop it in as a PDF and it'll show here.</span>";
    obj.appendChild(fb);
    return obj;
  }

  function select(btn) {
    const file = btn.dataset.file;
    crop.replaceChildren(buildDoc(file));
    frame.href = file;
    dl.href = file;
    dl.setAttribute("download", btn.dataset.download || "resume.pdf");
    tabs.querySelectorAll(".resume-tab").forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".resume-tab");
    if (btn) select(btn);
  });
})();
