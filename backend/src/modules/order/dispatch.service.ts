import { Injectable } from '@nestjs/common';
import { DispatchFailureReason, OrderStatus, ServiceCategory, WorkerStatus } from '../../constants/enums';
import { orders, services, workers } from '../demo-data';
import { WorkerEntity } from '../worker/entities/worker.entity';
import { ConflictOrder, DispatchCandidate, DispatchMatch } from './entities/dispatch-match.entity';
import { OrderEntity } from './entities/order.entity';

/** 占用技师档期的订单状态：已派单但尚未完工/取消 */
const OCCUPYING_STATUSES: OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.ACCEPTED,
  OrderStatus.ON_THE_WAY,
  OrderStatus.IN_PROGRESS
];

const WORKABLE_STATUSES: WorkerStatus[] = [WorkerStatus.ONLINE, WorkerStatus.BUSY];

const toMin = (value: string) => new Date(value).getTime() / 60000;

@Injectable()
export class DispatchService {
  /**
   * 智能匹配技师：
   * 1. 先按服务类目过滤擅长该类目的技师；
   * 2. 再排除与该技师已有订单时段撞车的人选；
   * 3. 多个人选时按评分降序、未完成单数升序排序。
   */
  match(order: OrderEntity): DispatchMatch {
    const service = services.find((item) => item.id === order.serviceItemId);
    const category = (service?.category ?? '') as ServiceCategory;
    const targetStart = toMin(order.scheduledTime);
    const targetEnd = targetStart + (service?.duration ?? 0);

    const skilled = workers.filter((worker) => worker.specialties.includes(category));
    const workable = skilled.filter((worker) => WORKABLE_STATUSES.includes(worker.status));
    const unavailable = skilled.filter((worker) => !WORKABLE_STATUSES.includes(worker.status));

    const toCandidate = (worker: WorkerEntity, isUnavailable = false): DispatchCandidate => {
      const activeOrders = orders.filter(
        (item) => item.id !== order.id && item.workerId === worker.id && OCCUPYING_STATUSES.includes(item.status)
      );
      const conflicts: ConflictOrder[] = activeOrders
        .map((item) => {
          const duration = services.find((svc) => svc.id === item.serviceItemId)?.duration ?? 0;
          const start = new Date(item.scheduledTime);
          return {
            id: item.id,
            orderNo: item.orderNo,
            scheduledTime: item.scheduledTime,
            endTime: new Date(start.getTime() + duration * 60000).toISOString(),
            status: item.status
          };
        })
        .filter((conflict) => {
          const otherStart = toMin(conflict.scheduledTime);
          const otherEnd = toMin(conflict.endTime);
          return otherStart < targetEnd && targetStart < otherEnd;
        });
      return {
        ...worker,
        activeOrderCount: activeOrders.length,
        conflicts,
        available: !isUnavailable && conflicts.length === 0,
        ...(isUnavailable ? { unavailable: worker.status } : {})
      };
    };

    const candidates = workable
      .map((worker) => toCandidate(worker))
      .sort(
        (a, b) =>
          Number(b.available) - Number(a.available) ||
          b.rating - a.rating ||
          a.activeOrderCount - b.activeOrderCount ||
          a.name.localeCompare(b.name)
      );

    const unavailableCandidates = unavailable.map((worker) => toCandidate(worker, true));

    const matched = candidates.some((candidate) => candidate.available);
    const failureReason = !workable.length
      ? DispatchFailureReason.SKILL_MISMATCH
      : !matched
        ? DispatchFailureReason.SCHEDULE_CONFLICT
        : undefined;
    const recommended = candidates.find((candidate) => candidate.available);

    return {
      matched,
      category,
      recommendedWorkerId: recommended?.id,
      candidates,
      unavailableCandidates,
      failureReason,
      skilledWorkerCount: skilled.length,
      matchedAt: new Date().toISOString()
    };
  }

  /** 校验指定技师当前能否接该订单（运营改派或确认时使用） */
  validateWorker(order: OrderEntity, workerId: string): DispatchMatch {
    const match = this.match(order);
    const candidate = match.candidates.find((item) => item.id === workerId);
    if (candidate?.available) return { ...match, recommendedWorkerId: workerId };

    const worker = workers.find((item) => item.id === workerId);
    const reason =
      !worker || !worker.specialties.includes(match.category as ServiceCategory) || !WORKABLE_STATUSES.includes(worker.status)
        ? DispatchFailureReason.SKILL_MISMATCH
        : DispatchFailureReason.SCHEDULE_CONFLICT;
    return { ...match, recommendedWorkerId: undefined, failureReason: reason };
  }
}
