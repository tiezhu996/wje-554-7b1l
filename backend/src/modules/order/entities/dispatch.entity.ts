export enum DispatchFailureReason {
  NO_SKILLED_WORKER = 'NO_SKILLED_WORKER', // 技能不符：没有可派技师擅长该服务类目
  SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT' // 档期冲突：技能匹配的技师在预约时段均有订单占用
}

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
