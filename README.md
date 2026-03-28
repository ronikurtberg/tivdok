# 🚗 Tivdok | תבדוק — מכור את הרכב שלך במחיר הנכון

**תבדוק** זה הכלי הכי פשוט למכירת רכב בישראל. אתם מכניסים מספר רכב — ואנחנו עושים את כל השאר.

הכניסו מספר רכב ← מקבלים נתוני רישוי רשמיים ← בדיקת היסטוריה ← סריקת יד2 בזמן אמת ← מחיר מכירה מדויק.

---

## איך מריצים את הפרויקט

צריך שני טרמינלים.

### 1. התקנת תלויות (פעם ראשונה בלבד)

```bash
cd ~/work/car-seller-assistant
uv pip install -e .          # Python backend deps

cd frontend
npm install                  # React frontend deps
```

### 2. הפעלת ה-Backend (FastAPI)

```bash
cd ~/work/car-seller-assistant
.venv/bin/python -m uvicorn car_seller.api:app --host 0.0.0.0 --port 8000 --reload
```

### 3. הפעלת ה-Frontend (React + Vite)

```bash
cd ~/work/car-seller-assistant/frontend
npm run dev
```

פתחו **http://localhost:5173** בדפדפן.

> ה-Frontend מעביר אוטומטית את כל קריאות ה-`/api` ל-Backend בפורט 8000.

### אופציונלי: OpenAI לתוכניות מכירה חכמות יותר

```bash
cp .env.example .env
# Add OPENAI_API_KEY=sk-... to .env
```

בלי זה, המערכת מייצרת תוכנית מכירה על פי חוקים — עדיין שימושית מאוד.

---

## זרימת האפליקציה (8 שלבים)

| שלב | מה קורה |
|-----|----------|
| **1. מספר רכב** | מכניסים מספר רישוי ישראלי |
| **2. זיהוי** | נתוני רכב רשמיים ממשרד התחבורה. מודל תלת-ממד אינטראקטיבי. |
| **3. אישור** | סקירה ותיקון פרטים. הוספת ק"מ ומחיר מבוקש. |
| **4. שוק** | בחירה אם לסרוק מודעות יד2 |
| **5. היסטוריה** | רישומי טסט שנתיים, בדיקת עקביות קילומטראז' |
| **6. סריקת שוק** | סריקה חיה של יד2 — גרף מחירים + כל המודעות |
| **7. מחיר** | שלוש אפשרויות: מכירה מהירה / שוויון שוק / מחיר פרמיום |
| **8. יועץ AI** | צ'אט חכם עם כל ההקשר של הרכב שלכם |

---

## מבנה הפרויקט

```
tivdok/
├── car_seller/
│   ├── api.py             # FastAPI app — all REST endpoints
│   ├── plate_lookup.py    # License plate → car info (data.gov.il)
│   ├── vehicle_history.py # Annual test history (data.gov.il)
│   ├── scraper.py         # Live Yad2 market scraper (free, no API key)
│   ├── official_price.py  # Ministry of Transport catalog price
│   ├── selling_plan.py    # GPT-4o-mini or rule-based selling plan
│   ├── models.py          # Pydantic data models
│   ├── server.py          # Uvicorn entrypoint
│   └── main.py            # Legacy CLI (still works)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # 8-step wizard with animated transitions
│   │   ├── steps/         # One file per wizard step
│   │   └── components/
│   │       └── CarViewer3D.jsx  # Three.js interactive 3D car
│   └── vite.config.js
├── pyproject.toml
├── .env.example
└── my_cars.json           # Saved cars (created at runtime)
```

---

## נקודות API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/plate/{plate}` | Look up a license plate — returns make, model, year, color, VIN, test dates, trim, tires |
| `GET` | `/api/history/{plate}` | Annual road test history, odometer records |
| `POST` | `/api/analyze` | Scrape Yad2 + get official price + generate selling plan |
| `GET` | `/api/cars` | List saved cars |
| `POST` | `/api/cars` | Save a car |
| `DELETE` | `/api/cars/{index}` | Remove a saved car |

---

## מקורות מידע

| מקור | מה הוא מספק | עלות |
|------|-------------|------|
| `data.gov.il` (משרד התחבורה) | נתוני רכב, VIN, גרסה, תאריכי טסט, מידות צמיגים | חינם |
| `data.gov.il` (טסטים שנתיים) | היסטוריית טסטים, קילומטראז' בכל טסט | חינם |
| `gw.yad2.co.il` | מודעות שוק חיות, מחירים, ק"מ | חינם (API ישיר) |
| `data.gov.il` (קטלוג רכב) | מחיר קטלוג רשמי של משרד התחבורה | חינם |
| OpenAI GPT-4o-mini | תוכניות מכירה עשירות יותר | אופציונלי, בתשלום |

> **שימו לב:** היסטוריית תאונות ותביעות ביטוח אינה זמינה ב-API ציבורי חופשי בישראל.
> שם בעל הרכב מוגן על פי חוק.

---

## CLI (ממשק שורת פקודה)

ממשק ה-CLI המקורי עדיין עובד:

```bash
car-seller add       # הוספת רכב באופן אינטראקטיבי
car-seller list      # רשימת רכבים שמורים
car-seller analyze   # ניתוח מלא בטרמינל
car-seller plan      # יצירה מחדש של תוכנית מכירה
```

---

*Tivdok — תבדוק. כי לפני שמוכרים, צריך לדעת.*
