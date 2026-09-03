import { useCallback, useEffect, useRef } from "react";
import { useSessionStore } from "../store/sessionStore";
import type { FinalResult } from "../types";

const socketUrl = import.meta.env.VITE_API_WS_URL ?? "ws://localhost:8000";
export function useChatSocket() {
  const socket = useRef<WebSocket | null>(null); const retry = useRef<number>(); const closedByApp = useRef(false);
  const store = useSessionStore();
  const connect = useCallback((sessionId: string) => {
    if (socket.current?.readyState === WebSocket.OPEN || socket.current?.readyState === WebSocket.CONNECTING) return;
    closedByApp.current = false; const ws = new WebSocket(`${socketUrl}/ws/chat`); socket.current = ws;
    ws.onopen = () => { useSessionStore.getState().setConnected(true); useSessionStore.getState().setError(null); };
    ws.onmessage = ({ data }) => { const message = JSON.parse(data) as { type: string; stage?: string; question?: string; reasoning?: string; message?: string } & FinalResult;
      if (message.type === "stage_update") useSessionStore.getState().setStage(message.stage ?? null);
      if (message.type === "clarification_needed") useSessionStore.getState().addMessage({ role: "assistant", content: message.question ?? "Could you clarify?" });
      if (message.type === "final_result") useSessionStore.getState().setResult(message);
      if (message.type === "error") useSessionStore.getState().setError(message.message ?? "Something went wrong."); };
    ws.onclose = () => { useSessionStore.getState().setConnected(false); if (!closedByApp.current) { useSessionStore.getState().setError("Connection lost. Reconnecting…"); retry.current = window.setTimeout(() => connect(sessionId), 1500); } };
  }, []);
  const sendMessage = useCallback((content: string) => { const state = useSessionStore.getState(); if (!content.trim()) return; if (socket.current?.readyState !== WebSocket.OPEN) { state.setError("Connecting to the advisor… please try again."); return; } state.addMessage({ role: "user", content }); state.setError(null); socket.current.send(JSON.stringify({ type: "user_message", session_id: state.sessionId, content })); }, []);
  useEffect(() => () => { closedByApp.current = true; if (retry.current) window.clearTimeout(retry.current); socket.current?.close(); }, []);
  const lastMessage = store.messages[store.messages.length - 1];
  return { connect, sendMessage, stage: store.stage, clarificationQuestion: lastMessage?.role === "assistant" ? lastMessage.content : null, finalResult: store.result, error: store.error, isConnected: store.isConnected };
}
