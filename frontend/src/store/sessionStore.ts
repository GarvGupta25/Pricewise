import { create } from "zustand";
import type { ChatMessage, FinalResult } from "../types";

type SessionState = { sessionId: string; messages: ChatMessage[]; stage: string | null; result: FinalResult | null; error: string | null; isConnected: boolean; addMessage: (message: ChatMessage) => void; setStage: (stage: string | null) => void; setResult: (result: FinalResult | null) => void; setError: (error: string | null) => void; setConnected: (value: boolean) => void; };
export const useSessionStore = create<SessionState>((set) => ({ sessionId: crypto.randomUUID(), messages: [], stage: null, result: null, error: null, isConnected: false, addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })), setStage: (stage) => set({ stage }), setResult: (result) => set({ result }), setError: (error) => set({ error }), setConnected: (isConnected) => set({ isConnected }) }));
