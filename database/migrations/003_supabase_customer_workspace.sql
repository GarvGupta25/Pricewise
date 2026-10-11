-- Authenticated customer lifecycle data. Apply after 002_supabase_saved_products.sql.
CREATE TABLE IF NOT EXISTS public.price_alerts (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    previous_price INT NOT NULL CHECK (previous_price >= 0),
    current_price INT NOT NULL CHECK (current_price >= 0),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, alert_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
    order_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    source_site TEXT NOT NULL,
    current_price INT NOT NULL CHECK (current_price >= 0),
    status TEXT NOT NULL CHECK (status IN ('checkout_started', 'ordered', 'delivered')),
    delivery_date DATE,
    installation_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_cases (
    case_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('return', 'exchange', 'warranty', 'delivery')),
    summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own price alerts" ON public.price_alerts
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users manage their own orders" ON public.orders
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users manage their own support cases" ON public.support_cases
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alerts, public.orders, public.support_cases TO authenticated;
