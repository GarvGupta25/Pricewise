import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import type { SavedProduct, ShopperPreferences } from "./store/sessionStore";

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

  return <AuthContext.Provider value={{ configured: Boolean(supabase), loading, session, sendMagicLink, updateProfile, signOut, syncSaved, saveProduct, removeSaved }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
