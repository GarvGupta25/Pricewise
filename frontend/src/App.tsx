import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CartDrawer } from "./components/CartDrawer";
import { ChatIntake } from "./components/ChatIntake";
import { ProductComparisonGrid } from "./components/ProductComparisonGrid";
import { ProductDecisionPage } from "./components/ProductDecisionPage";
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
const apiUrl = import.meta.env.VITE_API_HTTP_URL ?? "http://127.0.0.1:8000";

function PriceRefresh() {
  const cart = useSessionStore((state) => state.cart);
  const applyPriceRefresh = useSessionStore((state) => state.applyPriceRefresh);
  const productIds = cart.map((item) => item.id).join(",");
  useEffect(() => {
    if (!productIds) return;
    fetch(`${apiUrl}/products/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_ids: productIds.split(",") }),
    }).then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: { products: typeof cart }) => applyPriceRefresh(body.products))
      .catch(() => undefined);
  }, [productIds, applyPriceRefresh]);
  return null;
}

function SavedSync() {
  const cart = useSessionStore((state) => state.cart);
  const setCart = useSessionStore((state) => state.setCart);
  const setError = useSessionStore((state) => state.setError);
  const { session, syncSaved } = useAuth();
  useEffect(() => {
    if (!session) return;
    syncSaved(cart).then(setCart).catch(() => setError("Your saved products could not sync. The local copy is still available."));
  }, [session?.user.id]);
  return null;
}

function SiteHeader() {
  const demoUser = useSessionStore((state) => state.demoUser);
  const cartCount = useSessionStore((state) => state.cart.length);
  const unreadCount = useSessionStore((state) => state.notifications.filter((item) => !item.read).length);
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
        <NavLink className="notification-link" to="/notifications" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>Alerts{unreadCount ? <b>{unreadCount}</b> : null}</NavLink>
        <NavLink to="/orders">Orders</NavLink>
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
  const setError = useSessionStore((state) => state.setError);
  const startCheckout = useSessionStore((state) => state.startCheckout);
  const { saveProduct, removeSaved } = useAuth();
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
            <ProductComparisonGrid products={finalResult.products} onAddToCart={(product) => { addToCart(product); saveProduct(product).catch(() => setError("Saved locally, but account sync failed.")); }} />
          </>}
        </section>
        <aside className="advisor-rail">
          <div className={`connection-card ${isConnected ? "is-live" : ""}`} role="status">
            <span className="signal-dot" aria-hidden="true" />
            <div><strong>{isConnected ? "Advisor connected" : "Connecting advisor"}</strong><p>{isConnected ? "Ready for a new decision" : "The workspace will unlock when connected"}</p></div>
          </div>
          <CartDrawer items={cart} onRemove={(id) => { removeFromCart(id); removeSaved(id).catch(() => setError("Removed locally, but account sync failed.")); }} onCheckoutStarted={startCheckout} compact />
        </aside>
      </div>
    </main>
  );
}

function SavedPage() {
  const cart = useSessionStore((state) => state.cart);
  const removeFromCart = useSessionStore((state) => state.removeFromCart);
  const setError = useSessionStore((state) => state.setError);
  const startCheckout = useSessionStore((state) => state.startCheckout);
  const { removeSaved } = useAuth();
  return (
    <main className="page-shell">
      <header className="page-intro"><p className="kicker">Saved & tracking</p><h1>Your decisions, held in one place.</h1><p>Products saved in this browser remain here while account-backed tracking is being built.</p></header>
      <CartDrawer items={cart} onRemove={(id) => { removeFromCart(id); removeSaved(id).catch(() => setError("Removed locally, but account sync failed.")); }} onCheckoutStarted={startCheckout} />
    </main>
  );
}

function NotificationsPage() {
  const notifications = useSessionStore((state) => state.notifications);
  const markNotificationsRead = useSessionStore((state) => state.markNotificationsRead);
  useEffect(() => { if (notifications.some((item) => !item.read)) markNotificationsRead(); }, [notifications, markNotificationsRead]);
  return (
    <main className="page-shell">
      <header className="page-intro"><p className="kicker">Price alerts</p><h1>Changes worth knowing.</h1><p>Pricewise checks your saved products when you return and keeps meaningful price drops together here.</p></header>
      <section className="notifications-panel" aria-labelledby="notifications-title">
        <div className="notifications-heading"><div><p className="kicker">Notification centre</p><h2 id="notifications-title">{notifications.length ? `${notifications.length} price update${notifications.length === 1 ? "" : "s"}` : "You’re all caught up"}</h2></div><span aria-hidden="true">{notifications.length}</span></div>
        {!notifications.length ? <div className="notifications-empty"><p>Save a product and we’ll compare its latest cached price the next time you visit.</p><Link to="/advisor">Find a product <span aria-hidden="true">→</span></Link></div> : <ol className="notification-list">{notifications.map((item) => <li key={item.id}>
          <span className="drop-badge">Price drop</span><div><h3>{item.title}</h3><p><s>₹{item.previousPrice.toLocaleString("en-IN")}</s><strong>₹{item.currentPrice.toLocaleString("en-IN")}</strong><em>Save ₹{(item.previousPrice - item.currentPrice).toLocaleString("en-IN")}</em></p></div><Link to={`/product/${encodeURIComponent(item.productId)}`}>Review decision <span aria-hidden="true">→</span></Link>
        </li>)}</ol>}
      </section>
    </main>
  );
}

function OrdersPage() {
  const orders = useSessionStore((state) => state.orders);
  const updateOrder = useSessionStore((state) => state.updateOrder);
  const savePlan = (event: FormEvent<HTMLFormElement>, orderId: string) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateOrder(orderId, { deliveryDate: String(data.get("deliveryDate") || ""), installationAt: String(data.get("installationAt") || "") });
  };
  const calendarUrl = (title: string, date: string) => {
    const start = new Date(date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const format = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Install ${title}`)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent("Installation planned with Pricewise")}`;
  };
  return (
    <main className="page-shell">
      <header className="page-intro"><p className="kicker">Purchase companion</p><h1>From checkout to setup.</h1><p>Keep the handoff honest: confirm your retailer purchase, plan delivery, and reserve an installation window without losing the decision context.</p></header>
      {!orders.length ? <section className="orders-empty"><h2>No purchase journey yet.</h2><p>Open a test checkout from a saved product and it will appear here.</p><Link className="button button-primary" to="/saved">View saved products</Link></section> : <section className="orders-list" aria-label="Purchase journeys">{orders.map((order) => <article className="order-card" key={order.orderId}>
        <header><div><p className="kicker">{order.source_site}</p><h2>{order.title}</h2></div><span className={`order-status order-status-${order.status}`}>{order.status.replace("_", " ")}</span></header>
        <div className="order-meta"><span>Order value <strong>₹{order.current_price.toLocaleString("en-IN")}</strong></span><span>Started <strong>{new Date(order.createdAt).toLocaleDateString("en-IN")}</strong></span></div>
        {order.status === "checkout_started" && <div className="order-step"><div><h3>Did the retailer confirm payment?</h3><p>Pricewise cannot see the retailer’s payment status yet. Confirm only after you receive their order confirmation.</p></div><button className="button button-primary" onClick={() => updateOrder(order.orderId, { status: "ordered" })}>Yes, order confirmed</button></div>}
        {order.status !== "checkout_started" && <form className="fulfilment-form" onSubmit={(event) => savePlan(event, order.orderId)}><label>Expected delivery<input type="date" name="deliveryDate" defaultValue={order.deliveryDate} min={new Date().toISOString().slice(0, 10)} /></label><label>Preferred installation<input type="datetime-local" name="installationAt" defaultValue={order.installationAt} /></label><button type="submit">Save plan</button></form>}
        {order.status === "ordered" && <div className="order-actions">{order.installationAt && <a href={calendarUrl(order.title, order.installationAt)} target="_blank" rel="noreferrer">Add installation to Google Calendar <span aria-hidden="true">↗</span></a>}<button onClick={() => updateOrder(order.orderId, { status: "delivered" })}>Mark delivered</button></div>}
        {order.status === "delivered" && <div className="delivered-note"><span aria-hidden="true">✓</span><div><strong>Delivered</strong><p>Your after-sales workspace is ready if anything needs attention.</p></div></div>}
      </article>)}</section>}
    </main>
  );
}

function AccountPage() {
  const currentUser = useSessionStore((state) => state.demoUser);
  const setUser = useSessionStore((state) => state.setUser);
  const storedPreferences = useSessionStore((state) => state.preferences);
  const setPreferences = useSessionStore((state) => state.setPreferences);
  const { configured, loading, session, sendMagicLink, signOut, updateProfile } = useAuth();
  const [name, setName] = useState(String(session?.user.user_metadata.display_name || currentUser || ""));
  const [shoppingStyle, setShoppingStyle] = useState(storedPreferences.shoppingStyle);
  const [budgetFlexibility, setBudgetFlexibility] = useState(storedPreferences.budgetFlexibility);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (session?.user.user_metadata.display_name) setName(session.user.user_metadata.display_name); }, [session]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setStatus(null); setBusy(true);
    try {
      if (configured && !session) { await sendMagicLink(email.trim()); setStatus("Check your email for a secure sign-in link."); }
      else {
        const preferences = { shoppingStyle, budgetFlexibility };
        if (configured) await updateProfile(name.trim(), preferences);
        setUser(name.trim()); setPreferences(preferences); setStatus(configured ? "Profile updated." : "Preview profile saved on this device.");
      }
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
          {configured && !session ? <><label htmlFor="account-email">Email address</label><input id="account-email" type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setStatus(null); }} placeholder="you@example.com" autoComplete="email" /></> : <>
            <label htmlFor="profile-name">Your name</label><input id="profile-name" required value={name} onChange={(event) => { setName(event.target.value); setStatus(null); }} placeholder="e.g. Garv" autoComplete="name" />
            <fieldset className="preference-field"><legend>How do you usually choose?</legend><div className="preference-options">
              {([['best_value', 'Best value'], ['balanced', 'Balanced'], ['premium', 'Premium']] as const).map(([value, label]) => <label key={value} className={shoppingStyle === value ? "selected" : ""}><input type="radio" name="shopping-style" value={value} checked={shoppingStyle === value} onChange={() => setShoppingStyle(value)} /><span>{label}</span></label>)}
            </div></fieldset>
            <fieldset className="preference-field"><legend>Budget flexibility</legend><div className="preference-options preference-options-two">
              {([['strict', 'Stay within it'], ['flexible', 'Stretch for the right fit']] as const).map(([value, label]) => <label key={value} className={budgetFlexibility === value ? "selected" : ""}><input type="radio" name="budget-flexibility" value={value} checked={budgetFlexibility === value} onChange={() => setBudgetFlexibility(value)} /><span>{label}</span></label>)}
            </div></fieldset>
          </>}
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
      <SavedSync />
      <PriceRefresh />
      <SiteHeader />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/advisor" element={<AdvisorPage />} />
        <Route path="/product/:productId" element={<ProductDecisionPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="site-footer"><Link to="/">Pricewise</Link><p>Evidence-led shopping for consumer technology.</p><span>India · Preview</span></footer>
    </div>
  );
}
