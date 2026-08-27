// ============================================================================
// Soline Measurement Engine · Placement
// ----------------------------------------------------------------------------
// The surveyor picks an element from the catalog and PLACES it in the space by
// centers/offsets. This resolves a placement to world coordinates against the
// built geometry and validates it (fits the host wall, within height, array
// stays on the wall) — so a mis-placed element is caught, not built.
// ============================================================================

"use strict";

const { find } = require("./catalog");

/** Create a placement instance (params depend on the element's locateBy). */
function place(catalogId, params) { return { catalogId, ...params }; }

/**
 * Resolve a placement to points + validate.
 * @param p placement instance
 * @param geo geometry from computeGeometry(space)
 * @param space the space (for wall heights)
 */
function resolve(p, geo, space) {
  const def = find(p.catalogId);
  if (!def) return { valid: false, issues: [`אלמנט לא מוכר: ${p.catalogId}`], points: [] };
  const issues = [];
  const pts = [];
  const wall = p.wallId ? geo.wallGeom.find((w) => w.id === p.wallId) : null;
  const wallDef = p.wallId && space ? space.walls.find((w) => w.id === p.wallId) : null;
  const onWall = (off) => (wall ? [wall.a[0] + wall.dir[0] * off, wall.a[1] + wall.dir[1] * off] : null);
  const wl = wall ? wall.length : 0;

  switch (def.locateBy) {
    case "point":
      if (wall) {
        if (p.offset < 0 || p.offset > wl)
          issues.push(`${def.nameHe}: מרכז בהיסט ${p.offset} מ״מ מחוץ לקיר ${p.wallId} (אורך ${Math.round(wl)}).`);
        pts.push(onWall(Math.max(0, Math.min(wl, p.offset))));
      } else if (p.centerXY) pts.push(p.centerXY);
      else issues.push(`${def.nameHe}: חסר מיקום (קיר+היסט או מרכז XY).`);
      break;

    case "array": {
      if (!wall) { issues.push(`${def.nameHe}: מערך דורש קיר מאחז.`); break; }
      for (let i = 0; i < p.count; i++) {
        const off = p.firstOffset + i * p.spacing;
        if (off < 0 || off > wl) issues.push(`${def.nameHe}: פריט ${i + 1} במערך (היסט ${Math.round(off)}) חורג מהקיר.`);
        pts.push(onWall(Math.max(0, Math.min(wl, off))));
      }
      break;
    }

    case "span":
      if (wall) {
        if (p.startOffset < 0 || p.endOffset > wl + 2)
          issues.push(`${def.nameHe}: מתיחה ${p.startOffset}–${p.endOffset} חורגת מקיר ${p.wallId} (${Math.round(wl)}).`);
        pts.push(onWall(p.startOffset), onWall(p.endOffset));
      } else if (p.startXY && p.endXY) pts.push(p.startXY, p.endXY);
      else issues.push(`${def.nameHe}: חסרות נקודות התחלה/סוף.`);
      break;

    case "opening": {
      if (!wall) { issues.push(`${def.nameHe}: פתח דורש קיר מאחז.`); break; }
      const end = p.offset + p.width;
      if (p.offset < 0 || end > wl + 2)
        issues.push(`${def.nameHe}: פתח ${p.offset}–${end} חורג מקיר ${p.wallId} (${Math.round(wl)}). בדוק היסט/רוחב.`);
      pts.push(onWall(p.offset), onWall(end));
      break;
    }

    case "area":
      if (p.centerXY) pts.push(p.centerXY);
      else issues.push(`${def.nameHe}: חסר מרכז XY.`);
      break;
  }

  // Height plausibility against host wall.
  if (p.height != null && wallDef) {
    const wh = wallDef.height.value;
    if (p.height < 0 || p.height > wh)
      issues.push(`${def.nameHe}: גובה ${p.height} מ״מ מחוץ לגובה קיר ${p.wallId} (${wh}).`);
  }

  return { def, locateBy: def.locateBy, points: pts, z: p.height ?? null, valid: issues.length === 0, issues };
}

/** Validate a whole list of placements; returns flat issues + per-item results. */
function validatePlacements(placements, geo, space) {
  const results = placements.map((p) => ({ p, r: resolve(p, geo, space) }));
  const issues = results.flatMap((x) => x.r.issues);
  return { ok: issues.length === 0, results, issues };
}

module.exports = { place, resolve, validatePlacements };
