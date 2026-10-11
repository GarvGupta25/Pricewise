# Pricewise product plan

## Completed in the repository

- Premium responsive landing, discovery, conversational advisor, comparison, and product-decision experience.
- Schema-constrained shopping agent with bounded clarifications, allowlisted retailer search, review signals, historical pricing, and Indian sale-calendar guidance.
- Passwordless Supabase authentication, shopper preferences, saved products, price alerts, orders, delivery plans, and after-sales cases with row-level security.
- Scheduled tracked-price refresh command and deduplicated server-side price-drop alerts.
- Razorpay test-mode payment links using authoritative server-side prices.
- Voice intake, Google Calendar installation handoff, responsive navigation, accessible forms, and reduced-motion support.
- Backend test suite, frontend production build, Docker images, and deployment runbook.

## Provider activation required

These are not unfinished repository code. They require commercial access, credentials, or an operating decision:

- Production Razorpay approval, webhook secret, compliance review, refunds, and settlement operations.
- Retailer cart/order APIs and merchant agreements for purchasing inside Pricewise.
- Courier and installer APIs for automatic delivery-slot negotiation.
- Retailer return/exchange/warranty APIs for direct case submission.
- A deployed scheduler for `python -m backend.jobs.refresh_prices`.
- An outbound email, web-push, or SMS provider if alerts must arrive while the app is closed.
- Production Supabase, Groq, Firecrawl, Ollama/embedding, domain, monitoring, and hosting credentials.

## Release gate

Apply database migrations through `003`, configure the documented environment variables, run the verification commands, deploy both containers, schedule price refreshes, and complete one test-mode shopping journey before inviting users.
