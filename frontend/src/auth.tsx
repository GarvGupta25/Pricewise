import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  sendMagicLink: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
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
  const updateDisplayName = async (name: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: name } });
    if (error) throw error;
    setSession((current) => current ? { ...current, user: data.user } : current);
  };
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); };

  return <AuthContext.Provider value={{ configured: Boolean(supabase), loading, session, sendMagicLink, updateDisplayName, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
