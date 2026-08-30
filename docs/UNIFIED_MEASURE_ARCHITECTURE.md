# מנוע-המדידה המאוחד — ארכיטקטורה מחייבת (לפני-פיתוח)

> מאחד ומרחיב את `UNIFIED_MEASURE_PLAN.md` (מבנה) + `CAD_GEOMETRY_MATH.md` (מתמטיקה) ל**בלופרינט-מימוש**. לאשר לפני קוד.

## 0. עיקרון-על (הבעלים)
**מתאר-חדר אחד ומתמשך. כל הכלים כותבים אליו. מעבר-בין-כלים אף-פעם לא-מוחק.** המודד בוחר את הכלי הכי-מתאים לתנאי-השטח ברגע נתון וממשיך על אותו שרטוט — **גמישות-שדה מרבית**.

---

## 1. מבנה-המסך
```
┌──────────────────────────────────────────────┐
│  ← חזרה   soline · מדידת חדר    [חדר X · Nק']  │  סרגל-עליון
├───────┬──────────────────────────────────────┤
│ סרגל  │                                        │
│ כלים  │        קנבס-מבט-על משותף                │
│ (צד)  │   (RoomPlanCanvas · קירות/פינות/מידות) │
│       │                                        │
│ ▭ ✏️  │        המתאר החי — כל הכלים כאן          │
│ 📡 🎯 │                                        │
│ ∠ 🖉  │                                        │
├───────┴──────────────────────────────────────┤
│  פאנל-הקשר של הכלי-הפעיל (משתנה לפי-כלי)        │  סרגל-תחתון
└──────────────────────────────────────────────┘
```
- **מסך-אחד** `UnifiedMeasureScreen(nav, roomId)`. **סרגל-צד** = ToolRail (בוחר `mode`). **קנבס** משותף. **פאנל-תחתון** = ה-UI של הכלי-הפעיל בלבד.
- מחליף את 6-הכפתורים-המקבילים הנוכחיים (מדידה-חיה · שרטוט-חי · P2P · חצי-אוטומטי · תבניות · עריכה) — כולם הופכים ל**כלים** במסך-אחד.

## 2. מודל-המצב המשותף (מקור-אמת יחיד)
- **המתאר = `List<WallEntity>`** מ-`repo.walls(roomId)` (Flow, **DB-backed → שורד-סיבוב ומעבר-כלי**). פינות/גיאומטריה נגזרות דרך `WallBuilder.layout`.
- **כל הכלים** מקבלים: `walls` + callbacks: `onAddWall(len,ang)` · `onUpdateWall(w)` · `onRemoveLast()` · `onCommit(List<WallEntity>)` (לכלי-אצווה) · `onUpdateCorner`.
- **שני סוגי-כלים:**
  - **אינקרמנטלי** (כותב חי פר-פעולה): צייר-באצבע · מדידה-חיה · הזרקת-לייזר · CAD/קשת.
  - **אצווה** (בונה state-מקומי, `onCommit` בסוף): תבניות-אוטומטיות · P2P · אלכסון→זווית.
- **מעבר-כלי = רק שינוי `mode`.** המתאר ב-DB, לא-נגע. כלי-אצווה באמצע-בנייה → אזהרה לפני-מעבר ("לסיים/לבטל?").

## 3. חוזה-הכלי (Tool contract)
```kotlin
interface MeasureTool {
  val id: ToolId; val icon: String; val label: String
  val kind: Incremental | Batch
  @Composable fun Panel(walls, callbacks, laser, modifier)   // ה-UI בסרגל-התחתון
  // קלט-קנבס (אם צריך): onCanvasTap/onCanvasDrag — פעיל רק כשהכלי הפעיל
}
```
הוספת-כלי-עתידי = מימוש-אחד של החוזה + שורה ב-ToolRail. **בלי לגעת בשאר.**

## 4. כלי Phase-1 (כדי לבדוק X6)
| כלי | קלט | פלט | גיאומטריה |
|---|---|---|---|
| ✏️ **צייר-באצבע** | tap על קנבס → קודקודים | `onAddWall` פר-קטע (אורך-פיקסלי→מ"מ לפי-סקאלה) | snap-90° · snap-קודקוד |
| 📡 **הזרקת-לייזר** | `ble.lastReading.distanceMm` (D2/בוש/X6) | אורך-קיר לקיר-נבחר/חדש; re-arm רציף | — |
| 🎯 **P2P** | ירי-פינות (X6+DST: מרחק+אזימוט) | `StationSolver.toPlan`→פינות→`onCommit` | ספרי→קרטזי; `raiseEvent` ✓ |

**כל Phase-1 כותב לאותו מתאר.** דוגמה: צייר-באצבע 3 קירות → הזרקת-לייזר לאורכים מדויקים → P2P לפינה בעייתית.

## 5. קנבס + מחוות (הסיכון-המרכזי)
- **`RoomPlanCanvas` משותף** — מוסיפים פרמטרים: `onTap`/`onDragVertex`/overlay + מצלמה (pan/zoom).
- **קונפליקט-מחוות** (אצבע-מציירת ↔ pan/zoom): **קלט-ממותג-לפי-מצב** — `detectTapGestures` פעיל **רק** ב-mode=FINGER_DRAW; אחרת `detectTransformGestures` (pan/zoom). פתרון-של-record.
- **רינדור:** קירות · פינות · **מידות בס"מ** (`Prefs.formatLen`) · זוויות · קו-רצפה. מסומן-נבחר להדגשה.

## 6. אינטגרציית לייזר/X6
- `ble.lastReading` (distanceMm/vAngle/hAngle) — כלי-לייזר/P2P צורכים.
- **`setP2pActive(mode==P2P)`** ממותג-לפי-מצב — ה-poll של האזימוט רץ רק ב-P2P (אחרת מחניק notify-מרחק).
- `raiseEvent 100\r\n`→`3ab10120` בחיבור (✓ בקוד). רמז-מצב "בחר Measure-3D" כשאין-vAngle. re-arm רציף (📡).

## 7. חוזה-גיאומטריה (מ-CAD_GEOMETRY_MATH)
- **מוסכמה:** צירים ימני (x-ימין/y-מעלה, מ"מ); קיר-1 יוצא 0°=מזרח; `WallEntity.angle`=פנייה-חיצונית **CCW-חיובית** (`heading+=angle`). אומת.
- **קיים ✓:** אלכסון→זווית (`goldenTriangleAngle`), snap-90°.
- **להוסיף:** `PolygonMath.signedArea/isCCW` (shoelace — לזיהוי-כיווניות+שטח) · `SnapTools.snapToVertex/snapCollinear` · חלוקת-שגיאת-סגירה.
- ⚠️ **P2P זווית-זנית** — טעון בדיקת-חומרה (כרגע ניצל: vAngle=null בירי-אופקי → r=d נכון).

## 8. מבנה-קבצים
**Phase-1 (CREATE):** `ui/unified/UnifiedMeasureScreen.kt` · `ui/unified/ToolRail.kt` · `ui/unified/MeasureTool.kt` (חוזה) · `ui/unified/tools/{FingerDrawTool,LaserInjectTool,P2PTool}.kt` · `geometry/PolygonMath.kt` · `geometry/SnapTools.kt`.
**Phase-1 (EDIT):** `AppUi.kt` (route `unified/{rid}` + host + כפתור-כניסה ב-RoomScreen) · `canvas/RoomPlanCanvas.kt` (פרמטרי-קלט/overlay/מצלמה).
**Phase-2 (CREATE):** `tools/{AutoTemplateTool,SemiAutoTool,DiagonalAngleTool,ArcTool,EditDimTool}.kt`.

## 9. פיזוּר (Phasing)
- **Phase-1:** שלד + ToolRail + 3-כלים (אצבע/לייזר/P2P) + snap-בסיסי + מידות-cm. **מטרה: לבדוק X6 חי במנוע.**
- **Phase-2:** תבניות · חצי-אוטומטי · אלכסון→זווית · קשת · עריכת-מידות · shoelace/סגירה.
- **דו-קיום:** להשאיר את המסכים-הישנים עד parity מלא (לא-למחוק עד שהמנוע מוכח).

## 10. סיכונים
| סיכון | מיטיגציה |
|---|---|
| מחוות אצבע↔pan/zoom | קלט-ממותג-לפי-מצב (§5) |
| poll-אזימוט מחניק מרחק | `setP2pActive(mode==P2P)` |
| כלי-אצווה מאבד state במעבר | אזהרה "לסיים/לבטל" לפני-מעבר |
| P2P זווית-זנית | בדיקת-חומרה לפני-שחרור; לשמור vAngle מחוץ-ל-P2P |

## 11. אישור-לפני-קוד
מסמך-זה = ה-record. **לאשר → בונים Phase-1 מכאן.** שינוי-אדריכלי → לעדכן כאן קודם.
