package il.co.soline.measure.ui.bug

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.View
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/* =========================================================================
 * מדווח-הבאגים — לכידת-מסך
 * -------------------------------------------------------------------------
 * לוכד את חלון-ה-Activity הנוכחי ל-Bitmap. מסלול-ראשי: PixelCopy על
 * activity.window (לוכד את המסך המרונדר האמיתי, כולל שכבות-חומרה/SurfaceView).
 * מסלול-נסיגה: ציור decorView ל-Canvas (כש-PixelCopy אינו-זמין/נכשל).
 * ========================================================================= */

/** שולף את ה-Activity מתוך Context (עוטף שכבות ContextWrapper). */
fun Context.findActivity(): Activity? {
    var ctx: Context? = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

/**
 * לוכד את חלון-ה-Activity ל-Bitmap. מנסה PixelCopy; בכישלון נופל לציור-View.
 * מחזיר null אם אין View תקין ללכידה.
 */
suspend fun captureWindow(activity: Activity): Bitmap? {
    val view: View = activity.window?.decorView ?: return null
    val w = view.width
    val h = view.height
    if (w <= 0 || h <= 0) return null

    // מסלול-ראשי: PixelCopy (API 24+; אצלנו minSdk=26)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val fromPixelCopy = runCatching {
            suspendCancellableCoroutine<Bitmap?> { cont ->
                val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                try {
                    PixelCopy.request(
                        activity.window, bmp,
                        { result ->
                            if (result == PixelCopy.SUCCESS) cont.resume(bmp)
                            else { bmp.recycle(); cont.resume(null) }
                        },
                        Handler(Looper.getMainLooper()),
                    )
                } catch (e: Throwable) {
                    bmp.recycle(); cont.resume(null)
                }
            }
        }.getOrNull()
        if (fromPixelCopy != null) return fromPixelCopy
    }

    // מסלול-נסיגה: ציור עץ-ה-View לתוך Bitmap (עובד ל-Compose; לא ללכידת-חומרה)
    return runCatching {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        view.draw(Canvas(bmp))
        bmp
    }.getOrNull()
}
