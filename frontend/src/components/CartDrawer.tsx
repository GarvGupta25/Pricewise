import { useState } from "react";
import { Link } from "react-router-dom";

type CartItem = { id: string; title: string; source_site: string; current_price: number };
const apiUrl = import.meta.env.VITE_API_HTTP_URL ?? "http://127.0.0.1:8000";

export function CartDrawer({ items, onRemove, onCheckoutStarted, compact = false }: { items: CartItem[]; onRemove: (id: string) => void; onCheckoutStarted?: (item: CartItem) => void; compact?: boolean }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const checkout = async (item: CartItem) => {
    setLoadingId(item.id); setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/payment-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: item.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Unable to create payment link.");
      window.open(body.payment_link_url, "_blank", "noopener,noreferrer");
      onCheckoutStarted?.(item);
      setMessage("Razorpay test link opened in a new tab.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create payment link."); }
    finally { setLoadingId(null); }
  };
  return <section className={`saved-panel ${compact ? "saved-panel-compact" : ""}`} aria-labelledby={compact ? "saved-title-compact" : "saved-title"}>
    <header><div><p className="kicker">Saved products</p><h2 id={compact ? "saved-title-compact" : "saved-title"}>{items.length ? `${items.length} under consideration` : "Nothing saved yet"}</h2></div><span className="saved-count" aria-hidden="true">{items.length}</span></header>
    {!items.length ? <div className="saved-empty"><p>Save a result to keep it close and compare the buying moment.</p><Link to="/advisor">Start a product search <span aria-hidden="true">→</span></Link></div> : <ul>{items.map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>{item.source_site} · ₹{item.current_price.toLocaleString("en-IN")}</span></div><div className="saved-actions"><button onClick={() => checkout(item)} disabled={loadingId === item.id}>{loadingId === item.id ? "Creating…" : "Test checkout"}</button><button className="remove-action" onClick={() => onRemove(item.id)}>Remove</button></div></li>)}</ul>}
    {message && <p className="checkout-message" role="status">{message}</p>}
    {items.length > 0 && <p className="sandbox-note">Checkout remains Razorpay test-mode. Retailer order placement is not yet connected.</p>}
  </section>;
}
