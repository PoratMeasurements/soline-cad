package il.co.soline.measure.ui.p2p

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.StationSolver
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.BigActionButton
import il.co.soline.measure.ui.components.BrandHeader
import il.co.soline.measure.ui.components.SolineCard
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 * P2PMeasureScreen — מדידת-P2P אמיתית של Leica X6 + DST 360-X (CVSM §6.1 P2P · §7.6
 * כיול-עמדה). המודד עומד בעמדה-אחת ו**יורה כל פינה של החדר**; כל ירייה נותנת שלישייה
 * כדורית (מרחק + זווית-אופקית azimuth + זווית-אנכית) שנופלת ישירות למקומה בתוכנית
 * דרך [StationSolver.toPlan] (r=d·cosθ · x=r·cosφ · y=r·sinφ). הפינות הסדורות בונות
 * מתאר-קירות סגור דרך [StationSolver.cornersToWalls] — בלי משולש-הזהב ובלי מדידות-
 * אלכסון נוספות, בדיוק כמו תחנה-טוטאלית.
 *
 * הזרימה:
 *   1) כיול-עמדה — המכשיר על חצובה (DST 360-X). העמדה = ראשית-החדר (0,0). לא זזים.
 *   2) ירי-פינות — "ירה פינה" לכל פינה לפי-סדר (CCW או CW — הכיוון נגזר מהזוויות
 *      עצמן, לא מונח). תוכנית-חיה מציירת את המצולע וקווי-הראייה מהעמדה תוך-כדי.
 *      עריכה/מחיקה/ביטול לכל פינה + הוספה-ידנית (מרחק+אזימוט) לגיבוי/תיקון.
 *   3) סגירה+גובה — מתג "מתאר-סגור" וגובה-אחיד → "סיום ושמירה" מחזיר List<WallEntity>.
 *
 * דרוש DST 360-X לזווית-האופקית (Reading.hAngleDeg). בלעדיו המסך מזהיר: X6-לבד
 * מספק מרחק+זווית-אנכית בלבד ולא ניתן למקם פינות במרחב.
 *
 * RTL מלא, לשון-זכר, מטרות-מגע גדולות. עצמאי: קורא SolineApp.instance.ble.lastReading
 * וטוקני-צבע-מותג בלבד. שורד-סיבוב (rememberSaveable · B2) עד "סיום".
 * ──────────────────────────────────────────────────────────────────────────── */

private enum class Phase { STATION, BUILD }

@Composable
fun P2PMeasureScreen(
    roomId: Long,
    defaultHeightMm: Double = 2700.0,
    onDone: (List<WallEntity>) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ble = remember { SolineApp.instance.ble }
    val last by ble.lastReading.collectAsStateWithLifecycle(null)
    val connected by ble.connected.collectAsStateWithLifecycle(null)

    var phase by rememberSaveable { mutableStateOf(Phase.STATION) }
    var closed by rememberSaveable { mutableStateOf(true) }
    var heightText by rememberSaveable { mutableStateOf("") }

    // ── פינות-החדר שנורו (נקודות-תוכנית 2D יחסית-לעמדה, מ"מ) ──
    // שורד-סיבוב/יציאה (rememberSaveable · B2) — לא מאבד את הסקר עד "סיום".
    val cornersSaver = remember {
        Saver<SnapshotStateList<WallBuilder.Pt>, DoubleArray>(
            save = { list -> DoubleArray(list.size * 2).also { a -> list.forEachIndexed { i, p -> a[i * 2] = p.x; a[i * 2 + 1] = p.y } } },
            restore = { a -> (a.indices step 2).map { WallBuilder.Pt(a[it], a[it + 1]) }.toMutableStateList() },
        )
    }
    val corners = rememberSaveable(saver = cornersSaver) { mutableStateListOf<WallBuilder.Pt>() }

    // ── הוספה-ידנית / עריכה (מרחק + אזימוט) — גיבוי ותיקון-פינה ──
    var manDist by remember { mutableStateOf("") }
    var manAz by remember { mutableStateOf("") }
    // אינדקס-הפינה-הנערכת: כשאינו null העדכון נכתב **במקום** (corners[i]=) ולא-מתווסף
    // בסוף — כדי לשמר את סדר-הפינות=סדר-הקירות (עריכת-פינה-אמצעית לא משבשת את המצולע).
    var editIndex by rememberSaveable { mutableStateOf<Int?>(null) }
    // כיווניות-הבנייה (CCW ברירת-מחדל / CW). מתג-שדה יחיד נגד תוכנית-מראה.
    var cwHanded by rememberSaveable { mutableStateOf(false) }

    // ── דיאלוגי-אישור לפעולות-הרסניות ──
    var showClearConfirm by remember { mutableStateOf(false) }
    var showBackConfirm by remember { mutableStateOf(false) }

    // ── קליטה חד-פעמית מהלייזר (arm → הירייה-הבאה בלבד, ts>armedFrom) ──
    var armed by remember { mutableStateOf(false) }
    var armedFrom by remember { mutableStateOf(Long.MAX_VALUE) }
    var armCancelled by remember { mutableStateOf(false) }
    LaunchedEffect(last) {
        val r = last
        val dist = r?.distanceMm
        // דורש זווית-אופקית (DST 360-X) — ירייה בלי hAngle מפילה את הפינות על-קו.
        if (armed && r != null && dist != null && dist.isFinite() && dist > 0.0 && r.hAngleDeg != null && r.ts > armedFrom) {
            val pt = StationSolver.toPlan(dist, r.hAngleDeg, r.vAngleDeg, cwHanded)
            val ei = editIndex
            if (ei != null && ei in corners.indices) corners[ei] = pt else corners.add(pt)
            editIndex = null
            armed = false
            armedFrom = Long.MAX_VALUE
        }
    }
    // ניתוק-BLE בזמן-זִיון → מבטלים כדי שלא-ייקלט לפינה-שגויה אחרי-חיבור-מחדש.
    LaunchedEffect(connected) {
        if (connected == null && armed) {
            armed = false
            armedFrom = Long.MAX_VALUE
            armCancelled = true
        }
    }
    fun armShot() { armCancelled = false; armed = true; armedFrom = last?.ts ?: 0L }

    // סקירת-האזימוט (poll של DST 360-X) רצה **רק** בזמן שמסך-P2P מוצג — מחוץ לו היא מציפה
    // את החיבור באפסים ומחניקה את notify-המרחק. הדלקה בכניסה, כיבוי ביציאה.
    DisposableEffect(Unit) {
        ble.setP2pActive(true)
        onDispose { ble.setP2pActive(false) }
    }

    fun p(s: String): Double? = s.trim().replace(',', '.').toDoubleOrNull()
    val captureMm: Double? = last?.distanceMm?.takeIf { it.isFinite() && it > 0.0 }
    val liveHAngle: Double? = last?.hAngleDeg
    val hAngleMissing = connected != null && last != null && liveHAngle == null
    // מצב-מכשיר: מרחק מגיע אבל בלי זווית-אנכית ⇒ ה-X6 במצב-מרחק (DIST), לא Measure-3D/P2P.
    // (מ-docs/X6_LEVELLING_P2P.md: הזוויות+האזימוט מתעוררים רק בבחירת פונקציית-P2P על המכשיר.)
    val distModeHint = connected != null && captureMm != null && last?.vAngleDeg == null

    fun addManualCorner() {
        val d = p(manDist); val az = p(manAz)
        if (d != null && d > 0 && az != null) {
            val pt = StationSolver.toPlan(d, az, 0.0, cwHanded)
            val ei = editIndex
            if (ei != null && ei in corners.indices) corners[ei] = pt else corners.add(pt)
            editIndex = null
            manDist = ""; manAz = ""
        }
    }
    fun cancelEdit() { editIndex = null; manDist = ""; manAz = "" }
    // החלפת-כיווניות: משקף את הפינות-הקיימות (y→−y = φ→−φ) כדי שהמתג יתקן את המתאר
    // **בשטח** ולא רק ירְיות-עתידיות; ירְיות-חדשות נופלות באותו מסגרת דרך cwHanded.
    fun setHanded(cw: Boolean) {
        if (cw == cwHanded) return
        cwHanded = cw
        for (i in corners.indices) corners[i] = WallBuilder.Pt(corners[i].x, -corners[i].y)
    }
    // פינות-חופפות (ירייה-כפולה) — לאזהרה; המיזוג-בפועל ב-cornersToWalls.
    val coincident = StationSolver.dedupeCorners(corners.toList(), closed).size != corners.size

    val height = p(heightText)?.takeIf { it > 0 } ?: defaultHeightMm
    val heightMeasured = p(heightText).let { it != null && it > 0 }

    // תצוגת-תוכנית + פלט-סיום נגזרים מהפינות.
    val previewWalls: List<WallEntity> = remember(corners.toList(), height, closed) {
        StationSolver.cornersToWalls(corners.toList(), height, roomId, closed, heightMeasured)
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(
            modifier.fillMaxSize().background(Cream).verticalScroll(rememberScrollState()),
        ) {
            // ── כותרת + חיווי-לייזר (BrandHeader משותף · חץ-חזרה RTL-נכון) ──
            BrandHeader(
                "מדידת P2P · ירי-פינות מהעמדה",
                onBack = { if (corners.isNotEmpty()) showBackConfirm = true else onBack() },
                subtitle = "Leica X6 + DST 360-X — כל פינה נופלת לתוכנית",
                trailing = { LaserBadge(connected != null, captureMm, liveHAngle) },
            )

            when (phase) {
                // ═══════════════════ שלב 1: כיול-עמדה ═══════════════════
                Phase.STATION -> {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        InfoCard(
                            "שלב 1 · כיול-עמדה",
                            "הצב את המכשיר על חצובה עם DST 360-X בנקודה אחת בחדר. העמדה נקבעת כראשית " +
                                "(0,0) וכל פינה שתירֶה נופלת ישירות למקומה בתוכנית לפי המרחק + הזווית-האופקית " +
                                "(azimuth) + הזווית-האנכית.\n\n" +
                                "⚠️ אל תזיז את החצובה עד סוף-הסקר — הזזה פוסלת את מערכת-העמדה.",
                        )
                        if (connected == null) {
                            WarnCard("הלייזר מנותק — לירי-אוטומטי חבר את ה-X6.")
                            InfoHint("לבדיקה בלי-לייזר: לחץ \"קבע עמדה\" והמשך — בשלב-הבא אפשר להזין כל פינה ידנית (מרחק + אזימוט), בלי צורך במכשיר.")
                        } else if (hAngleMissing) {
                            WarnCard(
                                "DST 360-X לא מזוהה (אין זווית-אופקית). שיטת-הפינות דורשת את המתאם כדי " +
                                    "למקם פינות במרחב. אפשר להמשיך ידנית (מרחק+אזימוט) לבדיקה.",
                            )
                        }
                        if (distModeHint) {
                            WarnCard(
                                "המכשיר במצב מרחק (DIST) — אין זוויות. בחר על מסך-ה-X6 את פונקציית " +
                                    "Measure 3D / P2P, פַלֵּס את המכשיר, וירֵה — אז הזווית והאזימוט יתחילו לזרום.",
                            )
                        }
                        BigActionButton(
                            "📍 קבע עמדה כראשית והתחל",
                            { phase = Phase.BUILD },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }

                // ═══════════════════ שלב 2: ירי-פינות ═══════════════════
                Phase.BUILD -> {
                    // תוכנית-חיה
                    SectionLabel("תוכנית-חיה (${corners.size} פינות · ${previewWalls.size} קירות)")
                    Box(
                        Modifier.fillMaxWidth().height(260.dp).padding(horizontal = 12.dp)
                            .background(Color.White, RoundedCornerShape(12.dp))
                            .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (corners.isEmpty()) {
                            Text("ירֵה את הפינה הראשונה כדי לראות תוכנית", color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center)
                        } else {
                            PlanCanvas(corners.toList(), closed)
                        }
                    }

                    if (hAngleMissing) {
                        Box(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                            WarnCard("אין זווית-אופקית (DST 360-X) — הפינות ייפלו על קו אחד. חבר את המתאם.")
                        }
                    }
                    if (coincident) {
                        Box(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                            WarnCard("פינות חופפות (מרחק < ${StationSolver.MIN_CORNER_SEP_MM.roundToInt()} מ\"מ) אוחדו — ירייה-כפולה לא תיצור קיר-אפס.")
                        }
                    }

                    // ── כיווניות-בנייה (CW/CCW) — מתג-שדה יחיד נגד תוכנית-מראה ──
                    SectionLabel("כיווניות-הבנייה")
                    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ChoiceChip("נגד-כיוון-השעון ↺", !cwHanded) { setHanded(false) }
                            ChoiceChip("עם-כיוון-השעון ↻", cwHanded) { setHanded(true) }
                        }
                        Text(
                            "האם התוכנית-החיה תואמת לצורת-החדר? אם היא יוצאת מראה-הפוכה — החלף כיווניות.",
                            color = Muted, fontSize = 12.sp,
                        )
                    }

                    // ── ירי-פינה ──
                    SectionLabel("ירי-פינות")
                    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("כוון אל כל פינה של החדר לפי-הסדר ולחץ \"ירה פינה\".", color = Muted, fontSize = 12.sp)
                        BigActionButton(
                            when {
                                armed -> "📡 ממתין לירייה…"
                                editIndex != null -> "🎯 עדכן פינה ${editIndex!! + 1}"
                                else -> "🎯 ירה פינה ${corners.size + 1}"
                            },
                            { armShot() },
                            modifier = Modifier.fillMaxWidth(),
                            // חסום ירייה בלי מרחק **או** בלי זווית-אופקית (מונע פינות-על-קו).
                            container = if (armed) Teal else Orange,
                            enabled = captureMm != null && !hAngleMissing,
                        )
                        if (armCancelled) {
                            WarnCard("מכשיר נותק — ירייה בוטלה. חבר מחדש וירֵה שוב.")
                        }
                        // ירי-לייזר-אוטומטי חסום ⇒ הסבר-בהיר במקום כפתור-מת (הפינות עדיין ניתנות
                        // להזנה-ידנית למטה, גם בלי לייזר/מתאם — כך המסך לעולם לא "מת ללא-משוב").
                        if (!armed) {
                            when {
                                connected == null -> InfoHint("ירי-אוטומטי כבוי — הלייזר מנותק. הזן את הפינה ידנית למטה (מרחק + אזימוט), או חבר את ה-X6.")
                                hAngleMissing -> InfoHint("ירי-אוטומטי כבוי — אין DST 360-X (זווית-אופקית). הזן את הפינה ידנית למטה (מרחק + אזימוט).")
                                captureMm == null -> InfoHint("אין קריאת-מרחק עדיין — כוון וירֵה עם הלייזר, או הזן את הפינה ידנית למטה.")
                            }
                        }

                        // הוספה/עריכה ידנית (מרחק + אזימוט)
                        Text(
                            when {
                                editIndex != null -> "עריכת פינה ${editIndex!! + 1} (מרחק + אזימוט) — נכתב במקומה"
                                connected == null || hAngleMissing -> "הזנה ידנית (מרחק + אזימוט) — הדרך לבדוק בלי לייזר/מתאם"
                                else -> "הוספה ידנית (גיבוי / תיקון): מרחק + אזימוט"
                            },
                            color = if (editIndex != null) Orange else Muted, fontSize = 12.sp,
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = manDist, onValueChange = { manDist = it },
                                label = { Text("מרחק", fontSize = 13.sp) }, suffix = { Text("מ\"מ", color = Muted) },
                                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f),
                            )
                            OutlinedTextField(
                                value = manAz, onValueChange = { manAz = it },
                                label = { Text("אזימוט", fontSize = 13.sp) }, suffix = { Text("°", color = Muted) },
                                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f),
                            )
                            BigActionButton(
                                if (editIndex != null) "עדכן" else "הוסף",
                                { addManualCorner() },
                                container = Teal,
                                enabled = p(manDist).let { it != null && it > 0 } && p(manAz) != null,
                                fontSize = 15.sp,
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                            )
                        }
                        if (editIndex != null) {
                            OutlinedButton(onClick = { cancelEdit() }, modifier = Modifier.fillMaxWidth()) {
                                Text("✕ בטל עריכה")
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { if (corners.isNotEmpty()) { if (editIndex != null) cancelEdit(); corners.removeAt(corners.lastIndex) } },
                                enabled = corners.isNotEmpty(), modifier = Modifier.weight(1f),
                            ) { Text("↶ בטל אחרונה") }
                            OutlinedButton(
                                onClick = { showClearConfirm = true },
                                enabled = corners.isNotEmpty(), modifier = Modifier.weight(1f),
                            ) { Text("🗑 נקה הכל") }
                        }
                    }

                    // ── רשימת-פינות (מרחק+אזימוט מהעמדה) עם עריכה/מחיקה ──
                    if (corners.isNotEmpty()) {
                        SectionLabel("פינות שנורו")
                        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            corners.forEachIndexed { i, c ->
                                val r = hypot(c.x, c.y)
                                val az = Math.toDegrees(kotlin.math.atan2(c.y, c.x))
                                Row(
                                    Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(10.dp)).padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Box(
                                        Modifier.size(30.dp).background(Teal.copy(alpha = 0.14f), RoundedCornerShape(8.dp)),
                                        contentAlignment = Alignment.Center,
                                    ) { Text("${i + 1}", color = Teal, fontWeight = FontWeight.Bold, fontSize = 14.sp) }
                                    Text(
                                        "מרחק ${r.roundToInt()} · אזימוט ${az.roundToInt()}°",
                                        color = Ink, fontSize = 13.sp, modifier = Modifier.weight(1f),
                                    )
                                    OutlinedButton(
                                        // עריכה **במקום**: טוען מרחק/אזימוט ומסמן editIndex — הכתיבה-חזרה
                                        // תשמור על מיקום-הפינה (בלי remove+append שמשבש את המצולע).
                                        onClick = { manDist = r.roundToInt().toString(); manAz = az.roundToInt().toString(); editIndex = i },
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                    ) { Text("✎", fontSize = 14.sp) }
                                    OutlinedButton(
                                        onClick = { if (editIndex != null) cancelEdit(); corners.removeAt(i) },
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                    ) { Text("🗑", fontSize = 14.sp) }
                                }
                            }
                        }
                    }

                    // ── קירות שייגזרו + אורכים ──
                    if (previewWalls.isNotEmpty()) {
                        SectionLabel("קירות (${previewWalls.size})")
                        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            previewWalls.forEachIndexed { i, w ->
                                Row(
                                    Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(10.dp)).padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        "קיר ${i + 1}: אורך ${w.length.roundToInt()} מ\"מ" +
                                            (if (i < previewWalls.lastIndex || closed) " · פינה ${(180 - kotlin.math.abs(w.angle)).roundToInt()}°" else ""),
                                        color = Ink, fontSize = 13.sp,
                                    )
                                }
                            }
                        }
                    }

                    // ── סגירה + גובה ──
                    SectionLabel("סגירה וגובה")
                    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ChoiceChip("מתאר-סגור ⭕", closed) { closed = true }
                            ChoiceChip("מתאר-פתוח 〰", !closed) { closed = false }
                        }
                        OutlinedTextField(
                            value = heightText, onValueChange = { heightText = it },
                            label = { Text("גובה-קירות (ברירת-מחדל ${defaultHeightMm.roundToInt()})", fontSize = 14.sp) },
                            suffix = { Text("מ\"מ", color = Muted) },
                            singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    // ── סיום ──
                    Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        BigActionButton(
                            "💾 סיום ושמירת ${previewWalls.size} קירות",
                            { onDone(previewWalls) },
                            modifier = Modifier.fillMaxWidth(),
                            container = OkGreen,
                            enabled = previewWalls.isNotEmpty(),
                        )
                    }
                    Spacer(Modifier.height(20.dp))
                }
            }
        }

        // ── דיאלוגי-אישור לפעולות-הרסניות (נקה-הכל · חזרה-עם-פינות) ──
        if (showClearConfirm) {
            AlertDialog(
                onDismissRequest = { showClearConfirm = false },
                title = { Text("לנקות את כל הפינות?") },
                text = { Text("${corners.size} פינות שנורו יימחקו. לא ניתן לשחזר.") },
                confirmButton = {
                    TextButton(onClick = { cancelEdit(); corners.clear(); showClearConfirm = false }) {
                        Text("נקה הכל", color = BlockRed, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = { TextButton(onClick = { showClearConfirm = false }) { Text("ביטול") } },
            )
        }
        if (showBackConfirm) {
            AlertDialog(
                onDismissRequest = { showBackConfirm = false },
                title = { Text("לצאת בלי לשמור?") },
                text = { Text("יש ${corners.size} פינות שטרם נשמרו. יציאה תמחק אותן.") },
                confirmButton = {
                    TextButton(onClick = { showBackConfirm = false; onBack() }) {
                        Text("צא בלי לשמור", color = BlockRed, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = { TextButton(onClick = { showBackConfirm = false }) { Text("הישאר") } },
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// רכיבי-משנה
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun LaserBadge(connected: Boolean, mm: Double?, hAngle: Double?) {
    val (bg, fg, txt) = when {
        !connected -> Triple(Muted.copy(alpha = 0.15f), Muted, "לייזר מנותק")
        mm != null -> Triple(OkGreen.copy(alpha = 0.15f), OkGreen, "📏 ${mm.roundToInt()}" + (hAngle?.let { " · φ${it.roundToInt()}°" } ?: ""))
        hAngle != null -> Triple(Teal.copy(alpha = 0.15f), Teal, "φ ${hAngle.roundToInt()}° — ירֵה")
        else -> Triple(Teal.copy(alpha = 0.15f), Teal, "מחובר — ירֵה")
    }
    Box(Modifier.background(bg, RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 7.dp)) {
        Text(txt, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
        modifier = Modifier.fillMaxWidth().padding(start = 16.dp, top = 14.dp, bottom = 4.dp),
    )
}

@Composable
private fun InfoCard(title: String, body: String) {
    SolineCard {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, color = Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text(body, color = Muted, fontSize = 13.sp)
        }
    }
}

@Composable
private fun WarnCard(body: String) {
    Box(
        Modifier.fillMaxWidth().background(BlockRed.copy(alpha = 0.10f), RoundedCornerShape(10.dp))
            .border(1.dp, BlockRed.copy(alpha = 0.35f), RoundedCornerShape(10.dp)).padding(12.dp),
    ) { Text(body, color = BlockRed, fontSize = 13.sp, fontWeight = FontWeight.Medium) }
}

/** רמז-הכוונה עדין (טורקיז, לא-מאיים) — מסביר *למה* פעולה חסומה ומפנה לנתיב-החלופי,
 *  כדי שכפתור-מושבת לעולם לא ייראה כמסך-מת ללא-משוב. */
@Composable
private fun InfoHint(body: String) {
    Box(
        Modifier.fillMaxWidth().background(Teal.copy(alpha = 0.10f), RoundedCornerShape(10.dp))
            .border(1.dp, Teal.copy(alpha = 0.30f), RoundedCornerShape(10.dp)).padding(12.dp),
    ) { Text(body, color = Teal, fontSize = 13.sp, fontWeight = FontWeight.Medium) }
}

@Composable
private fun ChoiceChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected) Teal else Color.White,
            contentColor = if (selected) Color.White else Ink,
        ),
        border = if (selected) null else BorderStroke(1.dp, Muted.copy(alpha = 0.4f)),
        contentPadding = PaddingValues(vertical = 10.dp, horizontal = 12.dp),
    ) { Text(label, fontSize = 13.sp) }
}

/**
 * תוכנית-חיה: מצייר את **מתאר-הפינות עצמן** (נקודות-תוכנית יחסית-לעמדה) עם אוטו-פיט,
 * את העמדה בראשית (0,0), קווי-ראייה מהעמדה לכל פינה, ומספרי-פינות. הפינה-האחרונה
 * מודגשת בכתום. [closed]=true מצייר גם את קטע-הסגירה חזרה לפינה-הראשונה.
 */
@Composable
private fun PlanCanvas(corners: List<WallBuilder.Pt>, closed: Boolean) {
    Canvas(Modifier.fillMaxSize().padding(14.dp)) {
        if (corners.isEmpty()) return@Canvas
        // כולל את העמדה (0,0) בתחום-הצפייה כדי שתמיד תיראה.
        var minX = 0.0; var minY = 0.0; var maxX = 0.0; var maxY = 0.0
        for (c in corners) { minX = min(minX, c.x); minY = min(minY, c.y); maxX = max(maxX, c.x); maxY = max(maxY, c.y) }
        val pad = 22f
        val spanX = max(maxX - minX, 1.0); val spanY = max(maxY - minY, 1.0)
        val scale = min((size.width - 2 * pad) / spanX, (size.height - 2 * pad) / spanY).let { if (it.isFinite() && it > 0) it else 1.0 }
        val cx = (minX + maxX) / 2.0; val cy = (minY + maxY) / 2.0
        fun sx(x: Double) = ((x - cx) * scale + size.width / 2f).toFloat()
        fun sy(y: Double) = ((cy - y) * scale + size.height / 2f).toFloat()

        val station = Offset(sx(0.0), sy(0.0))
        // קווי-ראייה מהעמדה לכל פינה (מקווקו, עדין)
        val dash = PathEffect.dashPathEffect(floatArrayOf(6f, 6f))
        for (c in corners) {
            drawLine(Muted.copy(alpha = 0.35f), station, Offset(sx(c.x), sy(c.y)), strokeWidth = 1.5f, pathEffect = dash)
        }
        // מתאר-הפינות
        for (i in 0 until corners.size - 1) {
            val a = corners[i]; val b = corners[i + 1]
            val lastSeg = i == corners.size - 2
            drawLine(
                if (lastSeg) Orange else Teal,
                Offset(sx(a.x), sy(a.y)), Offset(sx(b.x), sy(b.y)),
                strokeWidth = if (lastSeg) 7f else 5f, cap = StrokeCap.Round,
            )
        }
        // קטע-סגירה
        if (closed && corners.size >= 3) {
            val a = corners.last(); val b = corners.first()
            drawLine(Teal.copy(alpha = 0.6f), Offset(sx(a.x), sy(a.y)), Offset(sx(b.x), sy(b.y)), strokeWidth = 4f, cap = StrokeCap.Round)
        }
        // קודקודי-פינה
        for (c in corners) drawCircle(Ink, 6f, Offset(sx(c.x), sy(c.y)))
        // עמדה (ראשית) מודגשת
        drawCircle(Orange, 10f, station, style = Stroke(width = 3f))
        drawCircle(Orange, 3f, station)
    }
}
