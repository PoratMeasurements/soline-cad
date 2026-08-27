package il.co.soline.measure.ui.view3d

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.data.leftEdgeMm
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Teal
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/* ─────────────────────────────────────────────────────────────────────────────
 * תצוגת 3D חיה של החדר (MICHAEL_WISHLIST §4 — "תצוגת 3D").
 *
 * קנבס Compose עם היטל איזומטרי/אלכסוני שנכתב-ביד (בלי מנוע-3D ובלי תלויות חדשות).
 * מוצג באופן קבוע במהלך המדידה כדי שהמודד יאמת שכל אלמנט נקלט: כל קיר מוצג
 * כמשטח מוגבּה (רצפה → תקרה), וכל בליטה מוצגת כתיבה תלת-ממדית קטנה על הקיר
 * שלה, עם שם בעברית. אזימוט מסתובב בגרירה, הטיה/זום בפינץ' או במחוונים.
 *
 * מוסכמות:
 *  - קודקודי-הרצפה מגיעים מ-WallBuilder.layout(walls) (מ"מ, מישור x/y).
 *  - הגובה (z) הוא WallEntity.height כלפי-מעלה.
 *  - כל היחידות במ"מ; ההיטל עצמאי (Pt3 מקומי, עוזרי-projection מקומיים).
 * ──────────────────────────────────────────────────────────────────────────── */

/** נקודה תלת-ממדית בעולם (מ"מ). x,y = מישור-הרצפה; z = גובה כלפי-מעלה. */
private data class Pt3(val x: Float, val y: Float, val z: Float)

/** תוצר-היטל: מיקום-מסך גולמי (sx,sy) + מפתח-עומק (ry) למיון-צייר. */
private data class Proj(val sx: Float, val sy: Float, val ry: Float)

/**
 * מבט-על תלת-ממדי חי של חדר בודד — אמצעי-אימות: כל אלמנט שנמדד נראה ב-3D.
 *
 * @param walls              קירות החדר (מסודרים לפי idx; אורך/גובה/זווית במ"מ ומעלות).
 * @param accessoriesByWall  בליטות לפי מזהה-קיר (wallId → רשימה).
 * @param modifier           Modifier חיצוני (למשל גודל/משקל בתוך פאנל).
 */
@Composable
fun Room3DView(
    walls: List<WallEntity>,
    accessoriesByWall: Map<Long, List<AccessoryEntity>>,
    modifier: Modifier = Modifier,
) {
    // סטייט-מצלמה: אזימוט (סיבוב), הטיה (elevation), זום.
    var azimuth by remember { mutableFloatStateOf(0.6f) }       // רדיאנים; גרירה אופקית
    var tilt by remember { mutableFloatStateOf(0.9f) }          // elevation (0.15=חזית, 1.45=מבט-על)
    var zoom by remember { mutableFloatStateOf(1.0f) }          // מכפיל-זום מעל fit

    val ordered = remember(walls) { walls.sortedBy { it.idx } }

    Column(modifier) {
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(8.dp)
                .background(Cream, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (ordered.isEmpty()) {
                Text(
                    "אין קירות להצגה. הוסף קיר כדי לראות את החדר נבנה ב-3D.",
                    color = Muted, fontSize = 14.sp,
                )
                return@Box
            }

            // ציורי-טקסט (Paint אנדרואיד — תומך עברית/RTL דרך nativeCanvas)
            val namePaint = remember {
                Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Ink.toArgb(); textAlign = Paint.Align.CENTER; isFakeBoldText = true
                }
            }
            val wallPaint = remember {
                Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER }
            }

            Canvas(
                Modifier
                    .fillMaxSize()
                    // גרירה: אופקי→אזימוט, אנכי→הטיה. פינץ'→זום. (§4 — לסובב/להטות את החדר)
                    .pointerInput(Unit) {
                        detectTransformGestures { _, pan, gestureZoom, _ ->
                            azimuth += pan.x * 0.008f
                            tilt = (tilt - pan.y * 0.004f).coerceIn(0.15f, 1.45f)
                            zoom = (zoom * gestureZoom).coerceIn(0.3f, 4.0f)
                        }
                    },
            ) {
                val az = azimuth
                val tl = tilt
                val floor: List<WallBuilder.Pt> = WallBuilder.layout(ordered)
                if (floor.size < 2) return@Canvas

                // ── היטל 3D→2D גולמי ─────────────────────────────────────
                // 1) סיבוב סביב ציר-אנכי באזימוט az.
                // 2) elevation tl: sin(tl) מקצר את הרצפה, cos(tl) מציג את הגובה.
                fun projectRaw(wx: Float, wy: Float, wz: Float): Proj {
                    val ca = cos(az); val sa = sin(az)
                    val rx = wx * ca - wy * sa
                    val ry = wx * sa + wy * ca
                    val sx = rx
                    val sy = ry * sin(tl) - wz * cos(tl) // z כלפי-מעלה = y-מסך שלילי
                    return Proj(sx, sy, ry)
                }

                // ── התאמה-אוטומטית (fit) לפי כל הקודקודים ברצפה ובתקרה ──
                var minX = Float.MAX_VALUE; var minY = Float.MAX_VALUE
                var maxX = -Float.MAX_VALUE; var maxY = -Float.MAX_VALUE
                for (i in ordered.indices) {
                    val p = floor[i]
                    val h = ordered[i].height.toFloat()
                    for (z in floatArrayOf(0f, h)) {
                        val pr = projectRaw(p.x.toFloat(), p.y.toFloat(), z)
                        minX = min(minX, pr.sx); maxX = max(maxX, pr.sx)
                        minY = min(minY, pr.sy); maxY = max(maxY, pr.sy)
                    }
                }
                // כולל את הקודקוד-הסוגר האחרון (floor.size = N+1)
                run {
                    val p = floor.last()
                    val pr = projectRaw(p.x.toFloat(), p.y.toFloat(), 0f)
                    minX = min(minX, pr.sx); maxX = max(maxX, pr.sx)
                    minY = min(minY, pr.sy); maxY = max(maxY, pr.sy)
                }
                val pad = 48.dp.toPx()
                val spanX = max(maxX - minX, 1f)
                val spanY = max(maxY - minY, 1f)
                val baseScale = min((size.width - 2 * pad) / spanX, (size.height - 2 * pad) / spanY)
                    .let { if (it.isFinite() && it > 0f) it else 1f }
                val scale = baseScale * zoom
                val cx = (minX + maxX) / 2f
                val cy = (minY + maxY) / 2f

                fun toScreen(pr: Proj) = Offset(
                    (pr.sx - cx) * scale + size.width / 2f,
                    (pr.sy - cy) * scale + size.height / 2f,
                )
                fun project(w: Pt3) = projectRaw(w.x, w.y, w.z)

                // ── רצפה (מצוירת ראשונה — הכי מאחור) ─────────────────────
                run {
                    val path = Path()
                    for (i in floor.indices) {
                        val s = toScreen(project(Pt3(floor[i].x.toFloat(), floor[i].y.toFloat(), 0f)))
                        if (i == 0) path.moveTo(s.x, s.y) else path.lineTo(s.x, s.y)
                    }
                    path.close()
                    drawPath(path, Teal.copy(alpha = 0.14f))
                    drawPath(path, Teal.copy(alpha = 0.45f), style = Stroke(width = 1.5.dp.toPx()))
                }

                // ── בניית drawables (קיר + הבליטות שלו) עם מפתח-עומק ────
                data class Drawable(val depth: Float, val render: DrawScope.() -> Unit)
                val drawables = ArrayList<Drawable>(ordered.size)

                for (i in ordered.indices) {
                    val w = ordered[i]
                    val a = floor[i]
                    val b = floor[i + 1]
                    val ax = a.x.toFloat(); val ay = a.y.toFloat()
                    val bx = b.x.toFloat(); val by = b.y.toFloat()
                    val h = w.height.toFloat().let { if (it > 0f) it else 2500f } // ברירת-מחדל 2.5מ' אם 0

                    // כיוון הקיר ונורמל-חוץ (במישור-הרצפה)
                    val dx = bx - ax; val dy = by - ay
                    val segLen = hypot(dx, dy).let { if (it < 1e-3f) 1f else it }
                    val ux = dx / segLen; val uy = dy / segLen        // יחידה לאורך-הקיר
                    val nx = -uy; val ny = ux                          // נורמל-שמאל (חוץ עבור CCW)

                    // ארבע פינות המשטח (רצפה→תקרה)
                    val pBotA = project(Pt3(ax, ay, 0f))
                    val pBotB = project(Pt3(bx, by, 0f))
                    val pTopB = project(Pt3(bx, by, h))
                    val pTopA = project(Pt3(ax, ay, h))
                    val midRy = (pBotA.ry + pBotB.ry) / 2f

                    // הצללה לפי כמה הקיר "פונה" למצלמה (נורמל אחרי סיבוב-אזימוט)
                    val nryRot = nx * sin(az) + ny * cos(az)          // רכיב-עומק של הנורמל
                    val facing = ((-nryRot) * 0.5f + 0.5f).coerceIn(0f, 1f)
                    val faceColor = lerp(Color(0xFFE7E0CE), Color.White, facing)

                    val accs = accessoriesByWall[w.id].orEmpty()

                    drawables += Drawable(midRy) {
                        // משטח-הקיר
                        val quad = Path().apply {
                            val s0 = toScreen(pBotA); moveTo(s0.x, s0.y)
                            val s1 = toScreen(pBotB); lineTo(s1.x, s1.y)
                            val s2 = toScreen(pTopB); lineTo(s2.x, s2.y)
                            val s3 = toScreen(pTopA); lineTo(s3.x, s3.y)
                            close()
                        }
                        drawPath(quad, faceColor)
                        drawPath(quad, Ink.copy(alpha = 0.85f), style = Stroke(width = 1.6.dp.toPx()))

                        // מספר-קיר בבסיס
                        wallPaint.textSize = 11.dp.toPx()
                        val baseMid = toScreen(project(Pt3((ax + bx) / 2f, (ay + by) / 2f, 0f)))
                        drawContext.canvas.nativeCanvas.drawText(
                            "קיר ${w.idx + 1} · ${w.length.roundToInt()} מ\"מ",
                            baseMid.x, baseMid.y + 14.dp.toPx(), wallPaint,
                        )

                        // ── בליטות: תיבה תלת-ממדית קטנה על הקיר ──────────
                        namePaint.textSize = 10.dp.toPx()
                        for (acc in accs) {
                            // גדלים מינימליים כדי שיהיו נראים על רקע קיר גדול.
                            // מיקום-שמאל אפקטיבי מכבד את פינת-המדידה (start/end) — תואם ל-SolWriter.
                            val alongStart = acc.leftEdgeMm(w.length).toFloat().coerceIn(0f, segLen)
                            val bw = max(acc.width.toFloat(), 140f)
                            val alongEnd = (alongStart + bw).coerceAtMost(segLen)
                            val z0 = acc.fromBottom.toFloat()
                            val z1 = z0 + max(acc.height.toFloat(), 140f)
                            val outD = max(acc.depth.toFloat(), 90f)   // בליטה החוצה מפני-הקיר

                            // אדום אם עומק>15 (חשד-התנגשות), אחרת טורקיז
                            val boxCol = if (acc.depth > 15.0) BlockRed else Teal

                            // פינת-עולם: לאורך-הקיר + החוצה בנורמל + גובה
                            fun corner(along: Float, out: Float, z: Float): Offset {
                                val gx = ax + ux * along + nx * out
                                val gy = ay + uy * along + ny * out
                                return toScreen(project(Pt3(gx, gy, z)))
                            }

                            fun face(pts: List<Offset>, fill: Color) {
                                val p = Path().apply {
                                    moveTo(pts[0].x, pts[0].y)
                                    for (k in 1 until pts.size) lineTo(pts[k].x, pts[k].y)
                                    close()
                                }
                                drawPath(p, fill)
                                drawPath(p, Ink.copy(alpha = 0.7f), style = Stroke(width = 1.dp.toPx()))
                            }

                            // שלושה משטחים נראים: חזית (out), גג (z1), צד (alongEnd)
                            face(
                                listOf(
                                    corner(alongStart, outD, z0), corner(alongEnd, outD, z0),
                                    corner(alongEnd, outD, z1), corner(alongStart, outD, z1),
                                ),
                                boxCol,
                            )
                            face(
                                listOf(
                                    corner(alongStart, 0f, z1), corner(alongEnd, 0f, z1),
                                    corner(alongEnd, outD, z1), corner(alongStart, outD, z1),
                                ),
                                boxCol.copy(alpha = 0.55f),
                            )
                            face(
                                listOf(
                                    corner(alongEnd, 0f, z0), corner(alongEnd, outD, z0),
                                    corner(alongEnd, outD, z1), corner(alongEnd, 0f, z1),
                                ),
                                boxCol.copy(alpha = 0.35f),
                            )

                            // תווית-שם בעברית מעל התיבה
                            val lbl = corner((alongStart + alongEnd) / 2f, outD, z1)
                            drawContext.canvas.nativeCanvas.drawText(
                                acc.name, lbl.x, lbl.y - 6.dp.toPx(), namePaint,
                            )
                        }
                    }
                }

                // ── מיון-צייר: הרחוקים (ry גדול) קודם, הקרובים אחרונים ──
                drawables.sortedByDescending { it.depth }.forEach { it.render(this) }
            }
        }

        // ── מחווני הטיה/זום (חלופה לפינץ') — §4 "pinch או slider" ────
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("הטיה", color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Slider(
                value = tilt, onValueChange = { tilt = it },
                valueRange = 0.15f..1.45f, modifier = Modifier.weight(1f),
            )
            Text("זום", color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Slider(
                value = zoom, onValueChange = { zoom = it },
                valueRange = 0.3f..4.0f, modifier = Modifier.weight(1f),
            )
        }
        Text(
            "גרור לסובב · צבט/מחוון להטיה וזום · אדום = עומק בליטה > 15 מ\"מ",
            color = Muted, fontSize = 11.sp,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp),
        )
    }
}
