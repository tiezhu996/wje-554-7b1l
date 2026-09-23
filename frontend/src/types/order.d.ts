import { DispatchFailureReason, OrderStatus, WorkerStatus } from '../constants/enums';
import { ServiceItem } from './service';
import { User } from './auth';
import { Worker } from './worker';

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
  proposedWorkerId?: string;
  dispatchFailureReason?: DispatchFailureReason;
  dispatchMatchedAt?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
  serviceItem: ServiceItem;
  customer: User;
  worker?: Worker;
  dispatchMatch?: DispatchMatch;
}

export interface ConflictOrder {
  id: string;
  orderNo: string;
  scheduledTime: string;
  endTime: string;
  status: OrderStatus;
}

export interface DispatchCandidate extends Worker {
  activeOrderCount: number;
  conflicts: ConflictOrder[];
  available: boolean;
  unavailable?: WorkerStatus;
}

export interface DispatchMatch {
  matched: boolean;
  category: string;
  recommendedWorkerId?: string;
  candidates: DispatchCandidate[];
  unavailableCandidates: DispatchCandidate[];
  failureReason?: DispatchFailureReason;
  skilledWorkerCount: number;
  matchedAt: string;
}
