import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../../constants/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  workerId?: string;
}

/** 智能匹配：可传 workerId 试算指定技师是否合适，不传则按规则推荐 */
export class MatchOrderDto {
  @IsOptional()
  @IsString()
  workerId?: string;
}

export class ConfirmAssignDto {
  @IsString()
  workerId!: string;
}

export class RateOrderDto {
  rating!: number;
  comment!: string;
}

export class CancelOrderDto {
  cancelReason!: string;
}
