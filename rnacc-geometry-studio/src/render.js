import { polygonVertices, rotate, buildSector } from "./geometry.js";
import { tauSigmaFrame, tauSigmaSvgTransform, isTransportBranchSelected } from "./transport.js";

const palettes = {
  reference: {
    bg: "#ffffff", frame: "#202931", polygon: "#303944", primary: "#5a6770",
    omega: "#9babb4", omegaS: "#9cabb3", omegaF: "#9cabb3",
    omegaJ: "#9cabb3", guides: "#d9dfe3", anchor: "#52606a",
    tau: ["#6b7b85", "#536673", "#8797a1"],
  },
  colored: {
    bg: "#ffffff", frame: "#142b3e", polygon: "#243c4d", primary: "#475569",
    omega: "#9fb3c2", omegaS: "#1b9ca5", omegaF: "#e0a12b",
    omegaJ: "#cf6a7f", guides: "#dee7eb", anchor: "#52606a",
    tau: ["#0b91a0", "#bd8a23", "#c45d83"],
  },
};

const f = (n) => Number(n.toPrecision(14));
const svgPoint = (point) => `${f(point.x)},${f(-point.y)}`;
const move = (p) => `M ${svgPoint(p)}`;

function path(d, stroke, width = 1, opacity = 1, unit = 0.0005) {
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(width * unit)}" ` +
    `stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" ` +
    `/>`;
}

function line(p1, p2, stroke, width = 1, opacity = 1, unit = 0.0005) {
  return path(`${move(p1)} L ${svgPoint(p2)}`, stroke, width, opacity, unit);
}

function polyline(points, stroke, width, close = false, unit = 0.0005) {
  return path(`${move(points[0])} ${points.slice(1).map((p) => `L ${svgPoint(p)}`).join(" ")}` +
    (close ? " Z" : ""), stroke, width, 1, unit);
}

function quarterArcPath(arc) {
  // All mathematical arcs increase polar angle (CCW in y-up coordinates).
  // SVG is y-down: sweep=0 preserves that apparent CCW rotation.
  return `A ${f(arc.radius)} ${f(arc.radius)} 0 0 0 ${svgPoint(arc.end)}`;
}

function spiral(arcs, stroke, width, opacity = 1, unit = 0.0005) {
  // Avoid degenerate, subpixel arcs at high n or deep k.
  const visible = arcs.filter((arc) => arc.radius >= unit * 0.12);
  if (!visible.length) return "";
  const d = `${move(visible[0].start)} ${visible.map(quarterArcPath).join(" ")}`;
  return path(d, stroke, width, opacity, unit);
}

function rotateArc(arc, radians) {
  return {
    ...arc,
    start: rotate(arc.start, radians),
    end: rotate(arc.end, radians),
    center: rotate(arc.center, radians),
  };
}

function dot(point, color, radius = 0.0022) {
  return `<circle cx="${f(point.x)}" cy="${f(-point.y)}" r="${radius}" fill="${color}"/>`;
}

/** Orthogonal transport triangles: arc center, arc start, and side contact. */
function tauLayer(couplings, settings, radians, palette, unit, isBranch = false) {
  if (!settings.showTau) return "";
  let body = "";
  for (const tau of couplings) {
    if (settings.tauComponents?.[tau.k] === false) continue;
    const [center, start, contact] = tau.triangle.map((p) => rotate(p, radians));
    const color = palette.tau[tau.k];
    const points = [center, start, contact];
    const coordinates = points.map(svgPoint).join(" ");
    body += `<g data-coupling="tau${tau.index}" data-region="${isBranch ? "omega" : "primary"}">`;
    // A very pale face retains the manuscript's line-based construction.
    body += `<polygon points="${coordinates}" fill="${color}" fill-opacity="${isBranch ? 0.018 : 0.055}"/>`;
    body += line(center, start, color, isBranch ? 0.58 : 0.82,
      isBranch ? 0.55 : 0.85, unit);
    body += line(center, contact, color, isBranch ? 0.72 : 0.96,
      isBranch ? 0.65 : 0.98, unit);
    body += line(start, contact, color, isBranch ? 1.05 : 1.7,
      isBranch ? 0.7 : 0.94, unit);
    if (settings.showTauContacts) {
      body += `<circle cx="${f(contact.x)}" cy="${f(-contact.y)}" ` +
        `r="${f(unit * (isBranch ? 2.0 : 3.1))}" fill="#ffffff" ` +
        `stroke="${color}" stroke-width="${f(unit * (isBranch ? 0.9 : 1.35))}"/>`;
      // Label the chord rather than the center. It does not affect geometry.
      if (!isBranch) {
        const midpoint = scalePoint(start, contact, 0.5);
        const fontSize = f(10.5 * unit);
        body += `<text x="${f(midpoint.x)}" y="${f(-midpoint.y - 4 * unit)}" ` +
          `font-size="${fontSize}" fill="${color}" font-family="sans-serif" ` +
          `text-anchor="middle">τ${["₁", "₂", "₃"][tau.k]}</text>`;
      }
    }
    body += "</g>";
  }
  return body;
}

/**
 * Carry a LOWERCASE σ sector (not Σ polygon) into each selected τ frame.
 * The two template σ states are σ_n for τ₂ and σ_(2n) for τ₁/τ₃.
 * The carrier itself is similar to its corresponding σ, so the three
 * vertices match exactly. No stretching, cropping or incircle construction.
 *
 * SVG <use> only references precompiled σ vector templates. This is a
 * one-level payload: τ outlines inside the payload never spawn new payloads.
 */
function tauSigmaPayloadLayer(couplings, sector, settings, radians, unit, isBranch, templates) {
  if (!settings.showTau || settings.tauPayload === "off") return "";
  if (!templates) return "";
  const threshold = settings.payloadMinPixels ?? 5;
  const maxInstances = settings.maxTauPayloadInstances ?? 4000;
  let out = "";
  for (const tau of couplings) {
    if (settings.tauComponents?.[tau.k] === false) continue;
    if (templates.count >= maxInstances) break;
    if (tau.radius * 2 < threshold * unit) continue;
    // Local τ is mapped by a sector phase rotation before the σ transform.
    const rotated = {
      ...tau, center: rotate(tau.center, radians),
      start: rotate(tau.start, radians), contact: rotate(tau.contact, radians),
    };
    const frame = tauSigmaFrame(rotated, sector.math.n, settings.tauReflection ?? "auto");
    const id = frame.sigmaN === sector.math.n ? templates.n : templates.twiceN;
    out += `<use href="#${id}" data-tau-sigma="tau${tau.index}" ` +
      `data-sigma-state="${frame.sigmaN}" data-location="${isBranch ? "omega" : "primary"}" ` +
      `transform="${tauSigmaSvgTransform(frame)}"/>`;
    templates.count++;
    if (settings.showTauAxes) {
      const c=rotated.center, a=rotated.start, b=rotated.contact;
      const color="#ca6a3e";
      out += line(c,a,color,0.9,0.75,unit) +
        line(c,b,color,0.9,0.75,unit) +
        `<circle cx="${f(c.x)}" cy="${f(-c.y)}" r="${f(3.4*unit)}" fill="#ca6a3e"/>` +
        `<circle cx="${f(a.x)}" cy="${f(-a.y)}" r="${f(2.8*unit)}" fill="#207e80"/>` +
        `<circle cx="${f(b.x)}" cy="${f(-b.y)}" r="${f(2.8*unit)}" fill="#9b5fbe"/>`;
    }
  }
  return out;
}

function scalePoint(a, b, fraction) {
  return { x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction };
}

function branchSimilaritySvg(branch, radians) {
  const anchor = rotate(branch.anchor, radians);
  // Keep deep scales as an SVG transform instead of subtracting positions
  // near a large vertex; floating-point absolute coordinates would collapse.
  return `translate(${f(anchor.x)} ${f(-anchor.y)}) ` +
    `scale(${f(branch.ratio)}) ` +
    `translate(${f(-anchor.x)} ${f(anchor.y)})`;
}

function sectorContent(sector, settings, radians, palette, includeFrame, unit, templates = null) {
  let body = "";
  const triangle = sector.triangle.map((p) => rotate(p, radians));
  const rotatedMaster = sector.master.map((arc) => rotateArc(arc, radians));
  const visibleBranches = sector.branches.filter((b) => settings.branches?.[b.name] !== false);

  // Base τ structures are drawn over the projected triangular partition.
  body += tauLayer(sector.tau, settings, radians, palette, unit);
  body += tauSigmaPayloadLayer(sector.tau, sector, settings, radians, unit, false, templates);
  if (settings.showPrimary) body += spiral(rotatedMaster, palette.primary, 1.15, 1, unit);

  // Every Ω power uses the SAME local geometry with a nested transform.
  // Deep directional chains retain their normalized proportions without
  // subtracting nearly equal 0.5-scale absolute coordinates in JavaScript.
  for (const branch of visibleBranches) {
    const factor = branch.ratio;
    // The triangle has circumradius 1/2 before scaling. A diameter under
    // one output pixel cannot carry visible spiral detail; retain its exact
    // mathematical state but do not emit thousands of degenerate SVG nodes.
    if (!(factor > 0) || factor < unit) continue;
    const color = palette[`omega${branch.name.toUpperCase()}`];
    const localUnit = unit / factor;
    const seam = branch.sourceSeam || branch.seam;
    let local = "";
    if (settings.showOmegaSeams) {
      const [a, b] = seam.map((p) => rotate(p, radians));
      local += line(a, b, palette.omega, 0.8, 0.83, unit / factor);
    }
    if (settings.showTauBranches) {
      local += tauLayer(sector.tau, settings, radians, palette, localUnit, true);

    }
    if (settings.tauPayload === "extended" &&
        isTransportBranchSelected(branch.name, settings.tauTransport ?? "all")) {
      local += tauSigmaPayloadLayer(sector.tau, sector, settings,
        radians, localUnit, true, templates);
    }
    // This screen-space test discards curves smaller than a visible pixel.
    // The exact ratios/orders remain in the mathematical data model.
    local += spiral(rotatedMaster, color, 0.85, 0.95, localUnit);
    if (local) body += `<g data-omega="${branch.name}" data-order="${branch.order}" ` +
      `transform="${branchSimilaritySvg(branch, radians)}">${local}</g>`;
  }
  if (includeFrame && settings.showFrame) {
    body += polyline(triangle, palette.frame, 1.4, true, unit);
  }
  if (settings.showAnchors) {
    for (const point of triangle) body += dot(point, palette.anchor);
    if (rotatedMaster.length) body += dot(rotatedMaster[0].center, palette.anchor, 0.002);
  }
  return body;
}

/** The same polygon assembler is used for the main Σ and every local τ inset. */
function polygonContent(sector, settings, palette, unit, templates = null) {
  const n = sector.math.n;
  let content = "";
  if (settings.showCircumcircle) {
    content += `<circle cx="0" cy="0" r="0.5" fill="none" ` +
      `stroke="${palette.guides}" stroke-width="${f(unit)}" ` +
      `stroke-dasharray="${f(5 * unit)} ${f(5 * unit)}"/>`;
  }
  for (let m = 0; m < n; m++) {
    content += sectorContent(sector, settings, m * sector.math.delta, palette, false, unit, templates);
  }
  if (settings.showFrame) {
    const points = polygonVertices(n);
    content += polyline(points, palette.polygon, 1.65, true, unit);
    for (const p of points) content += line({ x: 0, y: 0 }, p, palette.frame, 1.02, 0.84, unit);
  }
  if (settings.showAnchors) content += dot({ x: 0, y: 0 }, palette.anchor, 0.003);
  return content;
}

/** Two exact σ templates, shared by all τ root and Ω carriers. */
function anyVisibleTauPayload(sector, settings, unit) {
  if (!settings.tauPayload || settings.tauPayload === "off" || !settings.showTau) return false;
  const threshold = settings.payloadMinPixels ?? 5;
  return sector.tau.some((t) =>
    settings.tauComponents?.[t.k] !== false && t.radius * 2 >= threshold * unit);
}

const templateCache = new Map();
function getPayloadTemplateSector(n, sector) {
  const key=JSON.stringify([n,sector.master.length,sector.orders]);
  if (!templateCache.has(key)) {
    if (templateCache.size > 15) templateCache.clear();
    templateCache.set(key, buildSector(n,sector.master.length,sector.orders));
  }
  return templateCache.get(key);
}

function payloadDefinitions(sector, settings, palette) {
  // Always σ geometry; NEVER call polygonContent here.
  const nestedSettings = { ...settings, tauPayload:"off", showTauAxes:false,
    showTauContacts:false, showTauBranches:false };
  const localUnit = 0.003;
  const original = getPayloadTemplateSector(sector.math.n, sector);
  const doubled = getPayloadTemplateSector(2 * sector.math.n, sector);
  return `<defs><g id="rnacc-tau-sigma-n" data-template="sigma-n">` +
    sectorContent(original,nestedSettings,0,palette,true,localUnit,null) +
    `</g><g id="rnacc-tau-sigma-2n" data-template="sigma-2n">` +
    sectorContent(doubled,nestedSettings,0,palette,true,localUnit,null) +
    `</g></defs>`;
}

/** Render to standalone SVG markup (no external assets or CSS required). */
export function renderSvg(sector, settings, viewBox, options = {}) {
  const palette = palettes[settings.palette] ?? palettes.reference;
  const pixelWidth = options.width ?? "100%";
  const pixelHeight = options.height ?? "100%";
  const vb = `${f(viewBox.x)} ${f(viewBox.y)} ${f(viewBox.w)} ${f(viewBox.h)}`;
  const unit = viewBox.w / Math.max(1, options.pixelWidth ?? (Number(pixelWidth) || 1000));
  let content = "";
  const payloadEnabled = anyVisibleTauPayload(sector, settings, unit);
  const templates = payloadEnabled ? {n:"rnacc-tau-sigma-n",
    twiceN:"rnacc-tau-sigma-2n",count:0} : null;
  if (templates) content += payloadDefinitions(sector, settings, palette);

  content += `<rect x="${f(viewBox.x)}" y="${f(viewBox.y)}" width="${f(viewBox.w)}" height="${f(viewBox.h)}" fill="${palette.bg}"/>`;
  if (settings.mode === "polygon") {
    content += polygonContent(sector, settings, palette, unit, templates);
  } else {
    content += sectorContent(sector, settings, settings.phase * sector.math.delta,
      palette, true, unit, templates);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${pixelWidth}" ` +
    `height="${pixelHeight}" preserveAspectRatio="xMidYMid meet" ` +
    `role="img" aria-label="RNACC ${settings.mode} geometric construction for n=${sector.math.n}">` +
    content + `</svg>`;
}
