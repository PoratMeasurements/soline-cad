package il.co.soline.measure.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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

            // live reading (when connected)
            if (connected != null) {
                val last = readings.firstOrNull()
                Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp), shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(18.dp)) {
                        Text("מחובר: $connected", color = OkGreen, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(10.dp))
                        Text(last?.distanceMm?.let { "%.1f מ\"מ".format(it) } ?: "—", fontSize = 40.sp, fontWeight = FontWeight.Bold, color = Orange)
                        Text(last?.vAngleDeg?.let { "זווית אנכית: %.2f°".format(it) } ?: "מרחק בלבד", fontSize = 14.sp, color = Muted)
                    }
                }
                Text("קליטות אחרונות:", Modifier.padding(16.dp, 12.dp, 16.dp, 4.dp), fontWeight = FontWeight.SemiBold, color = Ink)
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 16.dp)) {
                    items(readings) { r ->
                        Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                            Text(
                                (r.distanceMm?.let { "%.1f מ\"מ".format(it) } ?: "—") +
                                    (r.vAngleDeg?.let { " · %.2f°".format(it) } ?: ""),
                                color = Ink, fontSize = 15.sp,
                            )
                            Text(r.hex, color = Muted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            HorizontalDivider(color = Cream)
                        }
                    }
                }
            } else {
                // found devices
                if (found.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(if (hasPerms) "הקש 'סרוק' והפעל את מד-הלייזר" else "צריך הרשאות בלוטות' כדי לסרוק", color = Muted)
                    }
                } else {
                    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
                        items(found) { d ->
                            Card(
                                onClick = { ble.connect(d.address) },
                                modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                            ) {
                                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(d.name, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                        Text(d.address, fontSize = 12.sp, color = Muted)
                                    }
                                    Text("${d.rssi} dBm", fontSize = 12.sp, color = Teal)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
