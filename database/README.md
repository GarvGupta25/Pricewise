# Database setup

The application uses PostgreSQL plus the `pgvector` extension. Create a database, then run `schema.sql` exactly once.

The `products_source_url_unique` constraint is deliberate: a fresh scrape updates the cached product in place and writes a separate `price_history` record. That prevents duplicate cached products while retaining every observed price.

For a local installation, use a PostgreSQL build that includes pgvector. For Supabase, enable the `vector` extension before running the schema. Add the resulting connection string to `backend/.env` as `DATABASE_URL`.
