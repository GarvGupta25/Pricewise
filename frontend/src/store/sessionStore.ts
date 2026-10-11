import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, FinalResult } from "../types";

export type SavedProduct = { id: string; title: string; source_site: string; current_price: number };

type SessionState = {
  sessionId: string;
  messages: ChatMessage[];
  stage: string | null;
  result: FinalResult | null;
  error: string | null;
  isConnected: boolean;
  demoUser: string | null;
  cart: SavedProduct[];
  addMessage: (message: ChatMessage) => void;
  setStage: (stage: string | null) => void;
  setResult: (result: FinalResult | null) => void;
  setError: (error: string | null) => void;
  setConnected: (value: boolean) => void;
  setUser: (name: string | null) => void;
  setCart: (products: SavedProduct[]) => void;
  addToCart: (product: SavedProduct) => void;
  removeFromCart: (id: string) => void;
};

export const useSessionStore = create<SessionState>()(persist((set) => ({
  sessionId: crypto.randomUUID(),
  messages: [],
  stage: null,
  result: null,
  error: null,
  isConnected: false,
  demoUser: null,
  cart: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setStage: (stage) => set({ stage }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
  setConnected: (isConnected) => set({ isConnected }),
  setUser: (demoUser) => set({ demoUser }),
  setCart: (cart) => set({ cart }),
  addToCart: (product) => set((state) => state.cart.some((item) => item.id === product.id) ? state : { cart: [...state.cart, product] }),
  removeFromCart: (id) => set((state) => ({ cart: state.cart.filter((item) => item.id !== id) })),
}), {
  name: "pricewise-preferences",
  partialize: (state) => ({ demoUser: state.demoUser, cart: state.cart, result: state.result }),
}));
