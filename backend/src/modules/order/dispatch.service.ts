import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, ServiceCategory, WorkerStatus } from '../../constants/enums';
import { orders, services, workers } from '../demo-data';
import { DispatchFailureReason, DispatchResult } from './entities/dispatch.entity';
import { OrderEntity } from './entities/order.entity';

// 占用技师档期的订单状态
const OCCUPYING_STATUSES: OrderStatus[] = [OrderStatus.ASSIGNED, OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY, OrderStatus.IN_PROGRESS];
// 可被派单的技师状态（离线、审核中不参与派单）
const DISPATCHABLE_STATUSES: WorkerStatus[] = [WorkerStatus.ONLINE, WorkerStatus.BUSY];

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  [ServiceCategory.CLEANING]: '清洁',
  [ServiceCategory.REPAIR]: '维修',
  [ServiceCategory.PLUMBING]: '管道',
  [ServiceCategory.MOVING]: '搬家',
  [ServiceCategory.ERRAND]: '跑腿'
};

@Injectable()
export class DispatchService {
  // 智能匹配：先看服务类目，再排除档期冲突，最后按评分高、未完成单少排序取最优
  match(order: OrderEntity): DispatchResult {
    const service = services.find((item) => item.id === order.serviceItemId);
    if (!service) throw new NotFoundException('订单关联的服务项目不存在');
    const skilled = workers.filter((worker) => DISPATCHABLE_STATUSES.includes(worker.status) && worker.specialties.includes(service.category));
    if (!skilled.length) {
      return {
        matched: false,
        candidateCount: 0,
        failureReason: DispatchFailureReason.NO_SKILLED_WORKER,
        message: `技能不符：当前没有可派技师擅长「${CATEGORY_LABELS[service.category]}」类目，订单保留待派单`,
        matchedAt: new Date().toISOString()
      };
    }
    const available = skilled.filter((worker) => !this.hasConflict(worker.id, order));
    if (!available.length) {
      return {
        matched: false,
        candidateCount: 0,
        failureReason: DispatchFailureReason.SCHEDULE_CONFLICT,
        message: `档期冲突：${skilled.length} 名技能匹配的技师在预约时段均有订单占用，订单保留待派单`,
        matchedAt: new Date().toISOString()
      };
    }
    const ranked = available
      .map((worker) => ({ worker, unfinished: this.unfinishedCount(worker.id) }))
      .sort((a, b) => b.worker.rating - a.worker.rating || a.unfinished - b.unfinished);
    const best = ranked[0];
    return {
      matched: true,
      workerId: best.worker.id,
      workerName: best.worker.name,
      rating: best.worker.rating,
      unfinishedOrders: best.unfinished,
      candidateCount: ranked.length,
      message: `已匹配技师 ${best.worker.name}（评分 ${best.worker.rating}，未完成单 ${best.unfinished}，候选 ${ranked.length} 人），待运营确认`,
      matchedAt: new Date().toISOString()
    };
  }

  // 确认派单前复核技师仍满足技能与档期要求，返回失败原因（null 表示通过）
  validate(order: OrderEntity, workerId: string): DispatchFailureReason | null {
    const service = services.find((item) => item.id === order.serviceItemId);
    const worker = workers.find((item) => item.id === workerId);
    if (!service || !worker || !DISPATCHABLE_STATUSES.includes(worker.status) || !worker.specialties.includes(service.category)) {
      return DispatchFailureReason.NO_SKILLED_WORKER;
    }
    return this.hasConflict(workerId, order) ? DispatchFailureReason.SCHEDULE_CONFLICT : null;
  }

  private hasConflict(workerId: string, order: OrderEntity) {
    const [start, end] = this.window(order);
    return orders.some((other) => {
      if (other.id === order.id || other.workerId !== workerId || !OCCUPYING_STATUSES.includes(other.status)) return false;
      const [otherStart, otherEnd] = this.window(other);
      return otherStart < end && start < otherEnd;
    });
  }

  private unfinishedCount(workerId: string) {
    return orders.filter((item) => item.workerId === workerId && OCCUPYING_STATUSES.includes(item.status)).length;
  }

  // 订单占用时段：[预约时间, 预约时间 + 服务预估时长]
  private window(order: OrderEntity): [number, number] {
    const service = services.find((item) => item.id === order.serviceItemId);
    const start = new Date(order.scheduledTime).getTime();
    return [start, start + (service?.duration ?? 60) * 60_000];
  }
}
