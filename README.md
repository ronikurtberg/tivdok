# 🚗 Car Seller Assistant — Israel

A full-stack web app that helps you sell your car in Israel the smart way.

Enter a license plate → get official car data → check vehicle history → scan the live market on Yad2 → receive a calculated ideal selling price.

---

## How to Run

You need two terminals.

### 1. Install dependencies (first time only)

```bash
cd ~/work/car-seller-assistant
uv pip install -e .          # Python backend deps

cd frontend
npm install                  # React frontend deps
```

### 2. Start the backend (FastAPI)

```bash
cd ~/work/car-seller-assistant
.venv/bin/python -m uvicorn car_seller.api:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the frontend (React + Vite)

```bash
cd ~/work/car-seller-assistant/frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

> The frontend dev server proxies all `/api` requests to the backend on port 8000 automatically.

### Optional: OpenAI for richer selling plans

```bash
cp .env.example .env
# Add OPENAI_API_KEY=sk-... to .env
```

Without it, a fully rule-based selling plan is generated — still useful.

---

## App Flow (8 steps)

| Step | What happens |
|------|-------------|
| **1. Plate entry** | Type any Israeli license plate number |
| **2. Identify** | Official car data pulled from the Ministry of Transport. 3D interactive car model shown. |
| **3. Confirm** | Review and correct any fields. Add your current mileage and asking price. |
| **4. Market prompt** | Choose whether to scan Yad2 for comparable listings |
| **5. History** | Annual road test records, odometer consistency check |
| **6. Market scan** | Live Yad2 scrape — price distribution chart + all listings |
| **7. Price** | Three options: Quick Sale / Fair Market / Premium Ask — with reasons |
| **8. Autopilot** | Vision for future AI-agent auto-selling mode |

---

## Project Structure

```
car-seller-assistant/
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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/plate/{plate}` | Look up a license plate — returns make, model, year, color, VIN, test dates, trim, tires |
| `GET` | `/api/history/{plate}` | Annual road test history, odometer records |
| `POST` | `/api/analyze` | Scrape Yad2 + get official price + generate selling plan |
| `GET` | `/api/cars` | List saved cars |
| `POST` | `/api/cars` | Save a car |
| `DELETE` | `/api/cars/{index}` | Remove a saved car |

---

## Data Sources

| Source | What it provides | Cost |
|--------|-----------------|------|
| `data.gov.il` (Ministry of Transport) | Vehicle registry, VIN, trim, test dates, license expiry, tire sizes | Free |
| `data.gov.il` (road tests resource) | Annual test history, mileage at each test | Free |
| `gw.yad2.co.il` | Live market listings, prices, mileage | Free (direct API) |
| `data.gov.il` (vehicle catalog) | Official Ministry catalog price | Free |
| OpenAI GPT-4o-mini | Richer selling plan text | Optional, paid |

> **Note:** Accident history and insurance claims are not available via any free public Israeli API.
> Owner name/address is protected by law.

---

## Legacy CLI

The original CLI still works for terminal-based use:

```bash
car-seller add       # Add a car interactively
car-seller list      # List saved cars
car-seller analyze   # Full analysis in the terminal
car-seller plan      # Regenerate selling plan
```
