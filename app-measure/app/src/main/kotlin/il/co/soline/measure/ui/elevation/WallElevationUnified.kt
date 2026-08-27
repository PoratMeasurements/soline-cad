package il.co.soline.measure.ui.elevation

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.data.AccType
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.CabinetEntity
import il.co.soline.measure.data.CabinetKind
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.fit.ClashSeverity
import il.co.soline.measure.fit.ElevationClash
import il.co.soline.measure.fit.ElevationFit
import il.co.soline.measure.geometry.WallBuilder.Pt
import il.co.soline.measure.geometry.WallProfileSolver
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import il.co.soline.measure.ui.components.BigActionButton
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/* ─────────────────────────────────────────────────────────────────────────────
 *  WallElevationUnified — מסך-החזית המאוחד של Soline Measure (InnoDraw "Wall
 *  Front View" / Elevation; INNODRAW_FEATURES §7 שורות 145/152, MICHAEL_WISHLIST
 *  §3/§5). זהו הלב של מדידת-מטבח, וכאן שני הכלים חיים תחת מסך אחד:
 *
 *   (א) מצב **מסגרת** — לוכדים סדרת-נקודות בלייזר (מרחק + זווית-אנכית של ה-X6 →
 *       (מיקום-אופקי, גובה)) או בהקשה-ידנית, המשרטטת את מתאר-פני-הקיר האמיתי:
 *       הנמכות, אלכסונים, גובה משתנה. "סיום" מחזיר את הנקודות ל-host להתמדה.
 *       Michael: "עם ה-X6 אני עושה מסגרת של נקודות, וממנה בונים את החזית → DXF+ORDX".
 *
 *   (ב) מצב **אלמנטים** — מציבים ומודדים אביזרים בגובה על פני-החזית (שקעים, מים,
 *       גז, חלונות, הנמכות). לחיצה על אביזר פותחת עורך-מימדים; "הוסף בגובה" מוסיף
 *       חדש; כפתור "קלוט גובה מהלייזר" ממלא גובה-מהרצפה מ-ble.lastReading בירייה
 *       יחידה (ONE-SHOT בלחיצה — לא מוצף מזרם-לייזר חי). קו-סימון/סופיט (soffit,
 *       הנמכת-תקרה) נמתח לרוחב עם גובהו.
 *
 *  הקנבס משרטט את *פני-הקיר*: אם קיימת מסגרת-לכודה — המתאר האמיתי (מצולע-צללית עם
 *  גובה משתנה); אחרת מלבן-הקיר הפשוט (length×height). קו-רצפה + תוויות-מידה בעברית.
 *  שדות-גדולים ידידותיים-לשטח, RTL, צבעי-המותג.
 *
 *  קובץ עצמאי: כל טיפוסי/עזרי-הציור מקומיים ו-file-private; נשען אך ורק על
 *  הטיפוסים היציבים (WallEntity, AccessoryEntity, AccType, LaserBle, צבעי-המותג).
 * ───────────────────────────────────────────────────────────────────────────── */

/** שני מצבי-המסך: לכידת-מתאר-החזית מול הצבת-אלמנטים-בגובה. */
private enum class ElevMode { FRAME, ELEMENTS }

/**
 * נקודת-מסגרת גולמית (שיטה A) — נושאת את מלוא-הירייה כדי לחשב `(u, v, e)` חי דרך
 * [WallProfileSolver]. עם זווית-אופקית (φ) יש `plan(X,Y)` והמיקום-האופקי *נמדד*;
 * בלעדיה (X6 חשוף) נופלים ל-[manualU] וההגלייה `e≡0`. [storedE] משמר הגלייה בטעינת-
 * מתאר-מוכן (בלי plan). כל היחידות מ"מ.
 */
private data class FramePt(
    val v: Double,          // גובה-מהרצפה (Z)
    val manualU: Double,    // מיקום-אופקי ידני (fallback)
    val planX: Double,      // היטל-תוכנית X (0 אם אין φ)
    val planY: Double,      // היטל-תוכנית Y
    val hasPlan: Boolean,   // האם קיימת זווית-אופקית (φ)
    val storedE: Double = 0.0, // הגלייה שמורה (טעינה-מחדש)
)

/** טרנספורם עולם→מסך למבט-חזית: מ"מ (x מהשמאל, y מהרצפה) → פיקסלים, ולהיפך. */
private data class UnifiedXf(val scale: Float, val left: Float, val bottom: Float) {
    fun sx(xMm: Double) = left + (xMm * scale).toFloat()
    /** yMm = גובה-מהרצפה; רצפה=bottom, המסך יורד → חיסור. */
    fun sy(yMm: Double) = bottom - (yMm * scale).toFloat()
    fun wx(px: Float): Double = ((px - left) / scale).toDouble()
    fun wy(py: Float): Double = ((bottom - py) / scale).toDouble()
}

/** אוטו-פיט של תיבת-העולם (worldW×worldH מ"מ) לתוך קנבס w×h עם שוליים pad. */
private fun unifiedFit(worldW: Double, worldH: Double, w: Float, h: Float, pad: Float): UnifiedXf {
    val lw = max(worldW, 1.0)
    val lh = max(worldH, 1.0)
    val sx = (w - 2 * pad) / lw
    val sy = (h - 2 * pad) / lh
    val scale = min(sx, sy).let { if (it.isFinite() && it > 0.0) it else 1.0 }.toFloat()
    val drawW = (lw * scale).toFloat()
    val drawH = (lh * scale).toFloat()
    val left = (w - drawW) / 2f
    val bottom = (h + drawH) / 2f
    return UnifiedXf(scale, left, bottom)
}

/** צבע-מילוי לפי סוג-אביזר (חשמל=כתום, מים/גז=טורקיז, פתחים=אפור, תקרה=ענבר). */
private fun accColorU(type: String): Color = when (type) {
    "SOCKET_SINGLE", "SOCKET_MULTI", "ELECTRICAL_LINE" -> Orange
    "WATER_PIPE", "GAS_PIPE" -> Teal
    "WINDOW", "DOOR" -> Muted
    "CEILING_DROP" -> WarnAmber
    else -> Teal
}

/** צבע-ארון לפי-חגורה (בסיס=טורקיז, עליון=כתום, גבוה/עמודה=ירוק). */
private fun cabinetColorU(kind: String): Color = when (CabinetKind.of(kind).belt) {
    "base" -> Teal
    "upper" -> Orange
    "tall" -> OkGreen
    else -> Muted
}

/** שם-חגורה קצר בעברית לתווית-הארון. */
private fun beltHeU(kind: String): String = when (CabinetKind.of(kind).belt) {
    "base" -> "בסיס"
    "upper" -> "עליון"
    "tall" -> "גבוה"
    else -> "ארון"
}

/**
 * צבע-הגלייה (שיטה A) לפי הסטייה-הניצבת e (מ"מ), במוסכמת סקר-המישוריות:
 * טורקיז = בליטה-לתוך-החדר (+), אדום = הרחק (−), ירוק ≈ 0 (≤3 מ"מ שטוח).
 */
private fun undColorU(e: Double): Color = when {
    e > 3.0 -> Teal
    e < -3.0 -> BlockRed
    else -> OkGreen
}

/**
 * גובה-מהרצפה מירית-לייזר: הרכיב-האנכי `d·sin θ` בלבד (מכשיר-בגובה-הרצפה).
 * מחזיר `null` — ולא את המרחק-הגולמי — כשאין זווית-אנכית או שהירי-אופקי
 * (רכיב-אנכי ≤ 1 מ"מ): המרחק-האלכסוני אינו גובה, ולכן דורש הזנה-ידנית ולא
 * ערך-שגוי-בשקט. הקוראים מטפלים ב-null (השבתה/ריקון) — לא מציגים מספר-שגוי.
 */
internal fun laserHeightMm(distMm: Double?, vAngleDeg: Double?): Double? {
    val d = distMm ?: return null
    if (d <= 0.0) return null
    val v = vAngleDeg ?: return null           // אין זווית-אנכית ⇒ אין גובה — הזנה-ידנית
    val comp = d * sin(Math.toRadians(v))
    if (!comp.isFinite() || comp <= 1.0) return null // ירי-אופקי ⇒ אין רכיב-אנכי תקף
    return comp
}

private fun Double.mmU(): String = roundToInt().toString()

/**
 * מסך-החזית המאוחד לקיר בודד — לכידת-מתאר-חזית + מדידת-אלמנטים-בגובה.
 *
 * @param wall               הקיר (length=רוחב מ"מ, height=גובה מ"מ).
 * @param accessories        אביזרי-הקיר (מיקום ב-fromLeft/fromBottom, מימד width×height).
 * @param cabinets           הארונות המתוכננים לקיר (שכבה A) — משורטטים כשכבת-תכנון
 *                           נפרדת (toggle) על-גבי המדידה, עם זיהוי-התנגשויות מול התשתית.
 * @param initialFramePoints מתאר-חזית קיים (u,v,e מ"מ) — כבר-ממוסגר; ריק=אין.
 * @param initialZeroCorner  פינת-האפס השמורה: "LEFT_BOTTOM"|"LEFT_TOP"|"RIGHT_BOTTOM"|"RIGHT_TOP".
 * @param initialDirection   כיוון-הליפוף השמור: "CCW"|"CW".
 * @param onFramePoints      נקרא ב"סיום-מסגרת" עם (u,v,e) + פינת-אפס + כיוון — על ה-host להתמיד.
 * @param onUpdateAccessory  שמירת-עריכה של אביזר קיים — על ה-host להתמיד ב-repo.
 * @param onAddAccessory     הוספת אביזר חדש (id=0) בגובה-נבחר — על ה-host להתמיד ב-repo.
 * @param onDeleteAccessory  מחיקת אביזר קיים ממסך-החזית — על ה-host להתמיד ב-repo.
 * @param initialSoffitHeight גובה-קו-הסימון (סופיט) השמור לקיר; null = לא-סומן.
 * @param onSoffitHeight     נקרא בשמירת/הסרת קו-הסימון — על ה-host להתמיד (null=הסרה).
 * @param onBack             חזרה למסך-הקודם.
 */
@Composable
fun WallElevationUnified(
    wall: WallEntity,
    accessories: List<AccessoryEntity>,
    cabinets: List<CabinetEntity> = emptyList(),
    initialFramePoints: List<Triple<Double, Double, Double>> = emptyList(),
    initialZeroCorner: String = "LEFT_BOTTOM",
    initialDirection: String = "CCW",
    initialSoffitHeight: Double? = null,
    onFramePoints: (points: List<Triple<Double, Double, Double>>, zeroCorner: String, direction: String) -> Unit,
    onUpdateAccessory: (AccessoryEntity) -> Unit,
    onAddAccessory: (AccessoryEntity) -> Unit,
    onDeleteAccessory: (AccessoryEntity) -> Unit = {},
    onSoffitHeight: (Double?) -> Unit = {},
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    // אותו סינגלטון-לייזר כמו שאר-המסכים — לא מתנתק ביציאה
    val ble = remember { (context.applicationContext as SolineApp).ble }
    val reading by ble.lastReading.collectAsStateWithLifecycle(null)
    val connected by ble.connected.collectAsStateWithLifecycle(null)
    val status by ble.status.collectAsStateWithLifecycle("")
    val liveMm = reading?.distanceMm
    val liveVDeg = reading?.vAngleDeg
    val liveHDeg = reading?.hAngleDeg

    var mode by remember { mutableStateOf(ElevMode.ELEMENTS) }

    // ── שכבת-תכנון (הארונות): toggle — ON כברירת-מחדל. כבוי = מדידה-גולמית בלבד
    //    ("השכבה בפני-עצמה" ש-Michael ביקש). דלוק = הארונות מונחים על-גבי המדידה.
    var planningLayer by remember { mutableStateOf(true) }
    // התנגשויות מחושבות טהורות (ElevationFit) — נגזרות מהקיר, אביזריו והארונות
    val clashes = remember(wall.id, wall.length, wall.height, accessories, cabinets) {
        ElevationFit.evaluate(wall, accessories, cabinets)
    }

    // ── מצב-מסגרת: עותק-עבודה של הנקודות (מזרעים מ-initialFramePoints) ─────────
    // שורד-סיבוב (rememberSaveable · B2/C2): לא מאבד את נקודות-המסגרת-שבתהליך.
    val frameSaver = remember {
        Saver<List<FramePt>, DoubleArray>(
            save = { list ->
                DoubleArray(list.size * 6).also { a ->
                    list.forEachIndexed { i, p ->
                        a[i * 6] = p.v; a[i * 6 + 1] = p.manualU; a[i * 6 + 2] = p.planX
                        a[i * 6 + 3] = p.planY; a[i * 6 + 4] = if (p.hasPlan) 1.0 else 0.0
                        a[i * 6 + 5] = p.storedE
                    }
                }
            },
            restore = { a ->
                (a.indices step 6).map {
                    FramePt(a[it], a[it + 1], a[it + 2], a[it + 3], a[it + 4] > 0.5, a[it + 5])
                }
            },
        )
    }
    // מתאר-מוכן נטען כ-(u,v,e): manualU=u, storedE=e, ללא-plan (המסגור כבר-הוחל → זהות).
    var frame by rememberSaveable(wall.id, stateSaver = frameSaver) {
        mutableStateOf(initialFramePoints.map { FramePt(v = it.second, manualU = it.first, planX = 0.0, planY = 0.0, hasPlan = false, storedE = it.third) })
    }
    // בורר פינת-אפס (LEFT/RIGHT × BOTTOM/TOP) + כיוון (CW/CCW) — שורדי-סיבוב.
    // מתאר-שמור כבר-ממוסגר (min u=0, min v=0), לכן טעינה מתחילה בזהות LEFT_BOTTOM/CCW;
    // שינוי-הבורר ממסגר-מחדש את המתאר-הנוכחי חי (= "החלף פינת-אפס"). המסגור-המקורי
    // מ-initialZeroCorner/initialDirection נשמר לייצוא ומוצג רק אם לא-נגעו בבורר.
    var zeroH by rememberSaveable(wall.id) { mutableStateOf(WallProfileSolver.ZeroH.LEFT) }
    var zeroV by rememberSaveable(wall.id) { mutableStateOf(WallProfileSolver.ZeroV.BOTTOM) }
    var dir by rememberSaveable(wall.id) { mutableStateOf(WallProfileSolver.Direction.CCW) }
    // נקודה-נבחרת למחיקה (הקשה סמוך לקודקוד קיים בוחרת; הקשה-במקום-פנוי מוסיפה).
    var selected by rememberSaveable(wall.id) { mutableStateOf(-1) }
    // סטפר-מיקום-אופקי + צעד, ו"מרחק-ירי-ממתין" (dedup לפי ts כמו בלכידת-הצורה)
    var horizMm by rememberSaveable(wall.id) { mutableStateOf(0.0) }
    var stepMm by remember { mutableStateOf(200.0) }
    var pendingDistMm by remember { mutableStateOf<Double?>(null) }
    var pendingVDeg by remember { mutableStateOf<Double?>(null) }
    var pendingHDeg by remember { mutableStateOf<Double?>(null) }
    var lastTs by remember { mutableStateOf(0L) }
    LaunchedEffect(reading?.ts) {
        val r = reading
        val d = r?.distanceMm
        if (r != null && r.ts != lastTs && d != null && d > 0.0) {
            lastTs = r.ts
            pendingDistMm = d
            pendingVDeg = r.vAngleDeg
            pendingHDeg = r.hAngleDeg
        }
    }

    // ── מתאר-החזית המחושב (u,v,e) — נגזר-חי מהנקודות-הגולמיות + המסגור (שיטה A) ──
    val profile = remember(frame, zeroH, zeroV, dir) {
        WallProfileSolver.toElevation(
            frame.map {
                WallProfileSolver.InPoint(
                    plan = if (it.hasPlan) Pt(it.planX, it.planY) else null,
                    v = it.v, manualU = it.manualU, storedE = it.storedE,
                )
            },
            zeroH, zeroV, dir,
        )
    }
    val hasMeasuredU = frame.any { it.hasPlan }
    val maxAbsE = profile.maxOfOrNull { abs(it.e) } ?: 0.0
    // סדר-הצללית (מיון לפי u) — מונע מצולע-צללית מצטלב כשסדר-הלכידה אינו מונוטוני
    // (ביקורת · "פרופיל-u לא-מונוטוני"). קודקודי-המסגרת הממוספרים נשארים בסדר-הלכידה.
    val silhouette = remember(profile) { WallProfileSolver.silhouetteOrder(profile) }

    // ── מצב-אלמנטים: דיאלוגים + קו-סימון (סופיט) ─────────────────────────────
    var editing by remember { mutableStateOf<AccessoryEntity?>(null) }
    var adding by remember { mutableStateOf(false) }
    // קו-הסימון (סופיט) — מזורע מהערך-השמור על-הקיר כדי שישרוד יציאה/כניסה למסך.
    var markerHeight by remember(wall.id, initialSoffitHeight) { mutableStateOf(initialSoffitHeight) }
    var markerDialog by remember { mutableStateOf(false) }

    var boxSize by remember { mutableStateOf(IntSize.Zero) }

    // תיבת-העולם: רוחב/גובה נגזרים מהקיר, ממתאר-המסגרת וגם מהארונות (כדי שגם ארון
    // חורג יישאר גלוי בקנבס — אחרת חריגת-FIT הייתה נחתכת מהתצוגה)
    val cabMaxX = if (planningLayer) (cabinets.maxOfOrNull { it.fromLeft + it.width } ?: 0.0) else 0.0
    val cabMaxY = if (planningLayer) (cabinets.maxOfOrNull { it.heightTo } ?: 0.0) else 0.0
    val worldW = remember(wall.length, profile, cabMaxX) {
        max(wall.length, max(profile.maxOfOrNull { it.u } ?: 0.0, cabMaxX)).coerceAtLeast(1.0)
    }
    val worldH = remember(wall.height, profile, cabMaxY) {
        max(wall.height, max(profile.maxOfOrNull { it.v } ?: 0.0, cabMaxY)).coerceAtLeast(1.0)
    }

    Column(modifier.fillMaxSize().background(Cream)) {

        // ── סרגל-עליון: חזרה + מותג + בורר-מצב ──────────────────────────────
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Spacer(Modifier.width(4.dp))
            Column(Modifier.weight(1f)) {
                Text("soline · חזית קיר", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 22.sp)
                Text(
                    "רוחב ${wall.length.mmU()} · גובה ${wall.height.mmU()} מ\"מ · ${accessories.size} אביזרים · ${frame.size} נק' מסגרת",
                    fontSize = 12.sp, color = Teal,
                )
            }
        }

        // בורר-מצב: מסגרת ↔ אלמנטים
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ModeTab("▦ מסגרת", mode == ElevMode.FRAME, Modifier.weight(1f)) { mode = ElevMode.FRAME }
            ModeTab("⊞ אלמנטים", mode == ElevMode.ELEMENTS, Modifier.weight(1f)) { mode = ElevMode.ELEMENTS }
        }

        // ── בורר-שכבת-התכנון: צ'יפ toggle "שכבת תכנון" + מונה-התנגשויות ──────
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LayerToggle(
                label = if (planningLayer) "◧ שכבת תכנון: דלוקה" else "◧ שכבת תכנון: כבויה",
                on = planningLayer,
                modifier = Modifier.weight(1f),
            ) { planningLayer = !planningLayer }
            if (planningLayer) {
                val hardFit = clashes.count { it.severity != ClashSeverity.INFO }
                val info = clashes.count { it.severity == ClashSeverity.INFO }
                val pillColor = when {
                    hardFit > 0 -> BlockRed
                    info > 0 -> WarnAmber
                    else -> OkGreen
                }
                val pillText = when {
                    hardFit > 0 -> "⚠ $hardFit התנגשויות"
                    info > 0 -> "$info הערות"
                    else -> "✓ מתאים"
                }
                Box(
                    Modifier
                        .background(pillColor.copy(alpha = 0.14f), RoundedCornerShape(12.dp))
                        .border(1.dp, pillColor.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) { Text(pillText, color = pillColor, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
            }
        }

        // ── קנבס-החזית ─────────────────────────────────────────────────────
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(10.dp)
                .background(Color.White, RoundedCornerShape(12.dp))
                .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            // remember ללא-תנאי (לפני כל early-return) — אחרת קריסת-slots ב-Compose
            val wallPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
            val accPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ink.toArgb(); textAlign = Paint.Align.CENTER } }
            val hPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }
            val idxPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Orange.toArgb(); textAlign = Paint.Align.CENTER } }
            val markPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = WarnAmber.toArgb(); textAlign = Paint.Align.LEFT } }
            val cabPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ink.toArgb(); textAlign = Paint.Align.CENTER } }
            val clashPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = BlockRed.toArgb(); textAlign = Paint.Align.CENTER } }

            if (wall.height <= 0.0 || wall.length <= 0.0) {
                Text(
                    "לקיר אין רוחב/גובה תקינים להצגת חזית.",
                    color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center,
                )
                return@Box
            }

            Canvas(
                Modifier
                    .fillMaxSize()
                    .onSizeChanged { boxSize = it }
                    // הקשה: במצב-מסגרת מפילה נקודה; במצב-אלמנטים בוחרת אביזר-לעריכה
                    .pointerInput(mode, wall.id, accessories, profile, worldW, worldH) {
                        detectTapGestures { tap ->
                            val w = boxSize.width.toFloat()
                            val h = boxSize.height.toFloat()
                            if (w <= 0f || h <= 0f) return@detectTapGestures
                            val xf = unifiedFit(worldW, worldH, w, h, PAD_PXU)
                            if (mode == ElevMode.FRAME) {
                                // הקשה סמוך לקודקוד קיים → בחירה (למחיקה); אחרת הוספת-נקודה ידנית.
                                val hitIdx = profile.indexOfFirst { p ->
                                    val sp = Offset(xf.sx(p.u), xf.sy(p.v))
                                    abs(sp.x - tap.x) <= TAP_SLOPU && abs(sp.y - tap.y) <= TAP_SLOPU
                                }
                                if (hitIdx >= 0) {
                                    selected = hitIdx
                                } else {
                                    val x = xf.wx(tap.x).coerceIn(0.0, worldW)
                                    val y = xf.wy(tap.y).coerceIn(0.0, worldH)
                                    frame = frame + FramePt(v = y, manualU = x, planX = 0.0, planY = 0.0, hasPlan = false)
                                    horizMm = x // המשך-הסטפר מהנקודה שהוקשה
                                    selected = -1
                                }
                            } else {
                                val hit = accessories.asReversed().firstOrNull { a ->
                                    val l = xf.sx(a.fromLeft)
                                    val r = xf.sx(a.fromLeft + a.width)
                                    val t = xf.sy(a.fromBottom + a.height)
                                    val b = xf.sy(a.fromBottom)
                                    tap.x >= min(l, r) - TAP_SLOPU && tap.x <= max(l, r) + TAP_SLOPU &&
                                        tap.y >= t - TAP_SLOPU && tap.y <= b + TAP_SLOPU
                                }
                                if (hit != null) editing = hit
                            }
                        }
                    },
            ) {
                val xf = unifiedFit(worldW, worldH, size.width, size.height, PAD_PXU)
                val nc = drawContext.canvas.nativeCanvas

                val botY = xf.sy(0.0)
                val leftX = xf.sx(0.0)
                val rightX = xf.sx(wall.length)

                // ── פני-הקיר: מתאר-חזית אמיתי אם קיים, אחרת מלבן פשוט ──────
                if (silhouette.size >= 2) {
                    // מצולע-צללית: רצפה בנקודה-הראשונה → מתאר-החזית → רצפה בנקודה-האחרונה.
                    // ממוין לפי u (silhouette) כדי שהמתאר לא יצטלב על-עצמו.
                    val path = Path().apply {
                        val p0 = silhouette.first()
                        moveTo(xf.sx(p0.u), botY)
                        for (p in silhouette) lineTo(xf.sx(p.u), xf.sy(p.v))
                        lineTo(xf.sx(silhouette.last().u), botY)
                        close()
                    }
                    drawPath(path, Cream)
                    drawPath(path, Ink, style = Stroke(width = 3.dp.toPx()))
                    // קו-המתאר עצמו — **פס-הגלייה**: כל קטע נצבע לפי ה-e הממוצע שלו
                    // (טורקיז=בליטה-לתוך-החדר + · אדום=הרחק − · ירוק≈0), כמו סקר-המישוריות.
                    for (i in 0 until silhouette.size - 1) {
                        val a = silhouette[i]; val b = silhouette[i + 1]
                        drawLine(
                            undColorU((a.e + b.e) / 2.0),
                            Offset(xf.sx(a.u), xf.sy(a.v)), Offset(xf.sx(b.u), xf.sy(b.v)),
                            strokeWidth = 5.dp.toPx(), cap = StrokeCap.Round,
                        )
                    }
                } else {
                    val topY = xf.sy(wall.height)
                    drawRect(Cream, Offset(leftX, topY), Size(rightX - leftX, botY - topY))
                    drawRect(Ink, Offset(leftX, topY), Size(rightX - leftX, botY - topY), style = Stroke(width = 3.dp.toPx()))
                }

                // ── קו-רצפה — עבה, חורג מעט מעבר לקיר ──────────────────────
                val floorPad = 18.dp.toPx()
                val floorRight = max(rightX, xf.sx(worldW))
                drawLine(
                    Ink, Offset(leftX - floorPad, botY), Offset(floorRight + floorPad, botY),
                    strokeWidth = 5.dp.toPx(), cap = StrokeCap.Round,
                )

                // ── שכבת-התכנון: הארונות המתוכננים, לפי-קנה-מידה על-גבי המדידה ──
                if (planningLayer) {
                    cabPaint.textSize = 12.dp.toPx()
                    for (c in cabinets) {
                        val l = xf.sx(c.fromLeft)
                        val r = xf.sx(c.fromLeft + c.width)
                        val t = xf.sy(c.heightTo)
                        val b = xf.sy(c.heightFrom)
                        val col = cabinetColorU(c.kind)
                        // מילוי חצי-שקוף (רואים דרכו את הקיר והתשתית) + מסגרת מודגשת
                        drawRect(col.copy(alpha = 0.16f), Offset(l, t), Size(r - l, b - t))
                        drawRect(col, Offset(l, t), Size(r - l, b - t), style = Stroke(width = 2.5.dp.toPx()))
                        // קו-אמצע-דלת עדין (רמז-חזית)
                        val midX = (l + r) / 2f
                        drawLine(
                            col.copy(alpha = 0.4f), Offset(midX, t + 4.dp.toPx()), Offset(midX, b - 4.dp.toPx()),
                            strokeWidth = 1.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f), 0f),
                        )
                        // תווית: שם-ארון + חגורה + רוחב, במרכז-הגוף
                        val cy = (t + b) / 2f
                        nc.drawText(c.name, midX, cy - 2.dp.toPx(), cabPaint)
                        nc.drawText(
                            "${beltHeU(c.kind)} · ${c.width.mmU()} מ\"מ",
                            midX, cy + 15.dp.toPx(), cabPaint,
                        )
                    }
                }

                // ── קודקודי-מסגרת ממוספרים + נקודת-ghost חיה (מצב-מסגרת) ────
                if (mode == ElevMode.FRAME) {
                    idxPaint.textSize = 11.dp.toPx()
                    markPaint.textSize = 11.dp.toPx()
                    // מיקומי-קיצון של ההגלייה (לתוויות-נקודה e=±)
                    val eMaxIdx = profile.indices.maxByOrNull { profile[it].e } ?: -1
                    val eMinIdx = profile.indices.minByOrNull { profile[it].e } ?: -1
                    for (i in profile.indices) {
                        val p = profile[i]
                        val s = Offset(xf.sx(p.u), xf.sy(p.v))
                        if (i == selected) drawCircle(BlockRed, 10.dp.toPx(), s, style = Stroke(width = 2.dp.toPx()))
                        drawCircle(undColorU(p.e), 6.dp.toPx(), s)
                        nc.drawText("${i + 1}", s.x, s.y - 12.dp.toPx(), idxPaint)
                        // תווית-הגלייה בקיצון המקומי (וכאשר משמעותי)
                        if ((i == eMaxIdx || i == eMinIdx) && abs(p.e) >= 3.0) {
                            markPaint.color = undColorU(p.e).toArgb()
                            nc.drawText("e=${if (p.e >= 0) "+" else ""}${p.e.roundToInt()}", s.x + 18.dp.toPx(), s.y + 4.dp.toPx(), markPaint)
                        }
                    }
                    // תצוגה-מקדימה של הנקודה-הבאה (מיקום-אופקי נוכחי × גובה-לייזר)
                    val ghostH = laserHeightMm(pendingDistMm ?: liveMm, pendingVDeg ?: liveVDeg)
                    if (ghostH != null) {
                        val g = Offset(xf.sx(horizMm.coerceIn(0.0, worldW)), xf.sy(ghostH.coerceIn(0.0, worldH)))
                        drawLine(
                            Orange.copy(alpha = 0.6f), Offset(g.x, botY), Offset(g.x, g.y),
                            strokeWidth = 2.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f), 0f),
                        )
                        drawCircle(Orange, 7.dp.toPx(), g, style = Stroke(width = 2.dp.toPx()))
                    }
                }

                // ── אלמנטים (מצב-אלמנטים) ──────────────────────────────────
                if (mode == ElevMode.ELEMENTS) {
                    accPaint.textSize = 11.dp.toPx()
                    for (a in accessories) {
                        val l = xf.sx(a.fromLeft)
                        val r = xf.sx(a.fromLeft + a.width)
                        var t = xf.sy(a.fromBottom + a.height)
                        val b = xf.sy(a.fromBottom)
                        var rr = r
                        if (rr - l < MIN_PXU) rr = l + MIN_PXU
                        if (b - t < MIN_PXU) t = b - MIN_PXU
                        val col = accColorU(a.type)
                        drawRect(col.copy(alpha = 0.22f), Offset(l, t), Size(rr - l, b - t))
                        drawRect(col, Offset(l, t), Size(rr - l, b - t), style = Stroke(width = 2.dp.toPx()))
                        val midX = (l + rr) / 2f
                        drawLine(
                            col.copy(alpha = 0.5f), Offset(midX, b), Offset(midX, botY),
                            strokeWidth = 1.5.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f),
                        )
                        nc.drawText(a.name, midX, t - 6.dp.toPx(), accPaint)
                        nc.drawText("h=${a.fromBottom.mmU()} מ\"מ", midX, b + 14.dp.toPx(), accPaint)
                    }

                    // קו-סימון / סופיט (soffit / הנמכת-תקרה) — קו אופקי לרוחב בגובהו
                    markerHeight?.let { mh ->
                        val my = xf.sy(mh.coerceIn(0.0, worldH))
                        drawLine(
                            WarnAmber, Offset(leftX, my), Offset(floorRight, my),
                            strokeWidth = 3.dp.toPx(), cap = StrokeCap.Round,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(20f, 12f), 0f),
                        )
                        markPaint.textSize = 12.dp.toPx()
                        markPaint.color = WarnAmber.toArgb()
                        nc.drawText("קו-סימון h=${mh.mmU()} מ\"מ", leftX + 6.dp.toPx(), my - 6.dp.toPx(), markPaint)
                    }
                }

                // ── התנגשויות: אזורים מסומנים (HARD/FIT אדום · INFO ענבר) + ⚠ ──
                if (planningLayer) {
                    clashPaint.textSize = 15.dp.toPx()
                    for (cl in clashes) {
                        val col = if (cl.severity == ClashSeverity.INFO) WarnAmber else BlockRed
                        val l = xf.sx(cl.region.x)
                        val r = xf.sx(cl.region.x + cl.region.w)
                        val t = xf.sy(cl.region.y + cl.region.h)
                        val b = xf.sy(cl.region.y)
                        val rl = min(l, r); val rr = max(l, r)
                        val rt = min(t, b); val rb = max(t, b)
                        val w = (rr - rl).coerceAtLeast(MIN_PXU)
                        val h = (rb - rt).coerceAtLeast(MIN_PXU)
                        // מילוי-קל + הצללה-אלכסונית (hatch) חתוכה לגבולות-האזור
                        drawRect(col.copy(alpha = 0.18f), Offset(rl, rt), Size(w, h))
                        clipRect(rl, rt, rl + w, rt + h) {
                            val step = 11.dp.toPx()
                            var d = 0f
                            while (d <= w + h) {
                                drawLine(
                                    col.copy(alpha = 0.55f),
                                    Offset(rl + d, rt), Offset(rl + d - h, rt + h),
                                    strokeWidth = 1.5.dp.toPx(),
                                )
                                d += step
                            }
                        }
                        // מסגרת-האזור מודגשת
                        drawRect(col, Offset(rl, rt), Size(w, h), style = Stroke(width = 2.5.dp.toPx()))
                        // סמן-אזהרה במרכז
                        clashPaint.color = col.toArgb()
                        nc.drawText("⚠", (rl + rr) / 2f, rt + (h / 2f) + 5.dp.toPx(), clashPaint)
                    }
                }

                // ── תוויות-מידה: רוחב (למטה) + גובה (בצד-שמאל, מסובבת) ──────
                wallPaint.textSize = 13.dp.toPx()
                nc.drawText("${wall.length.mmU()} מ\"מ", (leftX + rightX) / 2f, botY + 34.dp.toPx(), wallPaint)

                hPaint.textSize = 13.dp.toPx()
                val hx = leftX - 16.dp.toPx()
                val hy = xf.sy(wall.height / 2.0)
                nc.save()
                nc.rotate(-90f, hx, hy)
                nc.drawText("${wall.height.mmU()} מ\"מ", hx, hy, hPaint)
                nc.restore()
            }
        }

        // ── לוח-התנגשויות קומפקטי (מוצג רק כששכבת-התכנון דלוקה ויש ממצאים) ──
        if (planningLayer && clashes.isNotEmpty()) {
            ClashPanel(clashes)
        }

        // ── לוח-תחתון: משתנה לפי-מצב ────────────────────────────────────────
        if (mode == ElevMode.FRAME) {
            FramePanel(
                liveDistMm = pendingDistMm ?: liveMm,
                liveVDeg = pendingVDeg ?: liveVDeg,
                liveHDeg = pendingHDeg ?: liveHDeg,
                pending = pendingDistMm != null,
                horizMm = horizMm,
                stepMm = stepMm,
                onHoriz = { horizMm = it.coerceAtLeast(0.0) },
                onStep = { stepMm = it },
                pointCount = frame.size,
                hasMeasuredU = hasMeasuredU,
                maxAbsE = maxAbsE,
                zeroH = zeroH, zeroV = zeroV, dir = dir,
                onZeroH = { zeroH = it }, onZeroV = { zeroV = it }, onDir = { dir = it },
                connected = connected,
                status = status,
                canCapture = (pendingDistMm ?: liveMm)?.let { it > 0.0 } == true,
                onCapture = {
                    val d = pendingDistMm ?: liveMm
                    if (d != null && d > 0.0) {
                        val vDeg = pendingVDeg ?: liveVDeg
                        val hDeg = pendingHDeg ?: liveHDeg
                        val next = if (hDeg != null) {
                            // עם φ — מיקום-אופקי *נמדד* + הגלייה (plan מלא)
                            val st = WallProfileSolver.shotToStation(d, hDeg, vDeg)
                            frame + FramePt(v = st.z, manualU = horizMm.coerceAtLeast(0.0), planX = st.x, planY = st.y, hasPlan = true)
                        } else {
                            // ללא φ — מיקום-אופקי ידני, e≡0 (fallback X6). ללא זווית-אנכית
                            // תקפה אין גובה — לא לוכדים מרחק-גלם כגובה (מספר-שגוי לנגר).
                            laserHeightMm(d, vDeg)?.let { h ->
                                frame + FramePt(v = h, manualU = horizMm.coerceAtLeast(0.0), planX = 0.0, planY = 0.0, hasPlan = false)
                            }
                        }
                        if (next != null) {
                            frame = next
                            horizMm += stepMm // התקדמות-אופקית אוטומטית ("סריקה")
                            pendingDistMm = null; pendingVDeg = null; pendingHDeg = null
                            selected = -1
                        }
                    }
                },
                canUndo = frame.isNotEmpty(),
                onUndo = {
                    if (frame.isNotEmpty()) {
                        frame = frame.dropLast(1)
                        horizMm = (horizMm - stepMm).coerceAtLeast(0.0)
                        selected = -1
                    }
                },
                canDelete = selected in frame.indices,
                onDelete = {
                    if (selected in frame.indices) {
                        frame = frame.filterIndexed { i, _ -> i != selected }
                        selected = -1
                    }
                },
                canFinish = profile.size >= 2,
                onFinish = { onFramePoints(profile.map { Triple(it.u, it.v, it.e) }, "${zeroH.name}_${zeroV.name}", dir.name) },
                onClear = { frame = emptyList(); horizMm = 0.0; selected = -1 },
            )
        } else {
            ElementsPanel(
                liveMm = liveMm,
                connected = connected,
                status = status,
                markerSet = markerHeight != null,
                onAdd = { adding = true },
                onMarker = { markerDialog = true },
            )
        }
    }

    // ── דיאלוג-עריכה (אביזר קיים) ─────────────────────────────────────────
    editing?.let { acc ->
        AccessoryEditor(
            title = "עריכת ${acc.name}",
            initial = acc,
            liveMm = liveMm,
            liveHeightMm = laserHeightMm(liveMm, liveVDeg),
            confirmLabel = "שמור",
            onConfirm = { onUpdateAccessory(it); editing = null },
            onDismiss = { editing = null },
            // מחיקת-אביזר ממסך-החזית (A4 בביקורת) — מוצג רק בעריכת-אביזר-קיים.
            onDelete = { onDeleteAccessory(acc); editing = null },
        )
    }

    // ── דיאלוג-הוספה (אביזר חדש בגובה-נבחר) ───────────────────────────────
    if (adding) {
        // גובה-מהרצפה נגזר (d·sin θ) — לא המרחק-הגולמי. אין זווית-אנכית ⇒ 300 מ"מ.
        val liveHeightMm = laserHeightMm(liveMm, liveVDeg)
        val default = remember(wall.id, liveHeightMm) {
            AccessoryEntity(
                id = 0,
                wallId = wall.id,
                type = AccType.SOCKET_SINGLE.name,
                name = AccType.SOCKET_SINGLE.he,
                depth = AccType.SOCKET_SINGLE.defaultDepth,
                fromLeft = (wall.length / 2.0),
                width = 86.0,
                fromBottom = liveHeightMm ?: 300.0, // גובה-מהרצפה מהזווית-האנכית; אחרת ברירת-מחדל
                height = 86.0,
            )
        }
        AccessoryEditor(
            title = "הוסף אביזר בגובה",
            initial = default,
            liveMm = liveMm,
            liveHeightMm = liveHeightMm,
            confirmLabel = "הוסף",
            onConfirm = { onAddAccessory(it); adding = false },
            onDismiss = { adding = false },
        )
    }

    // ── דיאלוג-קו-סימון (סופיט) ────────────────────────────────────────────
    if (markerDialog) {
        MarkerDialog(
            initial = markerHeight ?: laserHeightMm(liveMm, liveVDeg) ?: (wall.height * 0.85),
            liveMm = liveMm,
            liveHeightMm = laserHeightMm(liveMm, liveVDeg),
            hasMarker = markerHeight != null,
            onConfirm = { markerHeight = it; onSoffitHeight(it); markerDialog = false },
            onRemove = { markerHeight = null; onSoffitHeight(null); markerDialog = false },
            onDismiss = { markerDialog = false },
        )
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  לוח-מצב-מסגרת: readout-לייזר + סטפר-מיקום-אופקי + כפתורי לכידה/ביטול/סיום.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun FramePanel(
    liveDistMm: Double?,
    liveVDeg: Double?,
    liveHDeg: Double?,
    pending: Boolean,
    horizMm: Double,
    stepMm: Double,
    onHoriz: (Double) -> Unit,
    onStep: (Double) -> Unit,
    pointCount: Int,
    hasMeasuredU: Boolean,
    maxAbsE: Double,
    zeroH: WallProfileSolver.ZeroH,
    zeroV: WallProfileSolver.ZeroV,
    dir: WallProfileSolver.Direction,
    onZeroH: (WallProfileSolver.ZeroH) -> Unit,
    onZeroV: (WallProfileSolver.ZeroV) -> Unit,
    onDir: (WallProfileSolver.Direction) -> Unit,
    connected: String?,
    status: String,
    canCapture: Boolean,
    onCapture: () -> Unit,
    canUndo: Boolean,
    onUndo: () -> Unit,
    canDelete: Boolean,
    onDelete: () -> Unit,
    canFinish: Boolean,
    onFinish: () -> Unit,
    onClear: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp)) {

        // ── סרגל-מסגור: פינת-אפס (2×2) + כיוון (CW/CCW) ────────────────────────
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ZeroCornerPad(zeroH, zeroV, onZeroH, onZeroV)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("כיוון-סריקה", fontSize = 11.sp, color = Muted)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    DirChip("↺ נגד השעון", dir == WallProfileSolver.Direction.CCW) { onDir(WallProfileSolver.Direction.CCW) }
                    DirChip("↻ עם השעון", dir == WallProfileSolver.Direction.CW) { onDir(WallProfileSolver.Direction.CW) }
                }
                // פס-הגלייה: בליטה-מירבית + מקור-המיקום-האופקי (נמדד/ידני)
                Text(
                    buildString {
                        append("בליטה מירבית ${maxAbsE.roundToInt()} מ\"מ · ")
                        append(if (hasMeasuredU) "אופקי נמדד (φ)" else "אופקי ידני — אין φ")
                    },
                    fontSize = 11.sp,
                    color = if (hasMeasuredU) Teal else WarnAmber,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
        Spacer(Modifier.height(8.dp))

        Text(
            "מסגרת: ${if (pointCount == 0) "אין נקודות עדיין" else "$pointCount נקודות על מתאר-החזית"}",
            fontSize = 12.sp, color = if (pointCount >= 2) OkGreen else Muted, fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(6.dp))

        // readout-ענק: מרחק חי/ממתין + גובה-נגזר
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        liveDistMm?.roundToInt()?.toString() ?: "– – –",
                        fontSize = 40.sp, fontWeight = FontWeight.Bold,
                        color = if (pending) Orange else Ink, lineHeight = 42.sp,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("מ\"מ", fontSize = 16.sp, color = Muted, modifier = Modifier.padding(bottom = 5.dp))
                }
                val derived = laserHeightMm(liveDistMm, liveVDeg)
                Text(
                    buildString {
                        append(if (pending) "מרחק-הירי הבא" else "מדידה חיה — לחץ על המכשיר")
                        if (liveVDeg != null) append(" · אנכית ${liveVDeg.roundToInt()}°")
                        if (liveHDeg != null) append(" · φ ${liveHDeg.roundToInt()}°")
                        if (derived != null) append(" · גובה≈${derived.roundToInt()} מ\"מ")
                    },
                    fontSize = 12.sp, color = Teal,
                )
            }
            ConnPill(connected, status)
        }
        Spacer(Modifier.height(8.dp))

        // סטפר-מיקום-אופקי (מ"מ מהשמאל) — מתקדם אוטומטית בכל לכידה
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("אופקי:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
            StepBtn("−", { onHoriz(horizMm - stepMm) })
            Box(
                Modifier.widthIn(min = 96.dp).background(Cream, RoundedCornerShape(10.dp))
                    .border(1.dp, Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) { Text("${horizMm.roundToInt()} מ\"מ", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Ink) }
            StepBtn("+", { onHoriz(horizMm + stepMm) })
        }
        Spacer(Modifier.height(6.dp))
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("צעד:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
            for (s in listOf(50.0, 100.0, 200.0, 300.0, 500.0)) {
                StepChipU("${s.roundToInt()}", stepMm == s) { onStep(s) }
            }
        }
        Spacer(Modifier.height(10.dp))

        // כפתורי-פעולה — שורה 1: קלוט-נקודה + בטל-נקודה
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FieldButton("➕ קלוט נקודה", Orange, canCapture, Modifier.weight(2f), onCapture)
            FieldButton("↩︎ בטל נקודה", BlockRed, canUndo, Modifier.weight(1f), onUndo)
        }
        Spacer(Modifier.height(8.dp))
        // שורה 2: מחק-נבחרת (הקש על קודקוד לבחירה) + נקה
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FieldButton(if (canDelete) "🗑 מחק נקודה נבחרת" else "🗑 בחר קודקוד למחיקה", BlockRed, canDelete, Modifier.weight(2f), onDelete)
            FieldButton("נקה", Muted, canUndo, Modifier.weight(1f), onClear)
        }
        Spacer(Modifier.height(8.dp))
        // שורה 3: סיום
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FieldButton("✓ סיום מסגרת", OkGreen, canFinish, Modifier.weight(1f), onFinish)
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  ZeroCornerPad — לוח 2×2 לבחירת פינת-האפס (LEFT/RIGHT × TOP/BOTTOM) של מתאר-החזית.
 *  הפינה-הנבחרת מודגשת; היא הופכת ל-(u=0, v=0) של השרטוט.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun ZeroCornerPad(
    zeroH: WallProfileSolver.ZeroH,
    zeroV: WallProfileSolver.ZeroV,
    onZeroH: (WallProfileSolver.ZeroH) -> Unit,
    onZeroV: (WallProfileSolver.ZeroV) -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("פינת-אפס", fontSize = 11.sp, color = Muted)
        Spacer(Modifier.height(4.dp))
        // TOP row: LEFT_TOP · RIGHT_TOP ; BOTTOM row: LEFT_BOTTOM · RIGHT_BOTTOM
        for (v in listOf(WallProfileSolver.ZeroV.TOP, WallProfileSolver.ZeroV.BOTTOM)) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (h in listOf(WallProfileSolver.ZeroH.LEFT, WallProfileSolver.ZeroH.RIGHT)) {
                    val on = h == zeroH && v == zeroV
                    Box(
                        Modifier
                            .width(30.dp).height(26.dp)
                            .background(if (on) Orange else Color.White, RoundedCornerShape(6.dp))
                            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                            .clickable { onZeroH(h); onZeroV(v) },
                        contentAlignment = Alignment.Center,
                    ) {
                        val glyph = when {
                            h == WallProfileSolver.ZeroH.LEFT && v == WallProfileSolver.ZeroV.TOP -> "▛"
                            h == WallProfileSolver.ZeroH.RIGHT && v == WallProfileSolver.ZeroV.TOP -> "▜"
                            h == WallProfileSolver.ZeroH.LEFT -> "▙"
                            else -> "▟"
                        }
                        Text(glyph, color = if (on) Color.White else Ink, fontSize = 15.sp)
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
        }
    }
}

/** צ'יפ-כיוון (CW/CCW). */
@Composable
private fun DirChip(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Teal else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Teal else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) { Text(label, color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  לוח-מצב-אלמנטים: לייזר-חי + הוספה-בגובה + קו-סימון.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun ElementsPanel(
    liveMm: Double?,
    connected: String?,
    status: String,
    markerSet: Boolean,
    onAdd: () -> Unit,
    onMarker: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        liveMm?.roundToInt()?.toString() ?: "– – –",
                        fontSize = 40.sp, fontWeight = FontWeight.Bold, color = Ink, lineHeight = 42.sp,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("מ\"מ", fontSize = 16.sp, color = Muted, modifier = Modifier.padding(bottom = 5.dp))
                }
                Text("גובה חי מהלייזר — לחץ על המכשיר בשטח", fontSize = 12.sp, color = Teal)
            }
            ConnPill(connected, status)
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FieldButton("➕ הוסף בגובה", Orange, true, Modifier.weight(2f), onAdd)
            FieldButton(if (markerSet) "קו-סימון ✓" else "קו-סימון", WarnAmber, true, Modifier.weight(1f), onMarker)
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  AccessoryEditor — עורך-מימדים משותף (הוספה/עריכה) עם לכידת-גובה-בלייזר.
 *  שדות: סוג · שם · גובה-מהרצפה (fromBottom) · מרחק-משמאל · רוחב · גובה · עומק.
 *  "קלוט גובה מהלייזר" ממלא גובה-מהרצפה מהקריאה-האחרונה — ONE-SHOT בלחיצה.
 * ───────────────────────────────────────────────────────────────────────────── */
/**
 * עורך-אביזר משותף — ציבורי כדי שגם רשימת-הבליטות הרגילה (WallScreen) תוכל לפתוח
 * אותו בהקשה (A4 בביקורת: עריכה שהייתה קבורה במסך-החזית בלבד).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AccessoryEditor(
    title: String,
    initial: AccessoryEntity,
    liveMm: Double?,
    // גובה-מהרצפה נגזר מהקריאה (d·sin θ) — null כשאין זווית-אנכית תקפה. כפתור
    // "קלוט גובה מהלייזר" פעיל ומזין ממנו בלבד (לא מהמרחק-הגולמי liveMm).
    liveHeightMm: Double? = null,
    confirmLabel: String,
    onConfirm: (AccessoryEntity) -> Unit,
    onDismiss: () -> Unit,
    // מחיקת-אביזר (A4 בביקורת): כשאינו-null מוצג כפתור "מחק אביזר". null ⇒ לא-מוצג
    // (למשל בעת הוספת-אביזר-חדש טרם-שמירה — אין-מה-למחוק).
    onDelete: (() -> Unit)? = null,
    // צילום-מוצמד-לאלמנט (§4): כשאינו-null מוצג כפתור-מצלמה קטן שמצלם תמונת-detail
    // המקושרת ל-elementId של האביזר. null ⇒ לא-מוצג (למשל בעת הוספת-אביזר-חדש טרם-שמירה).
    onCapturePhoto: (() -> Unit)? = null,
) {
    var typeName by remember { mutableStateOf(initial.type) }
    var nameTxt by remember { mutableStateOf(initial.name) }
    var fromBottomTxt by remember { mutableStateOf(initial.fromBottom.mmU()) }
    var fromLeftTxt by remember { mutableStateOf(initial.fromLeft.mmU()) }
    var widthTxt by remember { mutableStateOf(initial.width.mmU()) }
    var heightTxt by remember { mutableStateOf(initial.height.mmU()) }
    var depthTxt by remember { mutableStateOf(initial.depth.mmU()) }

    fun num(s: String, fallback: Double) = s.trim().toDoubleOrNull() ?: fallback

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                onConfirm(
                    initial.copy(
                        type = typeName,
                        name = nameTxt.ifBlank { AccType.of(typeName).he },
                        fromBottom = num(fromBottomTxt, initial.fromBottom),
                        fromLeft = num(fromLeftTxt, initial.fromLeft),
                        width = num(widthTxt, initial.width),
                        height = num(heightTxt, initial.height),
                        depth = num(depthTxt, initial.depth),
                    ),
                )
            }) { Text(confirmLabel, color = Orange, fontWeight = FontWeight.Bold) }
        },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                // "מחק אביזר" מוצג רק בעריכת-אביזר-קיים (onDelete != null).
                onDelete?.let { del -> TextButton(onClick = del) { Text("מחק אביזר", color = BlockRed, fontWeight = FontWeight.Bold) } }
                TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
            }
        },
        title = { Text(title, fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                // לייזר-חי + לכידת-גובה לשדה-הגובה (ONE-SHOT)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(Cream, RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("לייזר חי", fontSize = 11.sp, color = Teal)
                        Text(
                            (liveMm?.roundToInt()?.toString() ?: "– – –") + " מ\"מ",
                            fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink,
                        )
                    }
                    // מתאים-לתוכן (widthIn במקום width קבוע) + תווית-קצרה — כדי שלא ייחתך.
                    FieldButton(
                        "קלוט גובה", Teal, liveHeightMm != null, Modifier.widthIn(min = 120.dp),
                    ) { liveHeightMm?.let { fromBottomTxt = it.mmU() } }
                }
                Spacer(Modifier.height(10.dp))

                // 📷 צילום-מוצמד-לאלמנט (§4) — תמונת-תקריב (detail) הקשורה לאביזר-הזה.
                onCapturePhoto?.let { capture ->
                    FieldButton("📷 צלם תקריב לאלמנט", Orange, true, Modifier.fillMaxWidth()) { capture() }
                    Spacer(Modifier.height(10.dp))
                }

                // בורר-סוג (ממלא שם + עומק-ברירת-מחדל)
                Text("סוג", fontSize = 12.sp, color = Muted)
                Spacer(Modifier.height(4.dp))
                // FlowRow (במקום horizontalScroll) — כל סוגי-האביזרים גלויים בבת-אחת,
                // בלי קטגוריות נסתרות מעבר-לקצה (אפורדנס-גילוי · תיקון-4).
                FlowRow(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    for (t in AccType.entries) {
                        TypeChipU(t.he, typeName == t.name) {
                            typeName = t.name
                            if (nameTxt.isBlank() || AccType.entries.any { it.he == nameTxt }) nameTxt = t.he
                            if (depthTxt.trim().toDoubleOrNull() == null || depthTxt == "0") depthTxt = t.defaultDepth.mmU()
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))

                NumRow("שם", nameTxt, KeyboardType.Text) { nameTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("גובה מהרצפה (מ\"מ)", fromBottomTxt, KeyboardType.Number) { fromBottomTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("מרחק משמאל (מ\"מ)", fromLeftTxt, KeyboardType.Number) { fromLeftTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("רוחב (מ\"מ)", widthTxt, KeyboardType.Number) { widthTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("גובה (מ\"מ)", heightTxt, KeyboardType.Number) { heightTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("עומק-בליטה (מ\"מ)", depthTxt, KeyboardType.Number) { depthTxt = it }
            }
        },
        containerColor = Color.White,
    )
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  MarkerDialog — קו-סימון / סופיט (soffit / הנמכת-תקרה): גובהו מהרצפה.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun MarkerDialog(
    initial: Double,
    liveMm: Double?,
    // גובה-מהרצפה נגזר (d·sin θ); null ⇒ אין זווית-אנכית ⇒ כפתור-הלכידה מושבת.
    liveHeightMm: Double? = null,
    hasMarker: Boolean,
    onConfirm: (Double) -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    var hTxt by remember { mutableStateOf(initial.mmU()) }
    fun num(s: String, fallback: Double) = s.trim().toDoubleOrNull() ?: fallback

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { onConfirm(num(hTxt, initial)) }) {
                Text("שמור", color = Orange, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            if (hasMarker) TextButton(onClick = onRemove) { Text("הסר קו", color = BlockRed) }
            else TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
        },
        title = { Text("קו-סימון (סופיט / הנמכת-תקרה)", fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            Column {
                Row(
                    Modifier.fillMaxWidth().background(Cream, RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("לייזר חי", fontSize = 11.sp, color = Teal)
                        Text((liveMm?.roundToInt()?.toString() ?: "– – –") + " מ\"מ", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                    }
                    FieldButton("קלוט גובה", Teal, liveHeightMm != null, Modifier.widthIn(min = 120.dp)) {
                        liveHeightMm?.let { hTxt = it.mmU() }
                    }
                }
                Spacer(Modifier.height(10.dp))
                NumRow("גובה-קו מהרצפה (מ\"מ)", hTxt, KeyboardType.Number) { hTxt = it }
            }
        },
        containerColor = Color.White,
    )
}

/* ─── רכיבי-UI משותפים (file-private) ────────────────────────────────────────── */

@Composable
private fun NumRow(label: String, value: String, kb: KeyboardType, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = kb),
        modifier = Modifier.fillMaxWidth(),
    )
}

// כפתור-השדה מסב אל BigActionButton המשותף (מימוש-הכפתור היחיד). שומר על צפיפות-השדה
// (17sp · ריפוד-צמוד) כדי שתוויות-דחוסות בשורות weight לא ייחתכו, ועל יעד-מגע ≥56dp.
@Composable
private fun FieldButton(
    label: String,
    container: Color,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    BigActionButton(
        label, onClick, modifier = modifier, container = container, enabled = enabled,
        fontSize = 17.sp,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp),
    )
}

/** צ'יפ-toggle לשכבת-התכנון: דלוק=כתום-מלא, כבוי=מתאר בלבד. */
@Composable
private fun LayerToggle(label: String, on: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val bg = if (on) Orange else Color.White
    val fg = if (on) Color.White else Muted
    Box(
        modifier
            .heightIn(min = 44.dp)
            .background(bg, RoundedCornerShape(12.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 15.sp, fontWeight = FontWeight.Bold) }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  ClashPanel — רשימת-התנגשויות קומפקטית מתחת לשרטוט: כותרת-סיכום + שורה לכל
 *  ממצא, צבועה לפי-חומרה (HARD/FIT אדום · INFO ענבר). גלילה-אנכית אם ארוך.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun ClashPanel(clashes: List<ElevationClash>) {
    Column(
        Modifier.fillMaxWidth().background(Color.White)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        val hardFit = clashes.count { it.severity != ClashSeverity.INFO }
        val head = ElevationFit.summaryLine(clashes)
        Text(
            head, fontSize = 13.sp, fontWeight = FontWeight.Bold,
            color = if (hardFit > 0) BlockRed else WarnAmber,
        )
        Spacer(Modifier.height(6.dp))
        Column(Modifier.fillMaxWidth().heightIn(max = 116.dp).verticalScroll(rememberScrollState())) {
            for (cl in clashes) {
                val col = if (cl.severity == ClashSeverity.INFO) WarnAmber else BlockRed
                val icon = if (cl.severity == ClashSeverity.INFO) "•" else "⚠"
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(icon, color = col, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(8.dp))
                    Text(cl.message, color = Ink, fontSize = 13.sp, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ModeTab(label: String, on: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val bg = if (on) Orange else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        modifier
            .heightIn(min = 46.dp)
            .background(bg, RoundedCornerShape(12.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 16.sp, fontWeight = FontWeight.Bold) }
}

// סטפר −/+ מסב גם-הוא אל BigActionButton המשותף (טורקיז · 22sp · ריפוד-צמוד).
@Composable
private fun StepBtn(label: String, onClick: () -> Unit) {
    BigActionButton(
        label, onClick, modifier = Modifier.widthIn(min = 52.dp), container = Teal,
        fontSize = 22.sp,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
    )
}

@Composable
private fun StepChipU(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Orange else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) { Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun TypeChipU(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Teal else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Teal else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) { Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ConnPill(connected: String?, status: String) {
    val on = connected != null
    val fg = if (on) OkGreen else WarnAmber
    Box(
        Modifier
            .widthIn(max = 150.dp)
            .background(fg.copy(alpha = 0.14f), RoundedCornerShape(12.dp))
            .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (on) "● מחובר" else "○ מנותק", color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(connected ?: status, color = fg, fontSize = 10.sp, textAlign = TextAlign.Center, maxLines = 2)
        }
    }
}

// קבועי-ציור (פיקסלים לוגיים)
private const val PAD_PXU = 90f
private const val MIN_PXU = 22f
private const val TAP_SLOPU = 24f
