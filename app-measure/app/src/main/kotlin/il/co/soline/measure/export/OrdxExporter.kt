package il.co.soline.measure.export

import il.co.soline.measure.catalog.ElementCatalog
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.RoomEntity
import il.co.soline.measure.data.RoomSurvey
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder

/**
 * OrdxExporter — ייצוא חדר בודד לפורמט-החליפין ORDX (InnoDraw Order XML), הפורמט
 * שהממיר של Soline (ORDX → DXF/PDP/.sol) יודע לקרוא. "InnoDraw"/"ORDX" כאן מציינים
 * את פורמט-החליפין בלבד, לא מקור-לקוד שלנו. מודל על סמך הדגימה
 * `docs/samples/measure_export_ALL_elements.ordx` וניתוח `docs/ORDX_BRIDGE.md`.
 *
 * העץ: Job → Rooms → Room → Walls → Wall → {Fixtures|Furnishings}. יחידות: מ"מ.
 *
 * מה שכן נפלט (subset נאמן):
 *  - עטיפת Job עם Unit=mm, שם-חדר כשם-Job וכשם-Room.
 *  - כל קיר: Number, Description, Position (Start/End/Angle — ראו "גאומטריה" למטה),
 *    Type/Style=Standard, Dimensions/Length+Height (+Thick קבוע).
 *  - כל בליטה כ-Fixture או Furnishing עם Name (עברית), Class+Type ממופים,
 *    Size (Width/Height, ו-Depth כשגדול מ-0) ו-Position (X=fromLeft, Y=fromBottom).
 *
 * מה שלא נפלט (ראו ORDX_BRIDGE.md §3 — גשר lossy מכוון):
 *  - ארונות (אין ל-ORDX ישות Cabinet), סטטוס-נקודה (קיים/חדש/מבוטל), face,
 *    גיאומטריית-חריץ מזגן (slot*), קירות מעוקלים, גרף-חיבורי-קירות,
 *    Soffit/VaultHeight/elevation, ו-Position/Z. אלה דורשים בלוק <Ext> עתידי.
 *
 * גאומטריה: WallEntity נושא רק length/height/angle (angle = הפנייה לקיר הבא),
 * בלי קואורדינטות מוחלטות. לכן Start/End/Angle נגזרים ע"י פריסת הפוליגון דרך
 * מקור-האמת היחיד [WallBuilder.layout] (אותה מוסכמה כמו מסכי-הלכידה): הכיוון
 * ההתחלתי +X, וה-heading מסתובב ב-angle (מעלות, CCW חיובי) לקראת הקיר הבא
 * (angle=90 ⇒ פנייה של 90°, מפיק מלבן). ה-Angle שנפלט הוא כיוון-הקטע במעלות,
 * נגזר מהקודקודים עצמם (atan2). זו רק תכנית-על לוגית לצורך CAD, לא מדידה מוחלטת.
 */
object OrdxExporter {

    private const val CATALOG = "אלמנטים למדידה"
    private const val WALL_THICK_MM = 100.0

    /** עטיפת ORDX: Fixture (נקודת-תשתית) או Furnishing (אלמנט דקורטיבי/פתח). */
    private enum class Wrap { FIXTURE, FURNISHING }

    /** מיפוי סוג-בליטה → (עטיפה, Class, Type, Name) של ORDX. */
    private data class OrdxKind(val wrap: Wrap, val cls: String, val type: String, val name: String)

    /**
     * סיווג-ORDX לבליטה — נשען על מזהי-הממשק שב-[ElementCatalog] (Class/Type/Name),
     * במקום חוקן-נפילה גנרי. כך "דלת פנימה שמאל" נפלטת כ-Decorative/EntryDoor/Hinged
     * Left In, שקע כ-Fixture/Miscellaneous/Socket, חלון כ-Decorative/Window/Window —
     * והממיר שולף את זהות-האלמנט וסמל-ה-2D/‏PDP הנכונים.
     *
     * העטיפה נגזרת מהמחלקה: Fixture => Fixtures; כל היתר (Decorative/Appliance/
     * Accessory/Base) => Furnishings. אלמנט לא-מוכר (למשל וריאנט אישי CUSTOM_*)
     * נופל ל-Fixture/Miscellaneous עם השם-העברי — התנהגות שמרנית, אפס-רגרסיה.
     */
    private fun kindOf(acc: AccessoryEntity): OrdxKind {
        val def = ElementCatalog.of(acc.type)
        val cls = def?.ordxClass ?: "Fixture"
        val type = def?.ordxType ?: "Miscellaneous"
        val name = def?.effectiveOrdxName()?.takeIf { it.isNotBlank() } ?: acc.name
        val wrap = if (cls == "Fixture") Wrap.FIXTURE else Wrap.FURNISHING
        return OrdxKind(wrap, cls, type, name)
    }

    fun toOrdx(
        room: RoomEntity,
        walls: List<WallEntity>,
        accessoriesByWall: Map<Long, List<AccessoryEntity>>,
    ): String {
        val sb = StringBuilder(4096)
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
        sb.append("<!-- CV ORDX Order XML File — Soline Measure export -->\n")
        sb.append("<Job>\n")
        sb.append("  <ProductVersion>2025</ProductVersion>\n")
        sb.append("  <Unit>mm</Unit>\n")
        sb.append("  <Properties>\n")
        sb.append("    <Job>\n")
        sb.append("      <Information>\n")
        sb.append("        <Job>\n")
        sb.append("          <Name>").append(esc(room.name)).append("</Name>\n")
        sb.append("          <Description></Description>\n")
        sb.append("        </Job>\n")
        sb.append("      </Information>\n")
        sb.append("    </Job>\n")
        sb.append("  </Properties>\n\n")

        sb.append("  <Rooms>\n")
        sb.append("    <Room>\n")
        sb.append("      <RoomProperties>\n")
        sb.append("        <Room>\n")
        sb.append("          <General>\n")
        sb.append("            <Name>").append(esc(room.name)).append("</Name>\n")
        sb.append("            <Type>Room</Type>\n")
        sb.append("          </General>\n")
        appendSurveyExt(sb, room)
        sb.append("        </Room>\n")
        sb.append("      </RoomProperties>\n")
        sb.append("      <Walls>\n")

        val ordered = walls.sortedBy { it.idx }
        // פריסת הפוליגון דרך מקור-האמת היחיד לגזירת Start/End/Angle (ראו doc של האובייקט).
        val pts = WallBuilder.layout(ordered)
        for (i in ordered.indices) {
            val w = ordered[i]
            val sx = pts[i].x
            val sy = pts[i].y
            val ex = pts[i + 1].x
            val ey = pts[i + 1].y
            val headingDeg = Math.toDegrees(Math.atan2(ey - sy, ex - sx))
            appendWall(sb, w, sx, sy, ex, ey, headingDeg, accessoriesByWall[w.id].orEmpty())
        }

        sb.append("      </Walls>\n")
        sb.append("    </Room>\n")
        sb.append("  </Rooms>\n")
        sb.append("</Job>\n")
        return sb.toString()
    }

    /**
     * בלוק-הרחבה `<Ext><Soline>` תחת ה-Room — נושא את שדות-המודד ברמת-החדר
     * (ORDX_BRIDGE.md §3: extras דורשים <Ext>). ריק-לגמרי כשאין נתונים ⇒ אפס-רגרסיה
     * מול קוראי-ORDX קיימים (בלוק לא-מוכר מתעלמים ממנו). כולל: כיוון-כניסה,
     * מהלך-גבהים (מינ'/מקס'/מחייב) והערות-שינויים-עתידיים.
     */
    private fun appendSurveyExt(sb: StringBuilder, room: RoomEntity) {
        val heights = RoomSurvey.parseHeights(room.heightSweepMm)
        val changes = RoomSurvey.parseFutureChanges(room.futureChanges)
        val hasEntrance = room.entranceBearingDeg >= 0.0 || room.entranceWallIdx >= 0
        if (!hasEntrance && heights.isEmpty() && changes.isEmpty()) return
        val pad = "          "
        sb.append(pad).append("<Ext>\n")
        sb.append(pad).append("  <Soline>\n")
        if (hasEntrance) {
            sb.append(pad).append("    <EntranceDirection")
            if (room.entranceBearingDeg >= 0.0) sb.append(" bearingDeg=\"").append(mm(room.entranceBearingDeg)).append("\"")
            if (room.entranceWallIdx >= 0) sb.append(" wallIdx=\"").append(room.entranceWallIdx).append("\"")
            sb.append(" />\n")
        }
        if (heights.isNotEmpty()) {
            val binding = RoomSurvey.bindingHeight(heights)
            sb.append(pad).append("    <HeightSweep min=\"").append(mm(heights.min()))
                .append("\" max=\"").append(mm(heights.max()))
                .append("\" binding=\"").append(mm(binding ?: heights.min())).append("\">")
                .append(esc(heights.joinToString(",") { mm(it) })).append("</HeightSweep>\n")
        }
        for (c in changes) {
            sb.append(pad).append("    <FutureChange scope=\"").append(esc(c.scope)).append("\"")
            if (c.scope == "wall" && c.wallId >= 0) sb.append(" wallId=\"").append(c.wallId).append("\"")
            sb.append(">").append(esc(c.text)).append("</FutureChange>\n")
        }
        sb.append(pad).append("  </Soline>\n")
        sb.append(pad).append("</Ext>\n")
    }

    private fun appendWall(
        sb: StringBuilder,
        w: WallEntity,
        sx: Double, sy: Double, ex: Double, ey: Double,
        angle: Double,
        accessories: List<AccessoryEntity>,
    ) {
        val number = w.idx + 1
        sb.append("        <Wall>\n")
        sb.append("          <Number>").append(number).append("</Number>\n")
        sb.append("          <Description>Wall ").append(number).append("</Description>\n")
        sb.append("          <Position>\n")
        sb.append("            <StartX>").append(mm(sx)).append("</StartX>\n")
        sb.append("            <StartY>").append(mm(sy)).append("</StartY>\n")
        sb.append("            <Angle>").append(mm(angle)).append("</Angle>\n")
        sb.append("            <EndX>").append(mm(ex)).append("</EndX>\n")
        sb.append("            <EndY>").append(mm(ey)).append("</EndY>\n")
        sb.append("          </Position>\n")
        sb.append("          <Type>\n")
        sb.append("            <Style>Standard</Style>\n")
        sb.append("          </Type>\n")
        sb.append("          <Dimensions>\n")
        sb.append("            <Length>").append(mm(w.length)).append("</Length>\n")
        sb.append("            <Height>").append(mm(w.height)).append("</Height>\n")
        sb.append("            <Thick>").append(mm(WALL_THICK_MM)).append("</Thick>\n")
        sb.append("          </Dimensions>\n")

        val fixtures = accessories.filter { kindOf(it).wrap == Wrap.FIXTURE }
        val furnishings = accessories.filter { kindOf(it).wrap == Wrap.FURNISHING }

        if (fixtures.isNotEmpty()) {
            sb.append("          <Fixtures>\n")
            for (a in fixtures) appendItem(sb, "Fixture", a)
            sb.append("          </Fixtures>\n")
        }
        if (furnishings.isNotEmpty()) {
            sb.append("          <Furnishings>\n")
            for (a in furnishings) appendItem(sb, "Furnishing", a)
            sb.append("          </Furnishings>\n")
        }
        sb.append("        </Wall>\n")
    }

    private fun appendItem(sb: StringBuilder, tag: String, a: AccessoryEntity) {
        val k = kindOf(a)
        val pad = "            "
        sb.append(pad).append('<').append(tag).append(">\n")
        sb.append(pad).append("  <Catalog>").append(esc(CATALOG)).append("</Catalog>\n")
        sb.append(pad).append("  <Properties>\n")
        sb.append(pad).append("    <General>\n")
        // <Name> = מזהה-הממשק של ORDX (Socket/Window/Hinged Left In/…),
        // הנקודה שממנה הממיר שולף את סמל-ה-2D/‏PDP הנכון. השם-העברי נשמר ב-Description.
        sb.append(pad).append("      <Name>").append(esc(k.name)).append("</Name>\n")
        sb.append(pad).append("      <Description>").append(esc(a.name)).append("</Description>\n")
        sb.append(pad).append("      <Class>").append(k.cls).append("</Class>\n")
        sb.append(pad).append("      <Type>").append(k.type).append("</Type>\n")
        sb.append(pad).append("      <Size>\n")
        sb.append(pad).append("        <Width>").append(mm(a.width)).append("</Width>\n")
        sb.append(pad).append("        <Height>").append(mm(a.height)).append("</Height>\n")
        if (a.depth > 0.0) {
            sb.append(pad).append("        <Depth>").append(mm(a.depth)).append("</Depth>\n")
        }
        sb.append(pad).append("      </Size>\n")
        sb.append(pad).append("    </General>\n")
        sb.append(pad).append("  </Properties>\n")
        sb.append(pad).append("  <Position>\n")
        sb.append(pad).append("    <X>").append(mm(a.fromLeft)).append("</X>\n")
        sb.append(pad).append("    <Y>").append(mm(a.fromBottom)).append("</Y>\n")
        sb.append(pad).append("  </Position>\n")
        sb.append(pad).append("</").append(tag).append(">\n")
    }

    /** מ"מ ל-3 ספרות עשרוניות, נקודה עשרונית קבועה (בלי תלות ב-Locale). */
    private fun mm(v: Double): String {
        val neg = v < 0
        val abs = if (neg) -v else v
        val scaled = Math.round(abs * 1000.0)
        val intPart = scaled / 1000
        val frac = (scaled % 1000).toString().padStart(3, '0')
        return (if (neg) "-" else "") + intPart + "." + frac
    }

    /** מילוט תווי-XML. */
    private fun esc(s: String): String {
        val out = StringBuilder(s.length + 8)
        for (c in s) when (c) {
            '&' -> out.append("&amp;")
            '<' -> out.append("&lt;")
            '>' -> out.append("&gt;")
            '"' -> out.append("&quot;")
            '\'' -> out.append("&apos;")
            else -> out.append(c)
        }
        return out.toString()
    }
}
