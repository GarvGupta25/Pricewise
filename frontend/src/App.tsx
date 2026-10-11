import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CartDrawer } from "./components/CartDrawer";
import { ChatIntake } from "./components/ChatIntake";
import { ProductComparisonGrid } from "./components/ProductComparisonGrid";
import { RecommendationPanel } from "./components/RecommendationPanel";
import { SearchProgress } from "./components/SearchProgress";
import { useChatSocket } from "./hooks/useChatSocket";
import { useSessionStore } from "./store/sessionStore";
import { useAuth } from "./auth";

const discoveryPaths = [
  { label: "Phones", prompt: "Help me find a smartphone that fits my budget and daily use" },
  { label: "Laptops", prompt: "Help me choose a laptop for my work and budget" },
  { label: "Displays", prompt: "Help me find the right monitor for my setup" },
  { label: "Audio", prompt: "Help me choose headphones for the way I listen" },
];

function SiteHeader() {
  const demoUser = useSessionStore((state) => state.demoUser);
  const cartCount = useSessionStore((state) => state.cart.length);
  const { loading, session } = useAuth();
  const displayName = session?.user.user_metadata.display_name || session?.user.email || demoUser || "Sign in";
  return (
    <header className="site-header">
      <Link className="wordmark" to="/" aria-label="Pricewise home">
        <span className="wordmark-mark" aria-hidden="true">P</span>
        <span>Pricewise</span>
      </Link>
      <nav className="site-nav" aria-label="Primary navigation">
        <NavLink to="/explore">Explore</NavLink>
        <NavLink to="/advisor">Ask Pricewise</NavLink>
        <NavLink to="/saved">Saved{cartCount ? ` ${cartCount}` : ""}</NavLink>
      </nav>
      <Link className="account-link" to="/account">
        <span className="account-avatar" aria-hidden="true">{loading ? "·" : String(displayName).charAt(0).toUpperCase()}</span>
        <span>{loading ? "Loading" : displayName}</span>
      </Link>
    </header>
  );
}

function LandingPage() {
  return (
    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="landing-copy">
          <p className="kicker">Your technology buying companion</p>
          <h1 id="landing-title">Choose well.<br /><span>Buy at the right moment.</span></h1>
          <p className="landing-intro">Pricewise turns an open-ended shopping question into a short list you can trust — grounded in real retailer prices, review signals and timing evidence.</p>
          <div className="landing-actions">
            <Link className="button button-primary" to="/advisor">Ask Pricewise <span aria-hidden="true">↗</span></Link>
            <Link className="button button-secondary" to="/explore">Explore technology</Link>
          </div>
          <div className="trust-line" aria-label="Pricewise capabilities">
            <span>Approved Indian retailers</span><span>Evidence-led decisions</span><span>Private shortlist</span>
          </div>
        </div>
        <div className="product-stage" aria-label="A preview of the Pricewise product decision experience">
          <div className="stage-orbit" aria-hidden="true" />
          <div className="device-slab" aria-hidden="true"><span /></div>
          <article className="floating-card floating-card-price">
            <span className="signal-dot" aria-hidden="true" />
            <p>Price signal</p><strong>Near observed low</strong><small>Updated from live retailer evidence</small>
          </article>
          <article className="floating-card floating-card-fit">
            <p>Why it fits</p><strong>Built around your priorities</strong><small>No unexplained ranking</small>
          </article>
        </div>
      </section>
      <section className="chapter chapter-light" aria-labelledby="how-title">
        <div className="chapter-heading"><p className="kicker">From question to confidence</p><h2 id="how-title">Less searching.<br />More knowing.</h2></div>
        <div className="principle-grid">
          <article><span>01</span><h3>Describe the need</h3><p>Talk naturally. Pricewise asks only the questions that materially change the answer.</p></article>
          <article><span>02</span><h3>Compare the evidence</h3><p>See fit, trade-offs, retailer prices and review strength in one decision view.</p></article>
          <article><span>03</span><h3>Choose the moment</h3><p>Buy, wait or track with an honest confidence signal based on available history.</p></article>
        </div>
      </section>
      <section className="chapter closing-chapter">
        <p className="kicker">Start with the decision</p>
        <h2>What are you looking to buy?</h2>
        <Link className="command-link" to="/advisor"><span>Ask in your own words</span><b aria-hidden="true">→</b></Link>
      </section>
    </main>
  );
}

function ExplorePage() {
  return (
    <main className="page-shell">
      <header className="page-intro">
        <p className="kicker">Explore</p>
        <h1>Technology, through the lens of a better decision.</h1>
        <p>Choose a starting point. The advisor turns it into a brief tailored to your use, budget and timing.</p>
      </header>
      <section className="category-grid" aria-label="Technology categories">
        {discoveryPaths.map((item, index) => (
          <Link className={`category-card category-card-${index + 1}`} key={item.label} to={`/advisor?prompt=${encodeURIComponent(item.prompt)}`}>
            <span className="category-index">0{index + 1}</span>
            <div><p>Explore</p><h2>{item.label}</h2></div>
            <span className="category-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
      </section>
      <section className="editorial-strip">
        <div><p className="kicker">How Pricewise thinks</p><h2>A recommendation is only as good as its evidence.</h2></div>
        <p>Every result is designed to show the reason it fits, the trade-off you accept, where the price came from and how fresh the signal is. When the data is thin, Pricewise says so.</p>
        <Link to="/advisor">Start a decision <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}

function AdvisorPage() {
  const location = useLocation();
  const sessionId = useSessionStore((state) => state.sessionId);
  const messages = useSessionStore((state) => state.messages);
  const cart = useSessionStore((state) => state.cart);
  const addToCart = useSessionStore((state) => state.addToCart);
  const removeFromCart = useSessionStore((state) => state.removeFromCart);
  const { connect, sendMessage, stage, finalResult, error, isConnected } = useChatSocket();
  const starter = new URLSearchParams(location.search).get("prompt") ?? "";

  useEffect(() => { connect(sessionId); }, [connect, sessionId]);

  return (
    <main className="advisor-page">
      <header className="advisor-intro">
        <div><p className="kicker">Decision workspace</p><h1>Tell us what you need.<br /><span>We’ll narrow the field.</span></h1></div>
        <p>Real products from approved Indian retailers. Clear fit and timing signals. No invented certainty.</p>
      </header>
      <div className="advisor-layout">
        <section className="advisor-main" aria-label="Shopping advisor">
          {error && <div className="error-banner" role="alert"><strong>Live search needs attention.</strong><span>{error}</span></div>}
          <ChatIntake messages={messages} onSend={sendMessage} disabled={!isConnected} starter={starter} />
          <SearchProgress stage={stage} />
          {finalResult && <>
            <RecommendationPanel result={finalResult} />
            <ProductComparisonGrid products={finalResult.products} onAddToCart={addToCart} />
          </>}
        </section>
        <aside className="advisor-rail">
          <div className={`connection-card ${isConnected ? "is-live" : ""}`} role="status">
            <span className="signal-dot" aria-hidden="true" />
            <div><strong>{isConnected ? "Advisor connected" : "Connecting advisor"}</strong><p>{isConnected ? "Ready for a new decision" : "The workspace will unlock when connected"}</p></div>
          </div>
          <CartDrawer items={cart} onRemove={removeFromCart} compact />
        </aside>
      </div>
    </main>
  );
}

function SavedPage() {
  const cart = useSessionStore((state) => state.cart);
  const removeFromCart = useSessionStore((state) => state.removeFromCart);
  return (
    <main className="page-shell">
      <header className="page-intro"><p className="kicker">Saved & tracking</p><h1>Your decisions, held in one place.</h1><p>Products saved in this browser remain here while account-backed tracking is being built.</p></header>
      <CartDrawer items={cart} onRemove={removeFromCart} />
    </main>
  );
}

function AccountPage() {
  const currentUser = useSessionStore((state) => state.demoUser);
  const setUser = useSessionStore((state) => state.setUser);
  const { configured, loading, session, sendMagicLink, signOut, updateDisplayName } = useAuth();
  const [name, setName] = useState(String(session?.user.user_metadata.display_name || currentUser || ""));
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (session?.user.user_metadata.display_name) setName(session.user.user_metadata.display_name); }, [session]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setStatus(null); setBusy(true);
    try {
      if (configured && !session) { await sendMagicLink(email.trim()); setStatus("Check your email for a secure sign-in link."); }
      else if (configured) { await updateDisplayName(name.trim()); setStatus("Profile updated."); }
      else { setUser(name.trim()); setStatus("Preview profile saved on this device."); }
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to update your account."); }
    finally { setBusy(false); }
  };
  return (
    <main className="account-page">
      <section className="account-panel" aria-labelledby="account-title">
        <p className="kicker">{configured ? "Secure account" : "Preview profile"}</p>
        <h1 id="account-title">{session ? "Good to have you here." : "Make the experience yours."}</h1>
        <p>{configured ? session ? `Signed in as ${session.user.email}. Your authenticated profile can follow you across devices.` : "Use a magic link to sign in without a password. We’ll send it only to the address you enter." : "Supabase is not configured in this environment, so your preview name and shortlist stay in this browser."}</p>
        <form onSubmit={submit} className="account-form">
          {configured && !session ? <><label htmlFor="account-email">Email address</label><input id="account-email" type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setStatus(null); }} placeholder="you@example.com" autoComplete="email" /></> : <><label htmlFor="profile-name">Your name</label><input id="profile-name" required value={name} onChange={(event) => { setName(event.target.value); setStatus(null); }} placeholder="e.g. Garv" autoComplete="name" /></>}
          <button type="submit" disabled={busy || loading} className="button button-primary">{busy ? "Working…" : configured && !session ? "Email me a sign-in link" : "Save profile"}</button>
          {status && <p className="form-success" role="status">{status}</p>}
        </form>
        {session && <button className="signout-button" type="button" onClick={() => signOut()}>Sign out</button>}
      </section>
    </main>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/advisor" element={<AdvisorPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="site-footer"><Link to="/">Pricewise</Link><p>Evidence-led shopping for consumer technology.</p><span>India · Preview</span></footer>
    </div>
  );
}
