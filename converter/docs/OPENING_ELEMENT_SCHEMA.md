# סכמת-אלמנט: פתחים (דלת / חלון) — חוזה משותף

> **מטרה:** אלמנט פרמטרי אחד לכל דלת/חלון, שהמודד ממלא באפליקציה → נכתב ל-`.sol` → הממיר מרנדר לכל 6 הפורמטים. זהו החוזה בין `app-measure` (הזרקת-מודד) לבין `converter` (רינדור). כל שדה = מקור-אמת יחיד.

## שדות האלמנט (`opening`)
```jsonc
{
  "kind": "door | window",
  "typeKey": "DOOR_HINGED_L | WINDOW_KIP | WINDOW_MAMAD | ...", // מהקטלוג
  "hebrewName": "דלת פנים שמאל",

  // גיאומטריה — נמדד ע"י המודד (מ"מ)
  "geom": {
    "width":        900,   // רוחב-פתח נטו (light opening)
    "height":       2050,  // גובה-פתח נטו
    "sillHeight":   null,  // חלונות: רצפה→סף. דלת=0/null
    "wallThickness":100,   // עובי-הקיר המארח
    "frameThickness":40,   // ⭐ חדש: עובי-משקוף (דלת) / מסגרת (חלון) — עומק הפרופיל
    "frameReveal":  95,    // רוחב-חשפה/מלבן הנראה במישור-הקיר (9.5/12/14 ס"מ)
    "leafThickness":40     // עובי-כנף (דלת)
  },

  // תצורה — נבחר ע"י המודד
  "config": {
    "openMode": "hinged | sliding | folding | pocket | fixed | kip | awning | hung | double",
    "hingeSide":"L | R | null",
    "swing":    "in | out | null",   // כיוון-פתיחה בתנוחת-תוכנית
    "leafCount":1,
    "glazing":  "none | partial | full"  // דלת: זכוכית; חלון: תמיד full
  },

  // מיקום על הקיר — נמדד
  "pos": { "wallId": 3, "fromCorner": "start | end", "offset": 930 }, // offset=מהפינה עד קצה-הפתח

  // יצרן (אופציונלי, מהקטלוג) + הערות-מודד חופשיות
  "mfr":  { "brand": null, "series": null, "model": null },
  "notes": ""
}
```

## זרימה לפורמטים (מי-קורא-מה)
| פורמט | שימוש בשדות |
|---|---|
| **DXF-2D** | בלוק-סקאלה לפי `typeKey`+`geom`; קשת-פתיחה לפי `hingeSide`+`swing`; `frameThickness`/`frameReveal` מציירים את המשקוף; מידה=`width`, מיקום=`offset`. |
| **DXF-3D** | חלל-פתח בקיר (`width`×`height`, בגובה `sillHeight`), מסגרת בעובי `frameThickness`. |
| **ORDX** | `kind`→Class (Decorative), `typeKey`→Type/Name (EntryDoor/Window), `hingeSide+swing`→וריאנט. |
| **PDP** | רשומת-פריט: קוד-סמל לפי `typeKey`, מידות מ-`geom`, מיקום מ-`pos` (עריכה-במקום על בסיס-טעין). |
| **PDF / HTML** | שורת-מפרט (מס'/סוג/רוחב×גובה/משקוף/כיוון/סף) + חזית. |

## צד-אפליקציה (הזרקת-מודד) — app-lane
מסך-פתח: בחירת `typeKey` מהקטלוג → טופס ממלא `geom`(כולל **עובי-משקוף/מסגרת**), `config`(כיוון-פתיחה/מנגנון), `pos`. שומר ל-`.sol`. **ברירות-מחדל** מ-`DOORS_WINDOWS_SIZES.md` (מידות-יצרנים) ממולאות-מראש, המודד רק מאמת/מתקן.

## סטטוס
- [x] סימבולים + מידות-יצרנים (`element_symbols_soline.js`, `DOORS_WINDOWS_SIZES.md`).
- [ ] רינדור-פרמטרי מהסכמה בכל הפורמטים (converter-lane).
- [ ] מסך-הזרקת-מודד (app-lane, מסודרתי).
