import { create } from 'zustand';
import { orderApi } from '../api/order';
import { OrderStatus } from '../constants/enums';
import { DispatchMatch, ServiceOrder } from '../types/order';

interface OrderState {
  orders: ServiceOrder[];
  current?: ServiceOrder;
  dispatchMatch?: DispatchMatch;
  matching: boolean;
  loadOrders: (params?: { status?: OrderStatus }) => Promise<void>;
  loadOrder: (id: string) => Promise<void>;
  runMatch: (id: string, workerId?: string) => Promise<DispatchMatch>;
  confirmAssign: (id: string, workerId: string) => Promise<void>;
  updateStatus: (id: string, status: OrderStatus, workerId?: string) => Promise<void>;
  cancel: (id: string, reason: string) => Promise<void>;
  rate: (id: string, rating: number, comment: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  dispatchMatch: undefined,
  matching: false,
  loadOrders: async (params) => set({ orders: await orderApi.list(params) }),
  loadOrder: async (id) => set({ current: await orderApi.detail(id), dispatchMatch: undefined }),
  runMatch: async (id, workerId) => {
    set({ matching: true });
    try {
      const result = await orderApi.dispatchMatch(id, workerId);
      set((state) => ({
        dispatchMatch: result,
        current: state.current
          ? { ...state.current, dispatchMatch: result, proposedWorkerId: result.recommendedWorkerId, dispatchFailureReason: result.failureReason }
          : state.current
      }));
      return result;
    } finally {
      set({ matching: false });
    }
  },
  confirmAssign: async (id, workerId) => {
    const updated = await orderApi.confirmAssign(id, workerId);
    set({ current: updated, dispatchMatch: undefined, orders: get().orders.map((order) => (order.id === id ? updated : order)) });
  },
  updateStatus: async (id, status, workerId) => {
    const updated = await orderApi.updateStatus(id, { status, workerId });
    set({
      current: updated,
      orders: get().orders.map((order) => (order.id === id ? updated : order))
    });
  },
  cancel: async (id, reason) => {
    const updated = await orderApi.cancel(id, reason);
    set({ current: updated, orders: get().orders.map((order) => (order.id === id ? updated : order)) });
  },
  rate: async (id, rating, comment) => {
    const updated = await orderApi.rate(id, { rating, comment });
    set({ current: updated, orders: get().orders.map((order) => (order.id === id ? updated : order)) });
  }
}));
