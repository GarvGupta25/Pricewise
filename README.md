# Shopping Agent

A stateful shopping advisor for Indian e-commerce. It clarifies a shopper's intent, searches a cache and approved retailers, compares price history with the Indian sale calendar, and gives a transparent **Buy now** or **Wait** recommendation.

## What we are building

- A FastAPI + LangGraph backend with a real multi-turn clarification pause.
- PostgreSQL with pgvector for product cache and price history.
- Groq for structured language-model calls, Ollama for local embeddings, and Firecrawl restricted to approved Indian retailers.
- A React + Vite + Tailwind dashboard that shows live stages, a recommendation, comparison cards, and price trends.

The app deliberately does **not** log into retailers, add to carts, automate checkout, or process payments. A Razorpay payment-link demo hook may be enabled later with test keys.

## Build progress

- [x] Project foundation and repository setup
- [ ] Database schema and data-access layer
- [ ] Backend graph services and nodes
- [ ] FastAPI WebSocket API
- [ ] React comparison dashboard
- [ ] End-to-end verification and deployment guide

## Local setup (once the code stages are complete)

1. Install PostgreSQL with the `pgvector` extension, then run `database/schema.sql`.
2. Install Ollama and run `ollama pull nomic-embed-text`.
3. Copy `backend/.env.example` to `backend/.env` and add your Groq, Firecrawl, and database credentials.
4. Create a Python virtual environment, install `backend/requirements.txt`, and run the FastAPI server.
5. Install the frontend dependencies and run the Vite development server.

The backend is designed to be testable before secrets and external services are configured. It returns useful, explicit configuration errors rather than inventing retail data.

## Retailers

Only these retailers are eligible for live results:

- amazon.in
- flipkart.com
- croma.com
- reliancedigital.in
- mdcomputers.in
