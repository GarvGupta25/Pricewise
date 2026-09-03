import type { ProductResult } from "../types";
import { ProductCard } from "./ProductCard";
export function ProductComparisonGrid({ products }: { products: ProductResult[] }) { if (!products.length) return null; return <section><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-coral">Evidence, not guesses</p><h2 className="mt-1 text-2xl font-bold text-ink">Top matches</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>; }
