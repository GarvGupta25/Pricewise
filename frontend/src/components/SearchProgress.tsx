const stages = [
  { id: "searching", label: "Search retailers" },
  { id: "comparing", label: "Compare matches" },
  { id: "checking_prices", label: "Read price history" },
  { id: "checking_calendar", label: "Check sale timing" },
  { id: "done", label: "Decision ready" },
];

export function SearchProgress({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const active = stages.findIndex((item) => item.id === stage);
  return <section className="progress-card" aria-label="Search progress" aria-live="polite"><div className="progress-heading"><p className="kicker">Working through the evidence</p><strong>{stages[active]?.label ?? "Understanding your request"}</strong></div><ol>{stages.map((item, index) => <li key={item.id} className={index < active ? "complete" : index === active ? "active" : ""}><span>{index < active ? "✓" : index + 1}</span><p>{item.label}</p></li>)}</ol></section>;
}
