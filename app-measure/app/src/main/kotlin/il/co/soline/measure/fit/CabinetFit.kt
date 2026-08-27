package il.co.soline.measure.fit

import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.CabinetEntity
import il.co.soline.measure.data.CabinetKind

/* ─────────────────────────────────────────────────────────────────────────────
 *  גשר שכבת-הארונות → מנוע-ה-fit. ממפה CabinetEntity (שכבה A — תכנון-הנגר,
 *  Room) אל il.co.soline.measure.fit.Cabinet (הטיפוס הטהור של המנוע), כדי
 *  ש-FitEngine.evaluate יריץ R1–R10 מול ארונות אמיתיים ובליטות-הקיר הנמדדות —
 *  במקום ריצת-בסיס מונחת. השדה kind של המנוע חייב להיות base|upper|tall, ולכן
 *  נגזר מ-CabinetKind.belt ולא מהשם-הגולמי.
 * ───────────────────────────────────────────────────────────────────────────── */

/** CabinetEntity → fit-engine Cabinet (belt של הטיפוס ← kind של המנוע). */
fun toFitCabinets(cabinets: List<CabinetEntity>): List<Cabinet> =
    cabinets.map { c ->
        Cabinet(
            id = c.id.toString(),
            kind = CabinetKind.of(c.kind).belt,   // base | upper | tall
            name = c.name,
            wallId = c.wallId.toString(),
            fromLeft = c.fromLeft,
            width = c.width,
            depth = c.depth,
            heightFrom = c.heightFrom,
            heightTo = c.heightTo,
            backClearance = 0.0,
        )
    }

/** AccessoryEntity → fit-engine Protrusion (שכבה B — בליטות הקיר הנמדדות). */
fun toFitProtrusions(accessories: List<AccessoryEntity>): List<Protrusion> =
    accessories.map { a ->
        Protrusion(
            id = a.id.toString(),
            type = a.type,
            name = a.name,
            depth = a.depth,
            fromLeft = a.fromLeft,
            width = a.width,
            fromBottom = a.fromBottom,
            height = a.height,
        )
    }

/**
 * נוחות: בונה Wall אחד למנוע מ-wallId + אביזריו, כדי ש-FitEngine.evaluate יריץ
 * את ארוני-הקיר מול הבליטות הנמדדות עליו.
 */
fun fitWallOf(wallId: Long, accessories: List<AccessoryEntity>): Wall =
    Wall(id = wallId.toString(), protrusions = toFitProtrusions(accessories))
