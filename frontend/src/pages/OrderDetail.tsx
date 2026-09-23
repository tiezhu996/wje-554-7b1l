import { Alert, Box, Button, Card, CardContent, Chip, Grid, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DispatchFailureReason, OrderStatus, UserRole, WorkerStatus } from '../constants/enums';
import { categoryConfig } from '../constants/categories';
import { OrderStatusFlow } from '../components/common/OrderStatusFlow';
import { PageHeader } from '../components/common/PageHeader';
import { RatingStars } from '../components/common/RatingStars';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAuthStore } from '../stores/authStore';
import { useOrderStore } from '../stores/orderStore';
import { DispatchCandidate, DispatchMatch } from '../types/order';
import { datetime, money } from '../utils/format';

const failureText: Record<DispatchFailureReason, string> = {
  [DispatchFailureReason.SKILL_MISMATCH]: '技能不符：没有擅长该服务类目且当前可派（在线/忙碌）的技师，订单保留待派单',
  [DispatchFailureReason.SCHEDULE_CONFLICT]: '档期冲突：擅长该类目的技师在预约时段都有未完成订单，订单保留待派单'
};

const statusText: Record<WorkerStatus, string> = {
  [WorkerStatus.ONLINE]: '在线',
  [WorkerStatus.BUSY]: '忙碌',
  [WorkerStatus.OFFLINE]: '离线',
  [WorkerStatus.PENDING_REVIEW]: '审核中'
};

function CandidateRow({
  candidate,
  recommended,
  selected,
  onSelect
}: {
  candidate: DispatchCandidate;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      onClick={candidate.available ? onSelect : undefined}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : candidate.available ? 'background.paper' : 'action.hoverBackground',
        cursor: candidate.available ? 'pointer' : 'not-allowed',
        opacity: candidate.available ? 1 : 0.75
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography fontWeight={700}>{candidate.name}</Typography>
          <RatingStars value={Number(candidate.rating)} readOnly size="small" />
          <Typography variant="body2" color="text.secondary">未完成单 {candidate.activeOrderCount}</Typography>
          <Chip size="small" label={statusText[candidate.status]} color={candidate.status === WorkerStatus.ONLINE ? 'success' : 'default'} variant="outlined" />
          {recommended && <Chip size="small" color="primary" label="系统推荐" />}
        </Stack>
        {candidate.available ? (
          <Chip size="small" color="success" label="档期空闲" />
        ) : (
          <Chip size="small" color="error" label={candidate.unavailable ? `不可派·${statusText[candidate.unavailable]}` : '时段撞车'} />
        )}
      </Stack>
      {candidate.conflicts.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {candidate.conflicts.map((conflict) => (
            <Typography key={conflict.id} variant="body2" color="error">
              冲突订单 {conflict.orderNo}：{datetime(conflict.scheduledTime)} - {datetime(conflict.endTime)}（{conflict.status}）
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

function DispatchPanel() {
  const { current, dispatchMatch, matching, runMatch, confirmAssign } = useOrderStore();
  const [selectedWorker, setSelectedWorker] = useState<string | undefined>(undefined);

  const match = dispatchMatch ?? current?.dispatchMatch;

  useEffect(() => {
    setSelectedWorker(match?.recommendedWorkerId);
  }, [match?.recommendedWorkerId, match?.matchedAt]);

  if (!current) return null;

  const categoryLabel = current.serviceItem ? categoryConfig[current.serviceItem.category]?.label : '';

  const renderResult = (result: DispatchMatch) => (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`服务类目：${categoryLabel}`} />
        <Chip size="small" variant="outlined" label={`技能匹配技师 ${result.skilledWorkerCount} 人`} />
        <Chip size="small" variant="outlined" label={`可派 ${result.candidates.filter((item) => item.available).length} 人`} />
      </Stack>
      {result.matched ? (
        <Alert severity="success">
          已按「评分高、未完成单少」排序，推荐 {result.candidates.find((item) => item.id === result.recommendedWorkerId)?.name}，确认后订单才正式派给该技师。
        </Alert>
      ) : (
        <Alert severity="warning">{result.failureReason ? failureText[result.failureReason] : '暂无合适技师'}</Alert>
      )}
      <Stack spacing={1}>
        {result.candidates.map((candidate, index) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            recommended={candidate.id === result.recommendedWorkerId}
            selected={selectedWorker === candidate.id}
            onSelect={() => setSelectedWorker(candidate.id)}
          />
        ))}
        {result.unavailableCandidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            recommended={false}
            selected={selectedWorker === candidate.id}
            onSelect={() => setSelectedWorker(candidate.id)}
          />
        ))}
        {!result.candidates.length && !result.unavailableCandidates.length && (
          <Typography color="text.secondary" variant="body2">平台暂无擅长该类目的技师，可先去技师管理扩充队伍。</Typography>
        )}
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={!result.matched || !selectedWorker || matching} onClick={() => selectedWorker && confirmAssign(current.id, selectedWorker)}>
          确认派单给{result.candidates.find((item) => item.id === selectedWorker)?.name || '所选技师'}
        </Button>
        <Button onClick={() => runMatch(current.id, selectedWorker)} disabled={matching}>重新匹配</Button>
      </Stack>
    </Stack>
  );

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6">智能派单</Typography>
        <Typography color="text.secondary" variant="body2">
          规则：先匹配服务类目，再避开技师已有订单占用的时段；多人合适时优先评分高、未完成单少者。
        </Typography>
        {match ? (
          renderResult(match)
        ) : (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button variant="contained" disabled={matching} onClick={() => runMatch(current.id)}>开始智能匹配</Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export function OrderDetail() {
  const { id = '' } = useParams();
  const role = useAuthStore((state) => state.user?.role);
  const { current, loadOrder, updateStatus, cancel, rate } = useOrderStore();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('服务准时，沟通顺畅。');

  useEffect(() => { loadOrder(id); }, [id, loadOrder]);

  const actions = useMemo(() => {
    if (!current) return [];
    if (role === UserRole.WORKER) {
      const map: Partial<Record<OrderStatus, [string, OrderStatus]>> = {
        [OrderStatus.ASSIGNED]: ['接单', OrderStatus.ACCEPTED],
        [OrderStatus.ACCEPTED]: ['出发', OrderStatus.ON_THE_WAY],
        [OrderStatus.ON_THE_WAY]: ['开始服务', OrderStatus.IN_PROGRESS],
        [OrderStatus.IN_PROGRESS]: ['完工', OrderStatus.COMPLETED]
      };
      return map[current.status] ? [map[current.status]!] : [];
    }
    return [];
  }, [current, role]);

  if (!current) return null;

  return (
    <>
      <PageHeader title="订单详情" subtitle={current.orderNo} actions={<StatusBadge value={current.status} />} />
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          {role === UserRole.ADMIN && current.status === OrderStatus.PENDING && <DispatchPanel />}
          <Card><CardContent>
            <Typography variant="h5">{current.serviceItem.name}</Typography>
            <Typography color="text.secondary">{current.serviceItem.description}</Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}><Typography>价格：{money(current.totalPrice)}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography>预约：{datetime(current.scheduledTime)}</Typography></Grid>
              <Grid item xs={12}><Typography>地址：{current.address}{current.addressDetail}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography>联系电话：{current.contactPhone}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography>技师：{current.worker?.name || '待派单'}</Typography></Grid>
            </Grid>
            <Box sx={{ my: 4, overflowX: 'auto' }}><OrderStatusFlow status={current.status} /></Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {actions.map(([label, next]) => <Button key={next} variant="contained" onClick={() => updateStatus(current.id, next)}>{label}</Button>)}
              {role !== UserRole.WORKER && ![OrderStatus.CANCELLED, OrderStatus.RATED].includes(current.status) && <Button color="error" variant="outlined" onClick={() => cancel(current.id, '用户取消')}>取消订单</Button>}
            </Stack>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}><CardContent>
            <Typography variant="h6">地图定位</Typography>
            <Box sx={{ height: 220, mt: 2, borderRadius: 2, bgcolor: '#dfe7de', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>{current.address}</Box>
          </CardContent></Card>
          <Card><CardContent>
            <Typography variant="h6">评价</Typography>
            {current.status === OrderStatus.COMPLETED && role === UserRole.CUSTOMER ? (
              <Stack spacing={2} sx={{ mt: 2 }}>
                <RatingStars value={rating} onChange={setRating} />
                <TextField multiline minRows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                <Button variant="contained" onClick={() => rate(current.id, rating, comment)}>提交评价</Button>
              </Stack>
            ) : current.rating ? (
              <Stack spacing={1} sx={{ mt: 2 }}><RatingStars value={current.rating} readOnly /><Typography>{current.comment}</Typography></Stack>
            ) : <Typography color="text.secondary" sx={{ mt: 2 }}>完工后客户可评价。</Typography>}
          </CardContent></Card>
        </Grid>
      </Grid>
    </>
  );
}
