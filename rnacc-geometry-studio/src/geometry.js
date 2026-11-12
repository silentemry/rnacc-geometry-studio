import { calculateState } from "./math.js";

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v, factor) => ({ x: v.x * factor, y: v.y * factor });
export const rotate = (p, radians) => ({
  x: p.x * Math.cos(radians) - p.y * Math.sin(radians),
  y: p.x * Math.sin(radians) + p.y * Math.cos(radians),
});
export const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (a) => ({ x: Math.cos(a), y: Math.sin(a) });

export function projectedTriangle(math) {
  return [
    { x: 0, y: 0 },
    { x: math.gamma0, y: 0 },
    {
      x: math.gamma0 * Math.cos(math.delta),
      y: math.gamma0 * Math.sin(math.delta),
    },
  ];
}

/**
 * The master spiral is a chain of tangent quarter circles. Radii are exactly
 * αₖ = α₀ / φᵏ; the first radius is centered at (β₀,0), and its endpoint is
 * (β₀, α₀), as specified by the manuscript's Cartesian alpha anchors.
 * Subsequent arc centers are set by continuity of position and tangent.
 *
 * SVG's y axis is inverted by the renderer, never in this math module.
 */
export function constructQuarterSpiral(math, depth = 14) {
  if (!Number.isInteger(depth) || depth < 1 || depth > 48) {
    throw new RangeError("Spiral depth must be between 1 and 48.");
  }
  const arcs = [];
  let start = { x: math.beta1, y: 0 };
  for (let k = 0; k < depth; k++) {
    const radius = math.alpha(k);
    const angle = k * Math.PI / 2;
    const center = sub(start, scale(unit(angle), radius));
    const end = add(center, scale(unit(angle + Math.PI / 2), radius));
    arcs.push({ k, center, radius, angle, start, end });
    start = end;
  }
  return arcs;
}

/** Similarity transform centered on an existing triangle vertex. */
export function homothety(point, anchor, ratio) {
  return add(anchor, scale(sub(point, anchor), ratio));
}

function mapArc(arc, mapPoint, factor) {
  return {
    ...arc,
    start: mapPoint(arc.start),
    end: mapPoint(arc.end),
    center: mapPoint(arc.center),
    radius: arc.radius * factor,
    // The transform is a positive homothety and optional positive rotation.
    angle: arc.angle,
  };
}

/**
 * The three τ triangles belong ONLY to α₀, α₁, and α₂.
 *
 * Each is the triangle formed by:
 *   Oₖ   — αₖ arc center
 *   Aₖ   — αₖ quarter-arc starting point
 *   Cₖ   — the point on αₖ at manuscript transport angle tₖ₊₁
 *
 * The contact-radius OₖCₖ is perpendicular to the coupling boundary.
 * Boundary assignments (in the source's sector frame):
 *   τ₁ — external side P₁P₂
 *   τ₂ — internal side P₀P₂
 *   τ₃ — Ωˢ seam, parallel to P₁P₂
 *
 * The endpoint on the boundary and the chord length τₖ are CONSEQUENCES
 * of the defining α, β, Γ and t relations, not hardcoded coordinates.
 */
export function constructTauCouplings(math, arcs, triangle, scaleSeam) {
  const boundaries = [
    { name: "outer", edge: [triangle[1], triangle[2]] },
    { name: "inner", edge: [triangle[0], triangle[2]] },
    { name: "scale-seam", edge: scaleSeam },
  ];
  return arcs.slice(0, 3).map((arc, k) => {
    const angle = math.t[k];
    const contact = add(arc.center, scale(unit(angle), arc.radius));
    const boundary = boundaries[k];
    const [a, b] = boundary.edge;
    const line = sub(b, a);
    const offset = sub(contact, a);
    const denominator = line.x ** 2 + line.y ** 2;
    const parameter = (offset.x * line.x + offset.y * line.y) / denominator;
    const signedDistance = (line.x * offset.y - line.y * offset.x) / Math.sqrt(denominator);
    // The tangent direction is perpendicular to the radial direction OₖCₖ.
    const perpendicularResidual = (line.x * Math.cos(angle) +
      line.y * Math.sin(angle)) / Math.sqrt(denominator);
    return {
      k, index: k + 1, center: arc.center, start: arc.start,
      contact, radius: arc.radius, angle, triangle: [arc.center, arc.start, contact],
      chord: length(arc.start, contact), expectedChord: math.tau[k],
      boundary: boundary.name, edge: boundary.edge,
      boundaryParameter: parameter,
      boundaryResidual: signedDistance,
      perpendicularResidual,
    };
  });
}

/** Apply the same vertex-centered positive homothety to a τ object. */
export function mapTauCoupling(tau, mapPoint, factor) {
  const center = mapPoint(tau.center);
  const start = mapPoint(tau.start);
  const contact = mapPoint(tau.contact);
  return {
    ...tau, center, start, contact,
    triangle: [center, start, contact],
    edge: tau.edge.map(mapPoint),
    radius: tau.radius * factor,
    chord: tau.chord * factor,
    expectedChord: tau.expectedChord * factor,
    boundaryResidual: tau.boundaryResidual * factor,
  };
}

/**
 * First-order Ω branches. Their placement is derived by homothety at the
 * sector's three vertices, not manually fitted to screen coordinates.
 *
 * s : scale around P₀ (origin)      -> lower-left corner
 * f : scale around P₂ (next vertex) -> upper corner
 * j : scale around P₁ (base vertex) -> small right corner
 *
 * The assignment to vertices is an inferred placement rule from page 13;
 * the Ω factors themselves are the source formulas from page 4.
 */
/**
 * Independent, vertex-preserving Ω^r directional chains.
 * Each repeated direction applies the SAME local similarity about its
 * corresponding vertex. For a pure direction q, order p has ratio Ωq^p.
 * This intentionally does not assert commutativity for mixed s/f/j paths.
 */
export function buildSector(n, depth = 14, omegaOrders = { s: 1, f: 1, j: 1 }) {
  const orders = normalizeOrders(omegaOrders);
  const math = calculateState(n);
  const triangle = projectedTriangle(math);
  const master = constructQuarterSpiral(math, depth);
  const cornerSpecification = [
    { name: "s", anchor: triangle[0], ratio: math.omega.s, seam: [1, 2] },
    { name: "f", anchor: triangle[2], ratio: math.omega.f, seam: [0, 1] },
    { name: "j", anchor: triangle[1], ratio: math.omega.j, seam: [0, 2] },
  ];
  const tau = constructTauCouplings(math, master, triangle,
    // Ωˢ is the subtriangle at the origin; its opposite edge is the τ₃ seam.
    cornerSpecification[0].seam.map((i) =>
      homothety(triangle[i], cornerSpecification[0].anchor, math.omega.s)));
  const branches = [];
  for (const entry of cornerSpecification) {
    for (let order = 1; order <= orders[entry.name]; order++) {
      const factor = entry.ratio ** order;
      const map = (p) => homothety(p, entry.anchor, factor);
      const branchTriangle = triangle.map(map);
      branches.push({
        name: entry.name,
        order,
        key: `${entry.name}${order}`,
        ratio: factor,
        stepRatio: entry.ratio,
        anchor: entry.anchor,
        triangle: branchTriangle,
        seam: entry.seam.map((i) => branchTriangle[i]),
        sourceSeam: entry.seam.map((i) => triangle[i]),
        arcs: master.map((a) => mapArc(a, map, factor)),
        tau: tau.map((coupling) => mapTauCoupling(coupling, map, factor)),
      });
    }
  }
  return { math, triangle, master, tau, branches, orders };
}


export function normalizeOrders(orders = {}) {
  const result = {};
  for (const name of ["s", "f", "j"]) {
    const value = orders[name] ?? 1;
    if (!Number.isInteger(value) || value < 0 || value > 12) {
      throw new RangeError(`Ω ${name} order must be an integer 0–12.`);
    }
    result[name] = value;
  }
  return result;
}

export function polygonVertices(n, radius = 0.5) {
  return Array.from({ length: n }, (_, m) => ({
    x: radius * Math.cos(2 * Math.PI * m / n),
    y: radius * Math.sin(2 * Math.PI * m / n),
  }));
}

export function boundsOfPoints(points) {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

export function boundsForMode(sector, mode, phase = 0) {
  if (mode === "polygon") {
    return boundsOfPoints(polygonVertices(sector.math.n));
  }
  const points = sector.triangle.map((p) => rotate(p, phase * sector.math.delta));
  return boundsOfPoints(points);
}

/**
 * Fit an object's y-up mathematical bounds to a y-down SVG viewport.
 * SVG viewBox dimensions are stretched only by padding, never nonuniformly.
 */
export function fitViewBox(bounds, pixelWidth, pixelHeight, padding = 0.09) {
  const aspect = Math.max(1, pixelWidth) / Math.max(1, pixelHeight);
  const w = Math.max(1e-8, bounds.maxX - bounds.minX);
  const h = Math.max(1e-8, bounds.maxY - bounds.minY);
  const desiredW = w * (1 + 2 * padding);
  const desiredH = h * (1 + 2 * padding);
  const finalW = Math.max(desiredW, desiredH * aspect);
  const finalH = finalW / aspect;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = -(bounds.minY + bounds.maxY) / 2;
  return {
    x: centerX - finalW / 2,
    y: centerY - finalH / 2,
    w: finalW,
    h: finalH,
  };
}
