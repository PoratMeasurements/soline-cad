'use strict';
// Soline DXF exporter — one of the object-model's format exporters.
// DXF is the open/easy target: a Soline object's 2D symbol (polylines, mm) maps
// directly to DXF LINE entities. R12 ASCII, universally openable (AutoCAD, etc.).

function g(code, val) { return code + '\n' + val + '\n'; } // group-code pair

// Emit LINE entities for one polyline (offset by ox,oy), on a given layer.
function polylineToLines(pl, ox, oy, layer) {
  let s = '';
  for (let i = 0; i + 1 < pl.length; i++) {
    const [x1, y1] = pl[i], [x2, y2] = pl[i + 1];
    s += g(0, 'LINE') + g(8, layer) +
      g(10, (x1 + ox).toFixed(2)) + g(20, (y1 + oy).toFixed(2)) + g(30, '0.0') +
      g(11, (x2 + ox).toFixed(2)) + g(21, (y2 + oy).toFixed(2)) + g(31, '0.0');
  }
  return s;
}

// Export a single object's 2D symbol as a standalone DXF (origin 0,0).
function objectToDXF2D(symbol, layer = 'SYMBOL') {
  let body = '';
  for (const pl of symbol.polylines) body += polylineToLines(pl, 0, 0, layer);
  return g(0, 'SECTION') + g(2, 'ENTITIES') + body + g(0, 'ENDSEC') + g(0, 'EOF');
}

// Export MANY objects as a labelled grid gallery DXF (like the SVG preview, but
// real CAD geometry). objects: [{ en, he, symbol:{frame,polylines} }]
function galleryToDXF(objects, opts = {}) {
  const cols = opts.cols || 8;
  const cell = opts.cell || 500;   // mm grid cell
  let body = '';
  objects.forEach((o, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const ox = col * cell, oy = -row * cell;
    // frame box (light) + the symbol; layer = the element's Hebrew category.
    const [W, H] = o.symbol.frame || [200, 200];
    const layer = o.category || 'סמלים';
    body += polylineToLines([[0, 0], [W, 0], [W, H], [0, H], [0, 0]], ox, oy, 'מסגרת');
    for (const pl of o.symbol.polylines) body += polylineToLines(pl, ox, oy, layer);
    // label as TEXT — the Hebrew name (he). File is UTF-8; text rendered RTL by CAD.
    body += g(0, 'TEXT') + g(8, 'מקרא') + g(10, ox.toFixed(2)) + g(20, (oy - 30).toFixed(2)) +
      g(30, '0.0') + g(40, '40') + g(1, o.he || o.en || '');
  });
  return g(0, 'SECTION') + g(2, 'ENTITIES') + body + g(0, 'ENDSEC') + g(0, 'EOF');
}

module.exports = { objectToDXF2D, galleryToDXF: galleryToDXF, polylineToLines };
