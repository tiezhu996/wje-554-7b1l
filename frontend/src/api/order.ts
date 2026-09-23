import { OrderStatus } from '../constants/enums';
import { DispatchMatch, ServiceOrder } from '../types/order';
import { request } from './request';

export const orderApi = {
  list: (params?: { status?: OrderStatus }) => request.get<unknown, ServiceOrder[]>('/orders', { params }),
  detail: (id: string) => request.get<unknown, ServiceOrder>(`/orders/${id}`),
  create: (payload: Partial<ServiceOrder>) => request.post<unknown, ServiceOrder>('/orders', payload),
  dispatchMatch: (id: string, workerId?: string) =>
    request.post<unknown, DispatchMatch>(`/orders/${id}/dispatch-match`, workerId ? { workerId } : {}),
  confirmAssign: (id: string, workerId: string) =>
    request.post<unknown, ServiceOrder>(`/orders/${id}/confirm-assign`, { workerId }),
  updateStatus: (id: string, payload: { status: OrderStatus; workerId?: string }) =>
    request.patch<unknown, ServiceOrder>(`/orders/${id}/status`, payload),
  rate: (id: string, payload: { rating: number; comment: string }) => request.post<unknown, ServiceOrder>(`/orders/${id}/rate`, payload),
  cancel: (id: string, cancelReason: string) => request.post<unknown, ServiceOrder>(`/orders/${id}/cancel`, { cancelReason })
};
