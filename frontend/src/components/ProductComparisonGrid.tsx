import type { ProductResult } from "../types";
import { ProductCard } from "./ProductCard";

export function ProductComparisonGrid({ products, onAddToCart }: { products: ProductResult[]; onAddToCart: (product: ProductResult) => void }) {
  if (!products.length) return null;
  return <section className="results-section"><header><p className="kicker">Verified retailer results</p><h2>Strongest matches</h2><p>{products.length} products ranked from the available evidence.</p></header><div className="product-grid">{products.map((product, index) => <ProductCard key={product.id} product={product} rank={index + 1} onAddToCart={() => onAddToCart(product)} />)}</div></section>;
}
