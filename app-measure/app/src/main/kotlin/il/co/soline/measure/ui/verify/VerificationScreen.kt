package il.co.soline.measure.ui.verify

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.AccType
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.RoomEntity
import il.co.soline.measure.data.RoomSurvey
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.fit.RoomValidator
import il.co.soline.measure.fit.Severity
import il.co.soline.measure.fit.ValidationIssue
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.BlockRedBg
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import il.co.soline.measure.ui.WarnAmberBg
import kotlin.math.hypot
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 *  VerificationScreen — "אימות-סופי / בדיקת-שלמות / Calc".
 *  זהו שער-האיכות שרץ *לפני* ייצוא: מודד לא
 *  מגיש מדידה חסרה או לא-תקינה. שלושה חלקים:
 *
 *    1. באנר-סטטוס גדול — "מוכן להגשה ✓" (ירוק) או "דורש תיקון" (אדום),
 *       ומונה את החסימות. onProceed נדלק רק כשאין ולו חסימה אחת.
 *    2. ממצאי שער-האיכות (RoomValidator.validate) מקובצים לפי חומרה:
 *       חסימה / אזהרה / מידע — ככרטיסים נקיים.
 *    3. רשימת-שלמות (Calc) — כל בדיקה שורת ✓/✗ עצמאית, וסיכום-חישוב:
 *       מספר-קירות, היקף, שטח-קירות, אלמנטים לפי-קטגוריה, סטטוס-סגירה.
 *
 *  קובץ עצמאי: כל הלוגיקה (checklist + calc) מקומית; נשען רק על הטיפוסים
 *  היציבים (WallEntity/AccessoryEntity/RoomValidator/WallBuilder + צבעי-מותג).
 * ───────────────────────────────────────────────────────────────────────────── */

private const val MIN_WALLS = 3

// ─── מודלים-מקומיים לתוצאות-הבדיקה ─────────────────────────────────────────

/** שורת רשימת-שלמות: עברה (✓) או נכשלה (✗) עם פירוט. */
private data class Check(val ok: Boolean, val label: String, val detail: String)

/** סיכום-חישוב אגרגטיבי לכל החדרים. */
private data class CalcSummary(
    val roomCount: Int,
    val wallCount: Int,
    val perimeterMm: Double,
    val wallAreaMm2: Double,
    val elementCount: Int,
    val byCategory: List<Pair<String, Int>>,
    val allClosed: Boolean,
    val maxGapMm: Double,
)

// ─── עזרי-חישוב טהורים ─────────────────────────────────────────────────────

// ערך-מידה לפי יחידת-התצוגה (ערך בלבד, בלי סיומת). האחסון תמיד מ"מ.
private fun mm(v: Double): String = Prefs.lenValue(v)
private fun meters(v: Double): String = "%.2f".format(v / 1000.0)
private fun m2(v: Double): String = "%.2f".format(v / 1_000_000.0)

/** קטגוריית-אלמנט בעברית לצורך ספירה (Construction/Electrical/Plumbing… §8). */
private fun categoryOf(type: String): String = when (type) {
    "SOCKET_SINGLE", "SOCKET_MULTI", "ELECTRICAL_LINE" -> "חשמל"
    "WATER_PIPE", "GAS_PIPE" -> "אינסטלציה"
    "WINDOW", "DOOR" -> "פתחים"
    "COLUMN", "CEILING_DROP" -> "מבנה"
    else -> "אחר"
}

/** האם לסוג-בליטה זה מצופה עומק (D>0)? חלון/דלת אינם בולטים מהקיר. */
private fun expectsDepth(type: String): Boolean = AccType.of(type).defaultDepth > 0.0

/** סכום-אורכי הקטעים ב-polyline (WallBuilder.layout) — היקף-הריצה. */
private fun segmentSum(pts: List<WallBuilder.Pt>): Double {
    var sum = 0.0
    for (i in 1 until pts.size) sum += hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    return sum
}

/** מקבץ קירות לחדרים מסודרים לפי idx (כמו RoomValidator). */
private fun roomsOf(walls: List<WallEntity>): List<List<WallEntity>> =
    walls.groupBy { it.roomId }.values.map { it.sortedBy { w -> w.idx } }

private fun buildCalc(
    walls: List<WallEntity>,
    allAccessories: List<AccessoryEntity>,
): CalcSummary {
    val rooms = roomsOf(walls)
    var perimeter = 0.0
    var allClosed = rooms.isNotEmpty()
    var maxGap = 0.0
    for (room in rooms) {
        val pts = WallBuilder.layout(room)
        perimeter += segmentSum(pts)
        val gap = WallBuilder.closingGap(pts)
        if (gap > maxGap) maxGap = gap
        if (!WallBuilder.isClosed(pts)) allClosed = false
    }
    val area = walls.sumOf { it.length * it.height }
    val byCat = allAccessories.groupingBy { categoryOf(it.type) }.eachCount()
        .toList().sortedByDescending { it.second }
    return CalcSummary(
        roomCount = rooms.size,
        wallCount = walls.size,
        perimeterMm = perimeter,
        wallAreaMm2 = area,
        elementCount = allAccessories.size,
        byCategory = byCat,
        allClosed = allClosed,
        maxGapMm = maxGap,
    )
}

/** רשימת-השלמות העצמאית — כל פריט בדיקה נפרד עם ✓/✗. */
private fun buildChecklist(
    walls: List<WallEntity>,
    allAccessories: List<AccessoryEntity>,
    calc: CalcSummary,
    roomEntities: List<RoomEntity>,
): List<Check> {
    val rooms = roomsOf(walls)
    val checks = mutableListOf<Check>()

    // שדות-מודד ברמת-החדר (P1-3): כיוון-כניסה + גובה-תקרה נמדד
    if (roomEntities.isNotEmpty()) {
        val noEntrance = roomEntities.filter { it.entranceBearingDeg < 0.0 && it.entranceWallIdx < 0 }
        checks.add(
            Check(
                noEntrance.isEmpty(),
                "לכל חדר הוגדר כיוון-כניסה",
                if (noEntrance.isEmpty()) "כל ${roomEntities.size} החדרים בעלי כיוון-כניסה"
                else "${noEntrance.size} חדרים ללא כיוון-כניסה: ${noEntrance.joinToString(", ") { it.name }}",
            )
        )
        val noCeiling = roomEntities.filter { RoomSurvey.parseHeights(it.heightSweepMm).isEmpty() }
        checks.add(
            Check(
                noCeiling.isEmpty(),
                "לכל חדר נמדד גובה-תקרה",
                if (noCeiling.isEmpty()) "כל ${roomEntities.size} החדרים בעלי מהלך-גבהים"
                else "${noCeiling.size} חדרים ללא גובה-תקרה: ${noCeiling.joinToString(", ") { it.name }}",
            )
        )
    }

    // אורך>0 לכל קיר
    val noLen = walls.filter { it.length <= 0.0 }
    checks.add(
        Check(
            noLen.isEmpty(),
            "לכל קיר יש מידת-אורך",
            if (noLen.isEmpty()) "כל ${walls.size} הקירות נמדדו"
            else "${noLen.size} קירות ללא אורך: ${noLen.joinToString(", ") { "#${it.idx}" }}",
        )
    )

    // גובה מדוד לכל קיר (לא רק ברירת-המחדל 2700) — P1-1 בביקורת
    val noHt = walls.filter { it.height <= 0.0 }
    val unmeasuredHt = walls.filter { it.height > 0.0 && !it.heightMeasured }
    checks.add(
        Check(
            noHt.isEmpty() && unmeasuredHt.isEmpty(),
            "לכל קיר יש גובה מדוד",
            when {
                noHt.isNotEmpty() -> "${noHt.size} קירות ללא גובה: ${noHt.joinToString(", ") { "#${it.idx}" }}"
                unmeasuredHt.isNotEmpty() -> "${unmeasuredHt.size} קירות בגובה ברירת-מחדל (לא-נמדד): ${unmeasuredHt.joinToString(", ") { "#${it.idx}" }}"
                else -> "כל ${walls.size} הקירות בגובה מדוד"
            },
        )
    )

    // מספר-קירות בכל חדר (מידע בלבד — שרטוט פתוח מותר · בקשת-מודד 121438)
    val thin = rooms.filter { it.size < MIN_WALLS }
    checks.add(
        Check(
            rooms.isNotEmpty(),
            "בכל חדר יש קירות",
            when {
                rooms.isEmpty() -> "אין חדרים"
                thin.isEmpty() -> "${rooms.size} חדרים — מספר-קירות תקין"
                else -> "${thin.size} חדרים עם שרטוט פתוח (מותר להגשה)"
            },
        )
    )

    // סטטוס-סגירת-המתאר (מידע בלבד — פתוח מותר · בקשת-מודד 121438)
    checks.add(
        Check(
            true,
            "סטטוס-סגירת-מתאר",
            if (calc.allClosed) "כל החדרים נסגרים (פער ≤ ${mm(calc.maxGapMm)} ${Prefs.unitSuffix})"
            else "מתאר פתוח (פער ${mm(calc.maxGapMm)} ${Prefs.unitSuffix}) — מותר להגשה",
        )
    )

    // עומק לבליטות שמצופה מהן עומק
    val needDepth = allAccessories.filter { expectsDepth(it.type) }
    val missingDepth = needDepth.filter { it.depth <= 0.0 }
    checks.add(
        Check(
            missingDepth.isEmpty(),
            "לבליטות יש עומק (D) היכן שנדרש",
            if (missingDepth.isEmpty()) "${needDepth.size} אלמנטים בעלי-עומק תקינים"
            else "${missingDepth.size} אלמנטים ללא עומק: ${missingDepth.joinToString(", ") { it.name }}",
        )
    )

    // רוחב לכל בליטה = סטטוס-מידה קיים
    val noWidth = allAccessories.filter { it.width <= 0.0 }
    checks.add(
        Check(
            noWidth.isEmpty(),
            "לכל אלמנט יש רוחב (סטטוס-מידה)",
            if (noWidth.isEmpty()) "${allAccessories.size} אלמנטים בעלי-מידה"
            else "${noWidth.size} אלמנטים ללא רוחב: ${noWidth.joinToString(", ") { it.name }}",
        )
    )

    // אורכי-קיר בטווח-שפיות (חשד לטעות-מדידה מעל 30 מ')
    val suspect = walls.filter { it.length > 30_000.0 }
    checks.add(
        Check(
            suspect.isEmpty(),
            "אורכי-הקירות בטווח סביר",
            if (suspect.isEmpty()) "אין אורכים חריגים"
            else "${suspect.size} קירות חריגי-אורך — לוודא מדידה",
        )
    )

    return checks
}

// ─── המסך ─────────────────────────────────────────────────────────────────

/**
 * מסך אימות-סופי ובדיקת-שלמות לפני ייצוא.
 *
 * @param walls              כל קירות-הפרויקט (יכולים להשתייך לכמה חדרים לפי roomId).
 * @param accessoriesByWall  בליטות/אלמנטים לכל קיר לפי wallId.
 * @param onBack             חזרה למסך-הקודם.
 * @param onProceed          מעבר לייצוא — נדלק אך-ורק כשאין חסימה (שער-הייצוא).
 */
@Composable
fun VerificationScreen(
    walls: List<WallEntity>,
    accessoriesByWall: Map<Long, List<AccessoryEntity>>,
    onBack: () -> Unit,
    onProceed: () -> Unit,
    modifier: Modifier = Modifier,
    rooms: List<RoomEntity> = emptyList(),
) {
    val allAccessories = remember(accessoriesByWall) { accessoriesByWall.values.flatten() }

    val issues = remember(walls, accessoriesByWall, rooms) {
        RoomValidator.validate(walls, accessoriesByWall) + RoomValidator.validateSurvey(rooms)
    }
    val calc = remember(walls, allAccessories) { buildCalc(walls, allAccessories) }
    val checks = remember(walls, allAccessories, calc, rooms) { buildChecklist(walls, allAccessories, calc, rooms) }

    val blocks = issues.filter { it.severity == Severity.BLOCK }
    val warns = issues.filter { it.severity == Severity.WARN }
    val infos = issues.filter { it.severity == Severity.INFO }
    val ready = blocks.isEmpty()

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(modifier.fillMaxSize().background(Cream)) {

            // ── סרגל-עליון ────────────────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
                Spacer(Modifier.width(4.dp))
                Column(Modifier.weight(1f)) {
                    Text("soline · אימות-סופי", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 22.sp)
                    Text("בדיקת-שלמות לפני הגשה", fontSize = 12.sp, color = Teal)
                }
            }

            // ── גוף גליל ─────────────────────────────────────────────────
            Column(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StatusBanner(ready = ready, blockCount = blocks.size)

                CalcCard(calc)

                ChecklistCard(checks)

                if (blocks.isNotEmpty()) {
                    IssueGroup("חסימה", blocks, BlockRed, BlockRedBg)
                }
                if (warns.isNotEmpty()) {
                    IssueGroup("אזהרה", warns, WarnAmber, WarnAmberBg)
                }
                if (infos.isNotEmpty()) {
                    IssueGroup("מידע", infos, Teal, Cream)
                }
                if (issues.isEmpty()) {
                    Text(
                        "שער-האיכות לא מצא ממצאים — המדידה נקייה.",
                        color = Muted, fontSize = 14.sp,
                        modifier = Modifier.padding(4.dp),
                    )
                }
            }

            // ── לוח-תחתון: פעולת-ההמשך (שער-הייצוא) ──────────────────────
            Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp)) {
                if (!ready) {
                    Text(
                        "לא ניתן לייצא — יש ${blocks.size} חסימות לתיקון",
                        color = BlockRed, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
                BigButton(
                    label = if (ready) "אשר וייצא ✓" else "דורש תיקון לפני ייצוא",
                    container = OkGreen,
                    enabled = ready,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onProceed,
                )
            }
        }
    }
}

// ─── רכיבי-UI מקומיים ──────────────────────────────────────────────────────

@Composable
private fun StatusBanner(ready: Boolean, blockCount: Int) {
    val bg = if (ready) OkGreen else BlockRed
    Box(
        Modifier
            .fillMaxWidth()
            .background(bg, RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp, vertical = 20.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                if (ready) "מוכן להגשה ✓" else "דורש תיקון",
                color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                if (ready) "כל הבדיקות עברו — אפשר לייצא"
                else "נמצאו $blockCount ממצאים חוסמים שיש לתקן",
                color = Color.White.copy(alpha = 0.92f), fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun CalcCard(calc: CalcSummary) {
    Card(title = "סיכום-חישוב (Calc)") {
        StatRow("חדרים", "${calc.roomCount}")
        StatRow("קירות", "${calc.wallCount}")
        StatRow("היקף כולל", "${meters(calc.perimeterMm)} מ׳ (${mm(calc.perimeterMm)} ${Prefs.unitSuffix})")
        StatRow("שטח-קירות", "${m2(calc.wallAreaMm2)} מ\"ר")
        StatRow("סטטוס-סגירה", if (calc.allClosed) "סגור ✓" else "פתוח · פער ${mm(calc.maxGapMm)} ${Prefs.unitSuffix}",
            valueColor = if (calc.allClosed) OkGreen else BlockRed)
        Spacer(Modifier.height(6.dp))
        Text("אלמנטים (${calc.elementCount}):", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Ink)
        if (calc.byCategory.isEmpty()) {
            Text("אין אלמנטים רשומים", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
        } else {
            for ((cat, n) in calc.byCategory) StatRow(cat, "$n")
        }
    }
}

@Composable
private fun ChecklistCard(checks: List<Check>) {
    val passed = checks.count { it.ok }
    Card(title = "רשימת-שלמות ($passed/${checks.size})") {
        for (c in checks) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 6.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    if (c.ok) "✓" else "✗",
                    color = if (c.ok) OkGreen else BlockRed,
                    fontSize = 20.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.width(26.dp),
                )
                Column(Modifier.weight(1f)) {
                    Text(c.label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                    Text(c.detail, fontSize = 12.sp, color = if (c.ok) Muted else BlockRed)
                }
            }
        }
    }
}

@Composable
private fun IssueGroup(title: String, issues: List<ValidationIssue>, accent: Color, bg: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(10.dp).height(10.dp).background(accent, RoundedCornerShape(3.dp)))
            Spacer(Modifier.width(8.dp))
            Text("$title (${issues.size})", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = accent)
        }
        for (iss in issues) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(bg, RoundedCornerShape(12.dp))
                    .border(1.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                Column {
                    Text(iss.message, fontSize = 15.sp, color = Ink, fontWeight = FontWeight.Medium)
                    Text(iss.code, fontSize = 10.sp, color = Muted)
                }
            }
        }
    }
}

@Composable
private fun Card(title: String, content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(14.dp))
            .border(1.dp, Muted.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
            .padding(14.dp),
    ) {
        Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Orange)
        Spacer(Modifier.height(8.dp))
        content()
    }
}

@Composable
private fun StatRow(label: String, value: String, valueColor: Color = Ink) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 14.sp, color = Muted, modifier = Modifier.weight(1f))
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = valueColor)
    }
}

@Composable
private fun BigButton(
    label: String,
    container: Color,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val bg = if (enabled) container else Muted.copy(alpha = 0.25f)
    val fg = if (enabled) Color.White else Muted
    Box(
        modifier
            .heightIn(min = 58.dp)
            .background(bg, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
}
