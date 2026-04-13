import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid2,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import {
  createRequestId,
  getCompetitionById,
  listParticipants,
  registerParticipant,
  unregisterParticipant,
} from '../../../api';
import { getUserFriendlyErrorText } from '../../../utils/errorText';

function toOptionalTimeMs(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const d = dayjs(raw);
  return d.isValid() ? d.valueOf() : NaN;
}

function formatTimeValue(raw, pendingText = '待定') {
  if (raw === null || raw === undefined || raw === '') return pendingText;
  const d = dayjs(raw);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : '-';
}

function statusOf(item) {
  const now = Date.now();
  const regStart = toOptionalTimeMs(item?.registration_start);
  const regEnd = toOptionalTimeMs(item?.registration_end);
  const subStart = toOptionalTimeMs(item?.submission_start);
  const subEnd = toOptionalTimeMs(item?.submission_end);
  const reviewStart = toOptionalTimeMs(item?.review_start);
  const reviewEnd = toOptionalTimeMs(item?.review_end);

  if (regStart === null || Number.isNaN(regStart) || [regEnd, subStart, subEnd, reviewStart, reviewEnd].some(Number.isNaN)) {
    return { key: 'draft', label: '待配置', color: 'default' };
  }
  if (now < regStart) return { key: 'preview', label: '预告', color: 'info' };
  if (regEnd === null || now < regEnd) return { key: 'registration', label: '报名阶段', color: 'warning' };
  if (subStart === null || now < subStart) return { key: 'pending_start', label: '待开始阶段', color: 'info' };
  if (subEnd === null || now < subEnd) return { key: 'ongoing', label: '进行中', color: 'success' };
  if (reviewStart === null || now < reviewStart) return { key: 'pending_review', label: '待评审阶段', color: 'warning' };
  if (reviewEnd === null || now <= reviewEnd) return { key: 'review', label: '作品评审阶段', color: 'secondary' };
  return { key: 'ended', label: '结束', color: 'default' };
}

function normalizeAllowedFormats(value, fallbackFormats = ['pdf']) {
  const normalizeTokens = (rawValue) => String(rawValue || '')
    .split(',')
    .map((item) => String(item || '').trim().toLowerCase().replace(/^\./, ''))
    .map((item) => {
      if (item === 'doc' || item === 'docx' || item === 'word') return 'docx';
      if (item === 'xls' || item === 'xlsx' || item === 'excel') return 'xlsx';
      return item;
    })
    .filter((item) => item === 'pdf' || item === 'docx' || item === 'xlsx');
  const normalized = [...new Set(normalizeTokens(value))];
  if (normalized.length) return normalized;
  return [...new Set(normalizeTokens(fallbackFormats))];
}

function normalizeAttachmentMode(value) {
  return String(value || '').trim().toLowerCase() === 'multiple' ? 'multiple' : 'single';
}

function normalizeSubmissionRuleMode(value) {
  return String(value || '').trim().toLowerCase() === 'required_optional' ? 'required_optional' : 'legacy';
}

function canonicalFormatToken(value) {
  const token = String(value || '').trim().toLowerCase().replace(/^\./, '');
  if (!token) return '';
  if (token === 'doc' || token === 'docx' || token === 'word') return 'docx';
  if (token === 'xls' || token === 'xlsx' || token === 'excel') return 'xlsx';
  return token;
}

function mergeFormatLists(requiredFormats = [], optionalFormats = [], fallbackFormats = []) {
  const merged = [];
  [requiredFormats, optionalFormats, fallbackFormats].forEach((source) => {
    (source || []).forEach((fmt) => {
      const token = canonicalFormatToken(fmt);
      if (!token || merged.includes(token)) return;
      merged.push(token);
    });
  });
  return merged;
}

function resolveCompetitionFormatConfig(source = {}) {
  const submissionRuleMode = normalizeSubmissionRuleMode(source?.submission_rule_mode);
  const legacyAllowedFormats = normalizeAllowedFormats(source?.allowed_formats);
  if (submissionRuleMode !== 'required_optional') {
    const attachmentMode = normalizeAttachmentMode(source?.attachment_mode);
    const requiredFormats = attachmentMode === 'multiple' ? legacyAllowedFormats : [];
    const optionalFormats = attachmentMode === 'multiple' ? [] : legacyAllowedFormats;
    return {
      submission_rule_mode: 'legacy',
      required_formats: requiredFormats,
      optional_formats: optionalFormats,
      allowed_formats: legacyAllowedFormats,
      attachment_mode: attachmentMode,
    };
  }

  let requiredFormats = normalizeAllowedFormats(source?.required_formats, []);
  if (!requiredFormats.length) requiredFormats = legacyAllowedFormats;
  const optionalFormats = normalizeAllowedFormats(source?.optional_formats, [])
    .filter((fmt) => !requiredFormats.includes(fmt));
  return {
    submission_rule_mode: 'required_optional',
    required_formats: requiredFormats,
    optional_formats: optionalFormats,
    allowed_formats: mergeFormatLists(requiredFormats, optionalFormats, legacyAllowedFormats),
    attachment_mode: 'single',
  };
}

function normalizeParticipantLimitMode(value) {
  return String(value || '').trim().toLowerCase() === 'in_school' ? 'in_school' : 'unlimited';
}

function competitionLimitText(item) {
  const parts = [];
  if (normalizeParticipantLimitMode(item?.participant_limit_mode) === 'in_school') {
    parts.push('仅在校生');
  }
  if (item?.registration_code_required === true || Number(item?.registration_code_required) === 1) {
    parts.push('邀请码');
  } else if (String(item?.registration_code || '').trim()) {
    parts.push('邀请码');
  }
  return parts.length ? parts.join(' + ') : '无限制';
}

function competitionAttachmentText(item) {
  const config = resolveCompetitionFormatConfig(item);
  const mode = normalizeSubmissionRuleMode(config.submission_rule_mode);
  if (mode === 'required_optional') {
    const requiredText = config.required_formats.length
      ? config.required_formats.map((fmt) => fmt.toUpperCase()).join('、')
      : '无';
    const optionalText = config.optional_formats.length
      ? config.optional_formats.map((fmt) => fmt.toUpperCase()).join('、')
      : '无';
    return `必交：${requiredText} ｜ 选交：${optionalText}`;
  }
  const formats = config.allowed_formats.map((fmt) => fmt.toUpperCase()).join('、');
  const legacyMode = normalizeAttachmentMode(config.attachment_mode) === 'multiple' ? '多附件' : '单附件';
  return `${formats} ｜ ${legacyMode}`;
}

function canQuitCompetition(item) {
  if (item?.submission_start === null || item?.submission_start === undefined || item?.submission_start === '') {
    return true;
  }
  const subStart = dayjs(item.submission_start);
  if (!subStart.isValid()) return false;
  return Date.now() < subStart.valueOf();
}

function normalizeCompetitionIds(ids = []) {
  return [...new Set((ids || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];
}

function DetailItem({ label, value }) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {value || '-'}
      </Typography>
    </Box>
  );
}

export default function CompetitionEntryPage({
  competitionId,
  entryMode = 'detail',
  onNavigate,
  setMessage,
  homePath = '/',
  myContestsPath = '/my-contests',
}) {
  const normalizedCompetitionId = Number(competitionId);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [registeredCompetitionIds, setRegisteredCompetitionIds] = useState([]);
  const [joinRegistrationCode, setJoinRegistrationCode] = useState('');

  const showError = (error, fallback) => {
    if (typeof setMessage === 'function') {
      setMessage({ type: 'error', text: getUserFriendlyErrorText(error, fallback) });
    }
  };

  const loadDetail = async () => {
    if (Number.isNaN(normalizedCompetitionId) || normalizedCompetitionId <= 0) {
      setDetail(null);
      return;
    }
    const requestId = createRequestId();
    const { data } = await getCompetitionById(normalizedCompetitionId, { requestId });
    setDetail(data || null);
  };

  const loadRegisteredStatus = async () => {
    try {
      const rows = await listParticipants({ requestId: createRequestId() });
      const ids = (rows || [])
        .map((item) => Number(item?.competition_id))
        .filter((id) => !Number.isNaN(id));
      setRegisteredCompetitionIds(normalizeCompetitionIds(ids));
    } catch (error) {
      // 保留已有状态，避免状态查询失败把“已报名”误回退为“未报名”
      showError(error, '加载报名状态失败');
    }
  };

  const reloadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadDetail(), loadRegisteredStatus()]);
    } catch (error) {
      showError(error, '加载比赛信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedCompetitionId]);

  const status = useMemo(() => statusOf(detail || {}), [detail]);
  const isRegistered = useMemo(
    () => registeredCompetitionIds.includes(normalizedCompetitionId),
    [registeredCompetitionIds, normalizedCompetitionId]
  );
  const currentParticipants = Number(detail?.current_participants || 0) || 0;
  const maxParticipants = Number(detail?.max_participants || 0) || 0;
  const isRegistrationFull = (detail?.registration_is_full === true || Number(detail?.registration_is_full) === 1)
    || (maxParticipants > 0 && currentParticipants >= maxParticipants);
  const canRegister = status.key === 'registration' && !isRegistered && !isRegistrationFull;
  const canQuit = isRegistered && canQuitCompetition(detail || {});
  const requiresRegistrationCode = detail?.registration_code_required === true
    || Number(detail?.registration_code_required) === 1
    || Boolean(String(detail?.registration_code || '').trim());

  const navigateTo = (targetPath) => {
    if (typeof onNavigate === 'function') onNavigate(targetPath);
  };

  const handleRegister = async () => {
    if (!canRegister || actionLoading) return;
    const normalizedCode = String(joinRegistrationCode || '').trim();
    if (requiresRegistrationCode && !normalizedCode) {
      if (typeof setMessage === 'function') {
        setMessage({ type: 'warning', text: '请先填写报名码' });
      }
      return;
    }
    setActionLoading(true);
    try {
      await registerParticipant(
        {
          competition_id: normalizedCompetitionId,
          ...(requiresRegistrationCode ? { registration_code: normalizedCode } : {}),
        },
        { requestId: createRequestId() },
      );
      setRegisteredCompetitionIds((prev) => normalizeCompetitionIds([...(prev || []), normalizedCompetitionId]));
      if (typeof setMessage === 'function') {
        setMessage({ type: 'success', text: '报名成功' });
      }
      setJoinRegistrationCode('');
      await reloadAll();
    } catch (error) {
      showError(error, '报名失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuit = async () => {
    if (!canQuit || actionLoading) return;
    setActionLoading(true);
    try {
      await unregisterParticipant(normalizedCompetitionId, { requestId: createRequestId() });
      if (typeof setMessage === 'function') {
        setMessage({ type: 'success', text: '已退出比赛' });
      }
      await reloadAll();
    } catch (error) {
      showError(error, '退出比赛失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Stack spacing={1} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">比赛信息加载中...</Typography>
        </Stack>
      </Box>
    );
  }

  if (!detail) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2 }}>
        <Card sx={{ width: '100%', maxWidth: 760, borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Alert severity="warning">未找到比赛信息，可能已被删除或无访问权限</Alert>
              <Button variant="contained" onClick={() => navigateTo(homePath)}>返回首页</Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', px: 2, py: 3, background: 'linear-gradient(145deg, #f6f0ff 0%, #eee5ff 45%, #f8f5ff 100%)' }}>
      <Card sx={{ width: '100%', maxWidth: 980, mx: 'auto', borderRadius: 4, border: '1px solid #ddcff2' }}>
        <CardContent sx={{ px: { xs: 2, sm: 3.5 }, py: { xs: 2.5, sm: 3.5 } }}>
          <Stack spacing={2.4}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800 }}>
                {detail.name || `比赛 #${normalizedCompetitionId}`}
              </Typography>
              <Chip size="small" color={status.color} label={status.label} />
            </Stack>

            {entryMode === 'register' && (
              <Alert severity="info">
                当前是比赛报名入口页面，登录后可直接完成报名。
              </Alert>
            )}

            {status.key !== 'registration' && entryMode === 'register' && (
              <Alert severity="warning">
                当前不在报名阶段，暂不可报名。
              </Alert>
            )}

            <Typography color="text.secondary">
              {detail.description || '无'}
            </Typography>

            <Divider />

            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, md: 7 }}>
                <DetailItem label="报名时间" value={`${formatTimeValue(detail.registration_start, '-')} ~ ${formatTimeValue(detail.registration_end, '待定')}`} />
                <DetailItem label="比赛时间" value={`${formatTimeValue(detail.submission_start, '待定')} ~ ${formatTimeValue(detail.submission_end, '待定')}`} />
                <DetailItem label="评审时间" value={`${formatTimeValue(detail.review_start, '待定')} ~ ${formatTimeValue(detail.review_end, '待定')}`} />
                <DetailItem label="比赛限制" value={competitionLimitText(detail)} />
                <DetailItem label="作品提交格式" value={competitionAttachmentText(detail)} />
              </Grid2>
              <Grid2 size={{ xs: 12, md: 5 }}>
                <DetailItem label="最大参赛人数" value={String(detail.max_participants || '-')} />
                <DetailItem label="当前报名人数" value={maxParticipants > 0 ? `${currentParticipants}/${maxParticipants}` : String(currentParticipants)} />
                <DetailItem label="字数要求" value={`${detail.min_word_count || 0} ~ ${detail.max_word_count || 0}`} />
                <DetailItem label="报名状态" value={isRegistered ? '已报名' : (isRegistrationFull ? '报名人数已满' : '未报名')} />
              </Grid2>
            </Grid2>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {!isRegistered && canRegister && requiresRegistrationCode && (
                <TextField
                  size="small"
                  label="报名码"
                  value={joinRegistrationCode}
                  onChange={(event) => setJoinRegistrationCode(event.target.value)}
                  sx={{ minWidth: 220 }}
                />
              )}
              <Button variant="outlined" onClick={() => navigateTo(homePath)}>
                返回首页
              </Button>
              <Button variant="outlined" onClick={() => navigateTo(myContestsPath)}>
                我的比赛
              </Button>
              {!isRegistered ? (
                <Button
                  variant="contained"
                  disabled={!canRegister || actionLoading}
                  onClick={handleRegister}
                >
                  {isRegistrationFull ? '报名人数已满' : (status.key === 'registration' ? '立即报名' : '当前不可报名')}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  color="error"
                  disabled={!canQuit || actionLoading}
                  onClick={handleQuit}
                >
                  退出比赛
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
