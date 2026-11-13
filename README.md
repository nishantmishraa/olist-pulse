# Olist Pulse

Full-stack e-commerce analytics and seller operations dashboard built on top of the Olist Brazilian E-Commerce dataset schema.

I started this project to turn my SQL analysis of Olist orders into a working web application where marketplace operators and sellers can track revenue trends, delivery SLAs, and order statuses in real time.

## Tech Stack
- **Backend:** Python, FastAPI, SQLite / PostgreSQL
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **SQL Features Used:** CTEs (`WITH`), Window Functions (`LAG()`, `DENSE_RANK()`, `RANK()`, `SUM() OVER ()`, `AVG() OVER (ROWS BETWEEN ...)`), B-Tree indexes

## Key Features
- **Monthly Revenue & Rolling Averages:** Calculates month-over-month GMV growth using `LAG()` and 3-month moving averages directly in SQL.
- **Seller Leaderboard:** Ranks merchants with `DENSE_RANK() OVER (ORDER BY gross_revenue DESC)` and tracks on-time delivery SLA percentages (`delivered_date <= estimated_date`).
- **Category & Payment Breakdown:** Uses window totals (`SUM(revenue) OVER ()`) to compute category share and payment instrument splits (`credit_card`, `pix`, `boleto`).
- **Order Operations CRUD:** Filter orders by status, payment method, or merchant, create new test orders, and update fulfillment statuses (`processing` -> `shipped` -> `delivered`).

## Project Structure

```text
olist-pulse/
├── backend/
│   ├── database.py        # Schema creation, indexes, and dataset seeding
│   ├── main.py            # FastAPI routes and SQL query handlers
│   ├── queries.sql        # Main analytical SQL queries (CTEs + window functions)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.ts  # Fetch wrapper for backend endpoints
│   │   ├── types/olist.ts # TypeScript interfaces
│   │   ├── App.tsx        # Dashboard UI and order table
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/
│   └── ARCHITECTURE.md    # Notes on schema design and SQL optimization
└── README.md
```

## Running Locally

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
On first run, `database.py` creates `olist_pulse.db` and seeds it with sample Olist orders, sellers, products, and reviews.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Then open `http://localhost:5173`.

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/analytics/overview` | Summary KPIs (GMV, total orders, AOV, on-time SLA %, review score) |
| `GET` | `/api/analytics/revenue-trends` | Monthly revenue, MoM growth (`LAG`), and 3-month rolling average |
| `GET` | `/api/analytics/seller-leaderboard` | Seller rankings (`DENSE_RANK`) and SLA metrics |
| `GET` | `/api/analytics/category-performance` | Product category revenue share |
| `GET` | `/api/analytics/payment-breakdown` | Breakdown by payment method |
| `GET` | `/api/orders` | Paginated order list with search and status filters |
| `POST` | `/api/orders` | Create a new order record |
| `PATCH` | `/api/orders/{id}/status` | Update order status (`processing`, `shipped`, `delivered`, `canceled`) |
