# UX Audit — Soline Measure (Android field app)

> ביקורת-UX ממוקדת-שטח למודד. עיקרון-על של Michael: **"לא רוצה לתקתק יותר מפעם אחת לפעולה"**,
> והכל חייב לעבוד מהר ביד-אחת בשטח. הביקורת מדרגת חיכוך לפי מסך, וממפה כל תיקון למקום שבו הוא שייך.
> תאריך: 2026-08-20 · טווח: מפת-הזרימה open job → project → room → wall → element → measure → export.

---

## 1. מפת-הזרימה האמיתית (וכמה תקתוקים כל צעד עולה)

| שלב | מסך | תקתוקים כיום | הערה |
|---|---|---|---|
| פתיחת עבודה | Home → intake | 1 | טוב — כפתור ראשי בולט |
| המשך עבודה קיימת | Home → rooms | **2–3** (גלילה לרשימה → זיהוי → הקשה) | לא היה "המשך אחרון" — **תוקן** |
| חדר → קירות | ProjectRooms → Room | 1 + FAB | סביר |
| בחירת פעולת-מדידה | RoomScreen | **עומס: 11 כפתורים במסך אחד** | ראה §3 |
| הוספת קיר | Measure | 1 (add wall) | מצוין — mode-less, one-tap |
| הוספת אלמנט | Wall → picker → dialog | **3** (FAB → בחירת-סוג → טופס מידות) | ראה §4 |
| מדידת מידה | numField / CaptureBar | 1 ("מדוד פעם אחת") | מצוין — one-shot arm |
| ייצוא | ProjectRooms → share | 1 | טוב |

**מסקנה:** הליבה (Measure, numField) כבר מיישרת קו עם עיקרון ה-one-tap. עיקר-החיכוך מרוכז ב-**RoomScreen** (עומס-כפתורים), ב-**הוספת-אלמנט** (3 מסכים), וב-**גילוי** (אין undo גלובלי, אין laser-status קבוע, empty-states חלשים).

---

## 2. בעיות-רוחב (חוצות-מסכים)

1. **שפה-ויזואלית לא-אחידה.** כל מסך מגדיר מחדש כפתורים/כרטיסים/empty-states מקומית (BigButton ב-Measure, ListCard ב-AppUi, OfficeEmptyCard ב-Home...). → **תוקן:** נוצר `ui/components/SolineComponents.kt` כמקור-אמת יחיד (SolineButton, SolineCard, SectionHeader, EmptyState, BigActionButton, StatChip, LaserStatusPill). כל מסך יכול לאמץ.
2. **סטטוס-לייזר לא-נוכח באופן קבוע.** הצ'יפ מופיע רק ב-Home וב-CaptureBar. בשטח המודד צריך לדעת *תמיד* אם הלייזר מדבר. → רכיב `LaserStatusPill` מוכן לאימוץ בכל header. (עדיפות: הזרקה ל-`BrandHeader` ב-AppUi — **בעלות של האינטגרטור**.)
3. **יעדי-מגע לא-אחידים.** חלק מהכפתורים 52dp, חלק ברירת-מחדל (~40dp), FAB בלבד ברוב המסכים. `BigActionButton` (≥56dp) נותן יעד-שטח אחיד.
4. **אין Undo גלובלי / Snackbar.** מחיקת-אביזר (WallScreen), מחיקת-קיר — מיידיות ובלתי-הפיכות, בלי "בטל". רק Measure יש לו undo. → המלצה: Snackbar-with-undo סביב פעולות-מחיקה (בעלות: המסכים עצמם).
5. **הזנת-טקסט RTL בשדות-מספר.** numField עובד יפה (one-shot). לוודא keyboardType=Number בכל שדה-מידה — כבר קיים ברובם.

---

## 3. RoomScreen — עומס-כפתורים (עדיפות גבוהה)

**הבעיה:** 11 פעולות גלויות בבת-אחת (שרטוט-חי, מדידה-חיה, חצי-אוטומטי, 3D, עריכת-מידות, Datum, אימות, רצפה, תקרה, בדיקת-התאמה, + FAB). המודד צריך לסרוק קיר של טקסט לפני שהוא נוגע במסך. מנוגד ל-one-tap.

**המלצות (בעלות: האינטגרטור/סוכן-RoomScreen — לא נגעתי):**
- להעלות **פעולה-ראשית אחת** ("📐 מדידה חיה") ל-BigActionButton יחיד בראש; השאר ב-grid משני או ב-bottom-sheet "כלים".
- לקבץ לפי כוונה: *מדידה* (חי / חצי-אוטו / Datum) · *תצוגה* (3D / עריכת-מידות) · *מישוריות* (רצפה / תקרה) · *בקרה* (התאמה / אימות).
- להשתמש ב-`StatChip` להצגת סיכום-חדר (מס' קירות · מתאר סגור/פתוח) במקום להטמיע טקסט.

---

## 4. הוספת-אלמנט — 3 מסכים לפעולה אחת (עדיפות בינונית)

היום: FAB → ElementPickerSheet → AddAccessoryDialog. שלושה מסכים. הבורר (§5 wishlist) טוב, אבל:
- **פריטים-אחרונים / מועדפים:** רוב העבודה חוזרת על 3–4 סוגים (שקע/מים/גז). שורת "אחרונים" בראש הבורר תחסוך גלילה+חיפוש בכל פעם.
- **ברירות-מחדל חכמות בטופס:** למלא fromBottom/height טיפוסיים לפי סוג (שקע ≈ גובה קבוע) כדי שהמודד יאשר במקום להקליד.
- **מדידת-מיקום ישירות מהלייזר:** numField כבר תומך — לוודא שכל 5 השדות armed.

(בעלות: WallScreen/ElementPickerSheet — סומן להמשך, לא נגעתי.)

---

## 5. Empty-states וגילוי (עדיפות בינונית)

- **לפני התיקון:** ProjectsScreen/Room/Wall השתמשו ב-`EmptyHint` — שורת-טקסט אפורה בלבד, בלי call-to-action.
- **אחרי:** רכיב `EmptyState` (אמוג'י + כותרת + הסבר + כפתור-פעולה אופציונלי) — מוביל את המשתמש לצעד-הבא. אומץ ב-HomeScreen (פרויקטים ריקים → "＋ פרויקט מהיר", עבודות-משרד ריקות → הסבר). מומלץ לאמץ גם ב-Room ("+ קיר ראשון") ו-Wall ("+ שקע/מים/גז").

---

## 6. Home — מה תוקן בפועל (הפריט העיקרי בבעלותי)

לפני: TopBar + Greeting + 3 כפתורי quick-action + office + projects. סביר, אך:
- סטטוס-הלייזר היה צ'יפ זעיר בפינה בלבד.
- לא היה "המשך עבודה אחרונה" — חזרה לשטח עלתה 2–3 תקתוקים.
- כפתורים 52dp, empty-states מקומיים.

אחרי (HomeScreen.kt, בנוי על SolineComponents):
- **כרטיס-סטטוס-לייזר בולט** מתחת לברכה — `LaserStatusPill` מלא + כפתור "חבר/החלף". חיווי-שטח קבוע.
- **פעולות-שטח גדולות** (`BigActionButton` ≥56dp): "פתיחת עבודה" ראשי; **"המשך: <שם-הפרויקט>"** (one-tap אל הפרויקט העדכני) כשיש היסטוריה; "＋ פרויקט מהיר".
- **empty-states אחידים** עם call-to-action.
- **צ'יפ-סטטוס קומפקטי** נשאר גם ב-TopBar לנגישות-תמידית.
- היררכיה רגועה, ריווח אחיד 12dp, כרטיסים עם מתאר-עדין אחיד.

**ניווט:** נשמר בדיוק — `intake`, `devices`, `settings`, `rooms/{id}` בלבד. חתימת `HomeScreen(nav, modifier)` ללא שינוי.

---

## 7. רשימת-תיקונים מדורגת (ranked backlog)

| # | תיקון | מסך | עדיפות | סטטוס |
|---|---|---|---|---|
| 1 | ערכת-רכיבים אחידה (SolineComponents) | חוצה-מסכים | גבוהה | ✅ בוצע |
| 2 | Home: laser-status בולט + "המשך אחרון" + big actions | HomeScreen | גבוהה | ✅ בוצע |
| 3 | RoomScreen: לצמצם 11 כפתורים לפעולה-ראשית + כלים | RoomScreen (AppUi) | גבוהה | ⬜ אינטגרטור |
| 4 | Undo/Snackbar על מחיקות (אביזר, קיר) | WallScreen / Room | גבוהה | ⬜ אינטגרטור |
| 5 | laser-status קבוע בכל header (BrandHeader) | AppUi | בינונית | ⬜ אינטגרטור |
| 6 | הוספת-אלמנט: "אחרונים/מועדפים" + defaults חכמים | Wall/Picker | בינונית | ⬜ אינטגרטור |
| 7 | EmptyState עם CTA בכל מסך-רשימה | Room/Wall/Projects | בינונית | ⬜ (רכיב מוכן) |
| 8 | StatChip לסיכום-חדר/קיר | Room/Wall | נמוכה | ⬜ (רכיב מוכן) |
| 9 | הנחיה-בתוך-האפליקציה (CVSM §15: tooltip "הסבר קצר") | חוצה-מסכים | נמוכה | ⬜ עתידי |

---

## 8. הרכיבים שנבנו (SolineComponents.kt)

| רכיב | חתימה | מה נותן |
|---|---|---|
| `SolineButton` | `(text, onClick, modifier, style, icon, accent, enabled)` | כפתור-מותג ראשי/משני אחיד, ≥52dp |
| `BigActionButton` | `(text, onClick, modifier, icon, container, enabled)` | כפתור-שטח ≥56dp ליד-אחת |
| `SolineCard` | `(modifier, onClick?, border, content)` | כרטיס לבן אחיד, פינות 16dp |
| `SectionHeader` | `(title, modifier, badge?)` | כותרת-מקטע + תג-ספירה |
| `EmptyState` | `(emoji, title, subtitle, modifier, actionText?, onAction?)` | מצב-ריק מנחה עם CTA |
| `StatChip` | `(value, label, modifier, color)` | צ'יפ-נתון קומפקטי |
| `LaserStatusPill` | `(connectedName, onClick, modifier, compact)` | חיווי-לייזר בולט/קומפקטי |

כולם RTL, צבעי-מותג מ-`ui.Theme`, רדיוסים מ-`SolineShape`.
