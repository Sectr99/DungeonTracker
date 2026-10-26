// Flat SVG dice — line-drawn silhouettes per die type, plus a short tumble-and-settle roll.
// Replaces the old Three.js renderer; no dependencies.
const DIE_SVG = {
  d20:  '<polygon class="edge" points="50,4 90,27 90,73 50,96 10,73 10,27"/>' +
        '<polygon class="facet" points="50,26 74,67 26,67"/>' +
        '<path class="facet" d="M50,26 L10,27 M50,26 L50,4 M50,26 L90,27 M26,67 L10,27 M26,67 L10,73 M26,67 L50,96 M74,67 L90,27 M74,67 L90,73 M74,67 L50,96"/>',
  d100: '<polygon class="edge" points="50,4 93,42 50,96 7,42"/>' +
        '<path class="facet" d="M7,42 L50,62 L93,42 M50,62 L50,96"/>',
  d12:  '<polygon class="edge" points="50,4 94,36 77,91 23,91 6,36"/>' +
        '<polygon class="facet" points="50,24 74,41 65,70 35,70 26,41"/>' +
        '<path class="facet" d="M50,24 L50,4 M74,41 L94,36 M65,70 L77,91 M35,70 L23,91 M26,41 L6,36"/>',
  d6:   '<rect class="edge" x="10" y="10" width="80" height="80" rx="10"/>' +
        '<rect class="facet" x="22" y="22" width="56" height="56" rx="5"/>',
};

function setDieShape(svgId, die) { $(svgId).innerHTML = DIE_SVG[die] || DIE_SVG.d20; }

// Scramble numbers with a tumble, then settle on `final`. Instant when animations are off.
function rollDie(wrapId, numId, sides, final, done) {
  const wrap = $(wrapId), num = $(numId);
  if(!S.anim) { num.textContent = final; done(); return; }
  wrap.classList.add('rolling');
  const t = setInterval(() => { num.textContent = 1 + Math.floor(Math.random() * sides); }, 55);
  setTimeout(() => {
    clearInterval(t);
    num.textContent = final;
    wrap.classList.remove('rolling');
    done();
  }, 650);
}
