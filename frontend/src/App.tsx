import { FormEvent, useEffect, useState } from "react";
import { CartDrawer } from "./components/CartDrawer";
import { ChatIntake } from "./components/ChatIntake";
import { ProductComparisonGrid } from "./components/ProductComparisonGrid";
import { RecommendationPanel } from "./components/RecommendationPanel";
import { SearchProgress } from "./components/SearchProgress";
import { useChatSocket } from "./hooks/useChatSocket";
import { useSessionStore } from "./store/sessionStore";

function DemoLogin({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim()) onSubmit(name.trim()); };
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="sign-in-title"><div className="brand-mark" aria-hidden="true">P</div><p className="eyebrow">Pricewise · live shopping advisor</p><h1 id="sign-in-title">Make your next purchase count.</h1><p className="auth-copy">Compare real Indian retailer listings, save promising products, and get a clearer buying decision.</p><form onSubmit={submit} className="auth-form"><label htmlFor="demo-name">Your name</label><input id="demo-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Garv" autoComplete="name" autoFocus /><button type="submit" className="button button-primary">Enter Pricewise <span aria-hidden="true">→</span></button></form><p className="fine-print">Demo access only. No password or account is created.</p></section></main>;
}

export default function App() {
  const sessionId = useSessionStore((state) => state.sessionId); const messages = useSessionStore((state) => state.messages); const demoUser = useSessionStore((state) => state.demoUser); const cart = useSessionStore((state) => state.cart); const setUser = useSessionStore((state) => state.setUser); const addToCart = useSessionStore((state) => state.addToCart); const removeFromCart = useSessionStore((state) => state.removeFromCart);
  const { connect, sendMessage, stage, finalResult, error, isConnected } = useChatSocket();
  useEffect(() => { connect(sessionId); }, [connect, sessionId]);
  if (!demoUser) return <DemoLogin onSubmit={setUser} />;
  return <main className="app-shell"><div className="app-frame"><header className="topbar"><a className="wordmark" href="#advisor" aria-label="Pricewise home"><span className="wordmark-dot" />PRICEWISE</a><div className="topbar-actions"><span className={`connection-state ${isConnected ? "is-live" : "is-offline"}`} role="status"><i />{isConnected ? "Advisor connected" : "Reconnecting"}</span><button onClick={() => setUser(null)} className="button button-quiet">Switch user</button></div></header><section className="welcome" aria-labelledby="welcome-title"><div><p className="eyebrow">Personal shopping workspace</p><h1 id="welcome-title">Good to see you, <span>{demoUser}.</span></h1></div><p>Real retailers. Clear choices. No guesswork.</p></section><div className="workspace"><section id="advisor" className="advisor-column" aria-label="Shopping advisor"><section className="hero-card"><p className="eyebrow">Decision intelligence</p><h2>Find the right moment to buy.</h2><p>Tell us what you need. Pricewise asks only the useful questions, then searches trusted Indian retailers for real products.</p><div className="hero-points"><span>Live product search</span><span>Price context</span><span>Private shortlist</span></div></section>{error && <div className="error-banner" role="alert"><strong>Live search needs attention.</strong><span>{error}</span></div>}<ChatIntake messages={messages} onSend={sendMessage} disabled={!isConnected} /><SearchProgress stage={stage} />{finalResult && <><RecommendationPanel result={finalResult} /><ProductComparisonGrid products={finalResult.products} onAddToCart={addToCart} /></>}</section><CartDrawer items={cart} onRemove={removeFromCart} /></div></div></main>;
}
