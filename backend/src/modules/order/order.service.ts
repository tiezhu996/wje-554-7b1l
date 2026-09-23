import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DispatchFailureReason, OrderStatus, UserRole } from '../../constants/enums';
import { orders, services, users, workers } from '../demo-data';
import { NotificationService } from '../notification/notification.service';
import { WorkerService } from '../worker/worker.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { DispatchService } from './dispatch.service';
import { DispatchMatch } from './entities/dispatch-match.entity';
import { OrderEntity } from './entities/order.entity';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED],
  [OrderStatus.ON_THE_WAY]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [OrderStatus.RATED],
  [OrderStatus.RATED]: [],
  [OrderStatus.CANCELLED]: []
};

@Injectable()
export class OrderService {
  constructor(
    private readonly workerService: WorkerService,
    private readonly notification: NotificationService,
    private readonly dispatch: DispatchService
  ) {}

  list(user: { sub: string; role: UserRole }, status?: OrderStatus) {
    return orders.filter((order) => {
      if (status && order.status !== status) return false;
      if (user.role === UserRole.ADMIN) return true;
      if (user.role === UserRole.CUSTOMER) return order.customerId === user.sub;
      const worker = this.workerService.findByUserId(user.sub);
      return worker ? order.workerId === worker.id : false;
    }).map((order) => this.hydrate(order));
  }

  detail(user: { sub: string; role: UserRole }, id: string) {
    const order = this.mustFind(id);
    if (!this.canAccess(user, order)) throw new ForbiddenException('无权查看该订单');
    return this.hydrate(order);
  }

  create(user: { sub: string; role: UserRole }, dto: CreateOrderDto) {
    if (user.role !== UserRole.CUSTOMER) throw new ForbiddenException('仅 Customer 可下单');
    const service = services.find((item) => item.id === dto.serviceItemId);
    if (!service) throw new NotFoundException('服务项目不存在');
    const order: OrderEntity = {
      id: crypto.randomUUID(),
      orderNo: `HS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(orders.length + 1).padStart(4, '0')}`,
      serviceItemId: dto.serviceItemId,
      customerId: user.sub,
      address: dto.address,
      addressDetail: dto.addressDetail,
      contactPhone: dto.contactPhone,
      scheduledTime: dto.scheduledTime,
      status: OrderStatus.PENDING,
      totalPrice: dto.totalPrice || service.basePrice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    orders.unshift(order);
    service.orderCount += 1;
    this.notification.notify({ type: 'order:status_changed', title: '新订单待派单', message: order.orderNo, orderId: order.id });
    return this.hydrate(order);
  }

  /**
   * 智能派单匹配（第一步）：按服务类目 + 技师档期给出候选人，订单仍保持待派单。
   * 无合适技师时保留待派单，并记录失败原因（技能不符 / 档期冲突）。
   */
  match(user: { sub: string; role: UserRole }, id: string, workerId?: string): DispatchMatch {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('仅 Admin 可执行派单匹配');
    const order = this.mustFind(id);
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('仅待派单订单可执行匹配');

    const result = workerId ? this.dispatch.validateWorker(order, workerId) : this.dispatch.match(order);
    order.proposedWorkerId = result.matched ? result.recommendedWorkerId : undefined;
    order.dispatchFailureReason = result.failureReason;
    order.dispatchMatchedAt = result.matchedAt;
    order.updatedAt = new Date().toISOString();
    return result;
  }

  /** 运营确认派单（第二步）：确认后订单才真正交给该技师 */
  confirmAssign(user: { sub: string; role: UserRole }, id: string, workerId: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('仅 Admin 可确认派单');
    const order = this.mustFind(id);
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('仅待派单订单可确认派单');

    const result = this.dispatch.validateWorker(order, workerId);
    if (!result.matched || result.recommendedWorkerId !== workerId) {
      order.proposedWorkerId = undefined;
      order.dispatchFailureReason = result.failureReason;
      order.dispatchMatchedAt = result.matchedAt;
      const message = result.failureReason === DispatchFailureReason.SKILL_MISMATCH ? '该技师技能不符或当前不可派' : '该技师预约时段已撞车';
      throw new BadRequestException(message);
    }

    order.workerId = workerId;
    order.proposedWorkerId = undefined;
    order.dispatchFailureReason = undefined;
    order.status = OrderStatus.ASSIGNED;
    order.confirmedAt = new Date().toISOString();
    order.updatedAt = order.confirmedAt;
    this.notification.notify({
      type: 'order:new_assignment',
      title: '订单状态更新',
      message: `${order.orderNo} 已派单`,
      orderId: order.id,
      userIds: [order.customerId, workerId].filter(Boolean)
    });
    return this.hydrate(order);
  }

  updateStatus(user: { sub: string; role: UserRole }, id: string, status: OrderStatus, workerId?: string) {
    const order = this.mustFind(id);
    if (!transitions[order.status].includes(status)) throw new BadRequestException(`订单不能从 ${order.status} 流转到 ${status}`);
    if (status === OrderStatus.ASSIGNED) {
      throw new BadRequestException('派单需先执行智能匹配，由运营在订单详情确认后生效');
    } else if ([OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY, OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED].includes(status)) {
      const worker = this.workerService.findByUserId(user.sub);
      if (user.role !== UserRole.WORKER || !worker || worker.id !== order.workerId) throw new ForbiddenException('仅订单技师可更新该状态');
      if (status === OrderStatus.COMPLETED) {
        order.actualDuration = 96;
        worker.totalOrders += 1;
      }
    }
    order.status = status;
    order.updatedAt = new Date().toISOString();
    this.notification.notify({
      type: status === OrderStatus.ON_THE_WAY ? 'order:worker_arriving' : 'order:status_changed',
      title: '订单状态更新',
      message: `${order.orderNo} 已更新为 ${status}`,
      orderId: order.id,
      userIds: [order.customerId, order.workerId || ''].filter(Boolean)
    });
    return this.hydrate(order);
  }

  rate(user: { sub: string; role: UserRole }, id: string, rating: number, comment: string) {
    const order = this.mustFind(id);
    if (user.role !== UserRole.CUSTOMER || order.customerId !== user.sub) throw new ForbiddenException('仅订单客户可评价');
    if (order.status !== OrderStatus.COMPLETED) throw new BadRequestException('仅已完工订单可评价');
    order.rating = rating;
    order.comment = comment;
    order.status = OrderStatus.RATED;
    order.updatedAt = new Date().toISOString();
    return this.hydrate(order);
  }

  cancel(user: { sub: string; role: UserRole }, id: string, reason: string) {
    const order = this.mustFind(id);
    if (![UserRole.ADMIN, UserRole.CUSTOMER].includes(user.role) || (user.role === UserRole.CUSTOMER && order.customerId !== user.sub)) {
      throw new ForbiddenException('无权取消该订单');
    }
    if (order.status === OrderStatus.RATED) throw new BadRequestException('已评价订单不能取消');
    order.status = OrderStatus.CANCELLED;
    order.cancelReason = reason;
    order.updatedAt = new Date().toISOString();
    return this.hydrate(order);
  }

  private mustFind(id: string) {
    const order = orders.find((item) => item.id === id);
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  private canAccess(user: { sub: string; role: UserRole }, order: OrderEntity) {
    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.CUSTOMER) return order.customerId === user.sub;
    const worker = this.workerService.findByUserId(user.sub);
    return worker?.id === order.workerId;
  }

  private hydrate(order: OrderEntity) {
    const dispatchMatch = order.status === OrderStatus.PENDING ? this.dispatch.match(order) : undefined;
    return {
      ...order,
      // 待派单订单始终带上最新匹配结论；尚未执行匹配时以实时计算结果作为初始原因
      dispatchFailureReason: order.dispatchFailureReason ?? dispatchMatch?.failureReason,
      serviceItem: services.find((service) => service.id === order.serviceItemId),
      customer: users.find((customer) => customer.id === order.customerId),
      worker: workers.find((worker) => worker.id === order.workerId),
      dispatchMatch
    };
  }
}
