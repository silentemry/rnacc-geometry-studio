import { buildSector, boundsForMode, fitViewBox } from "./geometry.js";
import { renderSvg } from "./render.js";

const $ = (id) => document.getElementById(id);
const state = {
  n: 9,
  mode: "sector",
  phase: 0,
  depth: 14,
  palette: "reference",
  showFrame: true,
  showPrimary: true,
  showOmegaSeams: true,
  showAnchors: false,
  showCircumcircle: false,
  showTau: true,
  showTauBranches: false,
  showTauContacts: false,
  tauComponents: [true, true, true],
  branches: { s: true, f: true, j: true },
  omegaOrders: { s: 1, f: 1, j: 1 },
  tauPayload: "basic",
  tauTransport: "all",
  tauReflection: "auto",
  showTauAxes: false,
  payloadMinPixels: 5,
  maxTauPayloadInstances: 4000,
  focused: false,
  focusDirection: "s",
  focusOrder: 12,
};
let sector = buildSector(state.n, state.depth, state.omegaOrders);
let camera = null;
let fittedCamera = null;
let dragging = null;

function setPressed(active, inactive, isActive) {
  $(active).classList.toggle("active", isActive);
  $(inactive).classList.toggle("active", !isActive);
  $(active).setAttribute("aria-pressed", String(isActive));
  $(inactive).setAttribute("aria-pressed", String(!isActive));
}

function viewportSize() {
  const rect = $("drawing").getBoundingClientRect();
  return { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
}

function recalculateView() {
  const { w, h } = viewportSize();
  const bounds = boundsForMode(sector, state.focused ? "sector" : state.mode,
    state.focused ? 0 : state.phase);
  fittedCamera = fitViewBox(bounds, w, h);
  camera = { ...fittedCamera };
  repaint();
}

function recalculateGeometry({ resetView = false } = {}) {
  sector = buildSector(state.n, state.depth, state.omegaOrders);
  updateControls();
  if (resetView || camera === null) recalculateView();
  else repaint();
}

function repaint() {
  if (!camera) return;
  const { w } = viewportSize();
  const renderSettings = state.focused ? { ...state, mode: "sector", phase: 0 } : state;
  $("drawing").innerHTML = renderSvg(sector, renderSettings, camera, { pixelWidth: w });
  const svg = $("drawing").querySelector("svg");
  svg.addEventListener("wheel", onWheel, { passive: false });
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);
  svg.addEventListener("lostpointercapture", onPointerUp);
  svg.addEventListener("dblclick", () => recalculateView());
  $("zoom-label").textContent = fittedCamera ?
    `${(fittedCamera.w / camera.w).toFixed(2)}×` : "1.00×";
}

function pointerWorld(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: camera.x + (event.clientX - rect.left) / rect.width * camera.w,
    y: camera.y + (event.clientY - rect.top) / rect.height * camera.h,
  };
}

function onWheel(event) {
  event.preventDefault();
  const pivot = pointerWorld(event);
  const factor = Math.exp(Math.max(-120, Math.min(120, event.deltaY)) * 0.0016);
  const targetWidth = camera.w * factor;
  if (targetWidth < 1e-12 || targetWidth > 15) return;
  camera.x = pivot.x - (pivot.x - camera.x) * factor;
  camera.y = pivot.y - (pivot.y - camera.y) * factor;
  camera.w *= factor;
  camera.h *= factor;
  repaint();
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  dragging = { id: event.pointerId, lastX: event.clientX, lastY: event.clientY };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add("dragging");
}

function onPointerMove(event) {
  if (!dragging || event.pointerId !== dragging.id) return;
  const { w, h } = viewportSize();
  const dx = event.clientX - dragging.lastX;
  const dy = event.clientY - dragging.lastY;
  camera.x -= dx / w * camera.w;
  camera.y -= dy / h * camera.h;
  dragging.lastX = event.clientX;
  dragging.lastY = event.clientY;
  // Do not repaint on every captured move, as replacing the SVG would drop
  // the captured pointer. Update the existing SVG viewBox directly instead.
  const svg = $("drawing").querySelector("svg");
  svg.setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
}

function onPointerUp(event) {
  if (!dragging || event.pointerId !== dragging.id) return;
  dragging = null;
  event.currentTarget.classList.remove("dragging");
}

function updateControls() {
  const math = sector.math;
  $("n-input").value = state.n;
  $("n-range").value = state.n;
  $("phase-range").max = state.n - 1;
  $("phase-range").value = state.phase;
  $("phase-value").textContent = `${state.phase} / ${state.n - 1}`;
  $("phase-container").style.display = state.mode === "sector" ? "block" : "none";
  $("depth-range").value = state.depth;
  $("depth-value").textContent = `${state.depth} arc${state.depth !== 1 ? "s" : ""}`;
  const focusScale = sector.math.omega[state.focusDirection] ** state.focusOrder;
  $("view-title").textContent = state.focused ?
    `Ω${state.focusDirection} · Order ${state.focusOrder} (normalized local frame)` :
    state.mode === "sector" ? "σ · One triangular partition" : "Σ · Complete polygonal phase";
  $("viewer-label").textContent = state.focused ?
    `n = ${state.n} · Ω${state.focusDirection}^${state.focusOrder} · scale ${focusScale.toExponential(3)}` :
    state.mode === "sector" ?
      `n = ${state.n} · m = ${state.phase}` : `n = ${state.n} · all ${state.n} phases`;
  $("focus-direction").value = state.focusDirection;
  $("focus-order").value = state.focusOrder;

  const deg = 180 / Math.PI;
  $("value-theta").textContent = `${(math.theta * deg).toFixed(4)}°`;
  $("value-delta").textContent = `${(math.delta * deg).toFixed(4)}°`;
  $("value-alpha").textContent = math.alpha0.toFixed(6);
  $("value-beta").textContent = math.beta0.toFixed(6);
  $("value-s").textContent = math.omega.s.toFixed(6);
  $("value-f").textContent = math.omega.f.toFixed(6);
  $("value-j").textContent = math.omega.j.toFixed(6);
  for (let k = 0; k < 3; k++) {
    $("value-tau-" + (k + 1)).textContent = math.tau[k].toFixed(6);
  }
  for (const key of ["s", "f", "j"]) {
    $("order-" + key).value = state.omegaOrders[key];
    $("order-" + key + "-value").textContent = String(state.omegaOrders[key]);
  }
  $("tau-payload").value = state.tauPayload;
  $("tau-transport").value = state.tauTransport;
  $("tau-transport").disabled = state.tauPayload !== "extended";
  $("tau-reflection").value = state.tauReflection;
  $("show-tau-axes").checked = state.showTauAxes;
  $("value-orders").textContent =
    `${state.omegaOrders.s} / ${state.omegaOrders.f} / ${state.omegaOrders.j}`;
  $("value-region-count").textContent =
    String(1 + sector.branches.filter((b) => state.branches[b.name]).length);
  $("value-embedding").textContent = state.tauPayload === "off" ? "Off" :
    state.tauPayload === "basic" ? "σ basic" : `σ / Ω${state.tauTransport}`;
  const maxTauResidual = Math.max(0, ...sector.tau.map((tau) =>
    Math.max(Math.abs(tau.boundaryResidual),
      Math.abs(tau.perpendicularResidual),
      Math.abs(tau.chord - tau.expectedChord))));
  $("verification").textContent =
    `Numerical validation · α₀ − α₁ − α₂: ` +
    `${math.alphaIdentityResidual.toExponential(1)} · ` +
    `τ geometry maximum residual: ${maxTauResidual.toExponential(1)}. ` +
    `τ exists only for k = 0, 1, 2.`;
}

function setN(input) {
  if (!Number.isFinite(input)) return;
  const n = Math.min(120, Math.max(4, Math.round(input)));
  if (state.n === n) { updateControls(); return; }
  state.n = n;
  state.phase = Math.min(state.phase, n - 1);
  recalculateGeometry({ resetView: true });
}

function setMode(mode) {
  state.mode = mode;
  state.focused = false;
  setPressed("mode-sector", "mode-polygon", mode === "sector");
  updateControls();
  recalculateView();
}

function setPalette(palette) {
  state.palette = palette;
  setPressed("palette-reference", "palette-colored", palette === "reference");
  repaint();
}

function downloadSvg() {
  const renderSettings = state.focused ? { ...state, mode: "sector", phase: 0 } : state;
  const svg = renderSvg(sector, renderSettings, camera, {
    width: 1600, height: Math.round(1600 * camera.h / camera.w), pixelWidth: 1600,
  });
  const object = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`],
    { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(object);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rnacc-v04-${state.focused ? `focus-${state.focusDirection}${state.focusOrder}` : state.mode}-n${state.n}-s${state.omegaOrders.s}-f${state.omegaOrders.f}-j${state.omegaOrders.j}-tau-${state.tauPayload}-${state.tauTransport}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

$("n-input").addEventListener("change", (e) => setN(Number(e.target.value)));
$("n-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { setN(Number(e.target.value)); e.target.blur(); }
});
$("n-range").addEventListener("input", (e) => setN(Number(e.target.value)));
$("n-decrement").addEventListener("click", () => setN(state.n - 1));
$("n-increment").addEventListener("click", () => setN(state.n + 1));
$("depth-range").addEventListener("input", (e) => {
  state.depth = Number(e.target.value);
  recalculateGeometry();
});
$("phase-range").addEventListener("input", (e) => {
  state.phase = Number(e.target.value);
  updateControls();
  recalculateView();
});
$("mode-sector").addEventListener("click", () => setMode("sector"));
$("mode-polygon").addEventListener("click", () => setMode("polygon"));
$("palette-reference").addEventListener("click", () => setPalette("reference"));
$("palette-colored").addEventListener("click", () => setPalette("colored"));

for (const [id, target] of [
  ["show-frame", "showFrame"], ["show-primary", "showPrimary"],
  ["show-seams", "showOmegaSeams"], ["show-anchors", "showAnchors"],
  ["show-circle", "showCircumcircle"],
  ["show-tau", "showTau"], ["show-tau-branches", "showTauBranches"],
  ["show-tau-contacts", "showTauContacts"],
]) $(id).addEventListener("change", (e) => { state[target] = e.target.checked; repaint(); });
for (let k = 0; k < 3; k++) {
  $(`show-tau-${k + 1}`).addEventListener("change", (event) => {
    state.tauComponents[k] = event.target.checked;
    repaint();
  });
}
for (const key of ["s", "f", "j"]) {
  $(`show-${key}`).addEventListener("change", (e) => {
    state.branches[key] = e.target.checked;
    updateControls();
    repaint();
  });
  $(`order-${key}`).addEventListener("input", (e) => {
    state.omegaOrders[key] = Number(e.target.value);
    recalculateGeometry();
  });
}
$("tau-payload").addEventListener("change", e => {
  state.tauPayload = e.target.value;
  updateControls();
  repaint();
});
$("tau-transport").addEventListener("change", e => {
  state.tauTransport = e.target.value;
  repaint();
});
$("tau-reflection").addEventListener("change", e => {
  state.tauReflection = e.target.value;
  repaint();
});
$("show-tau-axes").addEventListener("change", e => {
  state.showTauAxes = e.target.checked;
  repaint();
});
$("focus-direction").addEventListener("change", e => { state.focusDirection = e.target.value; });
$("focus-order").addEventListener("change", e => {
  state.focusOrder = Math.min(12, Math.max(1, Math.round(Number(e.target.value) || 1)));
  updateControls();
});
$("focus-button").addEventListener("click", () => {
  const key = $("focus-direction").value;
  state.focusDirection = key;
  state.focusOrder = Math.min(12, Math.max(1, Math.round(Number($("focus-order").value) || 1)));
  if (state.omegaOrders[key] < state.focusOrder) {
    state.omegaOrders[key] = state.focusOrder;
    sector = buildSector(state.n, state.depth, state.omegaOrders);
  }
  state.focused = true;
  updateControls();
  recalculateView();
});
$("overview-button").addEventListener("click", () => {
  state.focused = false;
  updateControls();
  recalculateView();
});
$("fit-button").addEventListener("click", () => recalculateView());
$("export-button").addEventListener("click", downloadSvg);

let lastWidth = 0;
let lastHeight = 0;
new ResizeObserver(() => {
  const { w, h } = viewportSize();
  if (Math.abs(w - lastWidth) > 2 || Math.abs(h - lastHeight) > 2) {
    lastWidth = w;
    lastHeight = h;
    recalculateView();
  }
}).observe($("drawing"));
recalculateGeometry({ resetView: true });
