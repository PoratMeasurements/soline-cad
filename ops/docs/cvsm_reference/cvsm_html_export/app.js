/* [HTML EXPORT 2026-08-18] Interactive room-measurement report - client app.
 *
 * Adapted from the owner's desktop kitchen app's interactive export
 * (kitchen_app/templates/interactive_export/app.js): same architecture
 * (data blob -> SVG DOM with click handlers, viewBox pan/zoom, constant-
 * pixel text, chain-dimension layout), extended with:
 *   - a real orbitable 3D preview (vanilla canvas painter's-algorithm
 *     renderer - the desktop export ships a static image instead),
 *   - schedule tables (cabinets + accessories per room),
 *   - CAD overlays (solved dimension lines, free lines, elevation lines,
 *     text notes, library symbols rendered from serialized primitives),
 *   - sloped/vaulted wall tops, door swings, height-band readings,
 *   - single-language labels baked at export time (DATA.project.labels).
 *
 * Constraints (identical to the desktop export):
 *   - Classic script. No ES modules, no fetch(), no external libraries -
 *     must work when the .html is double-clicked off disk (file://) in
 *     Chrome AND opened in a tablet browser.
 *   - window.ROOM_EXPORT_DATA is the ONLY input. All geometry mm.
 */
(function () {
  "use strict";

  var DATA = window.ROOM_EXPORT_DATA || { project: {}, rooms: [] };
  var SVG_NS = "http://www.w3.org/2000/svg";
  var SETTINGS = (DATA.project && DATA.project.settings) || {};
  var TIERS = SETTINGS.tiers || {};
  // [VIEW SETTINGS 2026-08-18] Per-view tier styles: "tiers" is the PLAN view's (historical
  // key, drives the plan drawing), "tiers_elevation" the ELEVATION view's (drives the
  // elevation drawing). Blobs from before the split have no tiers_elevation - fall back to
  // the shared style, exactly the old behaviour.
  var TIERS_ELEV = SETTINGS.tiers_elevation || TIERS;

  function t(key) {
    var labels = (DATA.project && DATA.project.labels) || {};
    return labels[key] || key;
  }

  var CATEGORY_COLORS = {
    Electrical: "#e0b354", Plumbing: "#5aa9c9", Openings: "#b0aee0",
    Appliances: "#8fbf7f", Structure: "#9fb0a4", Other: "#b0bec5"
  };
  function categoryColor(cat) { return CATEGORY_COLORS[cat] || "#b0bec5"; }

  // ------------------------------------------------------------------ //
  // State + routing
  // ------------------------------------------------------------------ //
  var state = {
    view: "welcome", roomId: null, wallId: null,
    hideCabinets: false, hideOpenings: false, hiddenAccNames: {},
    hideNotes: false, hideSymbols: false,
    layersOpen: false
  };

  function getRoom(id) {
    for (var i = 0; i < DATA.rooms.length; i++) if (DATA.rooms[i].id === id) return DATA.rooms[i];
    return null;
  }
  function getWall(room, id) {
    for (var i = 0; i < room.walls.length; i++) if (room.walls[i].id === id) return room.walls[i];
    return null;
  }
  function goWelcome() { state.view = "welcome"; state.roomId = null; state.wallId = null; render(); }
  function goRoom(id) { state.view = "room"; state.roomId = id; state.wallId = null; render(); }
  function goElevation(roomId, wallId) { state.view = "elevation"; state.roomId = roomId; state.wallId = wallId; render(); }

  // ------------------------------------------------------------------ //
  // DOM helpers
  // ------------------------------------------------------------------ //
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") e.textContent = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function fmt(n) { return Math.round(n).toString(); }
  function polyPoints(pts) { return pts.map(function (p) { return p[0] + "," + p[1]; }).join(" "); }

  // ------------------------------------------------------------------ //
  // Constant-pixel text (see desktop export - SVG font-size lives in the
  // viewBox mm space and shrinks with the drawing; counter-scale it from
  // the real screen CTM after layout and after every pan/zoom).
  // ------------------------------------------------------------------ //
  var TEXT_SCALE_TARGETS = [
    [".dim-group text", 11], [".cad-dim text", 11], [".label-text", 11],
    [".acc-shape text", 9], [".text-note-label", 10], [".height-band text", 9],
    [".corner-angle text", 10], [".cad-symbol text.sym-label", 9]
  ];
  function applyConstantTextSize(svgEl) {
    if (!svgEl || !svgEl.isConnected) return;
    var ctm = svgEl.getScreenCTM ? svgEl.getScreenCTM() : null;
    var scale = ctm ? (Math.abs(ctm.a) || Math.abs(ctm.d)) : 0;
    if (!scale) return;
    TEXT_SCALE_TARGETS.forEach(function (entry) {
      svgEl.querySelectorAll(entry[0]).forEach(function (node) {
        node.style.fontSize = (entry[1] / scale) + "px";
      });
    });
  }
  function scheduleTextScaleFix() {
    requestAnimationFrame(function () {
      document.querySelectorAll("svg.plan-svg, svg.elev-svg").forEach(applyConstantTextSize);
    });
  }

  // ------------------------------------------------------------------ //
  // Pan/zoom (verbatim port of the desktop export's makePannable).
  // ------------------------------------------------------------------ //
  function makePannable(svgEl) {
    var parts = (svgEl.getAttribute("viewBox") || "0 0 100 100").split(/\s+/).map(Number);
    var home = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    var view = { x: home.x, y: home.y, w: home.w, h: home.h };
    var MAX_ZOOM_IN = 10;
    var DRAG_THRESHOLD_PX = 8;

    function apply() {
      svgEl.setAttribute("viewBox", view.x + " " + view.y + " " + view.w + " " + view.h);
      applyConstantTextSize(svgEl);
    }
    function clampSize(w, h) {
      var minW = home.w / MAX_ZOOM_IN;
      if (w < minW) { h = h * (minW / w); w = minW; }
      if (w > home.w) { h = h * (home.w / w); w = home.w; }
      return [w, h];
    }
    function zoomAt(factor, clientX, clientY) {
      var rect = svgEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var mx = (clientX - rect.left) / rect.width, my = (clientY - rect.top) / rect.height;
      var pointX = view.x + mx * view.w, pointY = view.y + my * view.h;
      var sized = clampSize(view.w * factor, view.h * factor);
      view.w = sized[0]; view.h = sized[1];
      view.x = pointX - mx * view.w;
      view.y = pointY - my * view.h;
      apply();
    }
    function panBy(dxPx, dyPx, baseX, baseY) {
      var rect = svgEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      view.x = baseX - dxPx * (view.w / rect.width);
      view.y = baseY - dyPx * (view.h / rect.height);
      apply();
    }
    function resetView() { view.x = home.x; view.y = home.y; view.w = home.w; view.h = home.h; apply(); }
    function touchDist(touches) {
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }

    var suppressClick = false;
    svgEl.addEventListener("click", function (e) {
      if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
    }, true);
    svgEl.addEventListener("dblclick", resetView);
    svgEl.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomAt(Math.pow(1.0015, e.deltaY), e.clientX, e.clientY);
    }, { passive: false });

    var dragging = false, dragMoved = false, startX = 0, startY = 0, baseX = 0, baseY = 0;
    svgEl.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      dragging = true; dragMoved = false;
      startX = e.clientX; startY = e.clientY;
      baseX = view.x; baseY = view.y;
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!dragMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) dragMoved = true;
      if (dragMoved) panBy(dx, dy, baseX, baseY);
    });
    window.addEventListener("mouseup", function () {
      if (dragging && dragMoved) suppressClick = true;
      dragging = false;
    });

    var touchState = null;
    svgEl.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) {
        touchState = { mode: "pan", x: e.touches[0].clientX, y: e.touches[0].clientY, baseX: view.x, baseY: view.y, moved: false };
      } else if (e.touches.length === 2) {
        touchState = {
          mode: "pinch", dist: touchDist(e.touches),
          midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          baseW: view.w, baseH: view.h, baseX: view.x, baseY: view.y
        };
      }
    }, { passive: true });
    svgEl.addEventListener("touchmove", function (e) {
      if (!touchState) return;
      e.preventDefault();
      if (touchState.mode === "pan" && e.touches.length === 1) {
        var dx = e.touches[0].clientX - touchState.x, dy = e.touches[0].clientY - touchState.y;
        if (!touchState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) touchState.moved = true;
        if (touchState.moved) panBy(dx, dy, touchState.baseX, touchState.baseY);
      } else if (touchState.mode === "pinch" && e.touches.length === 2) {
        var rect = svgEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var newDist = touchDist(e.touches) || 1;
        var factor = touchState.dist / newDist;
        var mx = (touchState.midX - rect.left) / rect.width;
        var my = (touchState.midY - rect.top) / rect.height;
        var pointX = touchState.baseX + mx * touchState.baseW;
        var pointY = touchState.baseY + my * touchState.baseH;
        var sized = clampSize(touchState.baseW * factor, touchState.baseH * factor);
        view.w = sized[0]; view.h = sized[1];
        view.x = pointX - mx * view.w;
        view.y = pointY - my * view.h;
        apply();
      }
    }, { passive: false });
    svgEl.addEventListener("touchend", function (e) {
      if (touchState && touchState.mode === "pan" && touchState.moved) suppressClick = true;
      if (e.touches.length === 0) touchState = null;
    });
  }

  // ------------------------------------------------------------------ //
  // Root render
  // ------------------------------------------------------------------ //
  function render() {
    var app = document.getElementById("app");
    clear(app);
    document.title = (DATA.project.name || t("appTitle")) + " - " + t("appTitle");
    var view = buildCurrentView();
    if (!view) return;
    app.appendChild(view);
    scheduleTextScaleFix();
  }
  function buildCurrentView() {
    if (state.view === "welcome") return renderWelcome();
    var room = getRoom(state.roomId);
    if (!room) { goWelcome(); return null; }
    if (state.view === "elevation" && state.wallId) {
      var wall = getWall(room, state.wallId);
      if (!wall) { goRoom(room.id); return null; }
      return renderElevationView(room, wall);
    }
    return renderRoomView(room);
  }

  function topbar(titleText, crumbText, backFn) {
    var bar = el("div", { class: "topbar" });
    if (backFn) bar.appendChild(el("button", { class: "ghost", text: "← " + t("back"), onclick: backFn }));
    bar.appendChild(el("div", { class: "title", text: titleText }));
    if (crumbText) bar.appendChild(el("div", { class: "crumb", text: crumbText }));
    return bar;
  }

  // ------------------------------------------------------------------ //
  // Welcome
  // ------------------------------------------------------------------ //
  function fieldGrid(pairs) {
    var grid = el("div", { class: "field-grid" });
    pairs.forEach(function (p) {
      grid.appendChild(el("div", { class: "field" }, [
        el("span", { class: "k", text: p[0] + ":" }),
        el("span", { text: p[1] })
      ]));
    });
    return grid;
  }
  function renderWelcome() {
    var root = el("div", { class: "welcome" });
    var proj = DATA.project || {};
    root.appendChild(el("div", { class: "hero" }, [
      el("h1", { text: proj.name || "" }),
      el("p", { text: proj.description || "" })
    ]));
    var stats = proj.stats || {};
    root.appendChild(el("div", { class: "stat-row" }, [
      statTile(stats.rooms, t("rooms")), statTile(stats.walls, t("walls")),
      statTile(stats.cabinets, t("cabinets")), statTile(stats.accessories, t("accessories"))
    ]));
    if (proj.customer && proj.customer.length) {
      root.appendChild(el("div", { class: "section-title", text: t("customerInfo") }));
      root.appendChild(fieldGrid(proj.customer));
    }
    if (proj.ship_to && proj.ship_to.length) {
      root.appendChild(el("div", { class: "section-title", text: t("shipTo") }));
      root.appendChild(fieldGrid(proj.ship_to));
    }
    root.appendChild(el("div", { class: "section-title", text: t("rooms") }));
    var grid = el("div", { class: "room-grid" });
    DATA.rooms.forEach(function (room) {
      var s = room.stats || {};
      var thumb = el("div", { class: "room-card-thumb" });
      thumb.appendChild(buildPlanSvg(room, { compact: true }));
      grid.appendChild(el("div", { class: "room-card", onclick: function () { goRoom(room.id); } }, [
        thumb,
        el("h3", { text: room.name }),
        el("div", { class: "meta" }, [
          el("span", { text: s.walls + " " + t("walls") }),
          el("span", { text: s.cabinets + " " + t("cabinets") }),
          el("span", { text: s.accessories + " " + t("accessories") })
        ])
      ]));
    });
    root.appendChild(grid);
    if (proj.generated_at) {
      root.appendChild(el("p", { class: "footer-note", text: t("generatedAt") + ": " + proj.generated_at + " — " + t("mmNote") }));
    }
    return root;
  }
  function statTile(n, label) {
    return el("div", { class: "stat-tile" }, [
      el("div", { class: "n", text: (n === undefined || n === null) ? "-" : String(n) }),
      el("div", { class: "l", text: label })
    ]);
  }

  // ------------------------------------------------------------------ //
  // Layers
  // ------------------------------------------------------------------ //
  function distinctAccessoryNames(room) {
    var seen = {}, names = [];
    room.accessories.forEach(function (a) {
      if (a.opening) return; // openings get their own toggle
      if (!seen[a.name]) { seen[a.name] = true; names.push(a.name); }
    });
    names.sort();
    return names;
  }
  function applyLayerVisibility(svgRoot) {
    if (!svgRoot) return;
    svgRoot.querySelectorAll(".cab-shape").forEach(function (n) { n.style.display = state.hideCabinets ? "none" : ""; });
    svgRoot.querySelectorAll(".opening-group").forEach(function (n) { n.style.display = state.hideOpenings ? "none" : ""; });
    svgRoot.querySelectorAll("[data-acc-name]").forEach(function (n) {
      n.style.display = state.hiddenAccNames[n.getAttribute("data-acc-name")] ? "none" : "";
    });
    svgRoot.querySelectorAll(".text-note, .note-leader").forEach(function (n) { n.style.display = state.hideNotes ? "none" : ""; });
    svgRoot.querySelectorAll(".cad-symbol").forEach(function (n) { n.style.display = state.hideSymbols ? "none" : ""; });
  }
  function applyLayerToggle() { render(); }

  function buildLayersControl(room) {
    var wrap = el("div", { class: "layers-control" });
    if (state.layersOpen) wrap.classList.add("open");
    var btn = el("button", { class: "ghost layers-btn", text: "☰ " + t("layers") });
    var panel = el("div", { class: "layers-panel" });

    function toggleRow(label, checked, apply) {
      var cb = el("input", { type: "checkbox" });
      cb.checked = checked;
      cb.addEventListener("change", function () { apply(cb.checked); applyLayerToggle(); });
      panel.appendChild(el("label", { class: "layer-row" }, [cb, el("span", { text: label })]));
    }
    toggleRow(t("cabinets"), !state.hideCabinets, function (v) { state.hideCabinets = !v; });
    toggleRow(t("openings"), !state.hideOpenings, function (v) { state.hideOpenings = !v; });
    if (SETTINGS.show_notes) toggleRow(t("notesLayer"), !state.hideNotes, function (v) { state.hideNotes = !v; });
    if (SETTINGS.show_symbols) toggleRow(t("symbolsLayer"), !state.hideSymbols, function (v) { state.hideSymbols = !v; });
    var names = distinctAccessoryNames(room);
    if (names.length) {
      panel.appendChild(el("div", { class: "layer-sep" }));
      names.forEach(function (name) {
        toggleRow(name, !state.hiddenAccNames[name], function (v) { state.hiddenAccNames[name] = !v; });
      });
    }
    btn.addEventListener("click", function () {
      wrap.classList.toggle("open");
      state.layersOpen = wrap.classList.contains("open");
    });
    wrap.appendChild(btn);
    wrap.appendChild(panel);
    return wrap;
  }

  // ------------------------------------------------------------------ //
  // Tier styling helpers - DimChainStyleManager colors baked at export.
  // [VIEW SETTINGS 2026-08-18] Optional last argument selects the view's tier map
  // (TIERS_ELEV for the elevation drawing); omitted = TIERS (plan), the old behaviour.
  // ------------------------------------------------------------------ //
  function tierEnabled(name, tiers) {
    var tr2 = (tiers || TIERS)[name];
    return !tr2 || tr2.enabled !== false;
  }
  function applyTierStyle(g, name, isTotal, tiers) {
    var tr2 = (tiers || TIERS)[name] || {};
    if (tr2.line) g.querySelectorAll("line").forEach(function (n) { n.style.stroke = tr2.line; });
    var txt = tr2.text || tr2.line;
    if (txt) g.querySelectorAll("text").forEach(function (n) { n.style.fill = txt; });
    if (isTotal) g.classList.add("dim-total");
    return g;
  }

  // ------------------------------------------------------------------ //
  // Generic dimension drawing (any angle) - line + end ticks + label.
  // Coordinates are screen-space (caller already converted elevations).
  // ------------------------------------------------------------------ //
  function dimTick(x, y, horizontal) {
    return horizontal
      ? svg("line", { x1: x, y1: y - 10, x2: x, y2: y + 10 })
      : svg("line", { x1: x - 10, y1: y, x2: x + 10, y2: y });
  }
  function dimLine(x0, y0, x1, y1, label, horizontal, cls) {
    var g = svg("g", cls ? { class: cls } : null);
    g.appendChild(dimTick(x0, y0, horizontal));
    g.appendChild(dimTick(x1, y1, horizontal));
    g.appendChild(svg("line", { x1: x0, y1: y0, x2: x1, y2: y1 }));
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    g.appendChild(svg("text", { x: mx, y: my - (horizontal ? 4 : 0), text: label }));
    return g;
  }
  function freeDimLine(x0, y0, x1, y1, label, cls) {
    var g = svg("g", cls ? { class: cls } : null);
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var TICK = 10;
    g.appendChild(svg("line", { x1: x0 - nx * TICK, y1: y0 - ny * TICK, x2: x0 + nx * TICK, y2: y0 + ny * TICK }));
    g.appendChild(svg("line", { x1: x1 - nx * TICK, y1: y1 - ny * TICK, x2: x1 + nx * TICK, y2: y1 + ny * TICK }));
    g.appendChild(svg("line", { x1: x0, y1: y0, x2: x1, y2: y1 }));
    g.appendChild(svg("text", { x: (x0 + x1) / 2 + nx * 30, y: (y0 + y1) / 2 + ny * 30, text: label }));
    return g;
  }
  function heightDimLine(x, yFloor, yRef, label) {
    var g = svg("g");
    g.appendChild(dimTick(x, yFloor, false));
    g.appendChild(dimTick(x, yRef, false));
    g.appendChild(svg("line", { x1: x, y1: yFloor, x2: x, y2: yRef }));
    g.appendChild(svg("text", { x: x - 16, y: (yFloor + yRef) / 2, style: "text-anchor:end", text: label }));
    return g;
  }

  // ------------------------------------------------------------------ //
  // CAD symbol rendering from serialized primitives (unit box, y-down).
  // ------------------------------------------------------------------ //
  function symbolShapes(key, view) {
    var def = (DATA.symbol_defs || {})[key];
    if (!def) return null;
    return view === "plan" ? def.plan : def.elev;
  }
  function renderSymbol(sym, view, cx, cy, color) {
    // cx/cy already in the target SVG's screen space; sym.w/sym.h mm.
    var g = svg("g", { class: "cad-symbol" });
    var inner = svg("g", { transform: "translate(" + cx + "," + cy + ") rotate(" + (sym.rot || 0) + ")" });
    var w = sym.w, h = sym.h;
    var stroke = color || "#111111";
    var sw = Math.max(3, Math.min(w, h) * 0.025);
    function ux(u) { return (u - 0.5) * w; }
    function uy(v) { return (v - 0.5) * h; }
    var shapes = symbolShapes(sym.key, view);
    if (!shapes) {
      // Unknown key (deleted custom symbol) - labelled placeholder box,
      // same degradation contract as the PDF exporter.
      inner.appendChild(svg("rect", {
        class: "placeholder", x: -w / 2, y: -h / 2, width: w, height: h,
        style: "stroke:" + stroke + ";stroke-width:" + sw
      }));
      inner.appendChild(svg("text", { class: "sym-label", x: 0, y: 0, text: sym.key, style: "fill:" + stroke }));
    } else {
      shapes.forEach(function (p) {
        var st = "stroke:" + stroke + ";stroke-width:" + (sw * (p.wt || 1)) +
          (p.dash ? ";stroke-dasharray:" + (sw * 3) + "," + (sw * 2) : "");
        var node = null;
        if (p.t === "line") {
          node = svg("line", { class: "prim", x1: ux(p.x1), y1: uy(p.y1), x2: ux(p.x2), y2: uy(p.y2), style: st });
        } else if (p.t === "rect") {
          var rw = (p.x1 - p.x0) * w, rh = (p.y1 - p.y0) * h;
          var rad = (p.rad || 0) * Math.min(w, h);
          node = svg("rect", {
            class: "prim" + (p.fill ? " filled" : ""), x: ux(p.x0), y: uy(p.y0),
            width: rw, height: rh, rx: rad,
            style: st + (p.fill ? ";fill:" + stroke : "")
          });
        } else if (p.t === "ellipse") {
          node = svg("ellipse", {
            class: "prim" + (p.fill ? " filled" : ""), cx: ux(p.cx), cy: uy(p.cy),
            rx: p.r * w, ry: p.r * h,
            style: st + (p.fill ? ";fill:" + stroke : "")
          });
        } else if (p.t === "arc") {
          // Sampled polyline - avoids SVG elliptical-arc flag headaches.
          var acx = ux((p.x0 + p.x1) / 2), acy = uy((p.y0 + p.y1) / 2);
          var arx = (p.x1 - p.x0) / 2 * w, ary = (p.y1 - p.y0) / 2 * h;
          var pts = [];
          var steps = 24;
          if (p.center) pts.push(acx + "," + acy);
          for (var i = 0; i <= steps; i++) {
            var a = (p.a0 + p.sweep * i / steps) * Math.PI / 180;
            pts.push((acx + arx * Math.cos(a)) + "," + (acy + ary * Math.sin(a)));
          }
          node = svg(p.center || p.fill ? "polygon" : "polyline", {
            class: "prim" + (p.fill ? " filled" : ""), points: pts.join(" "),
            style: st + (p.fill ? ";fill:" + stroke : "")
          });
        } else if (p.t === "poly") {
          var pp = [];
          for (var j = 0; j + 1 < p.pts.length; j += 2) pp.push(ux(p.pts[j]) + "," + uy(p.pts[j + 1]));
          node = svg(p.closed ? "polygon" : "polyline", {
            class: "prim" + (p.fill ? " filled" : ""), points: pp.join(" "),
            style: st + (p.fill ? ";fill:" + stroke : "")
          });
        } else if (p.t === "label") {
          node = svg("text", {
            x: ux(p.cx), y: uy(p.cy), text: p.text,
            style: "fill:" + stroke + ";font-size:" + (p.hf * h) + "px;text-anchor:middle;dominant-baseline:middle" + (p.bold ? ";font-weight:700" : "")
          });
        }
        if (node) inner.appendChild(node);
      });
    }
    g.appendChild(inner);
    if (sym.label) {
      g.appendChild(svg("text", {
        class: "sym-label", x: cx, y: cy + h / 2 + 60, text: sym.label,
        style: "fill:" + stroke + ";text-anchor:middle"
      }));
    }
    return g;
  }

  // Text note (plan or elevation - caller passes screen coords + a
  // converter for the leader target).
  function renderNote(note, x, y, leaderPt, room) {
    var lines = (note.text || "").split("\n");
    var hm = note.hmm || 150;
    var lineH = hm * 1.35;
    var widest = 0;
    lines.forEach(function (l) { widest = Math.max(widest, l.length); });
    var boxW = Math.max(240, widest * hm * 0.62 + hm);
    var boxH = lines.length * lineH + hm * 0.6;
    var color = note.color || null;
    var g = svg("g", { class: "text-note", onclick: function () { openDetailPanel("note", note, room); } });
    if (leaderPt) {
      g.appendChild(svg("line", { class: "note-leader", x1: x + boxW / 2, y1: y + boxH, x2: leaderPt[0], y2: leaderPt[1] }));
      g.appendChild(svg("circle", { cx: leaderPt[0], cy: leaderPt[1], r: hm * 0.15, style: "fill:" + (color || "#b49638") }));
    }
    var rot = note.rot ? " rotate(" + note.rot + " " + x + " " + y + ")" : "";
    var inner = svg("g", rot ? { transform: rot.trim() } : null);
    inner.appendChild(svg("rect", {
      class: "text-note-box", x: x, y: y, width: boxW, height: boxH, rx: hm * 0.25,
      style: color ? "stroke:" + color : ""
    }));
    lines.forEach(function (l, i) {
      inner.appendChild(svg("text", {
        class: "text-note-label", x: x + boxW / 2, y: y + (i + 0.62) * lineH,
        style: "font-size:" + hm + "px" + (color ? ";fill:" + color : ""), text: l
      }));
    });
    g.appendChild(inner);
    return g;
  }

  // ------------------------------------------------------------------ //
  // Plan SVG. World mm 1:1 into the viewBox; y used as-is (the app's own
  // plan canvas is a pure positive scale of world coords too).
  // ------------------------------------------------------------------ //
  function planBounds(room) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function grow(x, y) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    room.walls.forEach(function (w) {
      grow(w.x1, w.y1); grow(w.x2, w.y2);
      (w.arc || []).forEach(function (p) { grow(p[0], p[1]); });
    });
    room.cabinets.forEach(function (c) { (c.poly || []).forEach(function (p) { grow(p[0], p[1]); }); });
    room.accessories.forEach(function (a) {
      (a.poly || []).forEach(function (p) { grow(p[0], p[1]); });
      if (a.cx !== undefined) grow(a.cx, a.cy);
    });
    (room.notes || []).forEach(function (n) { grow(n.x, n.y); });
    (room.symbols || []).forEach(function (s) { grow(s.x - s.w / 2, s.y - s.h / 2); grow(s.x + s.w / 2, s.y + s.h / 2); });
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 4000; maxY = 3000; }
    var span = Math.max(maxX - minX, maxY - minY, 1000);
    var pad = Math.max(250, span * 0.09);
    return { minX: minX - pad, minY: minY - pad, w: (maxX - minX) + 2 * pad, h: (maxY - minY) + 2 * pad };
  }

  function wallPlanPolygon(w) {
    // Thickness extrudes to the BACK: back = data line minus front normal.
    var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len; // front normal
    var tx = -nx * w.thickness, ty = -ny * w.thickness;
    return [[w.x1, w.y1], [w.x2, w.y2], [w.x2 + tx, w.y2 + ty], [w.x1 + tx, w.y1 + ty]];
  }

  function buildPlanSvg(room, opts) {
    opts = opts || {};
    var b = planBounds(room);
    var root = svg("svg", {
      class: "plan-svg",
      viewBox: b.minX + " " + b.minY + " " + b.w + " " + b.h,
      preserveAspectRatio: "xMidYMid meet"
    });
    var dimGroup = svg("g", { class: "dim-group" });

    room.walls.forEach(function (wall) {
      var cls = "wall-shape" + (opts.highlightWallId === wall.id ? " current" : "") + (wall.peninsula ? " peninsula" : "");
      var shape;
      if (wall.arc && wall.arc.length > 1) {
        // Curved wall: the sampled arc polyline, stroked at wall thickness.
        shape = svg("polyline", {
          class: cls, points: polyPoints(wall.arc),
          style: "fill:none;stroke-width:" + Math.max(20, wall.thickness)
        });
      } else if (wall.peninsula) {
        shape = svg("line", { class: cls, x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2, style: "stroke-width:60" });
      } else {
        shape = svg("polygon", { class: cls, points: polyPoints(wallPlanPolygon(wall)) });
      }
      shape.addEventListener("click", function () { if (opts.onWallClick) opts.onWallClick(wall.id); });
      root.appendChild(shape);
      if (!opts.compact && SETTINGS.show_dims !== false && tierEnabled("detail")) {
        var mx = (wall.x1 + wall.x2) / 2, my = (wall.y1 + wall.y2) / 2;
        var dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
        var len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;
        var g = svg("g");
        g.appendChild(svg("text", { class: "label-text", x: mx + nx * 220, y: my + ny * 220, text: fmt(wall.length) }));
        applyTierStyle(g, "detail", false);
        dimGroup.appendChild(g);
      }
    });

    if (!opts.compact) {
      // Openings (window/door accessories): slot polygons in the wall body.
      room.accessories.forEach(function (a) {
        if (!a.opening || !a.poly) return;
        var g = svg("g", { class: "acc-shape opening-group", onclick: function () { openDetailPanel("accessory", a, room); } });
        g.appendChild(svg("polygon", {
          class: "opening-shape" + (a.opening === "door" ? " door" : ""),
          points: polyPoints(a.poly)
        }));
        root.appendChild(g);
        if (a.door && SETTINGS.show_door_swings !== false) {
          var sw = svg("g", { class: "door-swing" + (a.door.assumed ? " assumed" : "") });
          var tipX = a.door.hx + a.door.px, tipY = a.door.hy + a.door.py;
          sw.appendChild(svg("line", { x1: a.door.hx, y1: a.door.hy, x2: tipX, y2: tipY }));
          // Quarter arc tip -> free jamb, centred on the hinge.
          var r = Math.hypot(a.door.px, a.door.py);
          var a0 = Math.atan2(tipY - a.door.hy, tipX - a.door.hx);
          var a1 = Math.atan2(a.door.fy - a.door.hy, a.door.fx - a.door.hx);
          var sweep = a1 - a0;
          while (sweep > Math.PI) sweep -= 2 * Math.PI;
          while (sweep < -Math.PI) sweep += 2 * Math.PI;
          var pts = [];
          for (var i = 0; i <= 16; i++) {
            var ang = a0 + sweep * i / 16;
            pts.push((a.door.hx + r * Math.cos(ang)) + "," + (a.door.hy + r * Math.sin(ang)));
          }
          sw.appendChild(svg("path", { d: "M" + pts.join(" L") }));
          root.appendChild(sw);
        }
      });

      // Cabinets: world footprint polygons.
      room.cabinets.forEach(function (c) {
        if (!c.poly) return;
        var g = svg("g", { class: "cab-shape", onclick: function () { openDetailPanel("cabinet", c, room); } });
        g.appendChild(svg("polygon", { class: "box", points: polyPoints(c.poly) }));
        root.appendChild(g);
      });

      // Non-opening accessories: category-colored circles.
      room.accessories.forEach(function (a) {
        if (a.opening || a.cx === undefined) return;
        var r = Math.max(60, Math.min(a.w, a.d || a.w) / 2.2);
        var g = svg("g", {
          class: "acc-shape", "data-acc-name": a.name,
          onclick: function () { openDetailPanel("accessory", a, room); }
        });
        g.appendChild(svg("circle", { class: "box", cx: a.cx, cy: a.cy, r: r, fill: categoryColor(a.cat) }));
        g.appendChild(svg("text", { x: a.cx, y: a.cy, text: (a.cat || "?").slice(0, 1).toUpperCase() }));
        root.appendChild(g);
      });

      // Corner-angle callouts (off-square corners, pre-computed).
      if (SETTINGS.show_angles !== false) {
        (room.corners || []).forEach(function (c) {
          var g = svg("g", { class: "corner-angle" });
          g.appendChild(svg("text", { x: c.x + c.bx * 420, y: c.y + c.by * 420, text: c.label }));
          root.appendChild(g);
        });
      }

      // Solved CAD dimension lines + free plan lines (user-placed).
      var cadGroup = svg("g", { class: "cad-dim" });
      (room.cad_dims || []).forEach(function (d) {
        cadGroup.appendChild(freeDimLine(d.x1, d.y1, d.x2, d.y2, fmt(d.len)));
      });
      (room.cad_free || []).forEach(function (d) {
        cadGroup.appendChild(freeDimLine(d.x1, d.y1, d.x2, d.y2, fmt(d.len)));
      });
      root.appendChild(cadGroup);

      // Plan symbols then notes (notes read over symbols - canvas z-order).
      (room.symbols || []).forEach(function (s) {
        root.appendChild(renderSymbol(s, "plan", s.x, s.y, s.color));
      });
      (room.notes || []).forEach(function (n) {
        root.appendChild(renderNote(n, n.x, n.y, (n.lx !== undefined && n.lx !== null) ? [n.lx, n.ly] : null, room));
      });
    }

    root.appendChild(dimGroup);
    return root;
  }

  // ------------------------------------------------------------------ //
  // Elevation chain layout (port of the desktop export's splitIntoRows /
  // chainSegments / layoutChainRows / clusterByHeightLayer).
  // ------------------------------------------------------------------ //
  var FLOOR_TOLERANCE_MM = 5;
  var MM_PER_CHAR_THRESHOLD = 60;

  function splitIntoRows(elements) {
    var rows = [];
    elements.slice().sort(function (a, b) { return a.a0 - b.a0 || a.a1 - b.a1; })
      .forEach(function (e) {
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (e.a0 >= row[row.length - 1].a1 - 0.5) { row.push(e); return; }
        }
        rows.push([e]);
      });
    return rows;
  }
  function chainSegments(row, length) {
    var segs = [], prev = 0;
    row.forEach(function (e) {
      if (e.a0 - prev > 1) segs.push({ a0: prev, a1: e.a0 });
      segs.push({ a0: Math.max(prev, e.a0), a1: e.a1 });
      prev = Math.max(prev, e.a1);
    });
    if (length - prev > 1) segs.push({ a0: prev, a1: length });
    return segs;
  }
  function layoutChainRows(elements, wallLength) {
    var lines = [];
    splitIntoRows(elements).forEach(function (row) {
      var main = [], overflow = [];
      chainSegments(row, wallLength).forEach(function (seg) {
        var label = fmt(seg.a1 - seg.a0);
        var target = (seg.a1 - seg.a0 >= label.length * MM_PER_CHAR_THRESHOLD) ? main : overflow;
        target.push({ a0: seg.a0, a1: seg.a1, label: label });
      });
      lines.push(main);
      if (overflow.length) lines.push(overflow);
    });
    return lines;
  }
  function clusterByHeightLayer(elements) {
    var layers = [];
    elements.slice().sort(function (a, b) { return a.y0 - b.y0; }).forEach(function (e) {
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (e.y0 < L.yMax && e.y1 > L.yMin) {
          L.yMin = Math.min(L.yMin, e.y0);
          L.yMax = Math.max(L.yMax, e.y1);
          L.els.push(e);
          return;
        }
      }
      layers.push({ yMin: e.y0, yMax: e.y1, els: [e] });
    });
    layers.sort(function (a, b) { return a.yMin - b.yMin; });
    return layers;
  }

  // ------------------------------------------------------------------ //
  // Elevation SVG. x = along-wall mm, world y (height) flipped via sy().
  // ------------------------------------------------------------------ //
  function wallItems(room, wallId) {
    return {
      cabinets: room.cabinets.filter(function (c) { return c.wall === wallId; }),
      accessories: room.accessories.filter(function (a) { return a.wall === wallId && !a.opening; }),
      openings: room.accessories.filter(function (a) { return a.wall === wallId && a.opening; })
    };
  }

  function buildElevationSvg(room, wall) {
    var ROW_GAP = 150;
    var w = wall.length;
    var peak = wall.height;
    (wall.outline || []).forEach(function (p) { peak = Math.max(peak, p[1]); });
    var items = wallItems(room, wall.id);
    var showDims = SETTINGS.show_dims !== false;

    var lowerEls = [], upperEls = [];
    items.cabinets.forEach(function (c) {
      var e = { a0: c.along, a1: c.along + c.w, y0: c.bottom, y1: c.bottom + c.h };
      (c.bottom > FLOOR_TOLERANCE_MM ? upperEls : lowerEls).push(e);
    });
    var bottomLines = showDims && tierEnabled("detail", TIERS_ELEV) ? layoutChainRows(lowerEls, w) : [];
    var topLines = [];
    if (showDims && tierEnabled("detail", TIERS_ELEV)) {
      clusterByHeightLayer(upperEls).forEach(function (layer) {
        layoutChainRows(layer.els, w).forEach(function (line) { topLines.push(line); });
      });
    }

    var accForDims = showDims && tierEnabled("spans", TIERS_ELEV)
      ? items.accessories.filter(function (a) { return !state.hiddenAccNames[a.name]; })
      : [];
    var accHeightRefs = accForDims
      .map(function (a) { return a.center_ref ? a.bottom + a.h / 2 : a.bottom; })
      .filter(function (r) { return r > FLOOR_TOLERANCE_MM; })
      .sort(function (a, b) { return a - b; });
    var distinctHeights = [];
    accHeightRefs.forEach(function (r) {
      var last = distinctHeights[distinctHeights.length - 1];
      if (last === undefined || Math.abs(r - last) > FLOOR_TOLERANCE_MM) distinctHeights.push(r);
    });

    var showTotal = showDims && tierEnabled("total", TIERS_ELEV);
    var bottomRowCount = bottomLines.length + (accForDims.length ? 1 : 0) + (showTotal ? 1 : 0);
    var marginBottom = 80 + bottomRowCount * ROW_GAP;
    var marginTop = 80 + topLines.length * ROW_GAP;
    var HEIGHT_COL_BASE = 40, HEIGHT_COL_STEP = 150;
    var leftColCount = distinctHeights.length + (showTotal ? 1 : 0);
    var marginLeft = HEIGHT_COL_BASE + Math.max(1, leftColCount) * HEIGHT_COL_STEP + 120;
    var marginRight = 200;

    var root = svg("svg", {
      class: "elev-svg",
      viewBox: (-marginLeft) + " " + (-marginTop) + " " + (w + marginLeft + marginRight) + " " + (peak + marginTop + marginBottom),
      preserveAspectRatio: "xMidYMid meet"
    });
    function sy(hh) { return peak - hh; }

    var scene = svg("g");

    // Wall face - the outline polygon already carries sloped/vaulted tops
    // (and custom Leica profiles) from the Kotlin side.
    var facePts = (wall.outline && wall.outline.length >= 3)
      ? wall.outline.map(function (p) { return [p[0], sy(p[1])]; })
      : [[0, sy(0)], [w, sy(0)], [w, sy(wall.height)], [0, sy(wall.height)]];
    scene.appendChild(svg("polygon", { class: "wall-shape", points: polyPoints(facePts), style: "cursor:default" }));

    var dimGroup = svg("g", { class: "dim-group" });

    // Left height columns: distinct accessory heights + overall wall height.
    if (showDims) {
      distinctHeights.forEach(function (rh, k) {
        var x = -(HEIGHT_COL_BASE + k * HEIGHT_COL_STEP);
        var g = heightDimLine(x, sy(0), sy(rh), fmt(rh));
        applyTierStyle(g, "spans", false, TIERS_ELEV);
        dimGroup.appendChild(g);
      });
      if (showTotal) {
        var whX = -(HEIGHT_COL_BASE + distinctHeights.length * HEIGHT_COL_STEP);
        var gTot = svg("g");
        gTot.appendChild(heightDimLine(whX, sy(0), sy(wall.height), fmt(wall.height)));
        // Vault rise chained onto the same column (floor -> eave -> ridge).
        if (peak > wall.height + 1) {
          gTot.appendChild(heightDimLine(whX, sy(wall.height), sy(peak), fmt(peak - wall.height)));
        }
        applyTierStyle(gTot, "total", true, TIERS_ELEV);
        dimGroup.appendChild(gTot);
      }
    }

    // Cabinets.
    items.cabinets.forEach(function (c) {
      var g = svg("g", { class: "cab-shape", onclick: function () { openDetailPanel("cabinet", c, room); } });
      g.appendChild(svg("rect", {
        class: "box", x: c.along, y: sy(c.bottom + c.h), width: c.w, height: c.h
      }));
      if (SETTINGS.show_labels !== false) {
        g.appendChild(svg("text", {
          class: "label-text", x: c.along + c.w / 2, y: sy(c.bottom + c.h / 2), text: c.name
        }));
      }
      scene.appendChild(g);
    });

    // Openings (windows/doors) with their own width+height dims.
    items.openings.forEach(function (o) {
      var g = svg("g", { class: "acc-shape opening-group", onclick: function () { openDetailPanel("accessory", o, room); } });
      g.appendChild(svg("rect", {
        class: "opening-shape" + (o.opening === "door" ? " door" : ""),
        x: o.along, y: sy(o.bottom + o.h), width: o.w, height: o.h
      }));
      scene.appendChild(g);
      if (showDims && tierEnabled("detail", TIERS_ELEV)) {
        var gd = svg("g", { class: "opening-group" });
        gd.appendChild(dimLine(o.along, sy(0) + 18, o.along + o.w, sy(0) + 18, fmt(o.w), true));
        gd.appendChild(dimLine(o.along + o.w + 30, sy(o.bottom), o.along + o.w + 30, sy(o.bottom + o.h), fmt(o.h), false));
        applyTierStyle(gd, "detail", false, TIERS_ELEV);
        dimGroup.appendChild(gd);
      }
    });

    // Accessories.
    items.accessories.forEach(function (a) {
      var g = svg("g", {
        class: "acc-shape", "data-acc-name": a.name,
        onclick: function () { openDetailPanel("accessory", a, room); }
      });
      var r = svg("rect", { class: "box", x: a.along, y: sy(a.bottom + a.h), width: a.w, height: a.h });
      r.setAttribute("fill", categoryColor(a.cat));
      g.appendChild(r);
      g.appendChild(svg("text", {
        x: a.along + a.w / 2, y: sy(a.bottom + a.h / 2), text: (a.cat || "?").slice(0, 1).toUpperCase()
      }));
      scene.appendChild(g);
    });

    // Height-band readings (dashed, inside the wall body).
    if (SETTINGS.show_height_bands !== false) {
      (wall.bands || []).forEach(function (b2) {
        var g = svg("g", { class: "height-band" });
        g.appendChild(svg("line", { x1: 0, y1: sy(b2.h), x2: w, y2: sy(b2.h) }));
        g.appendChild(svg("text", { x: 40, y: sy(b2.h) - 25, text: fmt(b2.len) + " @ " + fmt(b2.h) }));
        scene.appendChild(g);
      });
    }

    // CAD elevation lines (user-placed 2-point dims, wall-face mm y-up).
    var cadG = svg("g", { class: "cad-dim" });
    (wall.cad_lines || []).forEach(function (d) {
      cadG.appendChild(freeDimLine(d.x1, sy(d.y1), d.x2, sy(d.y2), fmt(d.len)));
    });
    scene.appendChild(cadG);

    // Elevation symbols then notes.
    (wall.symbols || []).forEach(function (s) {
      scene.appendChild(renderSymbol(s, "elev", s.x, sy(s.y), s.color));
    });
    (wall.notes || []).forEach(function (n) {
      scene.appendChild(renderNote(
        n, n.x, sy(n.y),
        (n.lx !== undefined && n.lx !== null) ? [n.lx, sy(n.ly)] : null, room
      ));
    });

    // Base cabinet chains below the floor line.
    bottomLines.forEach(function (line, i) {
      var y = sy(0) + 60 + i * ROW_GAP;
      var g = svg("g", { class: "cab-shape" });
      line.forEach(function (seg) {
        g.appendChild(dimLine(seg.a0, y, seg.a1, y, seg.label, true));
      });
      applyTierStyle(g, "detail", false, TIERS_ELEV);
      dimGroup.appendChild(g);
    });

    // Accessory position chain (centers / edges per center_ref).
    if (accForDims.length) {
      var accY = sy(0) + 60 + bottomLines.length * ROW_GAP;
      var refs = accForDims
        .map(function (a) { return a.center_ref ? a.along + a.w / 2 : a.along; })
        .sort(function (a, b) { return a - b; });
      var gAcc = svg("g");
      var prev = 0;
      refs.forEach(function (c) {
        if (c - prev > 1) gAcc.appendChild(dimLine(prev, accY, c, accY, fmt(c - prev), true));
        prev = Math.max(prev, c);
      });
      if (w - prev > 1) gAcc.appendChild(dimLine(prev, accY, w, accY, fmt(w - prev), true));
      applyTierStyle(gAcc, "spans", false, TIERS_ELEV);
      dimGroup.appendChild(gAcc);
    }

    // Overall wall length - outermost.
    if (showTotal) {
      var totalRowIndex = bottomLines.length + (accForDims.length ? 1 : 0);
      var totalY = sy(0) + 60 + totalRowIndex * ROW_GAP;
      var gT = svg("g");
      gT.appendChild(dimLine(0, totalY, w, totalY, fmt(w), true));
      applyTierStyle(gT, "total", true, TIERS_ELEV);
      dimGroup.appendChild(gT);
    }

    // Upper cabinet chains above the wall top.
    topLines.forEach(function (line, i) {
      var y = sy(peak) - 60 - i * ROW_GAP;
      var g = svg("g", { class: "cab-shape" });
      line.forEach(function (seg) {
        g.appendChild(dimLine(seg.a0, y, seg.a1, y, seg.label, true));
      });
      applyTierStyle(g, "detail", false, TIERS_ELEV);
      dimGroup.appendChild(g);
    });

    scene.appendChild(dimGroup);
    root.appendChild(scene);
    return root;
  }

  // ------------------------------------------------------------------ //
  // 3D viewer - vanilla canvas painter's-algorithm renderer.
  // World: x = plan x, z = plan y, y = height (up). All mm.
  // The desktop export ships a static raster here; this app has no
  // offscreen renderer to reuse, so this is the faithful-equivalent
  // replacement: real extruded geometry, orbit/zoom, zero libraries.
  // ------------------------------------------------------------------ //
  function shade(hex, f) {
    var c = parseInt(hex.slice(1), 16);
    var r = Math.round(((c >> 16) & 255) * f), g = Math.round(((c >> 8) & 255) * f), b = Math.round((c & 255) * f);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function roomFaces(room) {
    var faces = []; // {pts:[[x,y,z]..], color, alpha}
    function quad(p0, p1, p2, p3, color, alpha) {
      faces.push({ pts: [p0, p1, p2, p3], color: color, alpha: alpha || 1 });
    }
    // Walls: front face along the data line, body extruded to the back,
    // top edge follows the outline profile (vault/cathedral supported).
    room.walls.forEach(function (w) {
      var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      var len = Math.hypot(dx, dy) || 1;
      var ux = dx / len, uz = dy / len;
      var nx = -dy / len, nz = dx / len;               // front normal (into room)
      var bx = -nx * (w.peninsula ? 30 : w.thickness); // body offset to the back
      var bz = -nz * (w.peninsula ? 30 : w.thickness);
      var alpha = w.peninsula ? 0.35 : 1;
      // Top profile: along-wall x -> height, from the baked outline.
      var prof = [];
      (w.outline || []).forEach(function (p) { if (p[1] > 1) prof.push(p); });
      prof.sort(function (a, b) { return a[0] - b[0]; });
      if (!prof.length) prof = [[0, w.height], [w.length, w.height]];
      function P(a, h, back) {
        return [w.x1 + ux * a + (back ? bx : 0), h, w.y1 + uz * a + (back ? bz : 0)];
      }
      // Front + back faces (polygons: floor corners + top profile).
      var front = [P(0, 0, false)], back = [P(0, 0, true)];
      prof.forEach(function (p) { front.push(P(p[0], p[1], false)); back.push(P(p[0], p[1], true)); });
      front.push(P(w.length, 0, false)); back.push(P(w.length, 0, true));
      faces.push({ pts: front, color: "#b9c2cd", alpha: alpha });
      faces.push({ pts: back.slice().reverse(), color: "#a7b0bd", alpha: alpha });
      // Top faces along the profile.
      for (var i = 0; i + 1 < prof.length; i++) {
        quad(P(prof[i][0], prof[i][1], false), P(prof[i + 1][0], prof[i + 1][1], false),
          P(prof[i + 1][0], prof[i + 1][1], true), P(prof[i][0], prof[i][1], true), "#cdd4dd", alpha);
      }
      // End caps.
      quad(P(0, 0, false), P(0, prof[0][1], false), P(0, prof[0][1], true), P(0, 0, true), "#9aa3b0", alpha);
      var lastH = prof[prof.length - 1][1];
      quad(P(w.length, 0, false), P(w.length, lastH, false), P(w.length, lastH, true), P(w.length, 0, true), "#9aa3b0", alpha);
    });

    function extrude(poly, y0, y1, color, alpha) {
      if (!poly || poly.length < 3) return;
      var top = poly.map(function (p) { return [p[0], y1, p[1]]; });
      var bot = poly.map(function (p) { return [p[0], y0, p[1]]; });
      faces.push({ pts: top, color: color, alpha: alpha || 1 });
      for (var i = 0; i < poly.length; i++) {
        var j = (i + 1) % poly.length;
        quad(bot[i], bot[j], top[j], top[i], shade(color, 0.85), alpha || 1);
      }
    }
    room.cabinets.forEach(function (c) { extrude(c.poly, c.bottom, c.bottom + c.h, "#e7d9c3", 1); });
    room.accessories.forEach(function (a) {
      if (!a.poly) return;
      var col = a.opening ? (a.opening === "door" ? "#f6eee2" : "#dcebf5") : categoryColor(a.cat);
      extrude(a.poly, a.bottom, a.bottom + a.h, col, 1);
    });
    return faces;
  }

  function attach3dViewer(canvas, room) {
    var faces = roomFaces(room);
    // Scene bounds.
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    faces.forEach(function (f) {
      f.pts.forEach(function (p) {
        for (var i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
      });
    });
    if (!isFinite(min[0])) { min = [0, 0, 0]; max = [4000, 2700, 3000]; }
    var cx = (min[0] + max[0]) / 2, cy2 = (min[1] + max[1]) / 2, cz = (min[2] + max[2]) / 2;
    var radius = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    var cam = { yaw: -0.7, pitch: 0.5, dist: radius * 2.1 };
    var HOME = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
    var LIGHT = [0.45, 0.8, 0.35];

    function draw() {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr; canvas.height = h * dpr;
      }
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var cyaw = Math.cos(cam.yaw), syaw = Math.sin(cam.yaw);
      var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      var f = Math.min(w, h) * 1.15;
      function project(p) {
        var x = p[0] - cx, y = p[1] - cy2, z = p[2] - cz;
        // yaw around Y, then pitch around X.
        var x1 = x * cyaw + z * syaw;
        var z1 = -x * syaw + z * cyaw;
        var y2 = y * cp - z1 * sp;
        var z2 = y * sp + z1 * cp + cam.dist;
        if (z2 < 1) z2 = 1;
        return [w / 2 + (x1 * f) / z2, h / 2 - (y2 * f) / z2, z2];
      }
      var polys = [];
      faces.forEach(function (fc) {
        var pp = fc.pts.map(project);
        var depth = 0;
        pp.forEach(function (p) { depth += p[2]; });
        depth /= pp.length;
        // Flat shading from the face normal (first three world points).
        var a = fc.pts[0], b = fc.pts[1], c3 = fc.pts[2];
        var ux2 = b[0] - a[0], uy2 = b[1] - a[1], uz2 = b[2] - a[2];
        var vx = c3[0] - a[0], vy = c3[1] - a[1], vz = c3[2] - a[2];
        var nx2 = uy2 * vz - uz2 * vy, ny2 = uz2 * vx - ux2 * vz, nz2 = ux2 * vy - uy2 * vx;
        var nl = Math.hypot(nx2, ny2, nz2) || 1;
        var lam = Math.abs((nx2 * LIGHT[0] + ny2 * LIGHT[1] + nz2 * LIGHT[2]) / nl);
        polys.push({ pp: pp, depth: depth, color: shade(fc.color, 0.62 + 0.38 * lam), alpha: fc.alpha });
      });
      polys.sort(function (a, b) { return b.depth - a.depth; });
      polys.forEach(function (p) {
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.moveTo(p.pp[0][0], p.pp[0][1]);
        for (var i = 1; i < p.pp.length; i++) ctx.lineTo(p.pp[i][0], p.pp[i][1]);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(40,48,60,0.35)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    var drag = null;
    canvas.addEventListener("mousedown", function (e) {
      drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
    });
    window.addEventListener("mousemove", function (e) {
      if (!drag) return;
      cam.yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
      cam.pitch = Math.max(-0.2, Math.min(1.4, drag.pitch + (e.clientY - drag.y) * 0.008));
      draw();
    });
    window.addEventListener("mouseup", function () { drag = null; });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      cam.dist = Math.max(radius * 0.5, Math.min(radius * 6, cam.dist * Math.pow(1.0015, e.deltaY)));
      draw();
    }, { passive: false });
    canvas.addEventListener("dblclick", function () {
      cam.yaw = HOME.yaw; cam.pitch = HOME.pitch; cam.dist = HOME.dist;
      draw();
    });
    var tState = null;
    canvas.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) {
        tState = { mode: "orbit", x: e.touches[0].clientX, y: e.touches[0].clientY, yaw: cam.yaw, pitch: cam.pitch };
      } else if (e.touches.length === 2) {
        tState = {
          mode: "zoom", dist: cam.dist,
          d0: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        };
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", function (e) {
      if (!tState) return;
      e.preventDefault();
      if (tState.mode === "orbit" && e.touches.length === 1) {
        cam.yaw = tState.yaw + (e.touches[0].clientX - tState.x) * 0.008;
        cam.pitch = Math.max(-0.2, Math.min(1.4, tState.pitch + (e.touches[0].clientY - tState.y) * 0.008));
        draw();
      } else if (tState.mode === "zoom" && e.touches.length === 2) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) || 1;
        cam.dist = Math.max(radius * 0.5, Math.min(radius * 6, tState.dist * tState.d0 / d));
        draw();
      }
    }, { passive: false });
    canvas.addEventListener("touchend", function (e) { if (e.touches.length === 0) tState = null; });

    // Not rAF-only: rAF never fires in a throttled/background tab, which would leave the
    // canvas blank until the first interaction. draw() is cheap and idempotent, so call it
    // now (may see zero size before layout), then retry shortly after layout settles.
    draw();
    setTimeout(draw, 60);
    requestAnimationFrame(draw);
    window.addEventListener("resize", draw);
    return draw;
  }

  // ------------------------------------------------------------------ //
  // Schedules (per-room tables).
  // ------------------------------------------------------------------ //
  function scheduleTable(headers, rows) {
    var scroll = el("div", { class: "schedule-scroll" });
    var table = el("table", { class: "schedule" });
    var trh = el("tr");
    headers.forEach(function (h) { trh.appendChild(el("th", { text: h })); });
    var thead = el("thead", null, [trh]);
    var tbody = el("tbody");
    rows.forEach(function (r) {
      var tr2 = el("tr");
      r.forEach(function (cell) { tr2.appendChild(el("td", { text: cell })); });
      tbody.appendChild(tr2);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    scroll.appendChild(table);
    return scroll;
  }
  function buildSchedules(room) {
    var wrap = el("div", { class: "schedules" });
    if (room.cabinets.length) {
      var cRows = room.cabinets.map(function (c, i) {
        return [String(i + 1), c.name, t("class_" + c.cls),
          fmt(c.w) + " × " + fmt(c.h) + " × " + fmt(c.d),
          t("wall") + " " + c.wall_no, fmt(c.along), fmt(c.bottom)];
      });
      var block1 = el("div", { class: "schedule-block" });
      block1.appendChild(el("h3", { text: t("cabinetSchedule") }));
      block1.appendChild(scheduleTable(
        ["#", t("colName"), t("colType"), t("colDims"), t("colWall"), t("colFromLeft"), t("colFromBottom")], cRows));
      wrap.appendChild(block1);
    }
    if (room.accessories.length) {
      var aRows = room.accessories.map(function (a, i) {
        return [String(i + 1), a.name, a.cat,
          fmt(a.w) + " × " + fmt(a.h) + (a.d ? " × " + fmt(a.d) : ""),
          t("wall") + " " + a.wall_no, fmt(a.along), fmt(a.bottom)];
      });
      var block2 = el("div", { class: "schedule-block" });
      block2.appendChild(el("h3", { text: t("accessorySchedule") }));
      block2.appendChild(scheduleTable(
        ["#", t("colName"), t("colCategory"), t("colDims"), t("colWall"), t("colFromLeft"), t("colFromBottom")], aRows));
      wrap.appendChild(block2);
    }
    if (!room.cabinets.length && !room.accessories.length) {
      wrap.appendChild(el("div", { class: "empty-note", text: t("noItems") }));
    }
    return wrap;
  }

  // ------------------------------------------------------------------ //
  // Room view: plan + 3D, detail section, schedules below.
  // ------------------------------------------------------------------ //
  function renderRoomView(room) {
    var root = el("div", { class: "room-view" });
    root.appendChild(topbar(room.name, t("clickWallHint"), goWelcome));

    var actions = el("div", { class: "subbar" });
    actions.appendChild(buildLayersControl(room));
    root.appendChild(actions);

    var body = el("div", { class: "room-body" });

    var planPane = el("div", { class: "pane" }, [el("div", { class: "pane-title", text: t("planView") })]);
    var planSplit = el("div", { class: "pane-split" });
    var planBody = el("div", { class: "pane-body" });
    var planSvg = buildPlanSvg(room, {
      compact: false,
      onWallClick: function (wallId) { goElevation(room.id, wallId); }
    });
    applyLayerVisibility(planSvg);
    makePannable(planSvg);
    planBody.appendChild(planSvg);
    planSplit.appendChild(planBody);
    planSplit.appendChild(buildDetailSection());
    planPane.appendChild(planSplit);

    var threePane = el("div", { class: "pane" }, [el("div", { class: "pane-title", text: t("view3d") })]);
    var threeBody = el("div", { class: "pane-body", style: "position:relative" });
    var canvas = el("canvas", { class: "view3d" });
    threeBody.appendChild(canvas);
    threeBody.appendChild(el("div", { class: "view3d-hint", text: t("orbitHint") }));
    threePane.appendChild(threeBody);

    body.appendChild(planPane);
    body.appendChild(threePane);
    root.appendChild(body);

    root.appendChild(el("div", { class: "section-title", text: t("schedules"), style: "padding:0 22px" }));
    root.appendChild(buildSchedules(room));

    // setTimeout, not rAF: the room view must build its 3D scene even in a tab the browser
    // is not compositing (rAF callbacks are suspended there; timers are not).
    setTimeout(function () { attach3dViewer(canvas, room); }, 0);
    return root;
  }

  // ------------------------------------------------------------------ //
  // Elevation view.
  // ------------------------------------------------------------------ //
  function renderElevationView(room, wall) {
    var root = el("div", { class: "elev-view" });
    root.appendChild(topbar(room.name + " — " + t("elevationOf") + " " + wall.number, "", function () { goRoom(room.id); }));

    var actions = el("div", { class: "subbar" });
    var dimsBtn = el("button", { class: "toggle active", text: "📐 " + t("toggleDims") });
    var infoBtn = el("button", { class: "ghost", text: "ℹ " + t("wallInfo") });
    var cadBtn = null;
    actions.appendChild(dimsBtn);
    if ((wall.cad_lines || []).length) {
      cadBtn = el("button", { class: "toggle active", text: t("toggleCadDims") });
      actions.appendChild(cadBtn);
    }
    actions.appendChild(infoBtn);
    actions.appendChild(buildLayersControl(room));

    var main = el("div", { class: "elev-main" });
    var area = el("div", { class: "elev-svg-area" });
    var elevSvg = buildElevationSvg(room, wall);
    applyLayerVisibility(elevSvg);
    makePannable(elevSvg);
    area.appendChild(elevSvg);
    main.appendChild(area);
    main.appendChild(buildDetailSection());

    dimsBtn.addEventListener("click", function () {
      elevSvg.classList.toggle("dims-hidden");
      dimsBtn.classList.toggle("active");
    });
    if (cadBtn) {
      cadBtn.addEventListener("click", function () {
        elevSvg.classList.toggle("caddims-hidden");
        cadBtn.classList.toggle("active");
      });
    }
    infoBtn.addEventListener("click", function () { openWallInfoPanel(room, wall); });

    var corner = el("div", { class: "plan-corner" });
    corner.appendChild(el("div", { class: "cap" }, [
      el("span", { text: t("planView") }),
      (function () {
        var b = el("button", { class: "ghost", text: t("backToPlan"), style: "padding:2px 6px;font-size:11px" });
        b.addEventListener("click", function () { goRoom(room.id); });
        return b;
      })()
    ]));
    corner.appendChild(buildPlanSvg(room, {
      compact: true, highlightWallId: wall.id,
      onWallClick: function (wallId) { goElevation(room.id, wallId); }
    }));

    var elevBody = el("div", { class: "elev-body" });
    elevBody.appendChild(main);
    elevBody.appendChild(corner);

    root.appendChild(actions);
    root.appendChild(elevBody);
    return root;
  }

  // ------------------------------------------------------------------ //
  // Detail section.
  // ------------------------------------------------------------------ //
  function buildDetailSection() {
    return el("div", { class: "detail-section", id: "detailSection" }, [
      el("div", { class: "detail-head" }, [
        el("h4", { id: "detailTitle", text: t("details") }),
        el("button", { class: "ghost", text: "✕", onclick: clearDetailSection })
      ]),
      el("div", { class: "detail-body", id: "detailBody" }, [
        el("div", { class: "empty-note", text: t("clickToSeeDetails") })
      ])
    ]);
  }
  function openDetailSection(title) {
    var titleEl = document.getElementById("detailTitle");
    if (!titleEl) return null;
    titleEl.textContent = title;
    var body = document.getElementById("detailBody");
    clear(body);
    var host = document.getElementById("detailSection");
    if (host) host.classList.add("filled");
    return body;
  }
  function clearDetailSection() {
    var host = document.getElementById("detailSection");
    if (!host) return;
    host.classList.remove("filled");
    document.getElementById("detailTitle").textContent = t("details");
    var body = document.getElementById("detailBody");
    clear(body);
    body.appendChild(el("div", { class: "empty-note", text: t("clickToSeeDetails") }));
  }
  function row(k, v) {
    return el("div", { class: "row" }, [el("span", { class: "k", text: k }), el("span", { class: "v", text: v })]);
  }
  function wallOf(room, wallId) {
    return getWall(room, wallId);
  }
  function openDetailPanel(kind, item, room) {
    if (kind === "note") {
      var nb = openDetailSection(t("comment"));
      if (!nb) return;
      nb.appendChild(row(t("comment"), item.text || ""));
      return;
    }
    var body = openDetailSection(item.name || "");
    if (!body) return;
    if (item.cat) {
      body.appendChild(el("div", {}, [
        el("span", { class: "badge", text: item.cat, style: "background:" + categoryColor(item.cat) })
      ]));
    }
    body.appendChild(row(t("width"), fmt(item.w) + " " + t("mm")));
    body.appendChild(row(t("height"), fmt(item.h) + " " + t("mm")));
    if (item.d) body.appendChild(row(t("depth"), fmt(item.d) + " " + t("mm")));
    if (item.along !== undefined) {
      body.appendChild(row(t("distFromLeft"), fmt(item.along) + " " + t("mm")));
      var wl = wallOf(room, item.wall);
      if (wl) body.appendChild(row(t("distFromRight"), fmt(wl.length - item.along - item.w) + " " + t("mm")));
      body.appendChild(row(t("centerPos"), fmt(item.along + item.w / 2) + " " + t("mm")));
    }
    if (item.bottom !== undefined) body.appendChild(row(t("elevationFromFloor"), fmt(item.bottom) + " " + t("mm")));
    if (item.z) body.appendChild(row(t("zOffset"), fmt(item.z) + " " + t("mm")));
    if (item.desc) body.appendChild(row(t("comment"), item.desc));
  }
  function openWallInfoPanel(room, wall) {
    var body = openDetailSection(t("wall") + " " + wall.number);
    if (!body) return;
    body.appendChild(row(t("length"), fmt(wall.length) + " " + t("mm")));
    body.appendChild(row(t("height"), fmt(wall.height) + " " + t("mm")));
    body.appendChild(row(t("thickness"), fmt(wall.thickness) + " " + t("mm")));
    if (wall.top_style && wall.top_style !== "STANDARD") {
      body.appendChild(row(t("topStyle"), t("top_" + wall.top_style.toLowerCase())));
    }
  }

  // ------------------------------------------------------------------ //
  // Init.
  // ------------------------------------------------------------------ //
  document.addEventListener("DOMContentLoaded", function () { render(); });
  var _resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(scheduleTextScaleFix, 120);
  });
})();
