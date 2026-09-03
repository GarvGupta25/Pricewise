export interface PricePoint { price: number; recorded_at: string; }
export interface ProductResult { id: string; title: string; source_site: string; source_url: string; current_price: number; all_time_low: number | null; avg_90_day: number | null; history_points: number; rating?: number | null; review_count?: number | null; price_history: PricePoint[]; price_data_status: "ready" | "insufficient_data"; }
export interface UpcomingSale { name: string; starts_in_days: number; window_start_month: number; window_end_month: number; }
export interface FinalResult { recommendation: "buy_now" | "wait" | "insufficient_data"; reasoning: string; products: ProductResult[]; upcoming_sale: UpcomingSale | null; }
export interface ChatMessage { role: "user" | "assistant"; content: string; }
