import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";

const starters = ["A phone under ₹25,000", "A laptop for video editing", "Headphones for travel"];

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function ChatIntake({ messages, onSend, disabled, starter = "" }: { messages: ChatMessage[]; onSend: (value: string) => void; disabled: boolean; starter?: string }) {
  const [value, setValue] = useState(starter);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  useEffect(() => { if (starter) setValue(starter); }, [starter]);
  useEffect(() => () => recognition.current?.stop(), []);
  const speechApi = typeof window === "undefined" ? undefined : (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
  const toggleVoice = () => {
    if (listening) { recognition.current?.stop(); return; }
    if (!speechApi) return;
    const next = new speechApi();
    next.lang = "en-IN";
    next.interimResults = false;
    next.onresult = (event) => setValue((current) => `${current}${current ? " " : ""}${event.results[0][0].transcript.trim()}`);
    next.onend = () => setListening(false);
    next.onerror = () => setListening(false);
    recognition.current = next;
    setListening(true);
    next.start();
  };
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
        <div className="prompt-actions"><span>Enter to send · Shift + Enter for a new line</span><div className="prompt-buttons">{speechApi && <button className={`voice-button ${listening ? "listening" : ""}`} type="button" onClick={toggleVoice} disabled={disabled} aria-label={listening ? "Stop voice input" : "Start voice input"}>{listening ? "■" : "●"}</button>}<button type="submit" disabled={disabled || !value.trim()} aria-label="Send shopping request">→</button></div></div>
      </form>
      {!messages.length && <div className="starter-row" aria-label="Example searches">{starters.map((item) => <button key={item} type="button" onClick={() => setValue(item)}>{item}</button>)}</div>}
    </section>
  );
}
