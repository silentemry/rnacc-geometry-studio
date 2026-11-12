/**
 * Exact τ → lowercase σ carrier correspondence (v0.4).
 *
 * Each τ triangle is isosceles because its equal sides are αₖ radii. The
 * included central angle is θ, 2θ, θ respectively. Consequently τ₁ and τ₃
 * are similar to σ_(2n), whereas τ₂ is similar to σ_n. These are exact
 * similarities, not stretched/affine coordinates or incircle fittings.
 *
 * The optional mirror is a chirality/presentation convention, NOT a change
 * in the source geometry or a theorem about physical transport.
 */
import { add, length, rotate, scale } from './geometry.js';

const EPS = 3e-10;
export const TAU_SIGMA_VARIANTS = Object.freeze(['off', 'basic', 'extended']);
export const TAU_REFLECTIONS = Object.freeze(['auto', 'normal', 'mirrored']);
export const TAU_DIRECTIONS = Object.freeze(['none', 's', 'f', 'j', 'all']);

export function sigmaStateForTau(n, k) {
  if (!Number.isInteger(n) || n < 4 || n > 120) {
    throw new RangeError('Root n must be an integer between 4 and 120.');
  }
  if (![0, 1, 2].includes(k)) throw new RangeError('τ exists only for α₀–α₂.');
  return k === 1 ? n : 2 * n;
}

export function resolveMirror(k, handedness = 'auto') {
  if (!TAU_REFLECTIONS.includes(handedness)) {
    throw new RangeError(`Unknown reflection mode: ${handedness}`);
  }
  // Auto alternates handedness at the middle α₁ quarter turn. This is an
  // explicit editable visualization convention, not a manuscript axiom.
  return handedness === 'mirrored' || (handedness === 'auto' && k === 1);
}

/** H(δ) is reflection in the bisector of an isosceles sector of angle δ. */
export function bisectorReflect(point, delta) {
  return {
    x: Math.cos(delta) * point.x + Math.sin(delta) * point.y,
    y: Math.sin(delta) * point.x - Math.cos(delta) * point.y,
  };
}

/**
 * Transport the local σ reference into a τ carrier.
 * Local σ has P0=(0,0), P1=(0.5,0), P2=(0.5cosδ,0.5sinδ).
 * Without reflection, these map to center,start,contact respectively.
 * With reflection the last two are swapped, but the triangular boundary is
 * unchanged. The scaling factor is 2·αₖ and never depends on pixels.
 */
export function tauSigmaFrame(tau, n, handedness = 'auto') {
  const sigmaN = sigmaStateForTau(n, tau.k);
  const delta = 2 * Math.PI / sigmaN;
  const angle = Math.atan2(tau.start.y - tau.center.y, tau.start.x - tau.center.x);
  const factor = 2 * tau.radius;
  const mirrored = resolveMirror(tau.k, handedness);
  const frame = {
    sourceIndex: tau.index, sigmaN, delta, angle,
    anchor: tau.center, factor, mirrored,
  };
  const map = (p) => add(frame.anchor,
    scale(rotate(mirrored ? bisectorReflect(p, delta) : p, angle), factor));
  const localA = {x:0,y:0}, localB = {x:0.5,y:0};
  const localC = {x:0.5*Math.cos(delta),y:0.5*Math.sin(delta)};
  const expectedB = mirrored ? tau.contact : tau.start;
  const expectedC = mirrored ? tau.start : tau.contact;
  frame.vertexResidual = Math.max(length(map(localA),tau.center),
    length(map(localB),expectedB),length(map(localC),expectedC));
  frame.mapPoint = map;
  // Pointwise absolute residual is relevant at normal display scale. Deep Ω
  // paths should use this frame in local coordinates, not pre-map to world.
  if (frame.vertexResidual > EPS * Math.max(1, factor)) {
    throw new Error(`τ${tau.index}: σ_${sigmaN} does not match carrier (${frame.vertexResidual}).`);
  }
  return frame;
}

/** SVG y-down equivalent of the y-up similarity, preserving local geometry. */
export function tauSigmaSvgTransform(frame) {
  const f = (n) => Number(n.toPrecision(14));
  const deg = frame.angle * 180 / Math.PI;
  let result = `translate(${f(frame.anchor.x)} ${f(-frame.anchor.y)}) ` +
    `rotate(${f(-deg)}) scale(${f(frame.factor)})`;
  if (frame.mirrored) {
    const c = f(Math.cos(frame.delta)), s = f(-Math.sin(frame.delta));
    // Y-inverted bisector reflection: [[cos δ,-sin δ],[-sin δ,-cos δ]].
    result += ` matrix(${c} ${s} ${s} ${-c} 0 0)`;
  }
  return result;
}

export function isTransportBranchSelected(branchName, setting) {
  if (!TAU_DIRECTIONS.includes(setting)) throw new RangeError(`Unknown τ transport direction ${setting}`);
  return setting === 'all' || setting === branchName;
}
