package il.co.soline.measure.ui.cad

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Redo
import androidx.compose.material.icons.filled.Rotate90DegreesCcw
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal

/*
 * =============================================================================
 *  CadToolbar.kt  —  סרגל כלים למסכי השרטוט (CAD) של Soline Measure
 * -----------------------------------------------------------------------------
 *  קובץ עצמאי המכיל שני רכיבים לשימוש חוזר:
 *
 *   1. EditHistory<S>          — מחסנית Undo/Redo גנרית לצילומי מצב של השרטוט.
 *   2. CadToolbar(...)         — סרגל כלים קומפקטי (Compose) עם כפתורי אייקון
 *                                ותוויות בעברית, כולל פונקציות קבועות (בטל/בצע שוב)
 *                                וכלי עריכת קווים / מידות / זוויות.
 *
 *  כל הטקסט המוצג למשתמש הוא בעברית ומיושר לימין (RTL).
 * =============================================================================
 */

// =============================================================================
//  חלק 1 — היסטוריית עריכה (Undo / Redo)
// =============================================================================

/**
 * מחסנית Undo/Redo גנרית עבור צילומי-מצב (snapshots) של השרטוט.
 *
 * הרעיון: בכל שינוי משמעותי בשרטוט (הוספת קו, עריכת מידה, מחיקה וכו')
 * המסך שומר "צילום מצב" [S] של כל המצב הרלוונטי (לרוב רשימת הקירות/הקווים).
 * המחלקה מנהלת שתי ערימות — אחת ל־Undo ואחת ל־Redo.
 *
 * הערה חשובה: [S] אמור להיות טיפוס בלתי־משתנה (immutable) או להיות מועתק
 * לפני הדחיפה, כדי שצילום המצב לא ישתנה "מאחורי הגב" של ההיסטוריה.
 *
 * המחלקה עצמה אינה תלויה ב־Compose ולכן ניתנת לבדיקת יחידה (unit test) בקלות.
 * לשימוש ריאקטיבי בתוך UI ראו [rememberEditHistory] / [EditHistoryState].
 *
 * @param capacity מספר מרבי של צעדים לשמירה (ברירת מחדל 100). כשעוברים
 *                 את המכסה, הצילום הישן ביותר נזרק כדי לחסוך זיכרון.
 */
class EditHistory<S>(private val capacity: Int = 100) {

    // ערימת המצבים שאפשר לחזור אליהם (החדש ביותר בסוף).
    private val undoStack = ArrayDeque<S>()

    // ערימת המצבים שבוטלו וניתן לשחזר (החדש ביותר בסוף).
    private val redoStack = ArrayDeque<S>()

    /** האם קיים מצב קודם שאפשר לחזור אליו. */
    val canUndo: Boolean get() = undoStack.size > 1

    /** האם קיים מצב שבוטל וניתן לשחזר. */
    val canRedo: Boolean get() = redoStack.isNotEmpty()

    /** צילום המצב הנוכחי (הראש של ערימת ה־Undo), או null אם ריק. */
    val current: S? get() = undoStack.lastOrNull()

    /**
     * דחיפת צילום מצב חדש לאחר שינוי בשרטוט.
     * פעולה זו מנקה את ערימת ה־Redo (כי נוצר "ענף" חדש בהיסטוריה).
     */
    fun push(state: S) {
        undoStack.addLast(state)
        redoStack.clear()
        // שמירה על המכסה: זריקת המצב הישן ביותר.
        while (undoStack.size > capacity) {
            undoStack.removeFirst()
        }
    }

    /**
     * ביטול הפעולה האחרונה. מחזיר את המצב הקודם שאליו יש לחזור,
     * או null אם אין לאן לחזור. המצב הנוכחי מועבר לערימת ה־Redo.
     */
    fun undo(): S? {
        if (!canUndo) return null
        val curr = undoStack.removeLast()
        redoStack.addLast(curr)
        return undoStack.last()
    }

    /**
     * ביצוע חוזר (Redo) של פעולה שבוטלה. מחזיר את המצב המשוחזר,
     * או null אם אין מה לשחזר.
     */
    fun redo(): S? {
        if (!canRedo) return null
        val restored = redoStack.removeLast()
        undoStack.addLast(restored)
        return restored
    }

    /** איפוס מלא של ההיסטוריה (למשל בעת פתיחת שרטוט חדש). */
    fun clear() {
        undoStack.clear()
        redoStack.clear()
    }

    /**
     * איפוס ההיסטוריה עם מצב התחלתי יחיד. שימושי כדי להתחיל היסטוריה
     * "נקייה" סביב מצב בסיס נתון (למשל הקירות שנטענו מהקובץ).
     */
    fun reset(initial: S) {
        clear()
        undoStack.addLast(initial)
    }
}

/**
 * עטיפה תצפיתית (observable) ל־[EditHistory] המיועדת ל־Compose.
 *
 * החשיפה של [canUndo] / [canRedo] מגובה ב־mutableStateOf כך שכל שינוי
 * גורם ל־recomposition של הסרגל (הכפתורים נדלקים / כבים אוטומטית).
 *
 * שימוש טיפוסי במסך שרטוט:
 * ```
 * val history = rememberEditHistory(initial = walls)          // צילום בסיס
 * // ... לאחר שינוי:
 * walls = newWalls
 * history.push(newWalls)
 * // בטל:
 * history.undo()?.let { walls = it }
 * // בצע שוב:
 * history.redo()?.let { walls = it }
 * ```
 */
class EditHistoryState<S>(initial: S, capacity: Int = 100) {

    private val history = EditHistory<S>(capacity).apply { reset(initial) }

    // דגלים תצפיתיים שמניעים recomposition בסרגל הכלים.
    var canUndo by mutableStateOf(history.canUndo)
        private set

    var canRedo by mutableStateOf(history.canRedo)
        private set

    /** צילום המצב הנוכחי (או null אם ריק). */
    val current: S? get() = history.current

    /** דחיפת צילום מצב חדש ורענון הדגלים. */
    fun push(state: S) {
        history.push(state)
        sync()
    }

    /** ביטול; מחזיר את המצב לשחזור על המסך (או null). */
    fun undo(): S? = history.undo().also { sync() }

    /** ביצוע חוזר; מחזיר את המצב המשוחזר (או null). */
    fun redo(): S? = history.redo().also { sync() }

    /** איפוס מלא סביב מצב בסיס חדש. */
    fun reset(initial: S) {
        history.reset(initial)
        sync()
    }

    // סנכרון הדגלים התצפיתיים עם המחסנית הפנימית.
    private fun sync() {
        canUndo = history.canUndo
        canRedo = history.canRedo
    }
}

/**
 * יוצר ומזכיר [EditHistoryState] יציב לאורך ה־recompositions.
 *
 * @param initial צילום המצב ההתחלתי (מצב הבסיס של השרטוט).
 * @param capacity מספר צעדי היסטוריה מרבי לשמירה.
 */
@Composable
fun <S> rememberEditHistory(initial: S, capacity: Int = 100): EditHistoryState<S> =
    remember { EditHistoryState(initial, capacity) }

// =============================================================================
//  חלק 2 — סרגל הכלים (CadToolbar)
// =============================================================================

/**
 * סרגל כלים קומפקטי וידידותי-למגע למסכי השרטוט (CAD).
 *
 * הסרגל מחולק לשלוש קבוצות עם מפרידים דקים:
 *   • פונקציות קבועות:  בטל · בצע שוב
 *   • כלי עריכה:        הוסף קו · ערוך מידה · ערוך זווית · מחק
 *   • תצוגה / עזר:      התאם תצוגה · נעילת 90° · ניקוי
 *
 * כל הפעולות מועברות כ־callbacks מבחוץ, והסרגל עצמו חסר-מצב (stateless)
 * למעט מצבי הזמינות שמתקבלים כפרמטרים. כך אפשר לחבר אותו לכל מנוע שרטוט.
 *
 * @param modifier        Modifier חיצוני למיקום/עיצוב הסרגל.
 * @param canUndo         האם ניתן לבטל (מדליק/מכבה את כפתור "בטל").
 * @param canRedo         האם ניתן לבצע שוב.
 * @param angleLock       מצב נעילת הזווית ל־90°; משנה אייקון וצבע.
 * @param hasSelection    האם קיימת בחירה (מדליק "מחק"/"ערוך").
 * @param onUndo          בטל את הפעולה האחרונה.
 * @param onRedo          בצע שוב פעולה שבוטלה.
 * @param onAddLine       כניסה למצב הוספת קו/קיר.
 * @param onEditDimension עריכת המידה (אורך) של האלמנט הנבחר.
 * @param onEditAngle     עריכת הזווית של האלמנט הנבחר.
 * @param onDelete        מחיקת האלמנט הנבחר.
 * @param onFitView       התאמת/איפוס התצוגה כך שכל השרטוט ייראה.
 * @param onToggleAngleLock  מתג נעילת 90°.
 * @param onClear         ניקוי כל השרטוט.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CadToolbar(
    modifier: Modifier = Modifier,
    canUndo: Boolean,
    canRedo: Boolean,
    angleLock: Boolean,
    hasSelection: Boolean = true,
    onUndo: () -> Unit,
    onRedo: () -> Unit,
    onAddLine: () -> Unit,
    onEditDimension: () -> Unit,
    onEditAngle: () -> Unit,
    onDelete: () -> Unit,
    onFitView: () -> Unit,
    onToggleAngleLock: () -> Unit,
    onClear: () -> Unit,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        color = Cream,
        tonalElevation = 3.dp,
        shadowElevation = 6.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            // --- קבוצה: פונקציות קבועות (בטל / בצע שוב) ---
            CadToolButton(
                icon = Icons.Filled.Undo,
                label = "בטל",
                enabled = canUndo,
                onClick = onUndo,
            )
            CadToolButton(
                icon = Icons.Filled.Redo,
                label = "בצע שוב",
                enabled = canRedo,
                onClick = onRedo,
            )

            CadToolbarDivider()

            // --- קבוצה: כלי עריכה ---
            CadToolButton(
                icon = Icons.Filled.Add,
                label = "הוסף קו",
                tint = Teal,
                enabled = true,
                onClick = onAddLine,
            )
            CadToolButton(
                icon = Icons.Filled.Edit,
                label = "ערוך מידה",
                enabled = hasSelection,
                onClick = onEditDimension,
            )
            CadToolButton(
                icon = Icons.Filled.Rotate90DegreesCcw,
                label = "ערוך זווית",
                enabled = hasSelection,
                onClick = onEditAngle,
            )
            CadToolButton(
                icon = Icons.Filled.Delete,
                label = "מחק",
                tint = Color(0xFFC0392B),
                enabled = hasSelection,
                onClick = onDelete,
            )

            CadToolbarDivider()

            // --- קבוצה: תצוגה / עזר ---
            CadToolButton(
                icon = Icons.Filled.CenterFocusStrong,
                label = "התאם תצוגה",
                enabled = true,
                onClick = onFitView,
            )
            CadToolButton(
                icon = if (angleLock) Icons.Filled.Lock else Icons.Filled.LockOpen,
                label = if (angleLock) "נעילת 90° ✓" else "נעילת 90°",
                tint = if (angleLock) OkGreen else Ink,
                active = angleLock,
                enabled = true,
                onClick = onToggleAngleLock,
            )
            CadToolButton(
                icon = Icons.Filled.Clear,
                label = "ניקוי",
                tint = Muted,
                enabled = true,
                onClick = onClear,
            )
        }
    }
}

/**
 * כפתור-כלי בודד: אייקון גדול לנגיעה + תווית עברית מתחתיו,
 * עטוף ב־Tooltip (לחיצה ארוכה) עם אותו טקסט בעברית.
 *
 * @param active מסמן מצב "פעיל/דלוק" (למשל נעילת 90° מופעלת) ומדגיש רקע.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CadToolButton(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    enabled: Boolean,
    tint: Color = Ink,
    active: Boolean = false,
) {
    TooltipBox(
        positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(),
        tooltip = {
            PlainTooltip(
                containerColor = Ink,
                contentColor = Cream,
            ) {
                // תווית נקייה ל־tooltip (ללא סימון ה־✓).
                Text(text = label.removeSuffix(" ✓"))
            }
        },
        state = rememberTooltipState(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(60.dp),
        ) {
            val contentColor = if (enabled) tint else Muted.copy(alpha = 0.45f)
            IconButton(
                onClick = onClick,
                enabled = enabled,
                modifier = Modifier.size(48.dp),
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = if (active) Orange.copy(alpha = 0.18f) else Color.Transparent,
                    contentColor = contentColor,
                    disabledContentColor = Muted.copy(alpha = 0.45f),
                ),
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    modifier = Modifier.size(26.dp),
                )
            }
            Text(
                text = label,
                color = contentColor,
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
                maxLines = 1,
            )
        }
    }
}

/** מפריד אנכי דק בין קבוצות כלים בסרגל (קו עדין בצבע מותג). */
@Composable
private fun CadToolbarDivider() {
    Box(
        modifier = Modifier
            .padding(horizontal = 3.dp)
            .width(1.dp)
            .height(36.dp)
            .background(Muted.copy(alpha = 0.25f))
    )
}
