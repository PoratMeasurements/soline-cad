package il.co.soline.measure.ui.bug

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/* =========================================================================
 * מדווח-הבאגים — צריבת-הערות על הביטמאפ + שיתוף
 * ========================================================================= */

private const val ANNOT_RED = 0xFFE5484D.toInt() // BlockRed המותגי
private const val AUTHORITY = "il.co.soline.measure.fileprovider"

/**
 * מחשב את שתי נקודות-הזיפים (barbs) של ראש-חץ לקו tail→head.
 * מוחזר: (barb1x, barb1y, barb2x, barb2y).
 */
fun arrowheadBarbs(
    tailX: Float, tailY: Float, headX: Float, headY: Float, size: Float,
): FloatArray {
    val ang = atan2((headY - tailY).toDouble(), (headX - tailX).toDouble())
    val a1 = ang + Math.toRadians(150.0)
    val a2 = ang - Math.toRadians(150.0)
    return floatArrayOf(
        (headX + size * cos(a1)).toFloat(), (headY + size * sin(a1)).toFloat(),
        (headX + size * cos(a2)).toFloat(), (headY + size * sin(a2)).toFloat(),
    )
}

/** גלישת-טקסט-מילים ל-רוחב מרבי (RTL/עברית) — מחזיר שורות. */
private fun wrapText(text: String, paint: Paint, maxWidth: Float): List<String> {
    val lines = ArrayList<String>()
    for (para in text.split("\n")) {
        if (para.isBlank()) { lines.add(""); continue }
        var line = StringBuilder()
        for (word in para.split(" ")) {
            val trial = if (line.isEmpty()) word else "$line $word"
            if (paint.measureText(trial) <= maxWidth || line.isEmpty()) line = StringBuilder(trial)
            else { lines.add(line.toString()); line = StringBuilder(word) }
        }
        if (line.isNotEmpty()) lines.add(line.toString())
    }
    return lines
}

/**
 * מצייר את ההערות (חצים + תיבות-טקסט) על עותק-בר-כתיבה של [src], מוסיף **פס-כיתוב
 * בתחתית עם [notes] החופשיות** (כדי שגם התיאור-הכולל ייצא בתמונה ולא רק ב-JSON),
 * ומחזיר PNG bytes. [annotations] בקואורדינטות פיקסלי-הביטמאפ (חוזה בלתי-תלוי-מכשיר).
 */
fun renderAnnotatedPng(src: Bitmap, annotations: List<BugAnnotation>, notes: String = ""): ByteArray {
    val unit = (hypot(src.width.toFloat(), src.height.toFloat()) / 400f).coerceAtLeast(2f)
    // ── חישוב פס-ההערות התחתון ──
    val note = notes.trim()
    val notePad = unit * 4f
    val noteSize = unit * 6.5f
    val noteLineH = noteSize * 1.35f
    val notePaintR = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF2B2620.toInt(); textSize = noteSize
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL); textAlign = Paint.Align.RIGHT
    }
    val noteTitle = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ANNOT_RED; textSize = noteSize
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); textAlign = Paint.Align.RIGHT
    }
    val maxTextW = src.width - notePad * 2
    val noteLines = if (note.isEmpty()) emptyList() else wrapText(note, notePaintR, maxTextW)
    val footerH = if (noteLines.isEmpty()) 0 else (notePad * 2 + noteLineH * (noteLines.size + 1)).toInt()

    // ── ביטמאפ-יעד: הצילום + פס-הערות מתחתיו (לא מכסה תוכן) ──
    val out = Bitmap.createBitmap(src.width, src.height + footerH, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    canvas.drawColor(Color.WHITE)              // רקע-לבן לפס-התחתון
    canvas.drawBitmap(src, 0f, 0f, null)       // הצילום למעלה (הסימונים מיושרים אליו)

    val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ANNOT_RED
        style = Paint.Style.STROKE
        strokeWidth = unit
        strokeCap = Paint.Cap.ROUND
    }
    val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ANNOT_RED; style = Paint.Style.FILL }
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ANNOT_RED
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textSize = unit * 7f
    }
    val textBg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xCCFFFFFF.toInt(); style = Paint.Style.FILL }

    for (a in annotations) {
        when (a.type) {
            BugAnnotation.ARROW -> {
                canvas.drawLine(a.tailX, a.tailY, a.headX, a.headY, stroke)
                val barbSize = unit * 6f
                val b = arrowheadBarbs(a.tailX, a.tailY, a.headX, a.headY, barbSize)
                canvas.drawLine(a.headX, a.headY, b[0], b[1], stroke)
                canvas.drawLine(a.headX, a.headY, b[2], b[3], stroke)
            }
            else -> {
                val txt = a.text.ifBlank { " " }
                val lines = txt.split("\n")
                val pad = unit * 2f
                val lineH = textPaint.textSize * 1.2f
                var maxW = 0f
                for (ln in lines) maxW = maxOf(maxW, textPaint.measureText(ln))
                val boxTop = a.y
                canvas.drawRoundRect(
                    a.x - pad, boxTop - pad,
                    a.x + maxW + pad, boxTop + lineH * lines.size + pad,
                    pad, pad, textBg,
                )
                var baseline = boxTop + textPaint.textSize
                for (ln in lines) {
                    canvas.drawText(ln, a.x, baseline, textPaint)
                    baseline += lineH
                }
            }
        }
    }

    // ── ציור פס-ההערות התחתון (הטקסט החופשי — כדי שגם הוא ייצא בתמונה) ──
    if (noteLines.isNotEmpty()) {
        val sep = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFFEADFC7.toInt(); style = Paint.Style.STROKE; strokeWidth = unit * 0.5f
        }
        canvas.drawLine(0f, src.height.toFloat(), src.width.toFloat(), src.height.toFloat(), sep)
        val xRight = src.width - notePad
        var baseline = src.height + notePad + noteSize
        canvas.drawText("הערות:", xRight, baseline, noteTitle)
        baseline += noteLineH
        for (ln in noteLines) {
            canvas.drawText(ln, xRight, baseline, notePaintR)
            baseline += noteLineH
        }
    }

    val bos = ByteArrayOutputStream()
    out.compress(Bitmap.CompressFormat.PNG, 100, bos)
    out.recycle()
    return bos.toByteArray()
}

/** משתף דיווח בודד (PNG + JSON) דרך גיליון-השיתוף של אנדרואיד. */
fun shareBugReport(context: Context, report: SavedBugReport) {
    val files = buildList {
        add(report.png)
        if (report.json.name.endsWith(".json") && report.json.exists()) add(report.json)
    }
    shareFiles(context, files, "דיווח-באג — שליחה לבעלים")
}

/** משתף מספר דיווחים יחד (SEND_MULTIPLE) — "שתף הכל". */
fun shareAllBugReports(context: Context, reports: List<SavedBugReport>) {
    val files = reports.flatMap { r ->
        buildList {
            add(r.png)
            if (r.json.name.endsWith(".json") && r.json.exists()) add(r.json)
        }
    }
    if (files.isNotEmpty()) shareFiles(context, files, "דיווחי-באגים — שליחה לבעלים")
}

private fun shareFiles(context: Context, files: List<File>, title: String) {
    if (files.isEmpty()) return
    val uris = ArrayList(files.map { FileProvider.getUriForFile(context, AUTHORITY, it) })
    val intent = if (uris.size == 1) {
        Intent(Intent.ACTION_SEND).apply {
            type = "*/*"
            putExtra(Intent.EXTRA_STREAM, uris[0])
        }
    } else {
        Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = "*/*"
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        }
    }
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    val chooser = Intent.createChooser(intent, title).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(chooser)
}
