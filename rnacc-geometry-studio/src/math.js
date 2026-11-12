/**
 * RNACC mathematical definitions from the user's October 2026 manuscript,
 * pp. 3–5. Units are normalized: Γ₀ = 1/2. No pixels or browser APIs here.
 *
 * Conventions:
 *   θ = π/n, Δ = 2π/n, ∇ = π/(2n)
 *   Ωˢ = Γₛ₌₁/Γ₀, Ωᶠ = Γ𝒇₌₁/Γ₀, Ωʲ = Γⱼ₌₁/Γ₀
 */
export const PHI = (1 + Math.sqrt(5)) / 2;
export const GAMMA_0 = 0.5;

export function calculateState(n) {
  if (!Number.isInteger(n) || n < 4 || n > 240) {
    throw new RangeError("Polygon state n must be an integer between 4 and 240.");
  }

  const theta = Math.PI / n;
  const delta = 2 * theta;
  const nabla = theta / 2;
  const tau0 = 1 + Math.tan(theta) ** 2 / PHI ** 3;
  const alpha0 = Math.sin(theta) /
    (tau0 * Math.cos(theta) + 2 * Math.tan(theta));
  const alpha = (k) => alpha0 / PHI ** k;

  const beta0 = GAMMA_0 - alpha0 / Math.cos(theta);
  const beta1 = beta0 + alpha0;
  const beta2 = beta1 - 2 * alpha(1);
  const beta3 = Math.sin(theta) - ((Math.sin(theta) - beta1) + (alpha0 + alpha(2)));
  const beta4 = alpha0 / Math.tan(delta);

  const gammaS = beta2 - alpha(2) * Math.cos(theta) / (1 + Math.sin(theta));
  const gammaF = GAMMA_0 - alpha0 / Math.sin(delta);
  const gammaJ = GAMMA_0 - beta1;
  const omega = {
    s: gammaS / GAMMA_0,
    f: gammaF / GAMMA_0,
    j: gammaJ / GAMMA_0,
  };

  // τ₁–τ₃ are the chords at the only three orthogonal boundary couplings.
  const tau = [2 * alpha0 * Math.sin(nabla),
    2 * alpha(1) * Math.sin(theta),
    2 * alpha(2) * Math.sin(nabla)];
  const t = [2 * nabla, Math.PI / 2 + delta, Math.PI + theta];

  return {
    n, theta, delta, nabla, gamma0: GAMMA_0, tau0,
    alpha0, alpha, beta0, beta1, beta2, beta3, beta4,
    gammaS, gammaF, gammaJ, omega, tau, t,
    // Useful numerical consistency check for the quarter-circle placement.
    alphaIdentityResidual: alpha0 - alpha(1) - alpha(2),
  };
}
