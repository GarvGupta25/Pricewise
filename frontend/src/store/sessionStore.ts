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
export type OrderRecord = SavedProduct & {
  orderId: string;
  status: "checkout_started" | "ordered" | "delivered";
  createdAt: string;
  deliveryDate?: string;
  installationAt?: string;
};
export type SupportCase = {
  id: string;
  orderId: string;
  kind: "return" | "exchange" | "warranty" | "delivery";
  summary: string;
  createdAt: string;
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
  orders: OrderRecord[];
  supportCases: SupportCase[];
  addMessage: (message: ChatMessage) => void;
  setStage: (stage: string | null) => void;
  setResult: (result: FinalResult | null) => void;
  setError: (error: string | null) => void;
  setConnected: (value: boolean) => void;
  setUser: (name: string | null) => void;
  setPreferences: (preferences: ShopperPreferences) => void;
  setCart: (products: SavedProduct[]) => void;
  setNotifications: (notifications: PriceNotification[]) => void;
  setOrders: (orders: OrderRecord[]) => void;
  setSupportCases: (supportCases: SupportCase[]) => void;
  addToCart: (product: SavedProduct) => void;
  removeFromCart: (id: string) => void;
  applyPriceRefresh: (products: SavedProduct[]) => void;
  markNotificationsRead: () => void;
  startCheckout: (product: SavedProduct) => void;
  updateOrder: (orderId: string, update: Partial<Pick<OrderRecord, "status" | "deliveryDate" | "installationAt">>) => void;
  createSupportCase: (supportCase: Omit<SupportCase, "id" | "createdAt">) => void;
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
  orders: [],
  supportCases: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setStage: (stage) => set({ stage }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
  setConnected: (isConnected) => set({ isConnected }),
  setUser: (demoUser) => set({ demoUser }),
  setPreferences: (preferences) => set({ preferences }),
  setCart: (cart) => set({ cart }),
  setNotifications: (notifications) => set({ notifications }),
  setOrders: (orders) => set({ orders }),
  setSupportCases: (supportCases) => set({ supportCases }),
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
  startCheckout: (product) => set((state) => ({ orders: [{ ...product, orderId: crypto.randomUUID(), status: "checkout_started", createdAt: new Date().toISOString() }, ...state.orders] })),
  updateOrder: (orderId, update) => set((state) => ({ orders: state.orders.map((order) => order.orderId === orderId ? { ...order, ...update } : order) })),
  createSupportCase: (supportCase) => set((state) => ({ supportCases: [{ ...supportCase, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...state.supportCases] })),
}), {
  name: "pricewise-preferences",
  partialize: (state) => ({ demoUser: state.demoUser, preferences: state.preferences, cart: state.cart, notifications: state.notifications, orders: state.orders, supportCases: state.supportCases, result: state.result }),
}));
