/* ============================================================
   TN DRIVE — MUTCD sign sprite (mockup edition)
   Hand-authored geometry: correct shape, correct colour, correct
   proportion. No clipart, no photography, anywhere in this product.

   Usage:  <svg class="sign sign--lg"><use href="#sg-stop"/></svg>
   Speed limit + shields are HTML components (numbers vary) — see
   .sign-speed / .shield below.
   ============================================================ */

(function () {
  const OCT = '29.3,0 70.7,0 100,29.3 100,70.7 70.7,100 29.3,100 0,70.7 0,29.3';
  const DIA = '50,1 99,50 50,99 1,50';
  const TRI = '2,7 98,7 50,96';
  const PEN = '50,1 98,37 79,99 21,99 2,37';

  const sprite = `
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><defs>
  <style>
    .f-red{fill:#B4151C}.f-wht{fill:#F2F4F1}.f-blk{fill:#14161A}.f-yel{fill:#FFCC00}
    .f-grn{fill:#04684E}.f-org{fill:#E35205}.f-blu{fill:#003F87}
    /* School/pedestrian/bicycle warning = FLUORESCENT YELLOW-GREEN (MUTCD).
       Fluorescent pink is incident management — a different thing entirely. */
    .f-fyg{fill:#C7EA00}.f-pnk{fill:#EE5FA7}
    .s-wht{stroke:#F2F4F1;fill:none}.s-blk{stroke:#14161A;fill:none}
    .lg{font-family:'Overpass',sans-serif;font-weight:800;text-anchor:middle}
  </style>
</defs>

<symbol id="sg-stop" viewBox="0 0 100 100">
  <polygon class="f-red" points="${OCT}"/>
  <polygon class="s-wht" points="${OCT}" stroke-width="5" transform="translate(50,50) scale(.87) translate(-50,-50)"/>
  <text class="lg f-wht" x="50" y="62" font-size="28" letter-spacing="1">STOP</text>
</symbol>

<symbol id="sg-yield" viewBox="0 0 100 100">
  <!-- R1-2 is a WHITE triangle with a wide RED border and a RED legend.
       Red field + white legend is the inverse of the real sign. -->
  <polygon class="f-red" points="${TRI}"/>
  <polygon class="f-wht" points="15,18 85,18 50,81"/>
  <text class="lg f-red" x="50" y="43" font-size="12" letter-spacing="0.3">YIELD</text>
</symbol>

<symbol id="sg-warn" viewBox="0 0 100 100">
  <polygon class="f-yel" points="${DIA}"/>
  <polygon class="s-blk" points="${DIA}" stroke-width="4" transform="translate(50,50) scale(.85) translate(-50,-50)"/>
</symbol>

<symbol id="sg-curve" viewBox="0 0 100 100">
  <polygon class="f-yel" points="${DIA}"/>
  <polygon class="s-blk" points="${DIA}" stroke-width="4" transform="translate(50,50) scale(.85) translate(-50,-50)"/>
  <!-- W1-2 CURVE: a gentle bend. The previous path was a right-angle turn
       (W1-1), which contradicted every caption calling it a curve. -->
  <path class="s-blk" stroke-width="7" stroke-linecap="butt" d="M40 78 C40 60 44 50 56 42"/>
  <polygon class="f-blk" points="50,30 70,36 55,50"/>
</symbol>

<symbol id="sg-merge" viewBox="0 0 100 100">
  <polygon class="f-yel" points="${DIA}"/>
  <polygon class="s-blk" points="${DIA}" stroke-width="4" transform="translate(50,50) scale(.85) translate(-50,-50)"/>
  <path class="s-blk" stroke-width="6" d="M40 80 L40 44"/>
  <path class="s-blk" stroke-width="6" d="M64 78 L64 58 Q64 46 50 42"/>
  <polygon class="f-blk" points="40,20 50,40 30,40"/>
</symbol>

<symbol id="sg-signal" viewBox="0 0 100 100">
  <polygon class="f-yel" points="${DIA}"/>
  <polygon class="s-blk" points="${DIA}" stroke-width="4" transform="translate(50,50) scale(.85) translate(-50,-50)"/>
  <rect class="f-blk" x="40" y="24" width="20" height="52" rx="4"/>
  <circle class="f-red" cx="50" cy="35" r="6"/>
  <circle class="f-yel" cx="50" cy="50" r="6"/>
  <circle cx="50" cy="65" r="6" fill="#1FA05F"/>
</symbol>

<symbol id="sg-slippery" viewBox="0 0 100 100">
  <polygon class="f-yel" points="${DIA}"/>
  <polygon class="s-blk" points="${DIA}" stroke-width="4" transform="translate(50,50) scale(.85) translate(-50,-50)"/>
  <rect class="f-blk" x="34" y="34" width="32" height="24" rx="5"/>
  <circle class="f-blk" cx="41" cy="61" r="5"/><circle class="f-blk" cx="60" cy="61" r="5"/>
  <path class="s-blk" stroke-width="4" stroke-linecap="round" d="M26 72 Q34 66 40 72 T54 72"/>
  <path class="s-blk" stroke-width="4" stroke-linecap="round" d="M58 76 Q66 70 72 76"/>
</symbol>

<symbol id="sg-deer" viewBox="0 0 100 100">
  <polygon class="f-yel" points="${DIA}"/>
  <polygon class="s-blk" points="${DIA}" stroke-width="4" transform="translate(50,50) scale(.85) translate(-50,-50)"/>
  <path class="f-blk" d="M60 30 L57 22 L60 24 L62 18 L64 24 L67 22 L64 30 Z"/>
  <path class="f-blk" d="M62 32 q8 2 8 12 l-2 22 h-5 l-1-16 q-8 4 -18 2 l-2 14 h-5 l1-20 q-6-6 -2-14 q6-4 12-2 z"/>
</symbol>

<symbol id="sg-ped" viewBox="0 0 100 100">
  <polygon class="f-yel" points="${DIA}"/>
  <polygon class="s-blk" points="${DIA}" stroke-width="4" transform="translate(50,50) scale(.85) translate(-50,-50)"/>
  <circle class="f-blk" cx="50" cy="30" r="6"/>
  <path class="f-blk" d="M44 38 h12 l4 18 h-5 l-2-9 v10 l6 20 h-6 l-6-17 l-5 17 h-6 l7-24 v-9 l-2 12 h-5 z"/>
</symbol>

<symbol id="sg-rr-advance" viewBox="0 0 100 100">
  <!-- W10-1: yellow circle, black X (NOT a plus), R left and R right,
       sitting in the horizontal quadrants of the X. -->
  <circle class="f-yel" cx="50" cy="50" r="49"/>
  <circle class="s-blk" cx="50" cy="50" r="43" stroke-width="3"/>
  <path class="s-blk" stroke-width="8" d="M19 19 L81 81 M81 19 L19 81"/>
  <text class="lg f-blk" x="27" y="59" font-size="23">R</text>
  <text class="lg f-blk" x="73" y="59" font-size="23">R</text>
</symbol>

<symbol id="sg-crossbuck" viewBox="0 0 100 100">
  <!-- R15-1: both blades first, THEN both legends, so neither word is buried
       under the other blade. paint-order keeps each word legible where the
       blades cross, without moving the geometry. -->
  <g transform="rotate(45 50 50)">
    <rect class="f-wht" x="5" y="41" width="90" height="18" rx="2"/>
    <rect class="s-blk" x="5" y="41" width="90" height="18" rx="2" stroke-width="2"/>
  </g>
  <g transform="rotate(-45 50 50)">
    <rect class="f-wht" x="5" y="41" width="90" height="18" rx="2"/>
    <rect class="s-blk" x="5" y="41" width="90" height="18" rx="2" stroke-width="2"/>
  </g>
  <g transform="rotate(45 50 50)">
    <text class="lg f-blk" x="50" y="54.5" font-size="12.5" letter-spacing="0.4"
          stroke="#F2F4F1" stroke-width="3" paint-order="stroke">RAILROAD</text>
  </g>
  <g transform="rotate(-45 50 50)">
    <text class="lg f-blk" x="50" y="54.5" font-size="12.5" letter-spacing="0.4"
          stroke="#F2F4F1" stroke-width="3" paint-order="stroke">CROSSING</text>
  </g>
</symbol>

<symbol id="sg-school" viewBox="0 0 100 100">
  <polygon class="f-fyg" points="${PEN}"/>
  <polygon class="s-blk" points="${PEN}" stroke-width="4" transform="translate(50,52) scale(.85) translate(-50,-52)"/>
  <circle class="f-blk" cx="40" cy="42" r="5"/><circle class="f-blk" cx="61" cy="46" r="5"/>
  <path class="f-blk" d="M34 50 h11 l4 14 h-4 l-2-7 v8 l4 16 h-5 l-4-13 l-3 13 h-5 l5-19 v-7 l-2 9 h-4 z"/>
  <path class="f-blk" d="M55 54 h11 l5 13 h-4 l-3-6 v7 l4 15 h-5 l-3-12 l-3 12 h-5 l4-18 v-6 l-2 8 h-4 z"/>
</symbol>

<symbol id="sg-workzone" viewBox="0 0 100 100">
  <polygon class="f-org" points="${DIA}"/>
  <polygon class="s-blk" points="${DIA}" stroke-width="4" transform="translate(50,50) scale(.85) translate(-50,-50)"/>
  <!-- Worker scaled to sit inside the inner border; at full size the legs
       crossed it. -->
  <g transform="translate(50,50) scale(.82) translate(-50,-50)">
    <path class="f-blk" d="M40 34 h10 v6 h-10z"/>
    <circle class="f-blk" cx="45" cy="30" r="5"/>
    <path class="f-blk" d="M38 42 h16 l6 16 -5 2 -4-10 v9 l5 17 h-6 l-4-13 -4 13h-6 l5-19 v-8 l-4 11 -5-2z"/>
    <path class="f-blk" d="M58 40 l14 12 -4 5 -14-12z"/>
  </g>
</symbol>

<symbol id="sg-donotenter" viewBox="0 0 100 100">
  <!-- R5-1 (US): RED SQUARE with a white horizontal bar, legend split above
       and below. The white-disc-with-red-bar composition is the European
       no-entry sign and is wrong here. -->
  <rect class="f-wht" x="1" y="1" width="98" height="98" rx="8"/>
  <rect class="f-red" x="5" y="5" width="90" height="90" rx="5"/>
  <text class="lg f-wht" x="50" y="32" font-size="18" letter-spacing="0.5">DO NOT</text>
  <rect class="f-wht" x="15" y="41" width="70" height="17" rx="2"/>
  <text class="lg f-wht" x="50" y="82" font-size="18" letter-spacing="0.5">ENTER</text>
</symbol>

<symbol id="sg-wrongway" viewBox="0 0 100 100">
  <rect class="f-red" x="4" y="20" width="92" height="60" rx="4"/>
  <rect class="s-wht" x="9" y="25" width="82" height="50" rx="2" stroke-width="3"/>
  <text class="lg f-wht" x="50" y="47" font-size="19">WRONG</text>
  <text class="lg f-wht" x="50" y="67" font-size="19">WAY</text>
</symbol>

<symbol id="sg-oneway" viewBox="0 0 100 100">
  <!-- R6-1. Legend sized so its ink stays inside the inner white rule:
       "ONE WAY" at 9.5u ≈ 41u wide, centred at 70 → 49.5…90.5, rule ends 94. -->
  <rect class="f-blk" x="2" y="32" width="96" height="36" rx="2"/>
  <rect class="s-wht" x="6" y="36" width="88" height="28" rx="1" stroke-width="1.5"/>
  <polygon class="f-wht" points="11,50 23,42.5 23,47.5 43,47.5 43,52.5 23,52.5 23,57.5"/>
  <text class="lg f-wht" x="70" y="53.5" font-size="9.5" letter-spacing="0.3">ONE WAY</text>
</symbol>

<symbol id="sg-noturn" viewBox="0 0 100 100">
  <rect class="f-wht" x="2" y="2" width="96" height="96" rx="6"/>
  <rect class="s-blk" x="6" y="6" width="88" height="88" rx="4" stroke-width="3"/>
  <path class="s-blk" stroke-width="7" fill="none" d="M38 76 V52 a13 13 0 0 1 26 0 v14"/>
  <polygon class="f-blk" points="55,64 73,64 64,80"/>
  <circle cx="50" cy="50" r="34" fill="none" stroke="#B4151C" stroke-width="8"/>
  <line x1="26" y1="26" x2="74" y2="74" stroke="#B4151C" stroke-width="8"/>
</symbol>

<symbol id="sg-guide" viewBox="0 0 140 100">
  <!-- A guide sign with no legend reads as a missing asset. This one carries
       a destination and a distance, which is what guide signs do. -->
  <rect class="f-grn" x="1" y="14" width="138" height="72" rx="5"/>
  <rect class="s-wht" x="6" y="19" width="128" height="62" rx="3" stroke-width="2.5"/>
  <text class="lg f-wht" x="60" y="45" font-size="15" letter-spacing="0.3">NASHVILLE</text>
  <text class="lg f-wht" x="46" y="68" font-size="15" letter-spacing="0.3">12</text>
  <text class="lg f-wht" x="76" y="68" font-size="11" letter-spacing="0.3">MILES</text>
</symbol>

<symbol id="sg-guide-blank" viewBox="0 0 140 100">
  <!-- Deliberately legend-less: used where the point IS that it points nowhere. -->
  <rect class="f-grn" x="1" y="14" width="138" height="72" rx="5"/>
  <rect class="s-wht" x="6" y="19" width="128" height="62" rx="3" stroke-width="2.5"/>
</symbol>

<symbol id="sg-services" viewBox="0 0 100 100">
  <rect class="f-blu" x="1" y="8" width="98" height="84" rx="5"/>
  <rect class="s-wht" x="6" y="13" width="88" height="74" rx="3" stroke-width="2.5"/>
  <path class="f-wht" d="M43 30h14v13h13v14H57v13H43V57H30V43h13z"/>
</symbol>

<symbol id="sg-nopassing" viewBox="0 0 100 100">
  <!-- W14-3: a solid yellow PENNANT, taller than wide, point to the right,
       mounted on the LEFT shoulder. Legend reads down the blade. -->
  <polygon class="f-yel" points="22,2 92,50 22,98"/>
  <!-- Scaled about the CENTROID (45.3,50), not an arbitrary point — otherwise
       the border is hairline at the left edge and thick at the point. -->
  <polygon class="s-blk" points="22,2 92,50 22,98" stroke-width="3.5"
           transform="translate(45.3,50) scale(.82) translate(-45.3,-50)"/>
  <text class="lg f-blk" x="44" y="38" font-size="9">NO</text>
  <text class="lg f-blk" x="44" y="53" font-size="9">PASSING</text>
  <text class="lg f-blk" x="44" y="68" font-size="9">ZONE</text>
</symbol>
</svg>`;

  function inject() {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    host.innerHTML = sprite;
    document.body.insertBefore(host, document.body.firstChild);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else { inject(); }

  const css = `
  .sign { width: 56px; height: 56px; display: inline-block; vertical-align: middle;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
  .sign--sm { width: 36px; height: 36px; }
  .sign--lg { width: 96px; height: 96px; }
  .sign--xl { width: 148px; height: 148px; }
  /* Drill mode: the sign IS the screen. Dominance is the thesis. */
  .sign--hero { width: clamp(150px, 48vw, 216px); height: clamp(150px, 48vw, 216px); }
  /* #sg-guide is 140×100 — a square box letterboxes it. Use --wide for it. */
  .sign--wide { width: 132px; height: 94px; }
  .sign--wide.sign--sm { width: 74px; height: 53px; }
  .sign--wide.sign--lg { width: 150px; height: 107px; }
  .sign--wide.sign--xl { width: 196px; height: 140px; }

  /* Speed-limit sign: numbers vary, so this is an HTML component. */
  .sign-speed {
    display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
    width: 76px; height: 96px; padding: 6px 4px;
    background: #F2F4F1; color: #14161A;
    border: 3px solid #14161A; border-radius: 4px;
    box-shadow: 0 0 0 3px #F2F4F1, 0 2px 8px rgba(0,0,0,.5);
    font-family: 'Overpass', sans-serif; line-height: 1;
  }
  .sign-speed b { font-size: .5rem; font-weight: 800; letter-spacing: .06em; }
  .sign-speed b + b { margin-top: 1px; }
  .sign-speed strong {
    font-family: 'Overpass Mono', monospace; font-size: 2.25rem; font-weight: 700;
    margin-top: 5px; font-variant-numeric: tabular-nums;
  }
  .sign-speed--sm { width: 56px; height: 70px; }
  .sign-speed--sm strong { font-size: 1.5rem; }

  /* Route shield: mastery level. Not decoration. */
  .shield {
    position: relative; display: inline-grid; place-items: center;
    width: 62px; height: 58px;
    background: #003F87;
    clip-path: polygon(50% 0%, 88% 9%, 100% 34%, 84% 78%, 50% 100%, 16% 78%, 0% 34%, 12% 9%);
    font-family: 'Overpass Mono', monospace; font-weight: 700; color: #F2F4F1;
    font-size: 1.35rem; line-height: 1;
  }
  .shield::before {
    content: ''; position: absolute; inset: 3px;
    background: #003F87; border: 2px solid #F2F4F1;
    clip-path: polygon(50% 0%, 88% 9%, 100% 34%, 84% 78%, 50% 100%, 16% 78%, 0% 34%, 12% 9%);
  }
  .shield > * { position: relative; z-index: 1; }
  .shield--locked { background: #2A2F38; color: #A7AFBB; }
  .shield--locked::before { background: #2A2F38; border-color: #3A414D; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
