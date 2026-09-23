import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { WorkerModule } from '../worker/worker.module';
import { DispatchService } from './dispatch.service';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [AuthModule, WorkerModule, NotificationModule],
  controllers: [OrderController],
  providers: [OrderService, DispatchService]
})
export class OrderModule {}
