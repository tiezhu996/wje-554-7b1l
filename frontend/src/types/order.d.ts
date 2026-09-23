import { OrderStatus } from '../constants/enums';
import { ServiceItem } from './service';
import { User } from './auth';
import { Worker } from './worker';

export type DispatchFailureReason = 'NO_SKILLED_WORKER' | 'SCHEDULE_CONFLICT';

export interface DispatchResult {
  matched: boolean;
  workerId?: string;
  workerName?: string;
  rating?: number;
  unfinishedOrders?: number;
  candidateCount: number;
  failureReason?: DispatchFailureReason;
  message: string;
  matchedAt: string;
}

export interface ServiceOrder {
  id: string;
  orderNo: string;
  serviceItemId: string;
  customerId: string;
  workerId?: string;
  address: string;
  addressDetail: string;
  contactPhone: string;
  scheduledTime: string;
  status: OrderStatus;
  totalPrice: number;
  actualDuration?: number;
  rating?: number;
  comment?: string;
  cancelReason?: string;
  dispatch?: DispatchResult;
  createdAt: string;
  updatedAt: string;
  serviceItem: ServiceItem;
  customer: User;
  worker?: Worker;
}
