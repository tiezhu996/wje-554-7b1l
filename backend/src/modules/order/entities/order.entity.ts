import { OrderStatus } from '../../../constants/enums';
import { UserEntity } from '../../auth/auth.service';
import { ServiceEntity } from '../../service/entities/service.entity';
import { WorkerEntity } from '../../worker/entities/worker.entity';
import { DispatchMatch } from './dispatch-match.entity';

export interface OrderEntity {
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
  /** 运营确认派单前暂定的技师，仅展示匹配结果，未实际占用 */
  proposedWorkerId?: string;
  /** 派单失败原因：技能不符 / 档期冲突 */
  dispatchFailureReason?: string;
  dispatchMatchedAt?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
  serviceItem?: ServiceEntity;
  customer?: UserEntity;
  worker?: WorkerEntity;
  dispatchMatch?: DispatchMatch;
}
