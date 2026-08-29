package il.co.soline.measure.ui.laser

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal

/**
 * פאנל-לייזר נשלף — **בלי כפתור-משלו**. משגר-הכלים-המאוחד ([il.co.soline.measure.ui.tools.ToolsFab])
 * פותח/סוגר אותו. מציג מצב-חיבור · בחירת-לייזר (D2/X6/Bosch) · סרוק/נתק — בלי לצאת ממסך-המדידה,
 * ממופה ישירות ל-`LaserBle` (סינגלטון-האפליקציה). כשנפתח — סורק אוטומטית.
 */
@Composable
fun LaserPanel(visible: Boolean, onClose: () -> Unit) {
    val context = LocalContext.current
    val ble = remember { SolineApp.instance.ble }
    val connected by ble.connected.collectAsState()
    val found by ble.devices.collectAsState()
    val status by ble.status.collectAsState()

    val perms = remember { blePerms() }
    var hasPerms by remember { mutableStateOf(hasAll(context, perms)) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        hasPerms = hasAll(context, perms)
        if (hasPerms) ble.startScan()
    }
    fun scan() {
        hasPerms = hasAll(context, perms)
        if (hasPerms) ble.startScan() else launcher.launch(perms)
    }
    // בפתיחה — סורק אוטומטית כדי שהרשימה תתמלא.
    LaunchedEffect(visible) { if (visible) scan() }

    // רשימת-בחירה: מדי-לייזר מזוהים; אם אין — פברוזה לכל-המכשירים (D2 שלא-משדר שם/UUID).
    val lasers = remember(found) { found.filter { it.isLaser }.distinctBy { it.address } }
    val shown = remember(found, lasers) { if (lasers.isNotEmpty()) lasers else found.distinctBy { it.address } }

    Box(Modifier.fillMaxSize()) {
        AnimatedVisibility(
            visible = visible,
            enter = slideInHorizontally { -it } + fadeIn(),
            exit = slideOutHorizontally { -it } + fadeOut(),
            modifier = Modifier.align(Alignment.BottomStart).padding(start = 12.dp, bottom = 150.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                shadowElevation = 10.dp,
                modifier = Modifier.widthIn(min = 232.dp, max = 300.dp),
            ) {
                Column(
                    Modifier.padding(14.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(10.dp).background(if (connected != null) OkGreen else Muted, RoundedCornerShape(5.dp)))
                        Spacer(Modifier.width(8.dp))
                        Text("מד-לייזר", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.weight(1f))
                        TextButton(onClick = onClose, contentPadding = PaddingValues(horizontal = 8.dp)) { Text("סגור", color = Muted) }
                    }
                    Text(
                        if (connected != null) "מחובר: $connected" else status,
                        fontSize = 12.sp, color = if (connected != null) OkGreen else Muted,
                    )

                    HorizontalDivider(color = Muted.copy(alpha = 0.15f))

                    if (shown.isEmpty()) {
                        Text("לא נמצאו מכשירים. הקש \"סרוק\".", fontSize = 12.sp, color = Muted)
                    } else {
                        if (lasers.isEmpty()) {
                            Text("לא זוהה מד-לייזר אוטומטית — בחר מהרשימה:", fontSize = 11.sp, color = Muted)
                        }
                        for (dev in shown) {
                            val isThis = connected != null && connected == dev.name
                            Row(
                                Modifier.fillMaxWidth()
                                    .border(1.dp, if (isThis) Teal else Muted.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                    .background(if (isThis) Teal.copy(alpha = 0.10f) else Color.White, RoundedCornerShape(10.dp))
                                    .clickable { ble.connect(dev.address) }
                                    .padding(horizontal = 10.dp, vertical = 9.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                KindBadge(dev.name)
                                Spacer(Modifier.width(8.dp))
                                Text(dev.name, fontSize = 13.sp, color = Ink, modifier = Modifier.weight(1f), maxLines = 1)
                                if (isThis) Text("✓", color = Teal, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { scan() }, modifier = Modifier.weight(1f)) { Text("סרוק") }
                        if (connected != null) {
                            OutlinedButton(
                                onClick = { ble.disconnect() },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = BlockRed),
                                modifier = Modifier.weight(1f),
                            ) { Text("נתק") }
                        }
                    }
                }
            }
        }
    }
}

/** תג-סוג-מכשיר נגזר-משם: D2 / X6 / Bosch. */
@Composable
private fun KindBadge(name: String) {
    val n = name.lowercase()
    val (label, c) = when {
        n.contains("d2") -> "D2" to Orange
        n.contains("bosch") || n.contains("glm") -> "Bosch" to Teal
        n.contains("x6") || n.contains("leica") || n.contains("disto") -> "X6" to Ink
        else -> "לייזר" to Muted
    }
    Box(
        Modifier.background(c.copy(alpha = 0.14f), RoundedCornerShape(6.dp)).padding(horizontal = 7.dp, vertical = 3.dp),
    ) { Text(label, fontSize = 11.sp, color = c, fontWeight = FontWeight.Bold) }
}

private fun blePerms(): Array<String> =
    if (Build.VERSION.SDK_INT >= 31)
        arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    else
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

private fun hasAll(ctx: Context, perms: Array<String>) =
    perms.all { ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED }
