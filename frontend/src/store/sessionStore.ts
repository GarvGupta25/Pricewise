import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, FinalResult } from "../types";

export type SavedProduct = { id: string; title: string; source_site: string; current_price: number };
export type ShopperPreferences = {
  shoppingStyle: "best_value" | "balanced" | "premium";
  budgetFlexibility: "strict" | "flexible";
};
export type PriceNotification = {
  id: string;
  productId: string;
  title: string;
  previousPrice: number;
  currentPrice: number;
  createdAt: string;
  read: boolean;
};

type SessionState = {
  sessionId: string;
  messages: ChatMessage[];
  stage: string | null;
  result: FinalResult | null;
  error: string | null;
  isConnected: boolean;
  demoUser: string | null;
  preferences: ShopperPreferences;
  cart: SavedProduct[];
  notifications: PriceNotification[];
  addMessage: (message: ChatMessage) => void;
  setStage: (stage: string | null) => void;
  setResult: (result: FinalResult | null) => void;
  setError: (error: string | null) => void;
  setConnected: (value: boolean) => void;
  setUser: (name: string | null) => void;
  setPreferences: (preferences: ShopperPreferences) => void;
  setCart: (products: SavedProduct[]) => void;
  addToCart: (product: SavedProduct) => void;
  removeFromCart: (id: string) => void;
  applyPriceRefresh: (products: SavedProduct[]) => void;
  markNotificationsRead: () => void;
};

export const useSessionStore = create<SessionState>()(persist((set) => ({
  sessionId: crypto.randomUUID(),
  messages: [],
  stage: null,
  result: null,
  error: null,
  isConnected: false,
  demoUser: null,
  preferences: { shoppingStyle: "balanced", budgetFlexibility: "strict" },
  cart: [],
  notifications: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setStage: (stage) => set({ stage }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
  setConnected: (isConnected) => set({ isConnected }),
  setUser: (demoUser) => set({ demoUser }),
  setPreferences: (preferences) => set({ preferences }),
  setCart: (cart) => set({ cart }),
  addToCart: (product) => set((state) => state.cart.some((item) => item.id === product.id) ? state : { cart: [...state.cart, product] }),
  removeFromCart: (id) => set((state) => ({ cart: state.cart.filter((item) => item.id !== id) })),
  applyPriceRefresh: (products) => set((state) => {
    const latest = new Map(products.map((product) => [product.id, product]));
    const drops = state.cart.flatMap((saved) => {
      const current = latest.get(saved.id);
      if (!current || current.current_price >= saved.current_price) return [];
      return [{
        id: `${saved.id}:${current.current_price}`,
        productId: saved.id,
        title: saved.title,
        previousPrice: saved.current_price,
        currentPrice: current.current_price,
        createdAt: new Date().toISOString(),
        read: false,
      }];
    }).filter((drop) => !state.notifications.some((item) => item.id === drop.id));
    return {
      cart: state.cart.map((saved) => latest.has(saved.id) ? { ...saved, current_price: latest.get(saved.id)!.current_price } : saved),
      notifications: [...drops, ...state.notifications].slice(0, 50),
    };
  }),
  markNotificationsRead: () => set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })) })),
}), {
  name: "pricewise-preferences",
  partialize: (state) => ({ demoUser: state.demoUser, preferences: state.preferences, cart: state.cart, notifications: state.notifications, result: state.result }),
}));
