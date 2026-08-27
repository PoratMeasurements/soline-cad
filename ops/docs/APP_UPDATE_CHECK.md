# בדיקת עדכון גרסה - אפליקציית המדידה (CVSM)

תאריך הבדיקה: 2026-08-16

## מסקנה
**המאגר לא היה נגיש.** לא ניתן לזהות את הגרסה החדשה או את החידושים ללא הרשאת גישה (GitHub token).

## פרטי הבדיקה
- אפליקציה: `com.roommeasure.app` (CVSM)
- גרסה מותקנת: 5.2.0 (versionCode 5200)
- מאגר עדכונים: `bravh/RoomMeasure-Releases`

## מה נבדק ומה התקבל
| בדיקה | תוצאה |
|-------|--------|
| `api.github.com/repos/bravh/RoomMeasure-Releases/releases/latest` | HTTP 404 |
| `api.github.com/repos/bravh/RoomMeasure-Releases/releases` | HTTP 404 |
| `github.com/bravh/RoomMeasure-Releases/releases` (עמוד HTML) | HTTP 404 |
| `api.github.com/repos/bravh/RoomMeasure-Releases` (מטא של המאגר) | HTTP 404 |
| `api.github.com/users/bravh` (המשתמש/הבעלים) | HTTP 200 - קיים |
| `api.github.com/users/bravh/repos` (מאגרים ציבוריים) | HTTP 200 - 4 מאגרים |

## ניתוח
- המשתמש `bravh` **קיים** בגיטהאב (נוצר 2019-04-15, 4 מאגרים ציבוריים).
- המאגרים הציבוריים היחידים תחת bravh הם: `Aspire-Doors-Gadget`, `bravh.github.io`, `Pytest`, `test-token-check`.
- המאגר `RoomMeasure-Releases` **אינו** ברשימה הציבורית ומחזיר 404 בכל נקודות הקצה.
- גיטהאב מחזיר 404 (ולא 403) עבור מאגרים **פרטיים** כדי להסתיר את עצם קיומם ממי שאין לו הרשאה.
- **מסקנה סבירה:** המאגר פרטי. מאחר שהאפליקציה בפועל מושכת עדכונים ממנו, היא כנראה עושה זאת עם token מובנה שאין לנו כאן.

## מה נדרש כדי להשלים את הבדיקה
- GitHub Personal Access Token עם הרשאת קריאה למאגר `bravh/RoomMeasure-Releases` (scope `repo` / `contents:read`).
- לחלופין: ה-token שהאפליקציה עצמה משתמשת בו (מוטמע בקוד/קונפיג של CVSM).
- כלי `gh` CLI אינו מותקן בסביבה זו.

## הרצה חוזרת (עם token)
```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  https://api.github.com/repos/bravh/RoomMeasure-Releases/releases/latest
```
