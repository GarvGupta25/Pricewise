import type { PricePoint } from "../types";

export function PriceSparkline({ points }: { points: PricePoint[] }) {
  if (points.length < 2) return <div className="sparkline-empty"><span />Price history unavailable</div>;
  const prices = points.map((point) => point.price);
  const low = Math.min(...prices);
  const range = Math.max(...prices) - low || 1;
  const path = points.map((point, index) => `${(index / (points.length - 1)) * 100},${38 - ((point.price - low) / range) * 30}`).join(" ");
  return <div className="sparkline"><svg viewBox="0 0 100 42" role="img" aria-label={`Price history from ₹${prices[0].toLocaleString("en-IN")} to ₹${prices[prices.length - 1].toLocaleString("en-IN")}`} preserveAspectRatio="none"><line x1="0" y1="38" x2="100" y2="38" /><polyline points={path} /></svg></div>;
}
