package il.co.soline.measure.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import il.co.soline.measure.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** תיאור-גרסה מהמניפסט הציבורי. */
data class UpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val notes: String,
)

/**
 * עדכון-גרסה בתוך-האפליקציה (OTA) — בלי מחשב/כבל. בודק מניפסט-JSON ציבורי (raw.githubusercontent
 * מ-repo `soline-releases` הציבורי; הקוד נשאר פרטי), משווה ל-[BuildConfig.VERSION_CODE], ואם יש
 * חדש — מוריד ל-`filesDir/updates/` ומפעיל את מתקין-החבילות של אנדרואיד דרך ה-FileProvider.
 *
 * מבנה latest.json: `{ "versionCode": 3, "versionName": "0.3", "apkUrl": "https://…/soline.apk", "notes": "…" }`
 */
object UpdateChecker {
    // מניפסט-עדכון ציבורי. מעודכן בכל release (אני דוחף APK + latest.json ל-repo הציבורי).
    const val MANIFEST_URL =
        "https://raw.githubusercontent.com/PoratMeasurements/soline-releases/main/latest.json"

    val currentCode = BuildConfig.VERSION_CODE
    val currentName = BuildConfig.VERSION_NAME

    suspend fun fetchLatest(url: String = MANIFEST_URL): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000; readTimeout = 10_000; requestMethod = "GET"
                setRequestProperty("Cache-Control", "no-cache")
            }
            conn.inputStream.use { ins ->
                val j = JSONObject(ins.readBytes().decodeToString())
                UpdateInfo(
                    versionCode = j.getInt("versionCode"),
                    versionName = j.optString("versionName", ""),
                    apkUrl = j.getString("apkUrl"),
                    notes = j.optString("notes", ""),
                )
            }
        } catch (_: Exception) {
            null
        }
    }

    fun isNewer(info: UpdateInfo) = info.versionCode > currentCode

    /** מוריד את ה-APK ל-`filesDir/updates/soline-update.apk`; מדווח אחוזים. מחזיר null בכשל. */
    suspend fun downloadApk(context: Context, url: String, onProgress: (Int) -> Unit = {}): File? =
        withContext(Dispatchers.IO) {
            try {
                val dir = File(context.filesDir, "updates").apply { mkdirs() }
                val out = File(dir, "soline-update.apk")
                if (out.exists()) out.delete()
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15_000; readTimeout = 30_000; instanceFollowRedirects = true
                }
                val total = conn.contentLength
                conn.inputStream.use { ins ->
                    out.outputStream().use { os ->
                        val buf = ByteArray(64 * 1024)
                        var read = 0L
                        var n: Int
                        while (ins.read(buf).also { n = it } >= 0) {
                            os.write(buf, 0, n)
                            read += n
                            if (total > 0) onProgress(((read * 100) / total).toInt())
                        }
                    }
                }
                out
            } catch (_: Exception) {
                null
            }
        }

    /** האם מותר להתקין חבילות (Android O+ דורש הרשאת "מקורות לא-ידועים" לאפליקציה). */
    fun canInstall(context: Context): Boolean =
        Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()

    /** פותח את מסך-ההרשאה "התקנת אפליקציות לא-ידועות" עבור האפליקציה. */
    fun promptEnableInstall(context: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            context.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    /** מפעיל את מתקין-החבילות של אנדרואיד על ה-APK שהורד (דרך ה-FileProvider הקיים). */
    fun installApk(context: Context, apk: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apk)
        context.startActivity(
            Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }
}
