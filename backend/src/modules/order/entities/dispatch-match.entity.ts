import { DispatchFailureReason, WorkerStatus } from '../../../constants/enums';
import { WorkerEntity } from '../../worker/entities/worker.entity';

export interface ConflictOrder {
  id: string;
  orderNo: string;
  scheduledTime: string;
  endTime: string;
  status: string;
}

export interface DispatchCandidate extends WorkerEntity {
  activeOrderCount: number;
  conflicts: ConflictOrder[];
  /** 档期是否空闲（无时间撞车） */
  available: boolean;
  /** 不可派原因：技师离线/审核中时给出状态 */
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
