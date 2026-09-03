import { useEffect } from "react";
import { ChatIntake } from "./components/ChatIntake";
import { ProductComparisonGrid } from "./components/ProductComparisonGrid";
import { RecommendationPanel } from "./components/RecommendationPanel";
import { SearchProgress } from "./components/SearchProgress";
import { useChatSocket } from "./hooks/useChatSocket";
import { useSessionStore } from "./store/sessionStore";

export default function App() {
  const sessionId = useSessionStore((state) => state.sessionId); const messages = useSessionStore((state) => state.messages);
  const { connect, sendMessage, stage, finalResult, error, isConnected } = useChatSocket();
  useEffect(() => { connect(sessionId); }, [connect, sessionId]);
  return <main className="min-h-screen bg-[#f8f7f4] px-5 py-8 text-slate-800 sm:px-8 lg:px-12"><div className="mx-auto max-w-7xl space-y-6"><header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.22em] text-coral">Pricewise</p><h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink">A calmer way to decide.</h1></div><span className={`rounded-full px-3 py-2 text-sm font-semibold ${isConnected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{isConnected ? "Advisor connected" : "Connecting"}</span></header><p className="max-w-2xl text-lg leading-7 text-slate-600">Find a product, compare approved Indian retailers, and see whether the price deserves a buy-now or wait decision.</p>{error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}<ChatIntake messages={messages} onSend={sendMessage} disabled={!isConnected} /><SearchProgress stage={stage} />{finalResult && <><RecommendationPanel result={finalResult} /><ProductComparisonGrid products={finalResult.products} /></>}</div></main>;
}
