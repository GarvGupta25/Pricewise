import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import type { ChatMessage } from "../types";

const starters = ["A phone under ₹25,000", "A laptop for video editing", "Headphones for travel"];

export function ChatIntake({ messages, onSend, disabled, starter = "" }: { messages: ChatMessage[]; onSend: (value: string) => void; disabled: boolean; starter?: string }) {
  const [value, setValue] = useState(starter);
  useEffect(() => { if (starter) setValue(starter); }, [starter]);
  const submit = (event?: FormEvent) => { event?.preventDefault(); if (!disabled && value.trim()) { onSend(value.trim()); setValue(""); } };
  const handleKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } };
  return (
    <section className="conversation-card" aria-labelledby="conversation-title">
      <div className="conversation-heading">
        <div><p className="kicker">Ask Pricewise</p><h2 id="conversation-title">What are you looking to buy?</h2></div>
        <span className="conversation-mode">Live advisor</span>
      </div>
      {messages.length > 0 && <ol className="conversation-log" aria-live="polite">
        {messages.map((message, index) => <li key={`${message.role}-${index}`} className={`message message-${message.role}`}><span>{message.role === "user" ? "You" : "Pricewise"}</span><p>{message.content}</p></li>)}
      </ol>}
      <form onSubmit={submit} className="prompt-form">
        <label className="sr-only" htmlFor="shopping-prompt">Describe the product you want to buy</label>
        <textarea id="shopping-prompt" rows={2} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={handleKeys} disabled={disabled} placeholder={disabled ? "Connecting to the advisor…" : "Tell us the product, budget and what matters most"} />
        <div className="prompt-actions"><span>Enter to send · Shift + Enter for a new line</span><button type="submit" disabled={disabled || !value.trim()} aria-label="Send shopping request">→</button></div>
      </form>
      {!messages.length && <div className="starter-row" aria-label="Example searches">{starters.map((item) => <button key={item} type="button" onClick={() => setValue(item)}>{item}</button>)}</div>}
    </section>
  );
}
