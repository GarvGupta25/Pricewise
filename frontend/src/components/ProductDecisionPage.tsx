import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useSessionStore } from "../store/sessionStore";
import type { ProductResult } from "../types";
import { PriceSparkline } from "./PriceSparkline";

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

function pricePosition(product: ProductResult) {
  if (product.price_data_status === "insufficient_data") return "More history needed";
  if (product.all_time_low !== null && product.current_price <= product.all_time_low * 1.02) return "Near observed low";
  if (product.avg_90_day !== null && product.current_price < product.avg_90_day) return "Below 90-day average";
  return "Above recent average";
}

export function ProductDecisionPage() {
  const { productId } = useParams();
  const result = useSessionStore((state) => state.result);
  const cart = useSessionStore((state) => state.cart);
  const addToCart = useSessionStore((state) => state.addToCart);
  const setError = useSessionStore((state) => state.setError);
  const { saveProduct } = useAuth();
  const product = result?.products.find((item) => item.id === productId);

  if (!result || !product) {
    return (
      <main className="decision-empty">
        <p className="kicker">Decision unavailable</p>
        <h1>Let’s rebuild this comparison.</h1>
        <p>Product evidence is kept with your latest search. Start a new conversation and Pricewise will create a fresh decision view.</p>
        <Link className="button button-primary" to="/advisor">Ask Pricewise</Link>
      </main>
    );
  }

  const isLead = result.products[0]?.id === product.id;
  const isSaved = cart.some((item) => item.id === product.id);
  const save = () => {
    addToCart(product);
    saveProduct(product).catch(() => setError("Saved locally, but account sync failed."));
  };

  return (
    <main className="decision-page">
      <Link className="decision-back" to="/advisor"><span aria-hidden="true">←</span> Back to comparison</Link>
      <section className="decision-hero" aria-labelledby="decision-title">
        <div className={`decision-visual ${product.image_url ? "has-image" : ""}`}>
          {product.image_url ? <img src={product.image_url} alt={product.title} referrerPolicy="no-referrer" /> : <span aria-hidden="true">{product.title.charAt(0).toUpperCase()}</span>}
          <div className="decision-position"><i aria-hidden="true" />{pricePosition(product)}</div>
        </div>
        <div className="decision-copy">
          <p className="kicker">{isLead ? "Leading match" : "Comparison option"} · {product.source_site}</p>
          <h1 id="decision-title">{product.title}</h1>
          <div className="decision-price">
            <strong>{money(product.current_price)}</strong>
            {product.rating != null && <span aria-label={`${product.rating} out of 5 stars`}>★ {product.rating}{product.review_count ? ` · ${product.review_count.toLocaleString("en-IN")} reviews` : ""}</span>}
          </div>
          <p className="decision-summary">{isLead ? result.reasoning : "This product ranked among the strongest matches for your brief. Compare its price position and retailer evidence before choosing."}</p>
          <div className="decision-actions">
            <button className="button button-primary" type="button" onClick={save} disabled={isSaved}>{isSaved ? "Saved for tracking" : "Save & track price"}</button>
            <a className="button button-secondary" href={product.source_url} target="_blank" rel="noreferrer">Buy at {product.source_site} <span aria-hidden="true">↗</span></a>
          </div>
          <p className="decision-disclosure">Pricewise does not place this order yet. You’ll finish securely with the retailer.</p>
        </div>
      </section>

      <section className="decision-evidence" aria-labelledby="evidence-title">
        <header><div><p className="kicker">Price evidence</p><h2 id="evidence-title">Know the buying moment.</h2></div><span>{product.history_points} observations</span></header>
        <div className="decision-chart"><PriceSparkline points={product.price_history} /></div>
        <div className="evidence-grid">
          <article><span>Today</span><strong>{money(product.current_price)}</strong><p>Current listed retailer price</p></article>
          <article><span>90-day average</span><strong>{product.avg_90_day === null ? "Not enough data" : money(product.avg_90_day)}</strong><p>Recent price benchmark</p></article>
          <article><span>Observed low</span><strong>{product.all_time_low === null ? "Not enough data" : money(product.all_time_low)}</strong><p>Lowest recorded by Pricewise</p></article>
        </div>
      </section>

      <section className={`decision-verdict decision-verdict-${result.recommendation}`}>
        <div><p className="kicker">Pricewise verdict</p><h2>{isLead ? result.recommendation.replace("_", " ") : "Compare before choosing"}</h2></div>
        <div><p>{isLead ? result.reasoning : "The overall verdict applies to the leading match. Use the evidence above to judge whether this alternative earns the trade-off."}</p>{result.upcoming_sale && <p className="sale-note"><strong>{result.upcoming_sale.name}</strong> begins in about {result.upcoming_sale.starts_in_days} days.</p>}</div>
      </section>
    </main>
  );
}
