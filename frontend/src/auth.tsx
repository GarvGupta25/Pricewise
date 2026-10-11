import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import type { OrderRecord, PriceNotification, SavedProduct, ShopperPreferences, SupportCase } from "./store/sessionStore";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  sendMagicLink: (email: string) => Promise<void>;
  updateProfile: (name: string, preferences: ShopperPreferences) => Promise<void>;
  signOut: () => Promise<void>;
  syncSaved: (localProducts: SavedProduct[]) => Promise<SavedProduct[]>;
  saveProduct: (product: SavedProduct) => Promise<void>;
  removeSaved: (productId: string) => Promise<void>;
  syncWorkspace: (orders: OrderRecord[], supportCases: SupportCase[], notifications: PriceNotification[]) => Promise<{ orders: OrderRecord[]; supportCases: SupportCase[]; notifications: PriceNotification[] }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false); });
    return () => data.subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (email: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/account` } });
    if (error) throw error;
  };
  const updateProfile = async (name: string, preferences: ShopperPreferences) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: name, shopping_preferences: preferences } });
    if (error) throw error;
    setSession((current) => current ? { ...current, user: data.user } : current);
  };
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); };
  const syncSaved = async (localProducts: SavedProduct[]) => {
    if (!supabase || !session) return localProducts;
    if (localProducts.length) {
      const rows = localProducts.map((product) => ({ user_id: session.user.id, product_id: product.id, title: product.title, source_site: product.source_site, current_price: product.current_price }));
      const { error } = await supabase.from("saved_products").upsert(rows, { onConflict: "user_id,product_id" });
      if (error) throw error;
    }
    const { data, error } = await supabase.from("saved_products").select("product_id,title,source_site,current_price").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((row) => ({ id: row.product_id, title: row.title, source_site: row.source_site, current_price: row.current_price }));
  };
  const saveProduct = async (product: SavedProduct) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("saved_products").upsert({ user_id: session.user.id, product_id: product.id, title: product.title, source_site: product.source_site, current_price: product.current_price }, { onConflict: "user_id,product_id" });
    if (error) throw error;
  };
  const removeSaved = async (productId: string) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("saved_products").delete().eq("product_id", productId);
    if (error) throw error;
  };
  const syncWorkspace = async (orders: OrderRecord[], supportCases: SupportCase[], notifications: PriceNotification[]) => {
    if (!supabase || !session) return { orders, supportCases, notifications };
    const userId = session.user.id;
    if (orders.length) {
      const { error } = await supabase.from("orders").upsert(orders.map((order) => ({ order_id: order.orderId, user_id: userId, product_id: order.id, title: order.title, source_site: order.source_site, current_price: order.current_price, status: order.status, delivery_date: order.deliveryDate || null, installation_at: order.installationAt ? new Date(order.installationAt).toISOString() : null, created_at: order.createdAt, updated_at: new Date().toISOString() })), { onConflict: "order_id" });
      if (error) throw error;
    }
    if (supportCases.length) {
      const { error } = await supabase.from("support_cases").upsert(supportCases.map((supportCase) => ({ case_id: supportCase.id, user_id: userId, order_id: supportCase.orderId, kind: supportCase.kind, summary: supportCase.summary, created_at: supportCase.createdAt })), { onConflict: "case_id" });
      if (error) throw error;
    }
    if (notifications.length) {
      const { error } = await supabase.from("price_alerts").upsert(notifications.map((item) => ({ alert_id: item.id, user_id: userId, product_id: item.productId, title: item.title, previous_price: item.previousPrice, current_price: item.currentPrice, is_read: item.read, created_at: item.createdAt })), { onConflict: "user_id,alert_id" });
      if (error) throw error;
    }
    const [orderResult, caseResult, alertResult] = await Promise.all([
      supabase.from("orders").select("order_id,product_id,title,source_site,current_price,status,delivery_date,installation_at,created_at").order("created_at", { ascending: false }),
      supabase.from("support_cases").select("case_id,order_id,kind,summary,created_at").order("created_at", { ascending: false }),
      supabase.from("price_alerts").select("alert_id,product_id,title,previous_price,current_price,is_read,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    if (orderResult.error) throw orderResult.error;
    if (caseResult.error) throw caseResult.error;
    if (alertResult.error) throw alertResult.error;
    return {
      orders: orderResult.data.map((row) => ({ orderId: row.order_id, id: row.product_id, title: row.title, source_site: row.source_site, current_price: row.current_price, status: row.status, deliveryDate: row.delivery_date ?? undefined, installationAt: row.installation_at ?? undefined, createdAt: row.created_at })) as OrderRecord[],
      supportCases: caseResult.data.map((row) => ({ id: row.case_id, orderId: row.order_id, kind: row.kind, summary: row.summary, createdAt: row.created_at })) as SupportCase[],
      notifications: alertResult.data.map((row) => ({ id: row.alert_id, productId: row.product_id, title: row.title, previousPrice: row.previous_price, currentPrice: row.current_price, read: row.is_read, createdAt: row.created_at })) as PriceNotification[],
    };
  };

  return <AuthContext.Provider value={{ configured: Boolean(supabase), loading, session, sendMagicLink, updateProfile, signOut, syncSaved, saveProduct, removeSaved, syncWorkspace }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
