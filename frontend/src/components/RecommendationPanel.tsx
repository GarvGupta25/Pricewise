import type { FinalResult } from "../types";

export function RecommendationPanel({ result }: { result: FinalResult }) {
  const title = result.recommendation === "buy_now" ? "The evidence supports buying now." : result.recommendation === "wait" ? "Waiting may be the better move." : "More price history is needed.";
  return <section className={`recommendation recommendation-${result.recommendation}`}><div className="recommendation-label"><span aria-hidden="true" />Recommendation</div><h2>{title}</h2><p>{result.reasoning}</p>{result.upcoming_sale && <div className="sale-signal"><strong>{result.upcoming_sale.name}</strong><span>Starts in {result.upcoming_sale.starts_in_days} days</span></div>}</section>;
}
