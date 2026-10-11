# Run the Shopping Agent locally

## 1. Configure the data services

1. Create a PostgreSQL database with pgvector (Supabase is fine), then run `database/schema.sql` in its SQL editor.
2. Install Ollama, then run `ollama pull nomic-embed-text`.
3. Create `backend/.env` by copying `backend/.env.example` and set `DATABASE_URL`, `GROQ_API_KEY`, and `FIRECRAWL_API_KEY`. Keep keys out of Git.

Run all commands from the cloned `Pricewise` repository root unless a step says otherwise.

## 2. Start the backend

Open PowerShell in the project folder and run:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

Confirm `http://localhost:8000/health` responds with `{"status":"ok"}`. A WebSocket client connects at `ws://localhost:8000/ws/chat`.

## 3. Start the frontend

In a second PowerShell window:

```powershell
Set-Location frontend
npm run dev
```

Open the URL Vite displays (normally `http://localhost:5173`). If the API runs elsewhere, set `VITE_API_WS_URL` to its WebSocket origin before starting Vite.

## 4. Verify before a demo

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
.\.venv\Scripts\python.exe -m backend.graph.test_run
Set-Location frontend
npm run build
```

The test suite confirms the graph’s routing, retailer defense, price-history labelling, WebSocket configuration error, and cached end-to-end decision. The smoke test uses deliberately isolated test data; the UI never shows fabricated products. A fully live run requires the credentials and services from step 1.

## 5. Schedule tracked-price refreshes

After applying Supabase migrations `002` and `003`, run this command from a trusted scheduler every 6–24 hours:

```powershell
.\.venv\Scripts\python.exe -m backend.jobs.refresh_prices
```

The job refreshes only products saved by a user, rejects URLs outside the retailer allowlist, records changed prices, and creates deduplicated price alerts. Its JSON output reports checked, changed, and failed counts for monitoring.

## Current limits

- The local machine still needs PostgreSQL/pgvector and Ollama installed.
- Live Firecrawl/Groq calls require your keys and can incur provider usage according to their plans.
- Razorpay payment links are intentionally not implemented; checkout automation is out of scope.
