package il.co.soline.measure.ui.unified

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.draw.LiveCadScreen
import il.co.soline.measure.ui.measure.MeasureCaptureScreen
import il.co.soline.measure.ui.p2p.P2PMeasureScreen
import kotlinx.coroutines.launch

/*
 * מנוע-המדידה המאוחד — Phase-1.
 * מסך-אחד שמארח את שלושת הכלים-המבוקרים הקיימים (הזרקת-לייזר · שרטוט · P2P),
 * כולם כותבים לאותו מתאר (repo.walls של אותו חדר). מעבר-כלי בסרגל-הצף אינו-מוחק
 * — המתאר שמור ב-DB. כך המודד בוחר את השיטה הכי-מתאימה לרגע וממשיך על אותו שרטוט.
 */

private enum class Tool(val glyph: String, val label: String) {
    LASER("📡", "לייזר"),
    DRAW("✏️", "שרטוט"),
    P2P("🎯", "P2P"),
}

@Composable
fun UnifiedMeasureHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val repo = SolineApp.instance.repo
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    var tool by remember { mutableStateOf(Tool.LASER) }

    val onAddWall: (Double, Double) -> Unit = { len, ang ->
        scope.launch { repo.addWall(roomId, len, Prefs.defaultWallHeightMm, ang) }
    }

    Box(Modifier.fillMaxSize()) {
        // ── הכלי-הפעיל (מסך-מבוקר; כולם על אותו מתאר) ──
        when (tool) {
            Tool.LASER -> MeasureCaptureScreen(
                walls = walls,
                onAddWall = onAddWall,
                onUndo = { scope.launch { repo.removeLastWall(roomId) } },
                onBack = { nav.popBackStack() },
            )
            Tool.DRAW -> LiveCadScreen(
                walls = walls,
                accessoriesByWall = emptyMap(),
                onAddWall = onAddWall,
                onRemoveLastWall = { scope.launch { repo.removeLastWall(roomId) } },
                onUpdateWall = { w -> scope.launch { repo.updateWall(w) } },
                onBack = { nav.popBackStack() },
            )
            Tool.P2P -> P2PMeasureScreen(
                roomId = roomId,
                defaultHeightMm = Prefs.defaultWallHeightMm,
                // מוסיף את פינות-ה-P2P לאותו מתאר (המשך, לא-דריסה).
                onDone = { newWalls ->
                    scope.launch {
                        for (w in newWalls) {
                            repo.addWall(roomId, w.length, if (w.height > 0) w.height else Prefs.defaultWallHeightMm, w.angle)
                        }
                        tool = Tool.DRAW // חוזר לתצוגת-המתאר לאחר commit
                    }
                },
                onBack = { tool = Tool.LASER },
            )
        }

        // ── סרגל-כלים צף (קטן, בקצה-ההתחלה) ──
        ToolRail(current = tool, onSelect = { tool = it })
    }
}

@Composable
private fun BoxScope.ToolRail(current: Tool, onSelect: (Tool) -> Unit) {
    Surface(
        modifier = Modifier.align(Alignment.CenterStart).padding(start = 4.dp),
        shape = RoundedCornerShape(26.dp),
        color = Color.White.copy(alpha = 0.88f),
        shadowElevation = 6.dp,
    ) {
        Column(
            Modifier.padding(vertical = 6.dp, horizontal = 4.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Tool.entries.forEach { t ->
                RailBtn(t.glyph, t.label, active = t == current) { onSelect(t) }
            }
        }
    }
}

@Composable
private fun RailBtn(glyph: String, label: String, active: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = if (active) Teal else Color.Transparent,
        modifier = Modifier.size(44.dp),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(glyph, fontSize = 18.sp)
                Text(
                    label, fontSize = 8.sp, fontWeight = FontWeight.Bold,
                    color = if (active) Color.White else Ink,
                )
            }
        }
    }
}
