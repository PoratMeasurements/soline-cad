package il.co.soline.measure.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.compose.runtime.collectAsState
import androidx.navigation.NavController
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.device.LaserBle

private fun blePerms(): Array<String> =
    if (Build.VERSION.SDK_INT >= 31)
        arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    else
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

private fun hasAll(ctx: android.content.Context, perms: Array<String>) =
    perms.all { ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED }

@Composable
fun DevicesScreen(nav: NavController) {
    val context = LocalContext.current
    // מד-הלייזר ברמת-האפליקציה — לא מתנתק ביציאה מהמסך (סינגלטון בטוח, בלי cast שביר)
    val ble = remember { il.co.soline.measure.data.SolineApp.instance.ble }
    LaunchedEffect(Unit) { ble.loadBonded() }

    val status by ble.status.collectAsState()
    val found by ble.devices.collectAsState()
    val readings by ble.readings.collectAsState()
    val connected by ble.connected.collectAsState()
    val diag by ble.diag.collectAsState()

    val perms = remember { blePerms() }
    var hasPerms by remember { mutableStateOf(hasAll(context, perms)) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        hasPerms = hasAll(context, perms)
        if (hasPerms) ble.startScan()
    }

    Scaffold(containerColor = Cream) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            // header
            Row(Modifier.fillMaxWidth().background(Color.White).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
                Column {
                    Text("מכשירי מדידה", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text("Bluetooth · Leica DISTO X6 / Bosch GLM", fontSize = 12.sp, color = Muted)
                }
            }

            // status + scan controls
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(status, Modifier.weight(1f), color = Teal, fontWeight = FontWeight.SemiBold)
                if (!hasPerms) {
                    Button(onClick = { launcher.launch(perms) }, colors = ButtonDefaults.buttonColors(containerColor = Orange)) { Text("אשר הרשאות") }
                } else if (connected == null) {
                    Button(onClick = { ble.startScan() }, colors = ButtonDefaults.buttonColors(containerColor = Orange)) { Text("סרוק") }
                } else {
                    OutlinedButton(onClick = { ble.disconnect() }) { Text("נתק") }
                }
            }

            // אבחון-לייזר 🔬 — פאנל-חי תמיד-זמין (גם מנותק): מה ה-X6 באמת שולח
            LaserDiagPanel(diag)

            // live reading (when connected)
            if (connected != null) {
                val last = readings.firstOrNull()
                Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp), shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(18.dp)) {
                        Text("מחובר: $connected", color = OkGreen, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(10.dp))
                        Text(last?.distanceMm?.let { Prefs.formatLen(it) } ?: "—", fontSize = 40.sp, fontWeight = FontWeight.Bold, color = Orange)
                        Text(last?.vAngleDeg?.let { "זווית אנכית: %.2f°".format(it) } ?: "מרחק בלבד", fontSize = 14.sp, color = Muted)
                    }
                }
                Text("קליטות אחרונות:", Modifier.padding(16.dp, 12.dp, 16.dp, 4.dp), fontWeight = FontWeight.SemiBold, color = Ink)
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 16.dp)) {
                    items(readings) { r ->
                        Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                            Text(
                                (r.distanceMm?.let { Prefs.formatLen(it) } ?: "—") +
                                    (r.vAngleDeg?.let { " · %.2f°".format(it) } ?: ""),
                                color = Ink, fontSize = 15.sp,
                            )
                            Text(r.hex, color = Muted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            HorizontalDivider(color = Cream)
                        }
                    }
                }
            } else {
                // מציגים רק מדי-לייזר כברירת-מחדל (Michael: "רק המכשירים הרלוונטיים")
                var showAll by remember { mutableStateOf(false) }
                val lasers = found.filter { it.isLaser }
                val shown = if (showAll) found else lasers
                val otherCount = found.size - lasers.size

                if (found.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(if (hasPerms) "הקש 'סרוק' והפעל את מד-הלייזר" else "צריך הרשאות בלוטות' כדי לסרוק", color = Muted)
                    }
                } else {
                    if (lasers.isEmpty() && !showAll) {
                        Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("לא זוהה מד-לייזר בסריקה.", color = Muted, fontSize = 15.sp)
                                Text("ודא שהמכשיר דלוק ולא מחובר לאפליקציה אחרת.", color = Muted, fontSize = 13.sp)
                            }
                        }
                    }
                    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
                        items(shown) { d ->
                            Card(
                                onClick = { ble.connect(d.address) },
                                modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                            ) {
                                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                    if (d.isLaser) Text("📏 ", fontSize = 18.sp)
                                    Column(Modifier.weight(1f)) {
                                        Text(d.name, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                        Text(d.address, fontSize = 12.sp, color = Muted)
                                    }
                                    Text("${d.rssi} dBm", fontSize = 12.sp, color = Teal)
                                }
                            }
                        }
                        // מתג עדין לחשיפת מכשירים לא-רלוונטיים (רק אם צריך)
                        if (otherCount > 0) {
                            item {
                                TextButton(onClick = { showAll = !showAll }, modifier = Modifier.fillMaxWidth()) {
                                    Text(
                                        if (showAll) "הסתר מכשירים לא-רלוונטיים" else "הצג את כל המכשירים ($otherCount נוספים)",
                                        color = Muted, fontSize = 13.sp,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * פאנל אבחון-לייזר 🔬 — תמיד-זמין (גם כשמנותק). מציג בזמן-אמת בדיוק מה שכבת-ה-BLE
 * רואה מה-X6: מצב-חיבור · האם notify הודלק (וכמה) · ספירת-פריימים · הפריים-הגולמי
 * האחרון (hex) · ה-Reading האחרון (מרחק/זווית-אנכית/זווית-אופקית) · ויומן-פריימים.
 * זה ההופך באג-חומרה בלתי-נבדק לנתונים-קונקרטיים שהבעלים יכול לקרוא בשטח ולשלוח.
 */
@Composable
private fun LaserDiagPanel(d: il.co.soline.measure.device.LaserBle.Diag) {
    var open by remember { mutableStateOf(true) }
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF10202A)),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Row(
                Modifier.fillMaxWidth().clickable { open = !open },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("🔬 אבחון-לייזר", color = Color(0xFF7FE0C8), fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.weight(1f))
                // נורית-חיווי: ירוק אם מגיעים פריימים, כתום אם מחובר-בלי-פריימים, אפור אם מנותק
                val dotColor = when {
                    d.frameCount > 0 -> OkGreen
                    d.state.contains("מחובר") -> Orange
                    else -> Muted
                }
                Text("● ", color = dotColor, fontSize = 16.sp)
                Text(if (open) "▲" else "▼", color = Color(0xFF7FE0C8), fontSize = 13.sp)
            }

            Spacer(Modifier.height(8.dp))
            DiagLine("מצב", d.state)
            if (d.deviceName != null) DiagLine("מכשיר", d.deviceName)

            if (open) {
                DiagLine("שירותים", "${d.servicesFound}" + (if (d.leicaFound) " · Leica ✓" else "") + (if (d.boschFound) " · Bosch ✓" else ""))
                DiagLine("DST 360-X (זווית-אופקית)", if (d.hAngleCharFound) "נמצא · poll ${d.hAnglePollCount}" else "לא נמצא")
                DiagLine("מנויים (notify/indicate)", if (d.subscribedChars.isEmpty()) "—" else d.subscribedChars.joinToString(" "))
                DiagLine("notify פעילים (CCCD)", "${d.notifyEnabledCount}")
                DiagLine("פריימים שהתקבלו", "${d.frameCount}  ·  פוענחו ${d.parsedCount}")

                Spacer(Modifier.height(6.dp))
                Text("פריים גולמי אחרון:", color = Color(0xFF9FB3BF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    d.lastFrameHex?.let { "[${d.lastFrameUuid} ${d.lastFrameSize}B] $it" } ?: "— אין פריים עדיין —",
                    color = if (d.lastFrameHex != null) Color(0xFFCDEBDF) else Muted,
                    fontFamily = FontFamily.Monospace, fontSize = 11.sp,
                )

                Spacer(Modifier.height(6.dp))
                Text("Reading אחרון (מפוענח):", color = Color(0xFF9FB3BF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    buildString {
                        append("מרחק ")
                        append(d.lastDistanceMm?.let { Prefs.formatLen(it) } ?: "—")
                        append("  ·  אנכית ")
                        append(d.lastVAngleDeg?.let { "%.2f°".format(it) } ?: "—")
                        append("  ·  אופקית ")
                        append(d.lastHAngleDeg?.let { "%.2f°".format(it) } ?: "—")
                    },
                    color = Color(0xFFCDEBDF), fontSize = 12.sp,
                )

                if (d.recentFrames.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text("יומן-פריימים (אחרונים):", color = Color(0xFF9FB3BF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Column(
                        Modifier.fillMaxWidth().heightIn(max = 150.dp)
                            .border(1.dp, Color(0xFF244050), RoundedCornerShape(8.dp)).padding(8.dp),
                    ) {
                        d.recentFrames.forEach { line ->
                            Text(line, color = Color(0xFFA9C6BC), fontFamily = FontFamily.Monospace, fontSize = 10.sp, maxLines = 1)
                        }
                    }
                }

                Spacer(Modifier.height(6.dp))
                Text(
                    "טיפ: אם 'פריימים שהתקבלו' נשאר 0 בזמן לחיצה על ה-X6 — הנתונים לא זורמים כלל (חיבור/מנוי). " +
                        "אם עולה אבל 'פוענחו' 0 — הפריים מגיע על ערוץ/מבנה לא-צפוי (צלם ושלח את היומן).",
                    color = Muted, fontSize = 11.sp,
                )
            }
        }
    }
}

@Composable
private fun DiagLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text("$label: ", color = Color(0xFF9FB3BF), fontSize = 12.sp)
        Text(value, color = Color(0xFFE0F0EA), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
