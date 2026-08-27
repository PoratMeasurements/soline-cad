/* =====================================================================
 * viz_engine.js  —  Soline "מנוע הדמייה למדידה"
 * Offline, dependency-free 3D visualization engine for measured kitchens.
 *
 *   - WebGL renderer when available, else a Canvas 2.5D painter's-algorithm
 *     fallback. ZERO network: no CDN, no external URLs, all procedural.
 *   - Procedural texture generators (WOOD / MARBLE_VEIN / GRANITE_SPECKLE /
 *     TERRAZZO / TILE_GRID / CONCRETE / LINEN / METAL_BRUSH / SOLID).
 *   - Scene from a room JSON (walls + heights, cabinets as boxes, counters,
 *     wall accessories/infrastructure, products). Kickboard (צוקל) on every
 *     base cabinet. Countertop slab on the base run.
 *   - Planning layer toggle + clash/fit detection ("נזהה בעיות בהתאמה").
 *
 * The module is UMD: usable in the browser (attaches window.VizEngine) and
 * in Node (module.exports) for the pure/testable parts. Texture rasterizing
 * and the viewer need a DOM <canvas>; the geometry, matrix math, noise and
 * clash detection are pure and run under Node.
 *
 * Author: viz agent for Michael / Soline.  Offline by design.
 * ===================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  if (typeof window !== "undefined") window.VizEngine = mod;
})(this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 0. Material vocabulary  (aligned with MATERIALS_LIBRARY.md TextureKind)
   * ------------------------------------------------------------------ */
  var TEXTURE_KINDS = [
    "SOLID", "WOOD", "MARBLE_VEIN", "GRANITE_SPECKLE", "TERRAZZO",
    "TILE_GRID", "CONCRETE", "LINEN", "METAL_BRUSH"
  ];

  // Hebrew display names for the legend / UI (masculine).
  var KIND_HE = {
    SOLID: "צבע אחיד",
    WOOD: "עץ / פורניר",
    MARBLE_VEIN: "שיש מנוקד",
    GRANITE_SPECKLE: "גרניט",
    TERRAZZO: "טראצו",
    TILE_GRID: "אריחים",
    CONCRETE: "בטון",
    LINEN: "בד / פשתן",
    METAL_BRUSH: "נירוסטה מוברשת"
  };

  // Default palette + real-world tile size (mm) per kind. tileMm drives how
  // often the texture repeats across a surface, so scale reads correctly.
  var KIND_DEFAULTS = {
    SOLID:          { base: "#e9e6df", accent: "#d9d5cc", tileMm: 600 },
    WOOD:           { base: "#b5884f", accent: "#7a5326", tileMm: 1200 },
    MARBLE_VEIN:    { base: "#efeee9", accent: "#9aa0a6", tileMm: 2000 },
    GRANITE_SPECKLE:{ base: "#3b3d42", accent: "#c9c6bf", tileMm: 900 },
    TERRAZZO:       { base: "#efeae1", accent: "#b7a58c", tileMm: 1000 },
    TILE_GRID:      { base: "#dfe4e7", accent: "#8f9aa1", tileMm: 300 },
    CONCRETE:       { base: "#b9b7b2", accent: "#8f8d88", tileMm: 1500 },
    LINEN:          { base: "#cfc7b6", accent: "#a89e88", tileMm: 500 },
    METAL_BRUSH:    { base: "#c3c7cc", accent: "#8b9096", tileMm: 800 }
  };

  /* ------------------------------------------------------------------ *
   * 1. Pure noise  (deterministic, node-testable)
   * ------------------------------------------------------------------ */
  function fract(x) { return x - Math.floor(x); }
  function hash2(x, y) {
    // deterministic pseudo-random in [0,1)
    return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var a = hash2(xi, yi), b = hash2(xi + 1, yi);
    var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    var u = smooth(xf), v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    oct = oct || 5;
    var sum = 0, amp = 0.5, freq = 1;
    for (var i = 0; i < oct; i++) {
      sum += amp * vnoise(x * freq, y * freq);
      freq *= 2; amp *= 0.5;
    }
    return sum;
  }

  /* ------------------------------------------------------------------ *
   * 2. Color helpers
   * ------------------------------------------------------------------ */
  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rgbCss(c) {
    return "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")";
  }

  /* ------------------------------------------------------------------ *
   * 3. Procedural texture generators.
   *    Each returns an offscreen <canvas> (browser only). They accept a
   *    { base, accent, scale, size, createCanvas } opts bag. `createCanvas`
   *    lets callers inject a factory (defaults to document.createElement).
   * ------------------------------------------------------------------ */
  function _canvas(size, createCanvas) {
    var mk = createCanvas || function (w, h) {
      var c = document.createElement("canvas"); c.width = w; c.height = h; return c;
    };
    return mk(size, size);
  }

  function makeTexture(kind, opts) {
    opts = opts || {};
    var def = KIND_DEFAULTS[kind] || KIND_DEFAULTS.SOLID;
    var base = hexToRgb(opts.base || def.base);
    var accent = hexToRgb(opts.accent || def.accent);
    var size = opts.size || 256;
    var scale = opts.scale || 1;
    var cv = _canvas(size, opts.createCanvas);
    var ctx = cv.getContext("2d");
    var img = ctx.createImageData(size, size);
    var d = img.data;

    // Per-pixel field for the noise-driven kinds.
    function px(i, c) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }

    var x, y, i, n, col, u, v;
    if (kind === "WOOD") {
      // Domain-warped stripes -> plank grain; darker ring lines in accent.
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        i = (y * size + x) * 4;
        var warp = fbm(x / size * 3 * scale, y / size * 9 * scale, 4) * 6;
        var g = Math.abs(Math.sin((x / size * 10 * scale + warp)));
        g = Math.pow(g, 1.6);
        var grain = fbm(x / size * 40 * scale, y / size * 6 * scale, 3) * 0.12;
        col = mixRgb(base, accent, clamp(g * 0.7 + grain, 0, 1));
        px(i, col);
      }
    } else if (kind === "MARBLE_VEIN") {
      // Turbulent veins: |sin(freq*x + turbulence)| sharpened.
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        i = (y * size + x) * 4;
        var t = fbm(x / size * 4 * scale, y / size * 4 * scale, 6);
        var vein = Math.abs(Math.sin((x / size * 6 * scale + y / size * 2 + t * 5) * Math.PI));
        vein = Math.pow(1 - vein, 3.0);            // thin bright/dark veins
        var mottle = (fbm(x / size * 2, y / size * 2, 3) - 0.5) * 0.10;
        col = mixRgb(base, accent, clamp(vein + mottle, 0, 1));
        px(i, col);
      }
    } else if (kind === "GRANITE_SPECKLE") {
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        i = (y * size + x) * 4;
        var bg = fbm(x / size * 3 * scale, y / size * 3 * scale, 4) * 0.25;
        var spk = hash2(x * 1.7 * scale, y * 1.3 * scale);
        col = mixRgb(base, accent, bg * 0.5);
        if (spk > 0.86) col = mixRgb(col, accent, 0.9);       // light fleck
        else if (spk < 0.06) col = mixRgb(col, [20, 20, 24], 0.6); // dark fleck
        px(i, col);
      }
    } else if (kind === "CONCRETE") {
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        i = (y * size + x) * 4;
        var m = fbm(x / size * 3 * scale, y / size * 3 * scale, 5);
        var blotch = fbm(x / size * 8 * scale + 5, y / size * 8 * scale + 5, 3) * 0.15;
        col = mixRgb(base, accent, clamp((m - 0.3) * 0.9 + blotch, 0, 1));
        px(i, col);
      }
    } else if (kind === "METAL_BRUSH") {
      // Anisotropic: noise smooth along X (brush direction), varying along Y.
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        i = (y * size + x) * 4;
        var streak = vnoise(x / size * 3 * scale, y / size * 120 * scale);
        var sheen = 0.5 + 0.5 * Math.sin(y / size * Math.PI); // soft vertical highlight
        col = mixRgb(base, accent, clamp((streak - 0.5) * 0.8 + (1 - sheen) * 0.25 + 0.3, 0, 1));
        px(i, col);
      }
    } else if (kind === "LINEN") {
      // Woven weave: alternating warp/weft threads (anisotropic in both axes).
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        i = (y * size + x) * 4;
        var th = 8 * scale;
        var warp = Math.sin(x / th * Math.PI) * 0.5 + 0.5;
        var weft = Math.sin(y / th * Math.PI) * 0.5 + 0.5;
        var over = ((Math.floor(x / th) + Math.floor(y / th)) % 2 === 0) ? warp : weft;
        var fib = fbm(x / size * 60, y / size * 60, 2) * 0.1;
        col = mixRgb(base, accent, clamp((1 - over) * 0.6 + fib, 0, 1));
        px(i, col);
      }
    } else { // SOLID + subtle grain
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        i = (y * size + x) * 4;
        var s = (fbm(x / size * 4, y / size * 4, 3) - 0.5) * 0.06;
        col = mixRgb(base, accent, clamp(0.15 + s, 0, 1));
        px(i, col);
      }
    }
    ctx.putImageData(img, 0, 0);

    // Vector overlays for kinds better drawn with shapes.
    if (kind === "TILE_GRID") {
      ctx.fillStyle = rgbCss(base); ctx.fillRect(0, 0, size, size);
      var cells = Math.max(1, Math.round(4 * scale));
      var cw = size / cells;
      for (var cy = 0; cy < cells; cy++) for (var cx = 0; cx < cells; cx++) {
        var vary = (hash2(cx, cy) - 0.5) * 0.12;
        ctx.fillStyle = rgbCss(mixRgb(base, accent, 0.12 + Math.abs(vary)));
        ctx.fillRect(cx * cw + 1, cy * cw + 1, cw - 2, cw - 2);
      }
      ctx.strokeStyle = rgbCss(mixRgb(accent, [40, 40, 40], 0.4));
      ctx.lineWidth = Math.max(2, size / 90);
      for (var g = 0; g <= cells; g++) {
        ctx.beginPath(); ctx.moveTo(g * cw, 0); ctx.lineTo(g * cw, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, g * cw); ctx.lineTo(size, g * cw); ctx.stroke();
      }
    } else if (kind === "TERRAZZO") {
      ctx.fillStyle = rgbCss(base); ctx.fillRect(0, 0, size, size);
      var chips = Math.round(220 * scale);
      var palette = [accent, mixRgb(accent, [40, 40, 40], 0.5), mixRgb(base, [200, 120, 90], 0.5),
                     mixRgb(base, [90, 130, 150], 0.5), [235, 235, 230]];
      for (var k = 0; k < chips; k++) {
        var rx = hash2(k * 1.1, 3.3) * size, ry = hash2(7.7, k * 1.9) * size;
        var rr = 3 + hash2(k, k * 2.2) * 9;
        ctx.fillStyle = rgbCss(palette[k % palette.length]);
        ctx.save(); ctx.translate(rx, ry); ctx.rotate(hash2(k, 5) * 6.28);
        ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * (0.5 + hash2(k, 9) * 0.6), 0, 0, 6.2832);
        ctx.fill(); ctx.restore();
      }
    }
    return cv;
  }

  /* ------------------------------------------------------------------ *
   * 4. mat4 math  (column-major, pure, node-testable)
   * ------------------------------------------------------------------ */
  var M4 = {
    ident: function () { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
    mul: function (a, b) {
      var o = new Array(16);
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
        o[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] +
                       a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
      }
      return o;
    },
    perspective: function (fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return [f / aspect,0,0,0, 0,f,0,0, 0,0,(far + near) * nf,-1, 0,0,2 * far * near * nf,0];
    },
    lookAt: function (eye, center, up) {
      var z = norm3(sub3(eye, center));
      var x = norm3(cross3(up, z));
      var y = cross3(z, x);
      return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
              -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1];
    },
    // transform vec3 as point, returns [x,y,z,w]
    apply: function (m, p) {
      return [
        m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
        m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
        m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],
        m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]
      ];
    },
    invert: function (m) {
      var inv = new Array(16), i;
      inv[0]=m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
      inv[4]=-m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
      inv[8]=m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
      inv[12]=-m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
      inv[1]=-m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
      inv[5]=m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
      inv[9]=-m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
      inv[13]=m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
      inv[2]=m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
      inv[6]=-m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
      inv[10]=m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
      inv[14]=-m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
      inv[3]=-m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
      inv[7]=m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
      inv[11]=-m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
      inv[15]=m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
      var det = m[0]*inv[0]+m[1]*inv[4]+m[2]*inv[8]+m[3]*inv[12];
      if (det === 0) return M4.ident();
      det = 1 / det;
      for (i = 0; i < 16; i++) inv[i] *= det;
      return inv;
    }
  };
  function sub3(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross3(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot3(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function len3(a) { return Math.sqrt(dot3(a, a)); }
  function norm3(a) { var l = len3(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }

  /* ------------------------------------------------------------------ *
   * 5. Scene construction from room JSON.
   *    Coordinate frame: X = plan-x (right), Z = plan-y (depth), Y = up.
   *    Floor at Y=0.  All units mm.  See VIZ_ENGINE.md for the JSON shape.
   * ------------------------------------------------------------------ */

  // Resolve a material reference (string kind, named-key, or inline object)
  function resolveMat(ref, materials) {
    materials = materials || {};
    if (!ref) return { kind: "SOLID" };
    if (typeof ref === "string") {
      if (materials[ref]) return materials[ref];
      if (KIND_DEFAULTS[ref]) return { kind: ref };
      return { kind: "SOLID" };
    }
    return ref; // inline {kind,base,accent,scale}
  }
  function matKey(m) {
    return (m.kind || "SOLID") + "|" + (m.base || "") + "|" + (m.accent || "") + "|" + (m.scale || 1);
  }

  // Build the 6 faces of an axis-aligned box (min/max) with per-face material.
  // mats = { px,nx,py,ny,pz,nz } material refs, or a single ref for all.
  function boxFaces(min, max, mats, materials, objId, layer, tileOverride) {
    var faces = [];
    function m(side) { return resolveMat(typeof mats === "object" && mats.px !== undefined ? mats[side] : mats, materials); }
    function tile(mat) { return tileOverride || (KIND_DEFAULTS[mat.kind] || KIND_DEFAULTS.SOLID).tileMm; }
    var x0 = min[0], y0 = min[1], z0 = min[2], x1 = max[0], y1 = max[1], z1 = max[2];
    // Each face: 4 CCW verts (as seen from outside) with planar UV / tileMm.
    function face(side, verts, uAxis, vAxis, normal) {
      var mat = m(side), t = tile(mat);
      var vv = verts.map(function (p) {
        return { pos: p, uv: [dot3(p, uAxis) / t, dot3(p, vAxis) / t] };
      });
      faces.push({ verts: vv, normal: normal, material: mat, objId: objId, layer: layer });
    }
    face("pz", [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], [1,0,0], [0,1,0], [0,0,1]);   // front (+Z)
    face("nz", [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], [1,0,0], [0,1,0], [0,0,-1]);  // back
    face("px", [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]], [0,0,1], [0,1,0], [1,0,0]);   // right
    face("nx", [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], [0,0,1], [0,1,0], [-1,0,0]);  // left
    face("py", [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], [1,0,0], [0,0,1], [0,1,0]);   // top
    face("ny", [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], [1,0,0], [0,0,1], [0,-1,0]);  // bottom
    return faces;
  }

  function aabbOverlap(a, b, eps) {
    eps = eps || 0;
    return a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps &&
           a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps &&
           a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps;
  }
  function footprintOverlap(a, b, eps) { // XZ only
    eps = eps || 0;
    return a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps &&
           a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps;
  }

  var KICK_H = 120;   // toe-kick height (mm)
  var KICK_INSET = 55; // toe-kick recess depth (mm)

  // Default material by product/appliance type (used when a product has no
  // explicit material). Keyed by `type` (case-insensitive). See VIZ_ENGINE.md.
  var COLOR_BY_TYPE = {
    grill:      { kind: "METAL_BRUSH", base: "#3a3d42", accent: "#202225" },  // dark brushed steel
    bbq:        { kind: "METAL_BRUSH", base: "#3a3d42", accent: "#202225" },
    fridge:     { kind: "METAL_BRUSH", base: "#c9cdd2", accent: "#8b9096" },  // stainless
    freezer:    { kind: "METAL_BRUSH", base: "#cfd3d8", accent: "#9096a0" },
    ice_maker:  { kind: "METAL_BRUSH", base: "#cfd3d8", accent: "#9096a0" },
    sink:       { kind: "METAL_BRUSH", base: "#c6cacf", accent: "#8b9096" },  // brushed steel
    faucet:     { kind: "METAL_BRUSH", base: "#cdd1d6", accent: "#9096a0" },
    cooktop:    { kind: "SOLID",       base: "#1c1d20", accent: "#2a6df0" },  // black glass + flame-blue accent
    cooktop_gas:{ kind: "SOLID",       base: "#1c1d20", accent: "#2a6df0" },
    oven:       { kind: "METAL_BRUSH", base: "#2b2d31", accent: "#15161a" },
    dishwasher: { kind: "METAL_BRUSH", base: "#c9cdd2", accent: "#8b9096" },
    hood:       { kind: "METAL_BRUSH", base: "#cdd1d6", accent: "#9096a0" },
    microwave:  { kind: "SOLID",       base: "#2a2c30", accent: "#191a1d" },
    planter:    { kind: "SOLID",       base: "#b5651d", accent: "#4a7c3f" },  // terracotta + green
    plant:      { kind: "SOLID",       base: "#4a7c3f", accent: "#2f5a28" },
    appliance:  { kind: "METAL_BRUSH", base: "#c6cacf", accent: "#8b9096" }
  };
  function productMaterial(p, materials) {
    if (p.material) return resolveMat(p.material, materials);
    var t = (p.type || p.kind || "").toLowerCase();
    if (COLOR_BY_TYPE[t]) return COLOR_BY_TYPE[t];
    return { kind: "METAL_BRUSH", base: "#c6cacf", accent: "#8b9096" };
  }

  // Accessory kind metadata: visual box + clash class + tint color.
  var ACC_META = {
    socket:       { he: "שקע חשמל",   depth: 12, color: "#f4f1e8", clash: "neutral" },
    switch:       { he: "מפסק",       depth: 12, color: "#f4f1e8", clash: "neutral" },
    pipe_water:   { he: "צינור מים",   depth: 55, color: "#3d7fd6", clash: "hard", clashDepth: 350 },
    pipe_gas:     { he: "צינור גז",    depth: 55, color: "#e0a400", clash: "hard", clashDepth: 350 },
    electric_line:{ he: "קו חשמל",    depth: 18, color: "#c94b32", clash: "hard", clashDepth: 200 },
    window:       { he: "חלון",       depth: 80, color: "#bfe3f2", clash: "hard", clashDepth: 400, glass: true },
    door:         { he: "דלת",        depth: 80, color: "#9b6b3a", clash: "hard", clashDepth: 400 },
    ceiling_drop: { he: "הנמכת תקרה", depth: 400, color: "#d8d4cb", clash: "hard", clashDepth: 400 },
    floor_drain:  { he: "ניקוז רצפה", depth: 120, color: "#7d8a90", clash: "floor" }
  };

  function buildScene(room) {
    room = room || {};
    var materials = room.materials || {};
    var faces = [];
    var objects = [];          // pickable / clash bodies
    var roomHeight = (room.room && room.room.height) || 2700;

    // ---- derive walls (explicit list, else from outline polyline) ----
    var walls = [];
    if (room.room && room.room.walls && room.room.walls.length) {
      walls = room.room.walls.map(function (w, i) {
        return { id: w.id || ("wall" + i), from: w.from, to: w.to,
                 height: w.height || roomHeight, material: w.material || (room.room && room.room.wallMaterial),
                 accessories: w.accessories || [] };
      });
    } else if (room.room && room.room.outline) {
      var o = room.room.outline;
      for (var i = 0; i < o.length; i++) {
        walls.push({ id: "wall" + i, from: o[i], to: o[(i + 1) % o.length],
                     height: roomHeight, material: room.room.wallMaterial, accessories: [] });
      }
    }

    // centroid for inward-normal orientation + bounds
    var minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, cx = 0, cz = 0, np = 0;
    walls.forEach(function (w) {
      [w.from, w.to].forEach(function (p) {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]);
        cx += p[0]; cz += p[1]; np++;
      });
    });
    if (np) { cx /= np; cz /= np; }
    var roomBounds = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };

    // ---- floor (polygon) ----
    var floorMat = resolveMat((room.room && room.room.floorMaterial) || "TILE_GRID", materials);
    if (walls.length >= 3) {
      var ftile = (KIND_DEFAULTS[floorMat.kind] || KIND_DEFAULTS.SOLID).tileMm;
      var fverts = walls.map(function (w) {
        return { pos: [w.from[0], 0, w.from[1]], uv: [w.from[0] / ftile, w.from[1] / ftile] };
      });
      // ensure CCW winding so the geometric normal points +Y (up), matching cull rule
      if (fverts.length >= 3) {
        var fn = cross3(sub3(fverts[1].pos, fverts[0].pos), sub3(fverts[2].pos, fverts[0].pos));
        if (fn[1] < 0) fverts.reverse();
      }
      faces.push({ verts: fverts, normal: [0, 1, 0], material: floorMat, objId: "floor", layer: "structure" });
    }

    // ---- walls (inner face) + accessories ----
    walls.forEach(function (w) {
      var dir = norm3([w.to[0] - w.from[0], 0, w.to[1] - w.from[1]]);
      var wlen = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
      // inward normal candidate (rotate dir -90 in XZ): (dz, 0, -dx)
      var nA = [dir[2], 0, -dir[0]];
      var midp = [(w.from[0] + w.to[0]) / 2, 0, (w.from[1] + w.to[1]) / 2];
      var toC = [cx - midp[0], 0, cz - midp[2]];
      if (dot3(nA, toC) < 0) nA = [-nA[0], 0, -nA[2]]; // ensure points into room
      var inward = nA;
      var wmat = resolveMat(w.material || "CONCRETE", materials);
      var wt = (KIND_DEFAULTS[wmat.kind] || KIND_DEFAULTS.SOLID).tileMm;
      var A = [w.from[0], 0, w.from[1]], B = [w.to[0], 0, w.to[1]];
      var Atop = [A[0], w.height, A[2]], Btop = [B[0], w.height, B[2]];
      // inner face seen from inside room -> wind so normal = inward
      var wverts = [
        { pos: A, uv: [0, 0] },
        { pos: B, uv: [wlen / wt, 0] },
        { pos: Btop, uv: [wlen / wt, w.height / wt] },
        { pos: Atop, uv: [0, w.height / wt] }
      ];
      // orient CCW wrt inward normal
      var testN = cross3(sub3(wverts[1].pos, wverts[0].pos), sub3(wverts[3].pos, wverts[0].pos));
      if (dot3(testN, inward) < 0) wverts.reverse();
      faces.push({ verts: wverts, normal: inward, material: wmat, objId: w.id, layer: "structure",
                   kind: "wall", doubleSided: true });

      // local axes for accessory placement
      var along = dir;                      // +along the wall
      var up = [0, 1, 0];
      var into = inward;                    // into the room
      (w.accessories || []).forEach(function (a, ai) {
        var meta = ACC_META[a.kind] || ACC_META.socket;
        var fl = a.fromLeft || 0, fb = (a.fromBottom != null ? a.fromBottom : 0);
        var aw = a.width || 100, ah = a.height || 100;
        var vdepth = a.depth || meta.depth;
        var id = a.id || (w.id + "_acc" + ai);
        // corner at (fromLeft, fromBottom) on the inner wall face
        function P(du, dv, dw) {
          return [
            A[0] + along[0] * du + into[0] * dw,
            fb + dv,
            A[2] + along[2] * du + into[2] * dw
          ];
        }
        var vmin, vmax;
        if (a.kind === "floor_drain") {
          // sits on the floor, protrudes into the room by `depth`
          var c0 = P(fl, 0, 0), c1 = P(fl + aw, 0, vdepth);
          vmin = [Math.min(c0[0], c1[0]), 0, Math.min(c0[2], c1[2])];
          vmax = [Math.max(c0[0], c1[0]), Math.max(20, ah || 20), Math.max(c0[2], c1[2])];
        } else {
          var pA = P(fl, 0, 0), pB = P(fl + aw, 0, vdepth);
          vmin = [Math.min(pA[0], pB[0]), fb, Math.min(pA[2], pB[2])];
          vmax = [Math.max(pA[0], pB[0]), fb + ah, Math.max(pA[2], pB[2])];
        }
        var accMatKind = meta.glass ? "SOLID" : "SOLID";
        var accColor = a.color || meta.color;
        var af = boxFaces(vmin, vmax, { kind: "SOLID", base: accColor, accent: accColor, scale: 1 },
                          materials, id, "infra");
        af.forEach(function (f) { faces.push(f); });
        // clash body: possibly deeper than the visual box
        var cd = meta.clashDepth || vdepth;
        var cbox;
        if (a.kind === "floor_drain") cbox = { min: vmin, max: vmax };
        else {
          var qA = P(fl, 0, 0), qB = P(fl + aw, 0, cd);
          cbox = { min: [Math.min(qA[0], qB[0]), fb, Math.min(qA[2], qB[2])],
                   max: [Math.max(qA[0], qB[0]), fb + ah, Math.max(qA[2], qB[2])] };
        }
        objects.push({ id: id, category: "accessory", kind: a.kind, layer: "infra",
                       clashClass: meta.clash, he: meta.he, label: a.label || meta.he,
                       box: cbox, visBox: { min: vmin, max: vmax }, wallLen: wlen });
      });
    });

    // ---- cabinets (base / wall / tall) with kickboard + carcass ----
    (room.cabinets || []).forEach(function (cab, ci) {
      var id = cab.id || ("cab" + ci);
      var x = cab.x || 0, z = cab.z || 0;
      var w = cab.width || 600, dp = cab.depth || 600;
      var hFrom = cab.heightFrom != null ? cab.heightFrom : 0;
      var hTo = cab.heightTo != null ? cab.heightTo : 900;
      var isBase = (cab.type === "base") || (hFrom < 50 && hTo <= 1100 && cab.type !== "wall" && cab.type !== "tall");
      var front = cab.front || "WOOD";
      var carcass = cab.carcass || "SOLID";
      var frontRef = resolveMat(front, materials), carcassRef = resolveMat(carcass, materials);
      var min = [x, hFrom, z], max = [x + w, hTo, z + dp];
      var hasKick = cab.kickboard !== false && isBase && hFrom < 50;

      var bodyMin = min.slice(), bodyMax = max.slice();
      if (hasKick) {
        // main carcass starts above the kick; front face = doors material
        bodyMin[1] = KICK_H;
        var mats = { px: carcassRef, nx: carcassRef, py: carcassRef, ny: carcassRef,
                     pz: frontRef, nz: carcassRef };
        boxFaces(bodyMin, bodyMax, mats, materials, id, "design").forEach(function (f) { faces.push(f); });
        // toe-kick: inset on the +Z (front) side, darker matte band
        var kickMin = [x, 0, z], kickMax = [x + w, KICK_H, z + dp - KICK_INSET];
        var kickCol = { kind: "SOLID", base: "#2b2b2e", accent: "#1c1c1f", scale: 1 };
        boxFaces(kickMin, kickMax, kickCol, materials, id + "_kick", "design").forEach(function (f) { faces.push(f); });
      } else {
        var mats2 = { px: carcassRef, nx: carcassRef, py: carcassRef, ny: carcassRef,
                      pz: frontRef, nz: carcassRef };
        boxFaces(min, max, mats2, materials, id, "design").forEach(function (f) { faces.push(f); });
      }
      objects.push({ id: id, category: "cabinet", type: cab.type || (isBase ? "base" : "wall"),
                     layer: "design", label: cab.label || ("ארון " + w + "מ״מ"),
                     dims: { W: w, D: dp, H: hTo - hFrom }, isBase: isBase,
                     box: { min: min, max: max },
                     footprint: { min: min, max: max } });
    });

    // ---- countertops ----
    (room.counters || []).forEach(function (ct, ti) {
      var id = ct.id || ("counter" + ti);
      var mat = resolveMat(ct.material || "MARBLE_VEIN", materials);
      var th = ct.thickness || 40;
      var over = ct.overhang != null ? ct.overhang : 20;
      var box;
      if (ct.overCabinets && ct.overCabinets.length) {
        var mnx = Infinity, mnz = Infinity, mxx = -Infinity, mxz = -Infinity;
        ct.overCabinets.forEach(function (cid) {
          var ob = objects.filter(function (o) { return o.id === cid; })[0];
          if (ob) {
            mnx = Math.min(mnx, ob.box.min[0]); mnz = Math.min(mnz, ob.box.min[2]);
            mxx = Math.max(mxx, ob.box.max[0]); mxz = Math.max(mxz, ob.box.max[2]);
          }
        });
        var top = ct.height != null ? ct.height : 920;
        box = { min: [mnx, top, mnz - over], max: [mxx, top + th, mxz + over] };
      } else {
        var top2 = ct.height != null ? ct.height : 920;
        box = { min: [ct.x, top2, ct.z], max: [ct.x + (ct.width || 600), top2 + th, ct.z + (ct.depth || 600)] };
      }
      boxFaces(box.min, box.max, mat, materials, id, "design").forEach(function (f) { faces.push(f); });
      objects.push({ id: id, category: "counter", layer: "design", label: ct.label || "משטח עבודה",
                     dims: { W: box.max[0] - box.min[0], D: box.max[2] - box.min[2], H: th },
                     box: box });
    });

    // ---- products / accessories placed as free boxes (sinks, hoods...) ----
    (room.products || []).forEach(function (p, pi) {
      var id = p.id || ("prod" + pi);
      var mat = productMaterial(p, materials);
      var box = { min: [p.x, p.heightFrom || 0, p.z],
                  max: [p.x + (p.width || 400), p.heightTo || 200, p.z + (p.depth || 400)] };
      boxFaces(box.min, box.max, mat, materials, id, "design").forEach(function (f) { faces.push(f); });
      objects.push({ id: id, category: "product", layer: "design", label: p.label || "מוצר",
                     dims: { W: box.max[0] - box.min[0], D: box.max[2] - box.min[2], H: box.max[1] - box.min[1] },
                     box: box });
    });

    // ---- bounds / center ----
    var lo = [Infinity, 0, Infinity], hi = [-Infinity, roomHeight, -Infinity];
    faces.forEach(function (f) {
      f.verts.forEach(function (v) {
        lo[0] = Math.min(lo[0], v.pos[0]); lo[2] = Math.min(lo[2], v.pos[2]);
        hi[0] = Math.max(hi[0], v.pos[0]); hi[2] = Math.max(hi[2], v.pos[2]);
      });
    });
    if (!isFinite(lo[0])) { lo = [0, 0, 0]; hi = [1000, roomHeight, 1000]; }
    var center = [(lo[0] + hi[0]) / 2, roomHeight / 2, (lo[2] + hi[2]) / 2];
    var radius = Math.max(hi[0] - lo[0], hi[2] - lo[2], roomHeight);

    return {
      faces: faces, objects: objects, walls: walls, roomBounds: roomBounds,
      bounds: { min: lo, max: hi }, center: center, radius: radius, roomHeight: roomHeight
    };
  }

  /* ------------------------------------------------------------------ *
   * 6. Clash / fit detection.  Returns [{cabinetId, accId, kind, reason}]
   *    Rule summary (see VIZ_ENGINE.md):
   *      - hard infra (pipe/gas/electric/window/door/ceiling drop) whose
   *        clash-body intersects a cabinet BODY  -> clash.
   *      - floor_drain whose footprint overlaps a BASE cabinet footprint -> clash.
   *      - cabinet plan box extending beyond the room outline -> "doesn't fit".
   *      - neutral infra (socket/switch) never clashes (expected behind cabinets).
   * ------------------------------------------------------------------ */
  function detectClashes(scene) {
    var clashes = [];
    var cabinets = scene.objects.filter(function (o) { return o.category === "cabinet"; });
    var accs = scene.objects.filter(function (o) { return o.category === "accessory"; });
    var rb = scene.roomBounds;

    cabinets.forEach(function (cab) {
      // (a) fit against room outline
      if (rb && isFinite(rb.minX)) {
        var m = 2; // mm tolerance
        if (cab.box.min[0] < rb.minX - m || cab.box.max[0] > rb.maxX + m ||
            cab.box.min[2] < rb.minZ - m || cab.box.max[2] > rb.maxZ + m) {
          clashes.push({ cabinetId: cab.id, accId: null, kind: "fit",
                         reason: "הארון חורג משטח החדר (לא נכנס)" });
        }
      }
      // (b) infra
      accs.forEach(function (a) {
        if (a.clashClass === "neutral") return;
        if (a.clashClass === "floor") {
          if (cab.isBase && footprintOverlap(cab.footprint, a.box)) {
            clashes.push({ cabinetId: cab.id, accId: a.id, kind: a.kind,
                           reason: "ארון בסיס מעל " + a.he + " (חוסם גישה)" });
          }
          return;
        }
        // hard
        if (aabbOverlap(cab.box, a.box, 1)) {
          // window/door only matter for cabinets that reach them; AABB already checks
          clashes.push({ cabinetId: cab.id, accId: a.id, kind: a.kind,
                         reason: a.he + " חוצה את גוף הארון" });
        }
      });
    });
    return clashes;
  }

  /* ------------------------------------------------------------------ *
   * 7. Triangulation helper (fan) shared by both renderers.
   * ------------------------------------------------------------------ */
  function fanTris(verts) {
    var tris = [];
    for (var i = 1; i < verts.length - 1; i++) tris.push([verts[0], verts[i], verts[i + 1]]);
    return tris;
  }

  /* ------------------------------------------------------------------ *
   * 8. Viewer  (browser only).  WebGL when available, else Canvas 2.5D.
   * ------------------------------------------------------------------ */
  function createViewer(canvas, room, options) {
    options = options || {};
    var scene = buildScene(room);
    var clashes = detectClashes(scene);

    // objectId -> clash flag
    var clashObjs = {};
    clashes.forEach(function (c) {
      if (c.cabinetId) clashObjs[c.cabinetId] = true;
      if (c.accId) clashObjs[c.accId] = true;
    });

    // camera state (orbit). Default: interior 3/4 view from the room side so
    // cabinet fronts (which face +Z into the room) face the camera.
    var cam = {
      theta: options.theta != null ? options.theta : 1.02,
      phi: options.phi != null ? options.phi : 0.5,
      radius: options.radius != null ? options.radius : scene.radius * 1.35,
      target: options.target || [scene.center[0], scene.roomHeight * 0.34, scene.center[2]],
      minR: scene.radius * 0.35, maxR: scene.radius * 5
    };
    var layers = { design: true, infra: true, structure: true };
    var hiddenWalls = {};                 // wallId -> true (manual hide)
    var autoHide = options.autoHide !== false; // hide walls facing the camera (cutaway); default on

    // texture cache (canvas per material key)
    var texCache = {};
    function texFor(mat) {
      var key = matKey(mat);
      if (!texCache[key]) texCache[key] = makeTexture(mat.kind, mat);
      return texCache[key];
    }

    var gl = null;
    if (!options.forceCanvas) {
      // NB: probing getContext("webgl") binds a context to the canvas, after
      // which getContext("2d") returns null. So skip the probe entirely when
      // the 2.5D fallback is forced.
      try {
        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      } catch (e) { gl = null; }
    }

    var renderer = gl ? new GLRenderer(gl, canvas, scene, texFor, clashObjs)
                      : new Canvas25(canvas, scene, texFor, clashObjs);

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      renderer.viewport();
    }

    function camMatrices() {
      var aspect = canvas.width / Math.max(1, canvas.height);
      var eye = [
        cam.target[0] + cam.radius * Math.cos(cam.phi) * Math.cos(cam.theta),
        cam.target[1] + cam.radius * Math.sin(cam.phi),
        cam.target[2] + cam.radius * Math.cos(cam.phi) * Math.sin(cam.theta)
      ];
      var view = M4.lookAt(eye, cam.target, [0, 1, 0]);
      var proj = M4.perspective(50 * Math.PI / 180, aspect, scene.radius * 0.02, scene.radius * 12);
      return { view: view, proj: proj, eye: eye, vp: M4.mul(proj, view) };
    }

    // precompute wall face centroids + normals for auto-hide
    var wallInfo = scene.faces.filter(function (f) { return f.kind === "wall"; }).map(function (f) {
      var c = [0, 0, 0];
      f.verts.forEach(function (v) { c[0] += v.pos[0]; c[1] += v.pos[1]; c[2] += v.pos[2]; });
      var n = f.verts.length;
      return { id: f.objId, cen: [c[0] / n, c[1] / n, c[2] / n], normal: f.normal };
    });

    var hovered = null;
    function computeHidden(eye) {
      var hidden = {};
      for (var k in hiddenWalls) if (hiddenWalls[k]) hidden[k] = true;
      if (autoHide) {
        wallInfo.forEach(function (w) {
          // near/occluding wall: its inward normal points away from the camera
          if (dot3(w.normal, sub3(eye, w.cen)) < 0) hidden[w.id] = true;
        });
      }
      return hidden;
    }
    function render() {
      var mats = camMatrices();
      renderer.draw(mats, layers, computeHidden(mats.eye));
    }

    // ---------------- interaction ----------------
    var dragging = false, lastX = 0, lastY = 0, pinchD = 0;
    function onDown(x, y) { dragging = true; lastX = x; lastY = y; }
    function onMove(x, y) {
      if (dragging) {
        cam.theta += (x - lastX) * 0.01;
        cam.phi = clamp(cam.phi + (y - lastY) * 0.01, -0.2, 1.45);
        lastX = x; lastY = y; render();
      } else {
        var mats = camMatrices();
        var hit = pick(x, y, mats);
        var newH = hit ? hit.id : null;
        if (newH !== hovered) { hovered = newH; render(); }
        if (options.onHover) options.onHover(hit, clashes);
      }
    }
    function onUp() { dragging = false; }
    function onWheel(dy) {
      cam.radius = clamp(cam.radius * (dy > 0 ? 1.1 : 0.9), cam.minR, cam.maxR); render();
    }

    // CPU ray pick vs object AABBs
    function pick(sx, sy, mats) {
      var rect = canvas.getBoundingClientRect();
      var ndcX = ((sx - rect.left) / rect.width) * 2 - 1;
      var ndcY = 1 - ((sy - rect.top) / rect.height) * 2;
      var inv = M4.invert(mats.vp);
      var pNear = M4.apply(inv, [ndcX, ndcY, -1]);
      var pFar = M4.apply(inv, [ndcX, ndcY, 1]);
      for (var k = 0; k < 3; k++) { pNear[k] /= pNear[3]; pFar[k] /= pFar[3]; }
      var ro = [pNear[0], pNear[1], pNear[2]];
      var rd = norm3([pFar[0] - pNear[0], pFar[1] - pNear[1], pFar[2] - pNear[2]]);
      var best = null, bestT = Infinity;
      scene.objects.forEach(function (o) {
        if (!layers[o.layer]) return;
        if (o.category === "product" && !layers.design) return;
        var t = rayAABB(ro, rd, o.box);
        if (t != null && t < bestT) { bestT = t; best = o; }
      });
      return best;
    }

    canvas.addEventListener("mousedown", function (e) { onDown(e.clientX, e.clientY); });
    window.addEventListener("mousemove", function (e) { onMove(e.clientX, e.clientY); });
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", function (e) { e.preventDefault(); onWheel(e.deltaY); }, { passive: false });
    canvas.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) pinchD = touchDist(e);
    }, { passive: true });
    canvas.addEventListener("touchmove", function (e) {
      if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) {
        var d = touchDist(e);
        if (pinchD) cam.radius = clamp(cam.radius * (pinchD / d), cam.minR, cam.maxR);
        pinchD = d; render();
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("touchend", onUp);

    function touchDist(e) {
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    resize();
    window.addEventListener("resize", function () { resize(); render(); });
    render();

    return {
      render: render, resize: resize, scene: scene, clashes: clashes,
      setLayer: function (name, on) { layers[name] = on; render(); },
      getLayers: function () { return layers; },
      walls: scene.walls,
      setWallHidden: function (id, on) { hiddenWalls[id] = on; render(); },
      setAutoHide: function (on) { autoHide = on; render(); },
      getAutoHide: function () { return autoHide; },
      backend: gl ? "webgl" : "canvas2.5d",
      camera: cam
    };
  }

  function rayAABB(ro, rd, box) {
    var tmin = -Infinity, tmax = Infinity;
    for (var i = 0; i < 3; i++) {
      var invd = 1 / (rd[i] || 1e-9);
      var t1 = (box.min[i] - ro[i]) * invd, t2 = (box.max[i] - ro[i]) * invd;
      if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    }
    if (tmax >= Math.max(tmin, 0)) return tmin > 0 ? tmin : tmax;
    return null;
  }

  /* ------------------------------------------------------------------ *
   * 8a. WebGL renderer (compact, batched by material).
   * ------------------------------------------------------------------ */
  function GLRenderer(gl, canvas, scene, texFor, clashObjs) {
    this.gl = gl; this.canvas = canvas; this.scene = scene;
    this.texFor = texFor; this.clashObjs = clashObjs;
    var vs =
      "attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUV; attribute vec3 aTint;" +
      "uniform mat4 uVP; varying vec2 vUV; varying vec3 vN; varying vec3 vTint; varying vec3 vW;" +
      "void main(){ vUV=aUV; vN=aNorm; vTint=aTint; vW=aPos; gl_Position=uVP*vec4(aPos,1.0); }";
    var fs =
      "precision mediump float; varying vec2 vUV; varying vec3 vN; varying vec3 vTint; varying vec3 vW;" +
      "uniform sampler2D uTex; uniform vec3 uEye;" +
      "void main(){ vec3 N=normalize(vN); vec3 L=normalize(vec3(0.45,0.8,0.35));" +
      " float d=max(dot(N,L),0.0);" +                                   // key light (Lambert)
      " float top=0.18*max(N.y,0.0);" +                                 // subtle sky/top light
      " float fill=0.16*max(dot(N,vec3(-0.35,0.15,-0.6)),0.0);" +       // cool fill from opposite
      " float amb=0.44;" +
      " float lit=amb+0.6*d+top+fill;" +
      // fake contact AO: darken vertical faces near the floor (y in mm)
      " float ao=1.0-0.34*exp(-vW.y/90.0)*(1.0-max(N.y,0.0));" +
      // gentle rim/edge darkening at grazing view angles for solidity
      " vec3 V=normalize(uEye-vW); float rim=pow(1.0-max(dot(N,V),0.0),3.0);" +
      " lit=clamp(lit*ao*(1.0-0.18*rim),0.0,1.2);" +
      " vec4 t=texture2D(uTex,vUV); gl_FragColor=vec4(t.rgb*lit*vTint,1.0); }";
    this.prog = makeProgram(gl, vs, fs);
    gl.useProgram(this.prog);
    this.loc = {
      aPos: gl.getAttribLocation(this.prog, "aPos"),
      aNorm: gl.getAttribLocation(this.prog, "aNorm"),
      aUV: gl.getAttribLocation(this.prog, "aUV"),
      aTint: gl.getAttribLocation(this.prog, "aTint"),
      uVP: gl.getUniformLocation(this.prog, "uVP"),
      uTex: gl.getUniformLocation(this.prog, "uTex"),
      uEye: gl.getUniformLocation(this.prog, "uEye")
    };
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);      // hide inner faces / near walls (cutaway effect)
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0.90, 0.91, 0.93, 1);
    this._build();
  }
  GLRenderer.prototype._build = function () {
    var gl = this.gl, self = this;
    // group faces by material key + layer, keep objId per-vertex for tint & hover
    var groups = {};
    this.scene.faces.forEach(function (f) {
      var key = matKey(f.material);
      if (!groups[key]) groups[key] = { mat: f.material, layer: {}, verts: [], objIds: [] };
      var tris = fanTris(f.verts);
      var tint = self.clashObjs[f.objId] || self.clashObjs[(f.objId || "").replace("_kick", "")] ? [1.5, 0.5, 0.5] : [1, 1, 1];
      tris.forEach(function (tri) {
        tri.forEach(function (v) {
          groups[key].verts.push({ pos: v.pos, norm: f.normal, uv: v.uv, tint: tint, objId: f.objId, layer: f.layer });
        });
      });
      // double-sided faces (walls): emit reversed winding with flipped normal
      if (f.doubleSided) {
        tris.forEach(function (tri) {
          [tri[0], tri[2], tri[1]].forEach(function (v) {
            groups[key].verts.push({ pos: v.pos, norm: [-f.normal[0], -f.normal[1], -f.normal[2]],
                                     uv: v.uv, tint: tint, objId: f.objId, layer: f.layer });
          });
        });
      }
    });
    this.groups = [];
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      var arr = new Float32Array(g.verts.length * 11);
      var meta = [];
      g.verts.forEach(function (v, i) {
        var o = i * 11;
        arr[o] = v.pos[0]; arr[o + 1] = v.pos[1]; arr[o + 2] = v.pos[2];
        arr[o + 3] = v.norm[0]; arr[o + 4] = v.norm[1]; arr[o + 5] = v.norm[2];
        arr[o + 6] = v.uv[0]; arr[o + 7] = v.uv[1];
        arr[o + 8] = v.tint[0]; arr[o + 9] = v.tint[1]; arr[o + 10] = v.tint[2];
        meta.push({ objId: v.objId, layer: v.layer });
      });
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      var tex = makeGLTexture(gl, self.texFor(g.mat));
      // per-vertex layer + objId for filtering / per-wall hide
      self.groups.push({ buf: buf, count: g.verts.length, tex: tex, mat: g.mat, meta: meta,
                         layerOf: g.verts.map(function (v) { return v.layer; }),
                         objOf: g.verts.map(function (v) { return v.objId; }) });
    });
  };
  GLRenderer.prototype.viewport = function () { this.gl.viewport(0, 0, this.canvas.width, this.canvas.height); };
  GLRenderer.prototype.draw = function (mats, layers, hidden) {
    hidden = hidden || {};
    var gl = this.gl, L = this.loc;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(L.uVP, false, new Float32Array(mats.vp));
    gl.uniform3fv(L.uEye, new Float32Array(mats.eye));
    var STRIDE = 11 * 4;
    this.groups.forEach(function (g) {
      gl.bindBuffer(gl.ARRAY_BUFFER, g.buf);
      gl.enableVertexAttribArray(L.aPos); gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(L.aNorm); gl.vertexAttribPointer(L.aNorm, 3, gl.FLOAT, false, STRIDE, 12);
      gl.enableVertexAttribArray(L.aUV); gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, STRIDE, 24);
      gl.enableVertexAttribArray(L.aTint); gl.vertexAttribPointer(L.aTint, 3, gl.FLOAT, false, STRIDE, 32);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.tex);
      gl.uniform1i(L.uTex, 0);
      // draw contiguous runs sharing (layer, objId); skip disabled layers / hidden objects
      var i = 0;
      while (i < g.count) {
        var lay = g.layerOf[i], oid = g.objOf[i];
        var j = i;
        while (j < g.count && g.layerOf[j] === lay && g.objOf[j] === oid) j++;
        if (layers[lay] && !hidden[oid]) gl.drawArrays(gl.TRIANGLES, i, j - i);
        i = j;
      }
    });
  };
  function makeProgram(gl, vsrc, fsrc) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function makeGLTexture(gl, srcCanvas) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }

  /* ------------------------------------------------------------------ *
   * 8b. Canvas 2.5D painter's-algorithm fallback.
   * ------------------------------------------------------------------ */
  function Canvas25(canvas, scene, texFor, clashObjs) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.scene = scene; this.texFor = texFor; this.clashObjs = clashObjs;
    this.patternCache = {};
  }
  Canvas25.prototype.viewport = function () {};
  Canvas25.prototype.pattern = function (mat) {
    var key = matKey(mat);
    if (!this.patternCache[key]) this.patternCache[key] = this.ctx.createPattern(this.texFor(mat), "repeat");
    return this.patternCache[key];
  };
  Canvas25.prototype.draw = function (mats, layers, hidden) {
    hidden = hidden || {};
    var ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, self = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // sky/ground gradient backdrop
    var grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#e9ebef"); grd.addColorStop(1, "#cfd2d8");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    var L = [0.45, 0.8, 0.35], Llen = Math.hypot(L[0], L[1], L[2]);
    L = [L[0] / Llen, L[1] / Llen, L[2] / Llen];
    var polys = [];
    this.scene.faces.forEach(function (f) {
      if (!layers[f.layer]) return;
      if (hidden[f.objId]) return;
      var cen = [0, 0, 0];
      for (var ci = 0; ci < f.verts.length; ci++) {
        cen[0] += f.verts[ci].pos[0]; cen[1] += f.verts[ci].pos[1]; cen[2] += f.verts[ci].pos[2];
      }
      cen = [cen[0] / f.verts.length, cen[1] / f.verts.length, cen[2] / f.verts.length];
      // backface cull for solid boxes; walls are double-sided (visibility via hidden set)
      var faceCam = dot3(f.normal, sub3(mats.eye, cen));
      if (!f.doubleSided && faceCam <= 0) return;
      var scr = [], sumZ = 0, ok = true;
      for (var i = 0; i < f.verts.length; i++) {
        var c = M4.apply(mats.vp, f.verts[i].pos);
        if (c[3] <= 0.0001) { ok = false; break; }
        scr.push([(c[0] / c[3] * 0.5 + 0.5) * W, (1 - (c[1] / c[3] * 0.5 + 0.5)) * H, c[2] / c[3]]);
        sumZ += c[2] / c[3];
      }
      if (!ok) return;
      // Lambert + ambient + top light; two-sided for walls.
      var nd = dot3(f.normal, L); if (f.doubleSided) nd = Math.abs(nd);
      var top = 0.18 * Math.max(f.normal[1], 0);
      var shade = 0.44 + 0.6 * Math.max(nd, 0) + top;
      // fake contact AO near floor on vertical faces
      var ao = 1 - 0.34 * Math.exp(-cen[1] / 90) * (1 - Math.max(f.normal[1], 0));
      shade = clamp(shade * ao, 0, 1.18);
      polys.push({ scr: scr, z: sumZ / f.verts.length, mat: f.material, shade: shade,
                   objId: f.objId, verts: f.verts });
    });
    polys.sort(function (a, b) { return b.z - a.z; }); // far first

    polys.forEach(function (p) {
      ctx.beginPath();
      ctx.moveTo(p.scr[0][0], p.scr[0][1]);
      for (var i = 1; i < p.scr.length; i++) ctx.lineTo(p.scr[i][0], p.scr[i][1]);
      ctx.closePath();
      ctx.save(); ctx.clip();
      // affine-map the texture parallelogram (p0->uv0, following the first 3 verts)
      var t = self.texFor(p.mat);
      var pat = self.pattern(p.mat);
      if (pat && p.verts.length >= 3) {
        // map UV(0..1 * tile repeats) using verts[0..2] as basis
        var A = p.scr[0], B = p.scr[1], C = p.scr[p.scr.length - 1];
        var uv0 = p.verts[0].uv, uv1 = p.verts[1].uv, uv2 = p.verts[p.verts.length - 1].uv;
        var du = [uv1[0] - uv0[0], uv1[1] - uv0[1]];
        var dv = [uv2[0] - uv0[0], uv2[1] - uv0[1]];
        var sx = [B[0] - A[0], B[1] - A[1]];
        var sy = [C[0] - A[0], C[1] - A[1]];
        var det = du[0] * dv[1] - du[1] * dv[0];
        if (Math.abs(det) > 1e-6) {
          var ts = t.width;
          // screen = A + sx*(u-u0)/? build matrix so texture(px) tiles by tile size
          var m00 = (sx[0] * dv[1] - sy[0] * du[1]) / det / ts;
          var m10 = (sx[1] * dv[1] - sy[1] * du[1]) / det / ts;
          var m01 = (-sx[0] * dv[0] + sy[0] * du[0]) / det / ts;
          var m11 = (-sx[1] * dv[0] + sy[1] * du[0]) / det / ts;
          var e = A[0] - (m00 * uv0[0] * ts + m01 * uv0[1] * ts);
          var fF = A[1] - (m10 * uv0[0] * ts + m11 * uv0[1] * ts);
          ctx.setTransform(m00, m10, m01, m11, e, fF);
          ctx.fillStyle = pat; ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else { ctx.fillStyle = "#ccc"; ctx.fill(); }
      }
      // lighting overlay (multiply-ish via translucent black/white)
      if (p.shade < 1) { ctx.fillStyle = "rgba(0,0,0," + (1 - p.shade) * 0.55 + ")"; ctx.fill(); }
      else if (p.shade > 1) { ctx.fillStyle = "rgba(255,255,255," + (p.shade - 1) * 0.5 + ")"; ctx.fill(); }
      // clash tint (red wash)
      var oid = (p.objId || "").replace("_kick", "");
      if (self.clashObjs[p.objId] || self.clashObjs[oid]) {
        ctx.fillStyle = "rgba(220,40,40,0.42)"; ctx.fill();
      }
      ctx.restore();
      // subtle edge
      ctx.strokeStyle = "rgba(20,20,25,0.18)"; ctx.lineWidth = 1; ctx.stroke();
    });
  };

  /* ------------------------------------------------------------------ *
   * 9. Public API
   * ------------------------------------------------------------------ */
  return {
    TEXTURE_KINDS: TEXTURE_KINDS,
    KIND_HE: KIND_HE,
    KIND_DEFAULTS: KIND_DEFAULTS,
    ACC_META: ACC_META,
    COLOR_BY_TYPE: COLOR_BY_TYPE,
    // pure / testable
    noise: { hash2: hash2, vnoise: vnoise, fbm: fbm },
    M4: M4,
    buildScene: buildScene,
    detectClashes: detectClashes,
    resolveMat: resolveMat,
    // browser
    makeTexture: makeTexture,
    createViewer: createViewer,
    KICK_H: KICK_H, KICK_INSET: KICK_INSET
  };
});
