import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateState, PHI } from '../src/math.js';
import { renderSvg } from '../src/render.js';
import { sigmaStateForTau, tauSigmaFrame, resolveMirror, bisectorReflect,
  tauSigmaSvgTransform, isTransportBranchSelected } from '../src/transport.js';
import {
  buildSector, constructQuarterSpiral, projectedTriangle,
  polygonVertices, length, rotate, fitViewBox, boundsForMode,
  normalizeOrders
} from '../src/geometry.js';

const near = (a, b, tolerance = 1e-11) => assert.ok(Math.abs(a - b) < tolerance,
  `expected ${a} ≈ ${b}`);

test('fixed n=9 normalized construction values', () => {
  const s = calculateState(9);
  near(s.theta, Math.PI / 9);
  near(s.delta, 2 * Math.PI / 9);
  near(s.gamma0, 0.5);
  near(s.alpha(1), s.alpha0 / PHI);
  near(s.alpha(2), s.alpha0 / PHI ** 2);
  near(s.alphaIdentityResidual, 0);
  near(s.omega.s, 0.36809, 1e-5);
  near(s.omega.f, 0.37291, 1e-5);
  near(s.omega.j, 0.02587, 1e-5);
});

test('triangle radius and subtended chord derive from n', () => {
  for (const n of [4, 5, 6, 9, 12, 31, 120]) {
    const math = calculateState(n);
    const [p0, p1, p2] = projectedTriangle(math);
    near(length(p0, p1), 0.5);
    near(length(p0, p2), 0.5);
    near(length(p1, p2), Math.sin(math.theta));
  }
});

test('the first spiral quarter circle is anchored at (β₀,0)', () => {
  const s = calculateState(9);
  const [a0, a1, a2] = constructQuarterSpiral(s, 14);
  near(a0.center.x, s.beta0);
  near(a0.center.y, 0);
  near(a0.start.x, s.beta1);
  near(a0.end.x, s.beta0);
  near(a0.end.y, s.alpha0);
  near(a1.center.y, s.alpha(2));
  near(a2.center.x, s.beta2);
  near(a2.center.y, s.alpha(2));
  near(a2.end.y, 0);
});

test('spiral quarters join, with tangency and exact shrinking radii', () => {
  for (const n of [4, 9, 13, 54]) {
    const s = calculateState(n);
    const arcs = constructQuarterSpiral(s, 20);
    for (let k = 1; k < arcs.length; k++) {
      near(length(arcs[k - 1].end, arcs[k].start), 0);
      near(arcs[k].radius, arcs[k - 1].radius / PHI);
      // Adjacent arc centers and the join point are collinear on the normal.
      const a = arcs[k - 1], b = arcs[k];
      const tangent = { x: -Math.sin(k * Math.PI / 2), y: Math.cos(k * Math.PI / 2) };
      const delta = { x: b.center.x - a.center.x, y: b.center.y - a.center.y };
      near(delta.x * tangent.x + delta.y * tangent.y, 0);
    }
  }
});

test('Ω nested triangles are homothetic to the sector about their vertices', () => {
  for (const n of [4, 6, 9, 27, 120]) {
    const sector = buildSector(n);
    for (const branch of sector.branches) {
      for (let i = 0; i < 3; i++) {
        near(length(branch.triangle[i], branch.anchor),
          branch.ratio * length(sector.triangle[i], branch.anchor));
      }
      near(branch.arcs[0].radius, sector.master[0].radius * branch.ratio);
    }
  }
});

test('polygon vertices lie on Γ₀ and form closed n-state phase', () => {
  for (const n of [4, 9, 36]) {
    const points = polygonVertices(n);
    assert.equal(points.length, n);
    for (const p of points) near(Math.hypot(p.x, p.y), .5);
    const closed = rotate(points[0], n * 2 * Math.PI / n);
    near(length(closed, points[0]), 0);
  }
});

test('fit-to-frame viewBox contains original triangle and regular polygon bounds', () => {
  for (const n of [4, 9, 40, 120]) {
    const sector = buildSector(n);
    for (const mode of ['sector', 'polygon']) {
      const b = boundsForMode(sector, mode);
      const box = fitViewBox(b, 920, 640);
      assert.ok(box.x < b.minX && box.x + box.w > b.maxX);
      // Mathematical y is inverted before constructing the SVG viewBox.
      assert.ok(box.y < -b.maxY && box.y + box.h > -b.minY);
      near(box.w / box.h, 920 / 640);
    }
  }
});

test('n and depth reject unsupported values', () => {
  assert.throws(() => calculateState(3), RangeError);
  assert.ok(Number.isFinite(calculateState(240).alpha0));
  assert.throws(() => calculateState(241), RangeError);
  assert.throws(() => constructQuarterSpiral(calculateState(9), 0), RangeError);
});


test('τ₁–τ₃ are the three contact chords, with no τ beyond α₂', () => {
  for (let n = 4; n <= 120; n++) {
    const math = calculateState(n);
    for (const depth of [1, 2, 3, 14]) {
      const sector = buildSector(n, depth);
      assert.equal(sector.tau.length, Math.min(3, depth));
      for (const tau of sector.tau) {
        assert.ok(tau.k >= 0 && tau.k < 3);
        assert.equal(tau.index, tau.k + 1);
        const alpha = math.alpha(tau.k);
        near(tau.radius, alpha);
        near(length(tau.center, tau.start), alpha);
        near(length(tau.center, tau.contact), alpha);
        near(tau.chord, math.tau[tau.k]);
        near(tau.expectedChord, math.tau[tau.k]);
        near(tau.boundaryResidual, 0);
        near(tau.perpendicularResidual, 0);
        assert.ok(tau.boundaryParameter >= -1e-10 && tau.boundaryParameter <= 1 + 1e-10,
          `n=${n} τ${tau.index}: contact outside boundary segment`);
      }
    }
  }
});

test('τ radius is normal to outer, inner, and Ωˢ seam, in that order', () => {
  for (const n of [4, 5, 6, 9, 12, 24, 120]) {
    const sector = buildSector(n, 18);
    const [p0, p1, p2] = sector.triangle;
    const edges = [[p1, p2], [p0, p2], sector.branches[0].seam];
    assert.deepEqual(sector.tau.map((x) => x.boundary), ['outer','inner','scale-seam']);
    for (let k = 0; k < 3; k++) {
      const tau = sector.tau[k];
      for (let j = 0; j < 2; j++) {
        near(length(tau.edge[j], edges[k][j]), 0);
      }
      // Boundary contact must lie on the angle ray defined in the paper.
      const radial = {x:tau.contact.x-tau.center.x, y:tau.contact.y-tau.center.y};
      near(radial.x / tau.radius, Math.cos(sector.math.t[k]));
      near(radial.y / tau.radius, Math.sin(sector.math.t[k]));
    }
  }
});

test('each first-order Ω region inherits only the same 3 τ shapes by homothety', () => {
  for (const n of [4, 6, 9, 18, 120]) {
    const sector = buildSector(n, 18);
    for (const branch of sector.branches) {
      assert.equal(branch.tau.length, 3);
      for (let k = 0; k < 3; k++) {
        const original = sector.tau[k];
        const mapped = branch.tau[k];
        near(mapped.chord, original.chord * branch.ratio);
        near(mapped.radius, original.radius * branch.ratio);
        near(length(mapped.center, mapped.contact), mapped.radius);
        near(mapped.boundaryResidual, 0);
        near(mapped.perpendicularResidual, 0);
        near(mapped.chord, mapped.expectedChord);
      }
    }
  }
});

test('τ overlays respond to independent visibility, depth and branch controls', () => {
  const sector = buildSector(9, 14);
  const viewBox = fitViewBox(boundsForMode(sector, 'sector'), 900, 620);
  const settings = {
    mode:'sector', phase:0, palette:'colored', showFrame:true,
    showPrimary:true, showOmegaSeams:true, showAnchors:false,
    branches:{s:true,f:true,j:true}, showTau:true,
    showTauBranches:false, showTauContacts:false,
    tauComponents:[true,true,true]
  };
  const rendered = renderSvg(sector, settings, viewBox, {width:900,height:620});
  assert.equal((rendered.match(/data-region="primary"/g) || []).length, 3);
  assert.equal((rendered.match(/data-region="omega"/g) || []).length, 0);
  settings.showTauBranches = true;
  assert.equal((renderSvg(sector, settings, viewBox).match(/data-region="omega"/g) || []).length, 9);
  settings.tauComponents = [false,true,false];
  assert.equal((renderSvg(sector, settings, viewBox).match(/data-coupling="tau2"/g) || []).length, 4);
  assert.equal((renderSvg(sector, settings, viewBox).match(/data-coupling="tau1"/g) || []).length, 0);
  settings.showTau = false;
  assert.equal((renderSvg(sector, settings, viewBox).match(/data-coupling=/g) || []).length, 0);
});


test('Ω directional recurrence reaches order 12 without inventing mixed-order commutation', () => {
  for (const n of [4, 6, 9, 18, 120]) {
    const parent = buildSector(n, 14, {s:12,f:12,j:12});
    assert.equal(parent.branches.length, 36);
    for (const name of ['s','f','j']) {
      const chain = parent.branches.filter((b) => b.name === name);
      assert.equal(chain.length, 12);
      const anchor = chain[0].anchor;
      for (let i = 0; i < 12; i++) {
        const branch = chain[i];
        assert.equal(branch.order, i + 1);
        near(branch.ratio, parent.math.omega[name] ** (i+1));
        near(length(branch.triangle[0], anchor),
          length(parent.triangle[0], anchor) * branch.ratio);
        near(branch.arcs[0].radius, parent.master[0].radius * branch.ratio);
        assert.equal(branch.tau.length, 3);
        for (const tau of branch.tau) near(tau.chord, parent.tau[tau.k].chord * branch.ratio);
      }
    }
  }
  const selective = buildSector(9, 8, {s:12,f:0,j:0});
  assert.deepEqual(selective.branches.map((b)=>b.key), Array.from({length:12},(_,i)=>`s${i+1}`));
  const zero = buildSector(9, 8, {s:0,f:0,j:0});
  assert.equal(zero.branches.length, 0);
  assert.throws(()=>normalizeOrders({s:13}), RangeError);
  assert.throws(()=>normalizeOrders({f:-1}), RangeError);
});

test('τ₁ / τ₂ / τ₃ are exactly similar to σ₂ₙ / σₙ / σ₂ₙ for all n=4..120', () => {
  for (let n=4; n<=120; n++) {
    const sector=buildSector(n, 14, {s:1,f:1,j:1});
    assert.deepEqual(sector.tau.map(t=>sigmaStateForTau(n,t.k)),[2*n,n,2*n]);
    for (const tau of sector.tau) {
      for (const handedness of ['normal','mirrored','auto']) {
        const frame=tauSigmaFrame(tau,n,handedness);
        const [p0,p1,p2]=projectedTriangle(calculateState(frame.sigmaN));
        const [target0,target1,target2] = frame.mirrored ?
          [tau.center,tau.contact,tau.start] : [tau.center,tau.start,tau.contact];
        near(length(frame.mapPoint(p0),target0),0,2e-12);
        near(length(frame.mapPoint(p1),target1),0,2e-12);
        near(length(frame.mapPoint(p2),target2),0,2e-12);
        near(frame.factor,2*tau.radius);
        near(frame.delta,Math.PI/(tau.k===1?n/2:n));
        near(frame.vertexResidual,0,2e-12);
        assert.ok(Number.isFinite(frame.angle));
        assert.ok(tauSigmaSvgTransform(frame).includes('translate('));
      }
    }
  }
  assert.throws(()=>sigmaStateForTau(3,1),RangeError);
  assert.throws(()=>sigmaStateForTau(121,1),RangeError);
  assert.throws(()=>sigmaStateForTau(9,3),RangeError);
});

test('handedness: normal preserves endpoint order; mirror swaps ends and is involutive',()=>{
  for (const n of [4,6,9,25]) {
    const sec=buildSector(n);
    for(const tau of sec.tau){
      assert.equal(resolveMirror(tau.k,'normal'),false);
      assert.equal(resolveMirror(tau.k,'mirrored'),true);
      assert.equal(resolveMirror(tau.k,'auto'),tau.k===1);
      const frame=tauSigmaFrame(tau,n,'mirrored');
      const ref={x:0.19,y:-0.07};
      const reflected=bisectorReflect(bisectorReflect(ref,frame.delta),frame.delta);
      near(length(ref,reflected),0);
      const transform=tauSigmaSvgTransform(frame);
      assert.ok(transform.includes('matrix('));
    }
  }
  assert.throws(()=>resolveMirror(0,'unknown'),RangeError);
});

const drawSettings = () => ({mode:'sector',phase:0,palette:'colored',
  showFrame:true,showPrimary:true,showOmegaSeams:true,showAnchors:false,
  showCircumcircle:false,showTau:true,showTauBranches:false,
  showTauContacts:false,tauComponents:[true,true,true],
  branches:{s:true,f:true,j:true},tauPayload:'off',tauTransport:'all',
  tauReflection:'auto',showTauAxes:false,payloadMinPixels:0});

const count = (svg,fragment) => svg.split(fragment).length-1;

test('σ payload Off / Basic / Extended are distinct and never embed Σ polygon',()=>{
  const sec=buildSector(9,14,{s:2,f:1,j:0});
  const box=fitViewBox(boundsForMode(sec,'sector'),900,640);
  const st=drawSettings();
  const output=()=>renderSvg(sec,st,box,{width:900,height:640,pixelWidth:900});
  let svg=output();
  assert.equal(count(svg,'data-tau-sigma='),0);
  assert.equal(count(svg,'data-template='),0);
  st.tauPayload='basic';
  svg=output();
  assert.equal(count(svg,'data-template='),2);
  assert.equal(count(svg,'data-tau-sigma='),3);
  assert.equal(count(svg,'data-sigma-state="18"'),2);
  assert.equal(count(svg,'data-sigma-state="9"'),1);
  assert.ok(svg.includes('data-template="sigma-n"'));
  assert.ok(svg.includes('data-template="sigma-2n"'));
  assert.ok(!svg.includes('rnacc-local-tau-polygon'));
  st.tauPayload='extended';
  svg=output();
  assert.equal(count(svg,'data-tau-sigma='),12); // 3 + 3*(s² + f¹)
  st.tauTransport='s';
  svg=output();
  assert.equal(count(svg,'data-tau-sigma='),9);
  st.tauTransport='none';
  svg=output();
  assert.equal(count(svg,'data-tau-sigma='),3);
  st.tauTransport='f';
  svg=output();
  assert.equal(count(svg,'data-tau-sigma='),6);
  st.branches.f=false;
  svg=output();
  assert.equal(count(svg,'data-tau-sigma='),3);
  st.showTau=false;
  svg=output();
  assert.equal(count(svg,'data-tau-sigma='),0);
  assert.equal(count(svg,'data-template='),0);
});

test('τ component switches, depth, inherited layer switches, and axes',()=>{
  const sec=buildSector(6,3,{s:1,f:1,j:1});
  const box=fitViewBox(boundsForMode(sec,'sector'),900,640);
  const st=drawSettings(); st.tauPayload='basic';
  st.tauComponents=[false,true,false]; st.showTauAxes=true;
  let svg=renderSvg(sec,st,box);
  assert.equal(count(svg,'data-tau-sigma='),1);
  assert.equal(count(svg,'data-tau-sigma="tau2"'),1);
  assert.ok(svg.includes('fill="#ca6a3e"'));
  st.showFrame=false; st.showPrimary=false; st.branches={s:false,f:false,j:false};
  svg=renderSvg(sec,st,box);
  assert.equal(count(svg,'data-tau-sigma='),1);
  assert.equal(count(svg,'data-tau-sigma="tau1"'),0);
  const one=buildSector(6,1);
  st.tauComponents=[true,true,true];
  svg=renderSvg(one,st,box);
  assert.equal(count(svg,'data-tau-sigma='),1);
});

test('parent Σ phase duplication and SVG resource reuse',()=>{
  const sec=buildSector(9,14,{s:0,f:0,j:0});
  const box=fitViewBox(boundsForMode(sec,'polygon'),1200,900);
  const st=drawSettings(); st.mode='polygon'; st.tauPayload='basic';
  const svg=renderSvg(sec,st,box,{width:1200,height:900,pixelWidth:1200});
  assert.equal(count(svg,'data-tau-sigma='),9*3);
  assert.equal(count(svg,'data-template='),2);
  assert.equal(count(svg,'href="#rnacc-tau-sigma-n"'),9);
  assert.equal(count(svg,'href="#rnacc-tau-sigma-2n"'),18);
  assert.ok(svg.length < 1_000_000);
});

test('τ v0.4 payload supports 2n=240 with strict one-level embedding',()=>{
  const sec=buildSector(120,14,{s:1,f:0,j:0});
  const box=fitViewBox(boundsForMode(sec,'sector'),900,640);
  const st=drawSettings(); st.tauPayload='extended';
  st.tauTransport='s'; st.tauComponents=[true,false,false];
  const svg=renderSvg(sec,st,box,{width:900,height:640,pixelWidth:900});
  assert.ok(svg.includes('data-sigma-state="240"'));
  assert.equal(count(svg,'data-tau-sigma='),2);
  assert.equal(count(svg,'data-template='),2);
  assert.ok(svg.length < 1_000_000);
  const stNo=drawSettings(); stNo.tauPayload='off';
  assert.equal(count(renderSvg(sec,stNo,box),'data-template='),0);
});

test('12th order τ direction does not explode, respects the instance budget',()=>{
  const sec=buildSector(9,14,{s:12,f:12,j:12});
  const box=fitViewBox(boundsForMode(sec,'polygon'),900,640);
  const st=drawSettings();st.mode='polygon';st.tauPayload='extended';
  st.maxTauPayloadInstances=50;
  const svg=renderSvg(sec,st,box,{width:900,height:640,pixelWidth:900});
  assert.ok(count(svg,'data-tau-sigma=')<=50);
  assert.ok(count(svg,'data-tau-sigma=')>=9);
  assert.ok(svg.length<2_000_000);
  assert.equal(isTransportBranchSelected('s','all'),true);
  assert.equal(isTransportBranchSelected('s','j'),false);
  assert.equal(isTransportBranchSelected('s','none'),false);
  assert.throws(()=>isTransportBranchSelected('s','INVALID'),RangeError);
});
