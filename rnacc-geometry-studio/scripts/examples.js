import fs from 'node:fs';
import { buildSector, boundsForMode, fitViewBox } from '../src/geometry.js';
import { renderSvg } from '../src/render.js';
const examples = [
  {file:'v04-sector-n6-sigma-basic.svg', n:6, mode:'sector', orders:{s:1,f:1,j:1}, payload:'basic', transport:'none', axes:false},
  {file:'v04-sector-n9-sigma-extended-s.svg', n:9, mode:'sector', orders:{s:12,f:1,j:1}, payload:'extended', transport:'s', axes:false},
  {file:'v04-sector-n6-sigma-axes.svg', n:6, mode:'sector', orders:{s:2,f:2,j:1}, payload:'basic', transport:'none', axes:true},
  {file:'v04-polygon-n9-sigma-extended.svg', n:9, mode:'polygon', orders:{s:3,f:2,j:2}, payload:'extended', transport:'all', axes:false},
];
for (const e of examples) {
  const sector = buildSector(e.n,14,e.orders);
  const w=1260,h=900;
  const view=fitViewBox(boundsForMode(sector,e.mode),w,h);
  const settings={mode:e.mode,phase:0,palette:'colored',showFrame:true,showPrimary:true,
    showOmegaSeams:true,showAnchors:false,showCircumcircle:false,
    showTau:true,showTauBranches:true,showTauContacts:false,
    tauComponents:[true,true,true],branches:{s:true,f:true,j:true},
    tauPayload:e.payload,tauTransport:e.transport,tauReflection:'auto',
    showTauAxes:e.axes,payloadMinPixels:3};
  const svg=renderSvg(sector,settings,view,{width:w,height:h,pixelWidth:w});
  fs.writeFileSync(`examples/${e.file}`,svg);
  console.log(e.file,svg.length,(svg.match(/data-tau-sigma=/g)||[]).length);
}
