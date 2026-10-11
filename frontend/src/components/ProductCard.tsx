import { Link } from "react-router-dom";
import type { ProductResult } from "../types";
import { PriceSparkline } from "./PriceSparkline";

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export function ProductCard({ product, rank, onAddToCart }: { product: ProductResult; rank: number; onAddToCart: () => void }) {
  const low = product.all_time_low !== null && product.current_price <= product.all_time_low * 1.02;
  return <article className="product-card">
    <div className="product-card-top"><span className="rank-label">0{rank}</span><span className="retailer-label">{product.source_site}</span>{low && <span className="low-label">Near observed low</span>}</div>
    <div className={`product-visual ${product.image_url ? "has-image" : ""}`} aria-hidden="true">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{product.title.charAt(0).toUpperCase()}</span>}</div>
    <h3>{product.title}</h3>
    <div className="product-price-row"><strong>{money(product.current_price)}</strong>{product.rating != null && <span aria-label={`${product.rating} out of 5 stars`}>★ {product.rating}{product.review_count ? ` · ${product.review_count.toLocaleString("en-IN")}` : ""}</span>}</div>
    <PriceSparkline points={product.price_history} />
    <p className="price-context">{product.price_data_status === "insufficient_data" ? "Price history is still being built." : `90-day average ${money(product.avg_90_day ?? product.current_price)}`}</p>
    <div className="product-actions"><Link to={`/product/${encodeURIComponent(product.id)}`}>View decision <span aria-hidden="true">→</span></Link><button onClick={onAddToCart}>Save & track</button></div>
  </article>;
}
