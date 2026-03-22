import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  Grid2,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import dayjs from 'dayjs';
import {
  addCompetitionJudge,
  createCompetition,
  createRequestId,
  createSubmission,
  batchDecideUserSyncReview,
  decideUserSyncReview,
  deleteCompetition,
  getCompetitionById,
  getCreatePermission,
  getMySubmissionAttachmentBlob,
  listMyJudgeCompetitionsPaged,
  getMySubmissionDetail,
  getUserSyncReviewPermission,
  listCompetitionParticipantsStatusPaged,
  listCompetitionJudgesPaged,
  listCompetitionsPaged,
  listMyCompetitionsPaged,
  listMyRegisteredCompetitionsPaged,
  listMySubmissionsPaged,
  listParticipants,
  listUserSyncReviewsPaged,
  registerParticipant,
  resubmitSubmission,
  unregisterParticipant,
  updateCompetitionJudgeStatus,
  updateCurrentUserProfile,
  updateCompetition,
  uploadSubmissionAttachment,
} from '../../../api';
import { contestRuntimeConfig } from '../../../config/contestRuntimeConfig';
import { getUserFriendlyErrorText } from '../../../utils/errorText';

const CONTEST_API_PREFIX = (contestRuntimeConfig.api.contestApiPrefix || '/contest/api').replace(/\/+$/, '');
const SUBMISSION_ATTACHMENT_ENDPOINT = `${CONTEST_API_PREFIX}/submissions/my/attachment`;

const BASE_NAV_ITEMS = [
  { key: 'home', label: '首页', icon: <HomeRoundedIcon fontSize="small" /> },
  { key: 'my_contests', label: '我的比赛', icon: <HowToRegRoundedIcon fontSize="small" /> },
  { key: 'judge_reviews', label: '我评审的比赛', icon: <RateReviewRoundedIcon fontSize="small" /> },
  { key: 'create', label: '创办比赛', icon: <AddCircleOutlineRoundedIcon fontSize="small" /> },
  { key: 'mine', label: '我创办的比赛', icon: <EditNoteRoundedIcon fontSize="small" /> },
  { key: 'profile', label: '个人信息', icon: <PersonRoundedIcon fontSize="small" /> },
];
const USER_SYNC_REVIEW_NAV_ITEM = {
  key: 'user_sync_review',
  label: '用户同步审核',
  icon: <AdminPanelSettingsRoundedIcon fontSize="small" />,
};
const ALL_NAV_ITEMS = [...BASE_NAV_ITEMS, USER_SYNC_REVIEW_NAV_ITEM];
export const DASHBOARD_VIEW_STATE_STORAGE_KEY = 'competition_dashboard_view_state';
const PAGE_SIZE = 7;
const PARTICIPANTS_PAGE_SIZE = 20;
const JUDGE_PAGE_SIZE = 10;
const EMPTY_SUBMISSION_FORM = {
  title: '',
  work_description: '无',
};

const EMPTY_FORM = {
  name: '',
  description: '无',
  registration_start: '',
  registration_end: '',
  submission_start: '',
  submission_end: '',
  review_start: '',
  review_end: '',
  max_participants: 100,
  team_mode: 'individual',
  min_team_size: 1,
  max_team_size: 1,
  participant_limit_mode: 'unlimited',
  school: '',
  major: '',
  grade: '',
  registration_code_required: false,
  allowed_formats: ['pdf'],
  attachment_mode: 'single',
  min_word_count: 500,
  max_word_count: 5000,
  max_file_size_mb: 6,
  max_modifications: 3,
  show_ranking: 1,
  ranking_visibility: 'all',
  show_score_detail: 1,
  show_judge_comment: 1,
  show_ai_analysis: 1,
  generate_certificate: 1,
};

const EMPTY_PROFILE_FORM = {
  study_status: 'in_school',
  school: '',
  major: '',
  grade: '',
  occupation: '',
  bio: '',
};

const ALLOWED_FORMAT_OPTIONS = ['pdf', 'docx'];
const GRADE_OPTIONS = ['本科生', '研究生', '博士生'];
const UNLIMITED_TEXT = '无限制';
const COMPETITION_OPTIONAL_TIMELINE_FIELDS = [
  { key: 'registration_end', label: '报名截止时间' },
  { key: 'submission_start', label: '比赛开始时间' },
  { key: 'submission_end', label: '比赛结束时间' },
  { key: 'review_start', label: '评审开始时间' },
  { key: 'review_end', label: '评审结束时间' },
];
const DOCX_PREVIEW_TIMEOUT_MS = 15000;
const MAX_UINT32 = 4294967295;
const MAX_UINT32_BIGINT = BigInt(MAX_UINT32);
const USER_SYNC_REVIEW_STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'conflict', label: '冲突' },
  { value: 'all', label: '全部' },
];
const USER_SYNC_REVIEW_CONFIRM_TEXT = {
  approve: '确认同步',
  reject: '确认拒绝',
};
const USER_SYNC_CONFLICT_HINT =
  '“冲突”表示系统在同步到 users 时，发现邮箱/手机号无法唯一对应同一账号（如分别命中不同用户），为避免错绑账号而拒绝自动同步。';
const CONTEST_THEME = {
  pageBg: 'linear-gradient(155deg, #f6f0ff 0%, #e9ddfb 45%, #f8f4ff 100%)',
  sideNavBg: 'linear-gradient(180deg, #4b2b7f 0%, #6a3ea3 100%)',
  sideNavBorder: '#bda8de',
  sideNavText: '#ffffff',
  sideNavActiveBg: 'rgba(255,255,255,0.20)',
  sideNavDivider: 'rgba(255,255,255,0.28)',
  panelBorder: '#ddcff2',
  panelGradient: 'linear-gradient(165deg, #ffffff 0%, #f7f1ff 100%)',
  headerGradient: 'linear-gradient(90deg, #ffffff 0%, #f4ecff 100%)',
  tableBorder: '#e9def8',
  tableHeadBg: '#f2e8ff',
  attachmentBorder: '#c6afe8',
  attachmentBg: '#f2e8ff',
  attachmentShadow: '0 1px 2px rgba(89, 43, 150, 0.12)',
  attachmentHoverBorder: '#ab88dd',
  attachmentHoverBg: '#eadbff',
  attachmentHoverShadow: '0 2px 6px rgba(89, 43, 150, 0.18)',
  attachmentIconBoxBg: '#e1d0fb',
  attachmentIconBoxBorder: '#ccb4ef',
  attachmentIcon: '#6f42ad',
  attachmentText: '#4c2d7d',
  attachmentSubText: '#7755ab',
  clearBtnBorder: '#d8caeb',
  clearBtnHoverBg: '#f7f2ff',
  sortPrimary: '#59368a',
  sortPrimaryHover: 'rgba(89,54,138,0.10)',
  sortSecondary: '#7150a3',
  datePlaceholderColor: 'rgba(72,41,120,0.45)',
  datePlaceholderShadow: '0 1px 2px rgba(72,41,120,0.18)',
};

function toFormatList(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeAllowedFormats(value) {
  const normalized = toFormatList(value)
    .map((item) => String(item || '').trim().toLowerCase().replace(/^\./, ''))
    .map((token) => {
      if (token === 'doc' || token === 'docx' || token === 'word') return 'docx';
      return token;
    })
    .filter((token) => token === 'pdf' || token === 'docx')
    .filter(Boolean);
  const deduped = [...new Set(normalized)];
  return deduped.length ? deduped : ['pdf'];
}

function normalizeAttachmentMode(value) {
  const token = String(value || '').trim().toLowerCase();
  return token === 'multiple' ? 'multiple' : 'single';
}

function normalizeParticipantLimitMode(value) {
  const token = String(value || '').trim().toLowerCase();
  return token === 'in_school' ? 'in_school' : 'unlimited';
}

function toInputDateTime(v) {
  if (!v) return '';
  const d = dayjs(v);
  return d.isValid() ? d.format('YYYY-MM-DDTHH:mm') : '';
}

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

function statusTimeText(item, statusKey) {
  if (statusKey === 'preview' || statusKey === 'registration') {
    const base = `报名时间：${formatTimeValue(item.registration_start, '-')} ~ ${formatTimeValue(item.registration_end, '待定')}`;
    const hint = statusKey === 'preview' ? '当前不可报名，可先查看规则。' : '可报名；已报名用户可在比赛开始前退出。';
    return `${base} ｜ ${hint}`;
  }
  if (statusKey === 'pending_start') {
    return `比赛时间：${formatTimeValue(item.submission_start, '待定')} ~ ${formatTimeValue(item.submission_end, '待定')} ｜ 报名已结束，等待比赛开始。`;
  }
  if (statusKey === 'ongoing') {
    return `作品提交时间：${formatTimeValue(item.submission_start, '待定')} ~ ${formatTimeValue(item.submission_end, '待定')} ｜ 比赛进行中，可提交作品，不能退出比赛。`;
  }
  if (statusKey === 'pending_review') {
    return `评审时间：${formatTimeValue(item.review_start, '待定')} ~ ${formatTimeValue(item.review_end, '待定')} ｜ 提交已截止，等待评审开始。`;
  }
  if (statusKey === 'review') {
    return `评审时间：${formatTimeValue(item.review_start, '待定')} ~ ${formatTimeValue(item.review_end, '待定')} ｜ 评审进行中，请关注结果。`;
  }
  if (statusKey === 'ended') return '比赛已结束。';
  return '';
}

function canDeleteCompetition(item) {
  return true;
}

function canQuitCompetition(item) {
  if (item?.submission_start === null || item?.submission_start === undefined || item?.submission_start === '') {
    return true;
  }
  const subStart = dayjs(item.submission_start);
  if (!subStart.isValid()) return false;
  return Date.now() < subStart.valueOf();
}

function statusOrderKey(statusKey) {
  const order = {
    preview: 1,
    registration: 2,
    pending_start: 3,
    ongoing: 4,
    pending_review: 5,
    review: 6,
    ended: 7,
    draft: 8,
  };
  return order[statusKey] || 99;
}

function teamModeText(mode) {
  if (mode === 'individual') return '个人';
  if (mode === 'team') return '团体';
  if (mode === 'both') return '个人/团体';
  return mode || '-';
}

function normalizeCompetitionIds(ids) {
  return [...new Set((ids || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];
}

function estimateMaxFileSizeMb(maxWordCount) {
  const words = Math.max(0, Number(maxWordCount) || 0);
  // 按文档型作品做经验估算，留一定冗余但避免明显偏大。
  // 参考值：5000字≈6MB，10000字≈8MB，20000字≈13MB，50000字≈28MB。
  const estimated = Math.ceil(words / 2000) + 3;
  return Math.max(5, Math.min(80, estimated));
}

function extractFileExt(fileName) {
  const text = String(fileName || '').trim();
  if (!text || !text.includes('.')) return '';
  return text.split('.').pop().trim().toLowerCase();
}

function canonicalFormatToken(value) {
  const token = String(value || '').trim().toLowerCase().replace(/^\./, '');
  if (!token) return '';
  if (token === 'doc' || token === 'docx' || token === 'word') return 'docx';
  return token;
}

function normalizeAttachmentMeta(raw) {
  const attachmentName = String(raw?.attachment_name || '').trim();
  const attachmentPath = String(raw?.attachment_path || '').trim();
  if (!attachmentName && !attachmentPath) return null;
  return {
    attachment_name: attachmentName || null,
    attachment_path: attachmentPath || null,
    attachment_ext: String(raw?.attachment_ext || '').trim().toLowerCase() || null,
    attachment_mime: String(raw?.attachment_mime || '').trim() || null,
    attachment_size: raw?.attachment_size == null ? null : Number(raw.attachment_size),
    attachment_hash: String(raw?.attachment_hash || '').trim() || null,
  };
}

function toAttachmentPayload(meta) {
  if (!meta) return null;
  return {
    attachment_name: meta.attachment_name || null,
    attachment_path: meta.attachment_path || null,
    attachment_ext: meta.attachment_ext || null,
    attachment_mime: meta.attachment_mime || null,
    attachment_size: meta.attachment_size == null ? null : Number(meta.attachment_size),
    attachment_hash: meta.attachment_hash || null,
  };
}

function getSubmissionFileAccept(allowedFormats) {
  const formats = normalizeAllowedFormats(allowedFormats);
  return formats.map((fmt) => `.${fmt}`).join(',');
}

function submissionStatusLabel(value) {
  return value === 'submitted' ? '已提交作品' : '未提交作品';
}

function normalizeLimitValue(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === UNLIMITED_TEXT) return '';
  return normalized;
}

function toLimitDisplayValue(value) {
  const normalized = String(value || '').trim();
  return normalized || UNLIMITED_TEXT;
}

function normalizeStudyStatus(value, row = {}) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'in_school' || normalized === 'not_in_school') return normalized;
  const hasInSchoolInfo = Boolean(
    String(row?.school || '').trim()
    || String(row?.major || '').trim()
    || String(row?.grade || '').trim()
  );
  return hasInSchoolInfo ? 'in_school' : 'not_in_school';
}

function studyStatusLabel(status) {
  return status === 'in_school' ? '在读' : '非在读';
}

function profileValue(value) {
  const text = String(value || '').trim();
  return text || '-';
}

function buildProfileFormFromUser(user) {
  if (!user) return { ...EMPTY_PROFILE_FORM };
  const studyStatus = normalizeStudyStatus(user?.study_status, user);
  const school = String(user?.school || '').trim();
  const major = String(user?.major || '').trim();
  const grade = String(user?.grade || '').trim();
  const occupation = String(user?.occupation || '').trim();
  const bio = String(user?.bio || '').trim();
  if (studyStatus === 'in_school') {
    return {
      study_status: 'in_school',
      school,
      major,
      grade,
      occupation: '',
      bio,
    };
  }
  return {
    study_status: 'not_in_school',
    school: '',
    major: '',
    grade: '',
    occupation,
    bio,
  };
}

function validateProfileForm(form) {
  const errors = {};
  const status = normalizeStudyStatus(form?.study_status, form);
  if (status === 'in_school') {
    if (!String(form?.school || '').trim()) errors.school = '请填写学校';
    if (!String(form?.major || '').trim()) errors.major = '请填写专业';
    if (!String(form?.grade || '').trim()) errors.grade = '请选择年级';
  } else if (!String(form?.occupation || '').trim()) {
    errors.occupation = '请填写职业';
  }
  if (String(form?.bio || '').length > 1000) {
    errors.bio = '个人简介最多 1000 字';
  }
  return errors;
}

function competitionLimitText(item) {
  const limitMode = normalizeParticipantLimitMode(item?.participant_limit_mode);
  const parts = [];
  if (limitMode === 'in_school') parts.push('仅在校生');
  if (registrationCodeRequired(item)) parts.push('邀请码');
  return parts.length ? parts.join(' + ') : '无限制';
}

function registrationCodeRequired(item) {
  if (item?.registration_code_required === true || Number(item?.registration_code_required) === 1) return true;
  return Boolean(String(item?.registration_code || '').trim());
}

function competitionAttachmentText(item) {
  const formats = normalizeAllowedFormats(item?.allowed_formats).map((fmt) => fmt.toUpperCase()).join('、');
  const mode = normalizeAttachmentMode(item?.attachment_mode) === 'multiple'
    ? '多附件'
    : '单附件';
  return `${formats} ｜ ${mode}`;
}

function userSyncReviewStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'rejected') return '已拒绝';
  if (normalized === 'conflict') return '冲突';
  return '待审核';
}

function userSyncReviewStatusColor(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'rejected') return 'warning';
  if (normalized === 'conflict') return 'error';
  return 'info';
}

function judgeStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'disabled' ? '停用' : '启用';
}

function userSyncReviewActionText(action) {
  const normalized = String(action || '').trim().toLowerCase();
  return normalized === 'reject' ? '拒绝' : '通过';
}

function buildSubmissionFormFromRow(row) {
  return {
    title: String(row?.title || ''),
    work_description: String(row?.work_description || '无'),
  };
}

function isPreviewableExt(ext) {
  const token = String(ext || '').trim().toLowerCase().replace(/^\./, '');
  if (!token) return false;
  return ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'txt'].includes(token);
}

function buildSubmissionAttachmentUrl(competitionId, disposition = 'attachment', attachmentExt = '') {
  const normalizedExt = canonicalFormatToken(attachmentExt);
  const params = new URLSearchParams({
    competition_id: String(Number(competitionId)),
    disposition: disposition === 'inline' ? 'inline' : 'attachment',
    t: String(Date.now()),
  });
  if (normalizedExt) params.set('attachment_ext', normalizedExt);
  return `${SUBMISSION_ATTACHMENT_ENDPOINT}?${params.toString()}`;
}

function getErrorText(error, fallback = '请求失败，请稍后重试') {
  return getUserFriendlyErrorText(error, fallback);
}

async function copyToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  return ok;
}

function withTimeout(promise, timeoutMs, timeoutMessage = 'timeout') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function trackAction(event, payload = {}) {
  const entry = {
    event,
    payload,
    at: new Date().toISOString(),
  };
  try {
    console.info('[contest-track]', entry);
  } catch {
    // no-op
  }
}

function loadDashboardViewState() {
  try {
    const raw = localStorage.getItem(DASHBOARD_VIEW_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildPayload(form) {
  const attachmentMode = normalizeAttachmentMode(form.attachment_mode);
  const participantLimitMode = normalizeParticipantLimitMode(form.participant_limit_mode);
  return {
    competition_info: {
      name: form.name.trim(),
      description: form.description || null,
      registration_start: form.registration_start || null,
      registration_end: form.registration_end || null,
      submission_start: form.submission_start || null,
      submission_end: form.submission_end || null,
      review_start: form.review_start || null,
      review_end: form.review_end || null,
      max_participants: Number(form.max_participants),
      team_mode: form.team_mode,
      min_team_size: Number(form.min_team_size),
      max_team_size: Number(form.max_team_size),
      participant_limit_mode: participantLimitMode,
      school: '',
      major: '',
      grade: '',
      registration_code_required: Boolean(form.registration_code_required),
      registration_code: '',
      allowed_formats: normalizeAllowedFormats(form.allowed_formats),
      attachment_mode: attachmentMode,
      min_word_count: Number(form.min_word_count),
      max_word_count: Number(form.max_word_count),
      max_file_size_mb: Number(form.max_file_size_mb),
      max_modifications: Number(form.max_modifications),
      show_ranking: Number(form.show_ranking),
      ranking_visibility: form.ranking_visibility,
      show_score_detail: Number(form.show_score_detail),
      show_judge_comment: Number(form.show_judge_comment),
      show_ai_analysis: Number(form.show_ai_analysis),
      generate_certificate: Number(form.generate_certificate),
    },
  };
}

function parseIntegerFieldValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: false, value: null };
  if (!/^-?\d+$/.test(raw)) return { ok: false, value: null };
  try {
    return { ok: true, value: BigInt(raw) };
  } catch {
    return { ok: false, value: null };
  }
}

function blockNonIntegerKeyInput(event) {
  const blocked = ['e', 'E', '+', '-', '.', ','];
  if (blocked.includes(event.key)) {
    event.preventDefault();
  }
}

function blockNonIntegerPaste(event) {
  const text = String(event?.clipboardData?.getData('text') || '').trim();
  if (!text) return;
  if (!/^\d+$/.test(text)) {
    event.preventDefault();
  }
}

function validateForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = '比赛名称不能为空';
  if (!form.registration_start) errors.registration_start = '请填写报名开始时间';
  if (!toFormatList(form.allowed_formats).length) errors.allowed_formats = '请至少选择一种允许格式';

  const maxParticipants = parseIntegerFieldValue(form.max_participants);
  if (!maxParticipants.ok) {
    errors.max_participants = '请输入有效整数';
  } else if (maxParticipants.value > MAX_UINT32_BIGINT) {
    errors.max_participants = '数值过大';
  } else if (maxParticipants.value <= 0n) {
    errors.max_participants = '必须大于0';
  }

  const maxModifications = parseIntegerFieldValue(form.max_modifications);
  if (!maxModifications.ok) {
    errors.max_modifications = '请输入有效整数';
  } else if (maxModifications.value > MAX_UINT32_BIGINT) {
    errors.max_modifications = '数值过大';
  } else if (maxModifications.value <= 0n) {
    errors.max_modifications = '必须大于0';
  }

  const maxFileSizeMb = parseIntegerFieldValue(form.max_file_size_mb);
  if (!maxFileSizeMb.ok) {
    errors.max_file_size_mb = '请输入有效整数';
  } else if (maxFileSizeMb.value > MAX_UINT32_BIGINT) {
    errors.max_file_size_mb = '数值过大';
  } else if (maxFileSizeMb.value <= 0n) {
    errors.max_file_size_mb = '必须大于0';
  }

  const minWordCount = parseIntegerFieldValue(form.min_word_count);
  if (!minWordCount.ok) {
    errors.min_word_count = '请输入有效整数';
  } else if (minWordCount.value > MAX_UINT32_BIGINT) {
    errors.min_word_count = '数值过大';
  } else if (minWordCount.value <= 0n) {
    errors.min_word_count = '必须大于0';
  }

  const maxWordCount = parseIntegerFieldValue(form.max_word_count);
  if (!maxWordCount.ok) {
    errors.max_word_count = '请输入有效整数';
  } else if (maxWordCount.value > MAX_UINT32_BIGINT) {
    errors.max_word_count = '数值过大';
  } else if (maxWordCount.value <= 0n) {
    errors.max_word_count = '必须大于0';
  }

  if (form.team_mode !== 'individual') errors.team_mode = '团队赛功能还未开发，当前仅支持个人赛';
  if (form.team_mode !== 'individual' && Number(form.min_team_size) > Number(form.max_team_size)) {
    errors.min_team_size = '最小团队人数不能大于最大团队人数';
    errors.max_team_size = '最大团队人数不能小于最小团队人数';
  }
  if (minWordCount.ok && maxWordCount.ok && minWordCount.value > maxWordCount.value) {
    errors.min_word_count = '最小字数不能大于最大字数';
    errors.max_word_count = '最大字数不能小于最小字数';
  }

  let firstPending = null;
  COMPETITION_OPTIONAL_TIMELINE_FIELDS.forEach((field) => {
    const hasValue = Boolean(form[field.key]);
    if (!hasValue) {
      if (!firstPending) firstPending = field;
      return;
    }
    if (firstPending) {
      errors[field.key] = `${firstPending.label}为待定时，${field.label}也必须为待定`;
    }
  });

  if (form.registration_start && form.registration_end && form.registration_start >= form.registration_end) {
    errors.registration_start = '报名开始时间必须早于报名截止时间';
    errors.registration_end = '报名截止时间必须晚于报名开始时间';
  }
  if (form.submission_start && form.submission_end && form.submission_start >= form.submission_end) {
    errors.submission_start = '比赛开始时间必须早于比赛结束时间';
    errors.submission_end = '比赛结束时间必须晚于比赛开始时间';
  }
  if (form.review_start && form.review_end && form.review_start >= form.review_end) {
    errors.review_start = '评审开始时间必须早于评审结束时间';
    errors.review_end = '评审结束时间必须晚于评审开始时间';
  }

  if (form.registration_end && form.submission_start && form.registration_end > form.submission_start) {
    errors.registration_end = '报名截止时间不能晚于比赛开始时间';
    errors.submission_start = '比赛开始时间不能早于报名截止时间';
  }
  if (form.submission_end && form.review_start && form.submission_end > form.review_start) {
    errors.submission_end = '比赛结束时间不能晚于评审开始时间';
    errors.review_start = '评审开始时间不能早于比赛结束时间';
  }
  return errors;
}

function DateTimeField({
  label,
  value,
  onChange,
  error,
  helperText,
  allowPending = false,
  disabled = false,
  mode = 'fixed',
  onModeChange,
}) {
  const datePart = value ? String(value).slice(0, 10) : '';
  const timePart = value && String(value).includes('T') ? String(value).slice(11, 16) : '';
  const parsedHour = timePart ? timePart.slice(0, 2) : '00';
  const parsedMinute = timePart ? timePart.slice(3, 5) : '00';
  const [hourPart, setHourPart] = useState(parsedHour);
  const [minutePart, setMinutePart] = useState(parsedMinute);
  const normalizedMode = allowPending && mode === 'pending' ? 'pending' : 'fixed';
  const pending = allowPending && normalizedMode === 'pending';
  const controlDisabled = disabled || pending;
  const showDatePlaceholder = !datePart;
  const dateSize = allowPending ? 6 : 7;
  const hourSize = allowPending ? 2 : 2.5;
  const minuteSize = allowPending ? 2 : 2.5;

  useEffect(() => {
    setHourPart(parsedHour);
    setMinutePart(parsedMinute);
  }, [parsedHour, parsedMinute]);

  const commit = (nextDate, nextHour, nextMinute, force = false) => {
    if (!nextDate) {
      if (allowPending || force) onChange({ target: { value: '' } });
      return;
    }
    const h = String(nextHour ?? '00').padStart(2, '0');
    const m = String(nextMinute ?? '00').padStart(2, '0');
    onChange({ target: { value: `${nextDate}T${h}:${m}` } });
  };

  return (
    <Grid2 container spacing={1}>
      <Grid2 size={dateSize}>
        <Box sx={{ position: 'relative' }}>
          <TextField
            type="date"
            fullWidth
            label={label}
            value={datePart}
            disabled={controlDisabled}
            onChange={(e) => commit(e.target.value, hourPart, minutePart, true)}
            InputLabelProps={{ shrink: true }}
            error={error}
            sx={{
              '& input[type="date"]::-webkit-datetime-edit': {
                color: showDatePlaceholder ? 'transparent' : 'inherit',
              },
              '& input[type="date"]::-webkit-datetime-edit-fields-wrapper': {
                color: showDatePlaceholder ? 'transparent' : 'inherit',
              },
            }}
          />
          {showDatePlaceholder && !controlDisabled && (
            <Typography
              variant="body2"
              sx={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-45%)',
                color: CONTEST_THEME.datePlaceholderColor,
                textShadow: CONTEST_THEME.datePlaceholderShadow,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              年-月-日
            </Typography>
          )}
        </Box>
      </Grid2>
      <Grid2 size={hourSize}>
        <FormControl fullWidth error={error} disabled={controlDisabled}>
          <InputLabel>时</InputLabel>
          <Select
            label="时"
            value={hourPart}
            onChange={(e) => {
              const nextHour = String(e.target.value);
              setHourPart(nextHour);
              commit(datePart, nextHour, minutePart);
            }}
          >
            {Array.from({ length: 24 }).map((_, i) => {
              const h = String(i).padStart(2, '0');
              return <MenuItem key={h} value={h}>{h}</MenuItem>;
            })}
          </Select>
        </FormControl>
      </Grid2>
      <Grid2 size={minuteSize}>
        <FormControl fullWidth error={error} disabled={controlDisabled}>
          <InputLabel>分</InputLabel>
          <Select
            label="分"
            value={minutePart}
            onChange={(e) => {
              const nextMinute = String(e.target.value);
              setMinutePart(nextMinute);
              commit(datePart, hourPart, nextMinute);
            }}
          >
            {Array.from({ length: 60 }).map((_, i) => {
              const m = String(i).padStart(2, '0');
              return <MenuItem key={m} value={m}>{m}</MenuItem>;
            })}
          </Select>
        </FormControl>
      </Grid2>
      {allowPending && (
        <Grid2 size={2}>
          <FormControl fullWidth error={error} disabled={disabled}>
            <InputLabel>状态</InputLabel>
            <Select
              label="状态"
              value={normalizedMode}
              onChange={(e) => {
                const nextMode = String(e.target.value);
                if (typeof onModeChange === 'function') onModeChange(nextMode);
                if (nextMode === 'pending') {
                  onChange({ target: { value: '' } });
                  return;
                }
              }}
            >
              <MenuItem value="fixed">指定时间</MenuItem>
              <MenuItem value="pending">待定</MenuItem>
            </Select>
          </FormControl>
        </Grid2>
      )}
      {!!helperText && (
        <Grid2 size={12}>
          <FormHelperText error={error}>{helperText}</FormHelperText>
        </Grid2>
      )}
    </Grid2>
  );
}

function CompetitionForm({ form, setForm, errors = {}, setErrors }) {
  const selectedFormats = normalizeAllowedFormats(form.allowed_formats);
  const attachmentMode = normalizeAttachmentMode(form.attachment_mode);
  const optionalTimelineKeys = COMPETITION_OPTIONAL_TIMELINE_FIELDS.map((field) => field.key);
  const timelineModes = form?._timeline_modes && typeof form._timeline_modes === 'object'
    ? form._timeline_modes
    : {};
  const getTimelineMode = (key) => (timelineModes[key] === 'pending' ? 'pending' : 'fixed');
  const firstPendingIndex = optionalTimelineKeys.findIndex((key) => getTimelineMode(key) === 'pending');
  const set = (k) => (e) => {
    const rawValue = e.target.value;
    const value = k === 'allowed_formats'
      ? (Array.isArray(rawValue) ? rawValue : String(rawValue || '').split(',').map((s) => s.trim()).filter(Boolean))
      : rawValue;
    if (setErrors) {
      setErrors((prev) => {
        const next = { ...prev };
        const timelineIndex = optionalTimelineKeys.indexOf(k);
        if (timelineIndex >= 0) {
          for (let i = timelineIndex; i < optionalTimelineKeys.length; i += 1) {
            delete next[optionalTimelineKeys[i]];
          }
          return next;
        }
        if (!prev?.[k]) return prev;
        delete next[k];
        return next;
      });
    }
    setForm((prev) => {
      if (k === 'team_mode') {
        if (value === 'individual') {
          return { ...prev, team_mode: value, min_team_size: 1, max_team_size: 1 };
        }
        return { ...prev, team_mode: value };
      }
      if (k === 'max_word_count') {
        const maxWordCount = Number(value || 0);
        return {
          ...prev,
          max_word_count: value,
          max_file_size_mb: estimateMaxFileSizeMb(maxWordCount),
        };
      }
      const timelineIndex = optionalTimelineKeys.indexOf(k);
      if (timelineIndex >= 0) {
        return { ...prev, [k]: value };
      }
      return { ...prev, [k]: value };
    });
  };
  const setTimelineMode = (key) => (nextMode) => {
    const timelineIndex = optionalTimelineKeys.indexOf(key);
    if (timelineIndex < 0) return;
    if (setErrors) {
      setErrors((prev) => {
        if (!prev || typeof prev !== 'object') return prev;
        const next = { ...prev };
        for (let i = timelineIndex; i < optionalTimelineKeys.length; i += 1) {
          delete next[optionalTimelineKeys[i]];
        }
        return next;
      });
    }
    setForm((prev) => {
      const next = { ...prev };
      const nextModes = {
        ...(prev?._timeline_modes && typeof prev._timeline_modes === 'object' ? prev._timeline_modes : {}),
      };
      if (nextMode === 'pending') {
        for (let i = timelineIndex; i < optionalTimelineKeys.length; i += 1) {
          const fieldKey = optionalTimelineKeys[i];
          nextModes[fieldKey] = 'pending';
          next[fieldKey] = '';
        }
      } else {
        nextModes[key] = 'fixed';
        for (let i = timelineIndex + 1; i < optionalTimelineKeys.length; i += 1) {
          const fieldKey = optionalTimelineKeys[i];
          if (nextModes[fieldKey] === 'pending' && !next[fieldKey]) {
            nextModes[fieldKey] = 'fixed';
          }
        }
      }
      next._timeline_modes = nextModes;
      return next;
    });
  };
  const integerInputBase = {
    inputMode: 'numeric',
    pattern: '[0-9]*',
    onKeyDown: blockNonIntegerKeyInput,
    onPaste: blockNonIntegerPaste,
  };

  return (
    <Stack spacing={2}>
      <Grid2 container spacing={2}>
        <Grid2 size={6}>
          <TextField fullWidth label="比赛名称 *" value={form.name} onChange={set('name')} error={!!errors.name} helperText={errors.name} />
        </Grid2>
        <Grid2 size={12}>
          <TextField multiline minRows={2} fullWidth label="比赛描述" value={form.description} onChange={set('description')} />
        </Grid2>
      </Grid2>

      <Divider />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>时间设置</Typography>
      <Grid2 container spacing={2}>
        {[
          { key: 'registration_start', label: '报名开始', allowPending: false },
          { key: 'registration_end', label: '报名截止', allowPending: true },
          { key: 'submission_start', label: '比赛开始', allowPending: true },
          { key: 'submission_end', label: '比赛结束', allowPending: true },
          { key: 'review_start', label: '评审开始', allowPending: true },
          { key: 'review_end', label: '评审结束', allowPending: true },
        ].map((field) => {
          const optionalIndex = optionalTimelineKeys.indexOf(field.key);
          const disabledByPending = optionalIndex >= 0 && firstPendingIndex >= 0 && optionalIndex > firstPendingIndex;
          return (
            <Grid2 key={field.key} size={12}>
              <DateTimeField
                label={field.label}
                value={form[field.key]}
                onChange={set(field.key)}
                error={!!errors[field.key]}
                helperText={errors[field.key]}
                allowPending={field.allowPending}
                disabled={disabledByPending}
                mode={getTimelineMode(field.key)}
                onModeChange={setTimelineMode(field.key)}
              />
            </Grid2>
          );
        })}
      </Grid2>

      <Divider />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>规则设置</Typography>
      <Grid2 container spacing={2}>
        <Grid2 size={3}><TextField type="number" fullWidth label="最大参赛人数" value={form.max_participants} onChange={set('max_participants')} error={!!errors.max_participants} helperText={errors.max_participants} slotProps={{ input: { ...integerInputBase, min: 1, max: MAX_UINT32, step: 1 } }} /></Grid2>
        <Grid2 size={3}>
          <FormControl fullWidth error={!!errors.team_mode}>
            <InputLabel>参赛模式</InputLabel>
            <Select label="参赛模式" value={form.team_mode} onChange={set('team_mode')}>
              <MenuItem value="individual">个人</MenuItem>
              <MenuItem value="team">团体（未开发）</MenuItem>
              <MenuItem value="both">个人/团体（未开发）</MenuItem>
            </Select>
            {!!errors.team_mode && <FormHelperText>{errors.team_mode}</FormHelperText>}
            {!errors.team_mode && form.team_mode !== 'individual' && (
              <FormHelperText error>团队赛功能还未开发，当前仅支持个人赛</FormHelperText>
            )}
          </FormControl>
        </Grid2>
        <Grid2 size={3}>
          <FormControl fullWidth>
            <InputLabel>就读状态限制</InputLabel>
            <Select
              label="就读状态限制"
              value={normalizeParticipantLimitMode(form.participant_limit_mode)}
              onChange={set('participant_limit_mode')}
            >
              <MenuItem value="unlimited">无限制</MenuItem>
              <MenuItem value="in_school">仅在校生</MenuItem>
            </Select>
            <FormHelperText>
              {normalizeParticipantLimitMode(form.participant_limit_mode) === 'in_school'
                ? '仅在校生可报名。'
                : '所有用户在报名阶段均可报名。'}
            </FormHelperText>
          </FormControl>
        </Grid2>
        <Grid2 size={3}>
          <FormControl fullWidth>
            <InputLabel>邀请码限制</InputLabel>
            <Select
              label="邀请码限制"
              value={form.registration_code_required ? 'required' : 'unlimited'}
              onChange={(event) => {
                const mode = String(event.target.value || 'unlimited');
                setForm((prev) => ({
                  ...prev,
                  registration_code_required: mode === 'required',
                }));
              }}
            >
              <MenuItem value="unlimited">无限制</MenuItem>
              <MenuItem value="required">需要邀请码（系统自动生成）</MenuItem>
            </Select>
            <FormHelperText>
              {form.registration_code_required
                ? '创建后系统自动生成邀请码；用户满足就读状态限制后，还需填写邀请码才能报名。'
                : '不校验邀请码。'}
            </FormHelperText>
          </FormControl>
        </Grid2>

        <Grid2 size={4}>
          <FormControl fullWidth error={!!errors.allowed_formats}>
            <InputLabel>允许格式(可多选)</InputLabel>
            <Select
              multiple
              label="允许格式(可多选)"
              value={selectedFormats}
              onChange={set('allowed_formats')}
              renderValue={(selected) => (Array.isArray(selected) ? selected.join(', ') : '')}
            >
              {ALLOWED_FORMAT_OPTIONS.map((fmt) => (
                <MenuItem key={fmt} value={fmt}>
                  <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ textTransform: 'lowercase', fontWeight: selectedFormats.includes(fmt) ? 700 : 500 }}>{fmt}</Box>
                    <CheckCircleRoundedIcon
                      fontSize="small"
                      sx={{
                        color: 'success.main',
                        opacity: selectedFormats.includes(fmt) ? 1 : 0,
                      }}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {!!errors.allowed_formats && <FormHelperText>{errors.allowed_formats}</FormHelperText>}
            {!errors.allowed_formats && <FormHelperText>当前支持 PDF、DOCX，可多选</FormHelperText>}
          </FormControl>
        </Grid2>
        <Grid2 size={3}>
          <FormControl fullWidth error={!!errors.attachment_mode}>
            <InputLabel>附件模式</InputLabel>
            <Select label="附件模式" value={attachmentMode} onChange={set('attachment_mode')}>
              <MenuItem value="single">单附件（提交任一允许格式即可）</MenuItem>
              <MenuItem value="multiple">多附件（需提交全部允许格式）</MenuItem>
            </Select>
            {!!errors.attachment_mode && <FormHelperText>{errors.attachment_mode}</FormHelperText>}
            {!errors.attachment_mode && <FormHelperText>默认单附件；多附件模式下将强制每种允许格式都要上传。</FormHelperText>}
          </FormControl>
        </Grid2>
        <Grid2 size={2}><TextField type="number" fullWidth label="最小字数" value={form.min_word_count} onChange={set('min_word_count')} error={!!errors.min_word_count} helperText={errors.min_word_count} slotProps={{ input: { ...integerInputBase, min: 1, max: MAX_UINT32, step: 1 } }} /></Grid2>
        <Grid2 size={2}><TextField type="number" fullWidth label="最大字数" value={form.max_word_count} onChange={set('max_word_count')} error={!!errors.max_word_count} helperText={errors.max_word_count} slotProps={{ input: { ...integerInputBase, min: 1, max: MAX_UINT32, step: 1 } }} /></Grid2>
        <Grid2 size={2}><TextField type="number" fullWidth label="文件上限MB(自动估算)" value={form.max_file_size_mb} slotProps={{ input: { readOnly: true } }} error={!!errors.max_file_size_mb} helperText={errors.max_file_size_mb} /></Grid2>
        <Grid2 size={2}><TextField type="number" fullWidth label="最多修改次数" value={form.max_modifications} onChange={set('max_modifications')} error={!!errors.max_modifications} helperText={errors.max_modifications} slotProps={{ input: { ...integerInputBase, min: 1, max: MAX_UINT32, step: 1 } }} /></Grid2>

        <Grid2 size={3}>
          <FormControl fullWidth>
            <InputLabel>公开排名</InputLabel>
            <Select label="公开排名" value={String(form.show_ranking)} onChange={set('show_ranking')}>
              <MenuItem value="1">是</MenuItem>
              <MenuItem value="0">否</MenuItem>
            </Select>
          </FormControl>
        </Grid2>
        <Grid2 size={3}>
          <FormControl fullWidth>
            <InputLabel>排名可见范围</InputLabel>
            <Select label="排名可见范围" value={form.ranking_visibility} onChange={set('ranking_visibility')}>
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="winners">仅获奖者</MenuItem>
              <MenuItem value="participants">仅参赛者</MenuItem>
              <MenuItem value="none">不可见</MenuItem>
            </Select>
          </FormControl>
        </Grid2>
        <Grid2 size={2}>
          <FormControl fullWidth>
            <InputLabel>评分详情</InputLabel>
            <Select label="评分详情" value={String(form.show_score_detail)} onChange={set('show_score_detail')}>
              <MenuItem value="1">公开</MenuItem>
              <MenuItem value="0">不公开</MenuItem>
            </Select>
          </FormControl>
        </Grid2>
        <Grid2 size={2}>
          <FormControl fullWidth>
            <InputLabel>评委评语</InputLabel>
            <Select label="评委评语" value={String(form.show_judge_comment)} onChange={set('show_judge_comment')}>
              <MenuItem value="1">公开</MenuItem>
              <MenuItem value="0">不公开</MenuItem>
            </Select>
          </FormControl>
        </Grid2>
        <Grid2 size={2}>
          <FormControl fullWidth>
            <InputLabel>AI分析</InputLabel>
            <Select label="AI分析" value={String(form.show_ai_analysis)} onChange={set('show_ai_analysis')}>
              <MenuItem value="1">公开</MenuItem>
              <MenuItem value="0">不公开</MenuItem>
            </Select>
          </FormControl>
        </Grid2>
        <Grid2 size={2}>
          <FormControl fullWidth>
            <InputLabel>电子证书</InputLabel>
            <Select label="电子证书" value={String(form.generate_certificate)} onChange={set('generate_certificate')}>
              <MenuItem value="1">生成</MenuItem>
              <MenuItem value="0">不生成</MenuItem>
            </Select>
          </FormControl>
        </Grid2>
      </Grid2>
    </Stack>
  );
}

function DetailItem({ label, value }) {
  return (
    <Box sx={{ py: 0.8 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {value || '-'}
      </Typography>
    </Box>
  );
}

function Dashboard({
  user,
  onLogout,
  onGoLogin,
  setMessage,
  routeTab = 'home',
  onRouteChange,
  onOpenJudgeReviewCompetition,
  competitionPathPrefix = '/competitions',
  competitionRegisterSuffix = '/register',
  autoOpenCompetitionId = 0,
  onAutoOpenCompetitionHandled,
}) {
  const savedViewStateRef = useRef(loadDashboardViewState());
  const persistedViewState = useMemo(() => {
    const saved = savedViewStateRef.current || {};
    const savedEmail = String(saved.userEmail || '').toLowerCase();
    const currentEmail = String(user?.email || '').toLowerCase();
    if (!savedEmail || savedEmail !== currentEmail) return {};
    return saved;
  }, [user?.email]);
  const [tab, setTab] = useState(() => {
    if (ALL_NAV_ITEMS.some((i) => i.key === routeTab)) return routeTab;
    const savedTab = persistedViewState.tab;
    return ALL_NAV_ITEMS.some((i) => i.key === savedTab) ? savedTab : 'home';
  });
  const [homeLoading, setHomeLoading] = useState(false);
  const [mineLoading, setMineLoading] = useState(false);
  const [myContestsLoading, setMyContestsLoading] = useState(false);
  const [judgeReviewsLoading, setJudgeReviewsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [canCreateCompetition, setCanCreateCompetition] = useState(false);
  const [createPermissionLoaded, setCreatePermissionLoaded] = useState(false);
  const [homeRows, setHomeRows] = useState([]);
  const [mineRows, setMineRows] = useState([]);
  const [myContestRows, setMyContestRows] = useState([]);
  const [judgeCompetitionRows, setJudgeCompetitionRows] = useState([]);
  const [registeredCompetitionIds, setRegisteredCompetitionIds] = useState([]);
  const [myParticipantMap, setMyParticipantMap] = useState({});
  const [submittedCompetitionMap, setSubmittedCompetitionMap] = useState({});
  const [homeKeywordInput, setHomeKeywordInput] = useState(() => String(persistedViewState.homeKeywordInput || ''));
  const [homeKeyword, setHomeKeyword] = useState(() => String(persistedViewState.homeKeyword || ''));
  const [homePage, setHomePage] = useState(() => Math.max(1, Number(persistedViewState.homePage || 1)));
  const [homeHasNext, setHomeHasNext] = useState(false);
  const [homeTotalPages, setHomeTotalPages] = useState(1);
  const [mineKeywordInput, setMineKeywordInput] = useState(() => String(persistedViewState.mineKeywordInput || ''));
  const [mineKeyword, setMineKeyword] = useState(() => String(persistedViewState.mineKeyword || ''));
  const [minePage, setMinePage] = useState(() => Math.max(1, Number(persistedViewState.minePage || 1)));
  const [mineHasNext, setMineHasNext] = useState(false);
  const [mineTotalPages, setMineTotalPages] = useState(1);
  const [myContestKeywordInput, setMyContestKeywordInput] = useState(() => String(persistedViewState.myContestKeywordInput || ''));
  const [myContestKeyword, setMyContestKeyword] = useState(() => String(persistedViewState.myContestKeyword || ''));
  const [myContestPage, setMyContestPage] = useState(() => Math.max(1, Number(persistedViewState.myContestPage || 1)));
  const [myContestHasNext, setMyContestHasNext] = useState(false);
  const [myContestTotalPages, setMyContestTotalPages] = useState(1);
  const [judgeReviewsKeywordInput, setJudgeReviewsKeywordInput] = useState(() => String(persistedViewState.judgeReviewsKeywordInput || ''));
  const [judgeReviewsKeyword, setJudgeReviewsKeyword] = useState(() => String(persistedViewState.judgeReviewsKeyword || ''));
  const [judgeReviewsPage, setJudgeReviewsPage] = useState(() => Math.max(1, Number(persistedViewState.judgeReviewsPage || 1)));
  const [judgeReviewsHasNext, setJudgeReviewsHasNext] = useState(false);
  const [judgeReviewsTotalPages, setJudgeReviewsTotalPages] = useState(1);
  const [profileData, setProfileData] = useState(() => user || null);
  const [profileForm, setProfileForm] = useState(() => buildProfileFormFromUser(user));
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [canReviewUserSync, setCanReviewUserSync] = useState(false);
  const [userSyncPermissionLoaded, setUserSyncPermissionLoaded] = useState(false);
  const [userSyncLoading, setUserSyncLoading] = useState(false);
  const [userSyncRows, setUserSyncRows] = useState([]);
  const [userSyncKeywordInput, setUserSyncKeywordInput] = useState(() => String(persistedViewState.userSyncKeywordInput || ''));
  const [userSyncKeyword, setUserSyncKeyword] = useState(() => String(persistedViewState.userSyncKeyword || ''));
  const [userSyncStatus, setUserSyncStatus] = useState(() => String(persistedViewState.userSyncStatus || 'pending'));
  const [userSyncPage, setUserSyncPage] = useState(() => Math.max(1, Number(persistedViewState.userSyncPage || 1)));
  const [userSyncHasNext, setUserSyncHasNext] = useState(false);
  const [userSyncTotalPages, setUserSyncTotalPages] = useState(1);
  const [userSyncReviewOpen, setUserSyncReviewOpen] = useState(false);
  const [userSyncReviewTarget, setUserSyncReviewTarget] = useState(null);
  const [userSyncDecisionOpen, setUserSyncDecisionOpen] = useState(false);
  const [userSyncDecisionAction, setUserSyncDecisionAction] = useState('approve');
  const [userSyncDecisionConfirmText, setUserSyncDecisionConfirmText] = useState('');
  const [userSyncDecisionReason, setUserSyncDecisionReason] = useState('');
  const [userSyncDecisionLoading, setUserSyncDecisionLoading] = useState(false);
  const [userSyncSelectedIds, setUserSyncSelectedIds] = useState([]);
  const [userSyncBatchDecisionOpen, setUserSyncBatchDecisionOpen] = useState(false);
  const [userSyncBatchAction, setUserSyncBatchAction] = useState('approve');
  const [userSyncBatchConfirmText, setUserSyncBatchConfirmText] = useState('');
  const [userSyncBatchReason, setUserSyncBatchReason] = useState('');
  const [userSyncBatchDecisionLoading, setUserSyncBatchDecisionLoading] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createErrors, setCreateErrors] = useState({});
  const [editOpen, setEditOpen] = useState(() => Boolean(persistedViewState.editOpen));
  const [editTarget, setEditTarget] = useState(() => persistedViewState.editTarget || null);
  const [editForm, setEditForm] = useState(() => {
    const savedEditForm = persistedViewState.editForm;
    if (!savedEditForm) return EMPTY_FORM;
    return {
      ...EMPTY_FORM,
      ...savedEditForm,
      allowed_formats: normalizeAllowedFormats(savedEditForm.allowed_formats),
    };
  });
  const [editErrors, setEditErrors] = useState({});
  // “比赛详情”属于瞬时弹窗状态，不做跨刷新恢复，避免出现无列表时仍自动弹出详情。
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailFromMine, setDetailFromMine] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(() => Boolean(persistedViewState.deleteOpen));
  const [deleteTarget, setDeleteTarget] = useState(() => persistedViewState.deleteTarget || null);
  const [deleteEmail, setDeleteEmail] = useState(() => String(persistedViewState.deleteEmail || ''));
  const [deletePassword, setDeletePassword] = useState('');
  const [quitOpen, setQuitOpen] = useState(() => Boolean(persistedViewState.quitOpen));
  const [quitTarget, setQuitTarget] = useState(() => persistedViewState.quitTarget || null);
  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [joinCodeTarget, setJoinCodeTarget] = useState(null);
  const [joinCodeValue, setJoinCodeValue] = useState('');
  const [submissionOpen, setSubmissionOpen] = useState(() => Boolean(persistedViewState.submissionOpen));
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionTarget, setSubmissionTarget] = useState(() => persistedViewState.submissionTarget || null);
  const [submissionMode, setSubmissionMode] = useState(() => (persistedViewState.submissionMode === 'resubmit' ? 'resubmit' : 'create'));
  const [submissionForm, setSubmissionForm] = useState(() => {
    const saved = persistedViewState.submissionForm;
    if (!saved || typeof saved !== 'object') return EMPTY_SUBMISSION_FORM;
    return {
      ...EMPTY_SUBMISSION_FORM,
      ...saved,
      work_description: String(saved.work_description || '无'),
    };
  });
  const [submissionErrors, setSubmissionErrors] = useState({});
  const [submissionAttachment, setSubmissionAttachment] = useState(() => normalizeAttachmentMeta(persistedViewState.submissionAttachment));
  const [submissionExisting, setSubmissionExisting] = useState(() => persistedViewState.submissionExisting || null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionFilesByFormat, setSubmissionFilesByFormat] = useState({});
  const [submissionClearedFormats, setSubmissionClearedFormats] = useState({});
  const [submissionAttachmentMenuAnchor, setSubmissionAttachmentMenuAnchor] = useState(null);
  const [submissionAttachmentMenuFormat, setSubmissionAttachmentMenuFormat] = useState('');
  const [submissionProgress, setSubmissionProgress] = useState({ mode: 'idle', percent: 0 });
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsTarget, setParticipantsTarget] = useState(null);
  const [participantsRows, setParticipantsRows] = useState([]);
  const [participantsStatusOrder, setParticipantsStatusOrder] = useState('submitted_first');
  const [participantsKeywordInput, setParticipantsKeywordInput] = useState('');
  const [participantsKeyword, setParticipantsKeyword] = useState('');
  const [participantsPage, setParticipantsPage] = useState(1);
  const [participantsHasNext, setParticipantsHasNext] = useState(false);
  const [participantsTotalPages, setParticipantsTotalPages] = useState(1);
  const [participantsExporting, setParticipantsExporting] = useState(false);
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeSubmitting, setJudgeSubmitting] = useState(false);
  const [judgeTarget, setJudgeTarget] = useState(null);
  const [judgeRows, setJudgeRows] = useState([]);
  const [judgeKeywordInput, setJudgeKeywordInput] = useState('');
  const [judgeKeyword, setJudgeKeyword] = useState('');
  const [judgeStatus, setJudgeStatus] = useState('all');
  const [judgePage, setJudgePage] = useState(1);
  const [judgeHasNext, setJudgeHasNext] = useState(false);
  const [judgeTotalPages, setJudgeTotalPages] = useState(1);
  const [judgeAccount, setJudgeAccount] = useState('');
  const [judgeAddConfirmOpen, setJudgeAddConfirmOpen] = useState(false);
  const [judgeAddConfirmAccount, setJudgeAddConfirmAccount] = useState('');
  const [myInfoOpen, setMyInfoOpen] = useState(false);
  const [myInfoCompetition, setMyInfoCompetition] = useState(null);
  const latestRequestIdsRef = useRef({
    home: '',
    mine: '',
    myContests: '',
    judgeReviews: '',
    userSync: '',
    detail: '',
    submission: '',
    participants: '',
    judges: '',
  });
  const autoOpenedDetailRef = useRef('');
  const detailRegistered = useMemo(() => {
    const id = Number(detailData?.id);
    if (Number.isNaN(id)) return false;
    return registeredCompetitionIds.includes(id) && Boolean(myParticipantMap[id]);
  }, [detailData?.id, registeredCompetitionIds, myParticipantMap]);
  const detailCurrentParticipants = useMemo(() => {
    const n = Number(detailData?.current_participants);
    if (Number.isNaN(n) || n < 0) return 0;
    return n;
  }, [detailData?.current_participants]);
  const detailMaxParticipants = useMemo(() => {
    const n = Number(detailData?.max_participants);
    if (Number.isNaN(n) || n <= 0) return 0;
    return n;
  }, [detailData?.max_participants]);
  const detailRegistrationFull = useMemo(() => {
    const byFlag = detailData?.registration_is_full === true || Number(detailData?.registration_is_full) === 1;
    if (byFlag) return true;
    if (detailMaxParticipants <= 0) return false;
    return detailCurrentParticipants >= detailMaxParticipants;
  }, [detailData?.registration_is_full, detailCurrentParticipants, detailMaxParticipants]);
  const detailParticipantCountText = useMemo(() => {
    if (detailMaxParticipants > 0) return `${detailCurrentParticipants}/${detailMaxParticipants}`;
    return `${detailCurrentParticipants}`;
  }, [detailCurrentParticipants, detailMaxParticipants]);
  const submissionMaxModifications = Math.max(0, Number(submissionTarget?.max_modifications ?? detailData?.max_modifications ?? 0) || 0);
  const submissionUsedModifications = Math.max(0, Number(submissionExisting?.modification_count || 0) || 0);
  const submissionRemainingModifications = Math.max(0, submissionMaxModifications - submissionUsedModifications);
  const submissionAttachmentMode = normalizeAttachmentMode(submissionTarget?.attachment_mode);
  const submissionAllowedFormats = useMemo(
    () => normalizeAllowedFormats(submissionTarget?.allowed_formats),
    [submissionTarget?.allowed_formats]
  );
  const submissionRequiredFormats = useMemo(
    () => (submissionAttachmentMode === 'multiple' ? submissionAllowedFormats : []),
    [submissionAttachmentMode, submissionAllowedFormats]
  );
  const submissionPrimaryFormat = useMemo(() => {
    if (submissionAttachmentMode !== 'multiple') return '';
    if (submissionRequiredFormats.includes('pdf')) return 'pdf';
    return submissionRequiredFormats[0] || '';
  }, [submissionAttachmentMode, submissionRequiredFormats]);
  const submissionPrimaryFile = useMemo(() => {
    if (submissionAttachmentMode !== 'multiple') return submissionFile;
    return submissionPrimaryFormat ? (submissionFilesByFormat[submissionPrimaryFormat] || null) : null;
  }, [submissionAttachmentMode, submissionPrimaryFormat, submissionFilesByFormat, submissionFile]);
  const submissionAttachmentName = submissionPrimaryFile?.name || submissionAttachment?.attachment_name || '';
  const submissionAttachmentSizeText = submissionPrimaryFile
    ? `${(submissionPrimaryFile.size / 1024 / 1024).toFixed(2)}MB`
    : '';
  const hasSubmissionAttachment = Boolean(submissionPrimaryFile || submissionAttachment);
  const submissionAttachmentMenuOpen = Boolean(submissionAttachmentMenuAnchor);
  const submissionExistingAttachmentMap = useMemo(() => {
    const map = {};
    const push = (raw) => {
      const normalized = normalizeAttachmentMeta(raw);
      if (!normalized) return;
      const ext = canonicalFormatToken(normalized.attachment_ext || extractFileExt(normalized.attachment_name || ''));
      if (!ext || map[ext]) return;
      if (submissionClearedFormats[ext]) return;
      map[ext] = normalized;
    };
    const extraList = submissionExisting?.extra_meta?.attachments;
    if (Array.isArray(extraList)) extraList.forEach((item) => push(item));
    push(submissionExisting);
    return map;
  }, [submissionExisting, submissionClearedFormats]);
  const detailSubmittedInfo = useMemo(() => {
    const competitionId = Number(detailData?.id);
    if (Number.isNaN(competitionId)) return null;
    return submittedCompetitionMap[competitionId] || null;
  }, [detailData?.id, submittedCompetitionMap]);
  const userSyncCurrentPageIds = useMemo(
    () => userSyncRows
      .map((row) => Number(row?.contest_user_id))
      .filter((id) => !Number.isNaN(id) && id > 0),
    [userSyncRows]
  );
  const userSyncSelectedIdSet = useMemo(
    () => new Set(userSyncSelectedIds),
    [userSyncSelectedIds]
  );
  const userSyncAllCurrentSelected = useMemo(
    () => userSyncCurrentPageIds.length > 0 && userSyncCurrentPageIds.every((id) => userSyncSelectedIdSet.has(id)),
    [userSyncCurrentPageIds, userSyncSelectedIdSet]
  );
  const userSyncCurrentIndeterminate = useMemo(() => {
    if (!userSyncCurrentPageIds.length) return false;
    const selectedCount = userSyncCurrentPageIds.filter((id) => userSyncSelectedIdSet.has(id)).length;
    return selectedCount > 0 && selectedCount < userSyncCurrentPageIds.length;
  }, [userSyncCurrentPageIds, userSyncSelectedIdSet]);
  const myInfoData = useMemo(() => {
    const competitionId = Number(myInfoCompetition?.id || myInfoCompetition?.competition_id);
    if (Number.isNaN(competitionId)) return null;
    return myParticipantMap[competitionId] || null;
  }, [myInfoCompetition, myParticipantMap]);
  const profileStatus = useMemo(
    () => normalizeStudyStatus(profileForm?.study_status, profileForm),
    [profileForm]
  );
  const profileInSchool = profileStatus === 'in_school';
  const profileGradeOptions = useMemo(() => {
    const current = String(profileForm?.grade || '').trim();
    if (!current || GRADE_OPTIONS.includes(current)) return GRADE_OPTIONS;
    return [...GRADE_OPTIONS, current];
  }, [profileForm?.grade]);
  const participantsRowsDisplay = useMemo(() => participantsRows, [participantsRows]);
  const participantsDisplayFieldFlags = useMemo(() => {
    let showInSchoolFields = false;
    let showOccupation = false;
    participantsRowsDisplay.forEach((item) => {
      const status = normalizeStudyStatus(item?.study_status, item);
      if (status === 'in_school') showInSchoolFields = true;
      else showOccupation = true;
    });
    return { showInSchoolFields, showOccupation };
  }, [participantsRowsDisplay]);
  const homeRowsDisplay = useMemo(() => {
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    return [...homeRows]
      .filter((row) => {
        const s = statusOf(row);
        if (s.key === 'draft') return false;
        if (s.key !== 'ended') return true;
        const reviewEndMs = row?.review_end ? new Date(row.review_end).getTime() : NaN;
        if (Number.isNaN(reviewEndMs)) return true;
        return now - reviewEndMs <= oneWeekMs;
      })
      .sort((a, b) => {
        const sa = statusOf(a);
        const sb = statusOf(b);
        const delta = statusOrderKey(sa.key) - statusOrderKey(sb.key);
        if (delta !== 0) return delta;
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
  }, [homeRows]);
  const mineRowsDisplay = useMemo(() => {
    return [...mineRows]
      .filter((row) => statusOf(row).key !== 'draft')
      .sort((a, b) => {
      const sa = statusOf(a);
      const sb = statusOf(b);
      const delta = statusOrderKey(sa.key) - statusOrderKey(sb.key);
      if (delta !== 0) return delta;
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [mineRows]);
  const myContestRowsDisplay = useMemo(() => {
    return [...myContestRows]
      .filter((row) => statusOf(row).key !== 'draft')
      .sort((a, b) => {
      const sa = statusOf(a);
      const sb = statusOf(b);
      const delta = statusOrderKey(sa.key) - statusOrderKey(sb.key);
      if (delta !== 0) return delta;
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [myContestRows]);

  const navItems = useMemo(() => {
    if (!user) return BASE_NAV_ITEMS.filter((item) => item.key === 'home');
    const keepCreatorTabsWhileLoading =
      !createPermissionLoaded &&
      (routeTab === 'create' || routeTab === 'mine' || tab === 'create' || tab === 'mine');
    const canAccessCreatorTabs = canCreateCompetition || keepCreatorTabsWhileLoading;
    const visibleBaseNavItems = canAccessCreatorTabs
      ? BASE_NAV_ITEMS
      : BASE_NAV_ITEMS.filter((item) => item.key !== 'create' && item.key !== 'mine');

    if (!canReviewUserSync) {
      if (!userSyncPermissionLoaded && routeTab === 'user_sync_review') {
        return [
          ...visibleBaseNavItems.filter((item) => item.key !== 'profile'),
          USER_SYNC_REVIEW_NAV_ITEM,
          ...visibleBaseNavItems.filter((item) => item.key === 'profile'),
        ];
      }
      return visibleBaseNavItems;
    }
    return [
      ...visibleBaseNavItems.filter((item) => item.key !== 'profile'),
      USER_SYNC_REVIEW_NAV_ITEM,
      ...visibleBaseNavItems.filter((item) => item.key === 'profile'),
    ];
  }, [user, canCreateCompetition, createPermissionLoaded, tab, canReviewUserSync, userSyncPermissionLoaded, routeTab]);
  const title = useMemo(() => navItems.find((i) => i.key === tab)?.label || '首页', [navItems, tab]);
  const switchTab = (nextTab, syncRoute = true) => {
    if (!nextTab || nextTab === tab) return;
    setTab(nextTab);
    if (syncRoute && typeof onRouteChange === 'function' && nextTab !== routeTab) {
      onRouteChange(nextTab);
    }
  };
  const handleLogout = () => {
    if (!user) {
      if (typeof onGoLogin === 'function') onGoLogin();
      return;
    }
    try {
      localStorage.removeItem(DASHBOARD_VIEW_STATE_STORAGE_KEY);
    } catch {
      // 忽略本地缓存清理异常，继续退出流程
    }
    if (typeof onLogout === 'function') onLogout();
  };
  const currentTabLoading =
    (tab === 'home' && homeLoading) ||
    (tab === 'mine' && mineLoading) ||
    (tab === 'my_contests' && myContestsLoading) ||
    (tab === 'judge_reviews' && judgeReviewsLoading) ||
    (tab === 'user_sync_review' && userSyncLoading);

  const buildCompetitionPath = (competitionId, mode = 'detail') => {
    const id = Number(competitionId);
    if (Number.isNaN(id) || id <= 0) return '';
    const base = String(competitionPathPrefix || '/competitions').replace(/\/+$/, '') || '/competitions';
    const registerSuffix = String(competitionRegisterSuffix || '/register').trim() || '/register';
    const suffixWithSlash = registerSuffix.startsWith('/') ? registerSuffix : `/${registerSuffix}`;
    return mode === 'register'
      ? `${base}/${id}${suffixWithSlash}`
      : `${base}/${id}`;
  };
  const buildCompetitionShareUrl = (competitionId, mode = 'detail') => {
    const path = buildCompetitionPath(competitionId, mode);
    if (!path) return '';
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return path;
    }
  };

  const loadHome = async (keyword = homeKeyword, page = homePage) => {
    const requestId = createRequestId();
    latestRequestIdsRef.current.home = requestId;
    setHomeLoading(true);
    try {
      const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
      const { items, total, requestId: echoedRequestId } = await listCompetitionsPaged(PAGE_SIZE, offset, keyword, {
        fields: 'summary',
        requestId,
      });
      if (latestRequestIdsRef.current.home !== echoedRequestId) return;
      const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
      setHomeTotalPages(totalPages);
      setHomeHasNext(page < totalPages);
      setHomeRows(items);
    } catch (error) {
      if (latestRequestIdsRef.current.home !== requestId) return;
      setHomeHasNext(false);
      setHomeTotalPages(1);
      setMessage({ type: 'error', text: getErrorText(error, '加载首页比赛失败') });
    } finally {
      if (latestRequestIdsRef.current.home === requestId) setHomeLoading(false);
    }
  };

  const loadMine = async (keyword = mineKeyword, page = minePage) => {
    const requestId = createRequestId();
    latestRequestIdsRef.current.mine = requestId;
    setMineLoading(true);
    try {
      const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
      const { items, total, requestId: echoedRequestId } = await listMyCompetitionsPaged(PAGE_SIZE, offset, keyword, {
        fields: 'summary',
        requestId,
      });
      if (latestRequestIdsRef.current.mine !== echoedRequestId) return;
      const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
      setMineTotalPages(totalPages);
      setMineHasNext(page < totalPages);
      setMineRows(items);
    } catch (error) {
      if (latestRequestIdsRef.current.mine !== requestId) return;
      setMineHasNext(false);
      setMineTotalPages(1);
      setMessage({ type: 'error', text: getErrorText(error, '加载我创办的比赛失败') });
    } finally {
      if (latestRequestIdsRef.current.mine === requestId) setMineLoading(false);
    }
  };

  const loadMyContests = async (keyword = myContestKeyword, page = myContestPage) => {
    const requestId = createRequestId();
    latestRequestIdsRef.current.myContests = requestId;
    setMyContestsLoading(true);
    try {
      const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
      const { items, total, requestId: echoedRequestId } = await listMyRegisteredCompetitionsPaged(PAGE_SIZE, offset, keyword, {
        fields: 'summary',
        requestId,
      });
      if (latestRequestIdsRef.current.myContests !== echoedRequestId) return;
      const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
      setMyContestTotalPages(totalPages);
      setMyContestHasNext(page < totalPages);
      setMyContestRows(items);
    } catch (error) {
      if (latestRequestIdsRef.current.myContests !== requestId) return;
      setMyContestHasNext(false);
      setMyContestTotalPages(1);
      setMessage({ type: 'error', text: getErrorText(error, '加载我的比赛失败') });
    } finally {
      if (latestRequestIdsRef.current.myContests === requestId) setMyContestsLoading(false);
    }
  };

  const loadJudgeReviews = async (keyword = judgeReviewsKeyword, page = judgeReviewsPage) => {
    const requestId = createRequestId();
    latestRequestIdsRef.current.judgeReviews = requestId;
    setJudgeReviewsLoading(true);
    try {
      const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
      const { items, total, requestId: echoedRequestId } = await listMyJudgeCompetitionsPaged(
        PAGE_SIZE,
        offset,
        keyword,
        { requestId }
      );
      if (latestRequestIdsRef.current.judgeReviews !== echoedRequestId) return;
      const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
      setJudgeReviewsTotalPages(totalPages);
      setJudgeReviewsHasNext(page < totalPages);
      setJudgeCompetitionRows(items);
    } catch (error) {
      if (latestRequestIdsRef.current.judgeReviews !== requestId) return;
      setJudgeReviewsHasNext(false);
      setJudgeReviewsTotalPages(1);
      setMessage({ type: 'error', text: getErrorText(error, '加载我评审的比赛失败') });
    } finally {
      if (latestRequestIdsRef.current.judgeReviews === requestId) setJudgeReviewsLoading(false);
    }
  };

  const loadRegisteredStatus = async () => {
    try {
      const participantRows = await listParticipants();
      const participantMap = {};
      const serverIds = participantRows
        .map((item) => {
          const competitionId = Number(item?.competition_id);
          if (Number.isNaN(competitionId)) return NaN;
          participantMap[competitionId] = item;
          return competitionId;
        })
        .filter((id) => !Number.isNaN(id));
      setMyParticipantMap(participantMap);
      setRegisteredCompetitionIds(normalizeCompetitionIds(serverIds));
    } catch {
      // 保留上一次成功状态，避免请求偶发失败时把“已报名”错误回退成“未报名”。
    }
  };

  const loadCreatePermission = async () => {
    setCreatePermissionLoaded(false);
    try {
      const canCreate = await getCreatePermission();
      setCanCreateCompetition(canCreate);
    } catch {
      setCanCreateCompetition(false);
    } finally {
      setCreatePermissionLoaded(true);
    }
  };

  const loadUserSyncReviewPermission = async () => {
    if (!user) {
      setCanReviewUserSync(false);
      setUserSyncPermissionLoaded(false);
      return;
    }
    try {
      const canReview = await getUserSyncReviewPermission({ requestId: createRequestId() });
      setCanReviewUserSync(Boolean(canReview));
    } catch {
      setCanReviewUserSync(false);
    } finally {
      setUserSyncPermissionLoaded(true);
    }
  };

  const loadUserSyncReviews = async (
    keyword = userSyncKeyword,
    page = userSyncPage,
    status = userSyncStatus,
  ) => {
    if (!canReviewUserSync) {
      setUserSyncRows([]);
      setUserSyncHasNext(false);
      setUserSyncTotalPages(1);
      return;
    }
    const requestId = createRequestId();
    latestRequestIdsRef.current.userSync = requestId;
    setUserSyncLoading(true);
    try {
      const offset = (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE;
      const { items, total, requestId: echoedRequestId } = await listUserSyncReviewsPaged(PAGE_SIZE, offset, keyword, {
        status,
        requestId,
      });
      if (latestRequestIdsRef.current.userSync !== echoedRequestId) return;
      const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
      setUserSyncRows(Array.isArray(items) ? items : []);
      setUserSyncTotalPages(totalPages);
      setUserSyncHasNext(page < totalPages);
    } catch (error) {
      if (latestRequestIdsRef.current.userSync !== requestId) return;
      setUserSyncRows([]);
      setUserSyncHasNext(false);
      setUserSyncTotalPages(1);
      setMessage({ type: 'error', text: getErrorText(error, '加载用户同步审核列表失败') });
    } finally {
      if (latestRequestIdsRef.current.userSync === requestId) setUserSyncLoading(false);
    }
  };

  const openUserSyncReview = (row) => {
    if (!row?.contest_user_id) return;
    setUserSyncReviewTarget(row);
    setUserSyncReviewOpen(true);
  };

  const closeUserSyncReview = () => {
    setUserSyncReviewOpen(false);
    setUserSyncReviewTarget(null);
  };

  const toggleUserSyncRowSelection = (contestUserId, checked) => {
    const targetId = Number(contestUserId);
    if (Number.isNaN(targetId) || targetId <= 0) return;
    setUserSyncSelectedIds((prev) => {
      const exists = prev.includes(targetId);
      if (checked && !exists) return [...prev, targetId];
      if (!checked && exists) return prev.filter((id) => id !== targetId);
      return prev;
    });
  };

  const toggleUserSyncSelectCurrentPage = (checked) => {
    const visibleIds = userSyncCurrentPageIds;
    if (!visibleIds.length) return;
    setUserSyncSelectedIds((prev) => {
      if (checked) {
        return [...new Set([...prev, ...visibleIds])];
      }
      const visibleSet = new Set(visibleIds);
      return prev.filter((id) => !visibleSet.has(id));
    });
  };

  const clearUserSyncSelection = () => {
    setUserSyncSelectedIds([]);
  };

  const openUserSyncDecisionDialog = (action = 'approve') => {
    const normalizedAction = String(action || '').trim().toLowerCase() === 'reject' ? 'reject' : 'approve';
    setUserSyncDecisionAction(normalizedAction);
    setUserSyncDecisionConfirmText('');
    setUserSyncDecisionReason('');
    setUserSyncDecisionOpen(true);
  };

  const closeUserSyncDecisionDialog = () => {
    if (userSyncDecisionLoading) return;
    setUserSyncDecisionOpen(false);
    setUserSyncDecisionConfirmText('');
    setUserSyncDecisionReason('');
  };

  const openUserSyncBatchDecisionDialog = (action = 'approve') => {
    if (!userSyncSelectedIds.length) {
      setMessage({ type: 'warning', text: '请先勾选要审核的用户' });
      return;
    }
    const normalizedAction = String(action || '').trim().toLowerCase() === 'reject' ? 'reject' : 'approve';
    setUserSyncBatchAction(normalizedAction);
    setUserSyncBatchConfirmText('');
    setUserSyncBatchReason('');
    setUserSyncBatchDecisionOpen(true);
  };

  const closeUserSyncBatchDecisionDialog = () => {
    if (userSyncBatchDecisionLoading) return;
    setUserSyncBatchDecisionOpen(false);
    setUserSyncBatchConfirmText('');
    setUserSyncBatchReason('');
  };

  const submitUserSyncDecision = async () => {
    const contestUserId = Number(userSyncReviewTarget?.contest_user_id);
    if (Number.isNaN(contestUserId) || contestUserId <= 0) return;
    const action = userSyncDecisionAction === 'reject' ? 'reject' : 'approve';
    const requiredText = USER_SYNC_REVIEW_CONFIRM_TEXT[action];
    const confirmText = String(userSyncDecisionConfirmText || '').trim();
    if (confirmText !== requiredText) {
      setMessage({ type: 'warning', text: `请输入“${requiredText}”后再提交` });
      return;
    }

    setUserSyncDecisionLoading(true);
    try {
      await decideUserSyncReview(
        contestUserId,
        {
          action,
          confirm: true,
          confirm_text: confirmText,
          reason: String(userSyncDecisionReason || '').trim(),
        },
        { requestId: createRequestId() },
      );
      setMessage({ type: 'success', text: `审核成功：已${userSyncReviewActionText(action)}` });
      setUserSyncSelectedIds((prev) => prev.filter((id) => id !== contestUserId));
      setUserSyncDecisionOpen(false);
      closeUserSyncReview();
      await loadUserSyncReviews(userSyncKeyword, userSyncPage, userSyncStatus);
    } catch (error) {
      const errorStatus = Number(error?.response?.status || 0);
      const errorText = getErrorText(error, '审核失败');
      const isConflict = errorStatus === 409 && errorText.includes('同步冲突');
      if (isConflict) {
        setUserSyncDecisionOpen(false);
        setUserSyncDecisionConfirmText('');
        setUserSyncDecisionReason('');
        setUserSyncReviewTarget((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            review_status: 'conflict',
            latest_review: {
              ...(prev.latest_review || {}),
              action: 'approve',
              result_status: 'conflict',
              reason: '同步冲突：手机号/邮箱在 users 表中存在冲突，请人工处理',
              created_at: new Date().toISOString(),
            },
          };
        });
        await loadUserSyncReviews(userSyncKeyword, userSyncPage, userSyncStatus);
      }
      setMessage({ type: 'error', text: getErrorText(error, '审核失败') });
    } finally {
      setUserSyncDecisionLoading(false);
    }
  };

  const submitUserSyncBatchDecision = async () => {
    const ids = [...new Set(userSyncSelectedIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0))];
    if (!ids.length) {
      setMessage({ type: 'warning', text: '请先勾选要审核的用户' });
      return;
    }
    const action = userSyncBatchAction === 'reject' ? 'reject' : 'approve';
    const requiredText = USER_SYNC_REVIEW_CONFIRM_TEXT[action];
    const confirmText = String(userSyncBatchConfirmText || '').trim();
    if (confirmText !== requiredText) {
      setMessage({ type: 'warning', text: `请输入“${requiredText}”后再提交` });
      return;
    }

    setUserSyncBatchDecisionLoading(true);
    try {
      const { data } = await batchDecideUserSyncReview(
        {
          contest_user_ids: ids,
          action,
          confirm: true,
          confirm_text: confirmText,
          reason: String(userSyncBatchReason || '').trim(),
        },
        { requestId: createRequestId() },
      );
      const summary = data?.summary || {};
      const total = Number(summary.total || ids.length);
      const success = Number(summary.success || 0);
      const failed = Number(summary.failed || 0);
      const conflict = Number(summary.conflict || 0);
      const idempotent = Number(summary.idempotent || 0);
      const detailText = `总数 ${total}，成功 ${success}，失败 ${failed}${conflict > 0 ? `，冲突 ${conflict}` : ''}${idempotent > 0 ? `，幂等 ${idempotent}` : ''}`;
      setMessage({ type: failed > 0 ? 'warning' : 'success', text: `批量审核完成：${detailText}` });
      setUserSyncBatchDecisionOpen(false);
      setUserSyncSelectedIds([]);
      const reviewTargetId = Number(userSyncReviewTarget?.contest_user_id || 0);
      if (reviewTargetId > 0 && ids.includes(reviewTargetId)) {
        closeUserSyncReview();
      }
      await loadUserSyncReviews(userSyncKeyword, userSyncPage, userSyncStatus);
    } catch (error) {
      setMessage({ type: 'error', text: getErrorText(error, '批量审核失败') });
    } finally {
      setUserSyncBatchDecisionLoading(false);
    }
  };

  const searchUserSyncReviews = async () => {
    const keyword = String(userSyncKeywordInput || '').trim();
    setUserSyncSelectedIds([]);
    setUserSyncKeyword(keyword);
    setUserSyncPage(1);
    await loadUserSyncReviews(keyword, 1, userSyncStatus);
  };

  const clearUserSyncReviewsSearch = async () => {
    setUserSyncSelectedIds([]);
    setUserSyncKeywordInput('');
    setUserSyncKeyword('');
    setUserSyncPage(1);
    await loadUserSyncReviews('', 1, userSyncStatus);
  };

  const changeUserSyncStatus = async (nextStatus) => {
    const status = String(nextStatus || 'pending').trim().toLowerCase();
    setUserSyncSelectedIds([]);
    setUserSyncStatus(status);
    setUserSyncPage(1);
    await loadUserSyncReviews(userSyncKeyword, 1, status);
  };

  const changeUserSyncPage = async (nextPage) => {
    const safePage = Math.max(1, Number(nextPage) || 1);
    setUserSyncSelectedIds([]);
    setUserSyncPage(safePage);
    await loadUserSyncReviews(userSyncKeyword, safePage, userSyncStatus);
  };

  const loadSubmissionStatus = async () => {
    const nextMap = {};
    let offset = 0;
    const limit = 50;
    let total = 0;
    let pageCount = 0;
    try {
      while (pageCount < 20) {
        const { items, total: currentTotal } = await listMySubmissionsPaged(limit, offset, '', {
          fields: 'summary',
          requestId: createRequestId(),
        });
        const rows = Array.isArray(items) ? items : [];
        rows.forEach((item) => {
          const competitionId = Number(item?.competition_id);
          if (Number.isNaN(competitionId)) return;
          nextMap[competitionId] = {
            submission_id: item?.id,
            submit_version: Number(item?.submit_version || 1),
            last_submitted_at: item?.last_submitted_at || item?.updated_at || null,
          };
        });
        total = Number(currentTotal || 0);
        offset += rows.length;
        pageCount += 1;
        if (!rows.length || offset >= total) break;
      }
      setSubmittedCompetitionMap(nextMap);
    } catch {
      setSubmittedCompetitionMap({});
    }
  };

  const startEditProfile = () => {
    setProfileForm(buildProfileFormFromUser(profileData || user));
    setProfileErrors({});
    setProfileEditing(true);
  };

  const cancelEditProfile = () => {
    setProfileForm(buildProfileFormFromUser(profileData || user));
    setProfileErrors({});
    setProfileEditing(false);
  };

  const submitProfileUpdate = async () => {
    const errors = validateProfileForm(profileForm);
    setProfileErrors(errors);
    if (Object.keys(errors).length) return;

    const status = normalizeStudyStatus(profileForm?.study_status, profileForm);
    const payload = {
      study_status: status,
      school: status === 'in_school' ? String(profileForm.school || '').trim() : '',
      major: status === 'in_school' ? String(profileForm.major || '').trim() : '',
      grade: status === 'in_school' ? String(profileForm.grade || '').trim() : '',
      occupation: status === 'in_school' ? '' : String(profileForm.occupation || '').trim(),
      bio: String(profileForm.bio || '').trim(),
    };

    setProfileSaving(true);
    try {
      const { data } = await updateCurrentUserProfile(payload, { requestId: createRequestId() });
      const nextUser = data || { ...(profileData || user || {}), ...payload };
      setProfileData(nextUser);
      setProfileForm(buildProfileFormFromUser(nextUser));
      setProfileErrors({});
      setProfileEditing(false);
      await loadRegisteredStatus();
      setMessage({ type: 'success', text: '个人信息更新成功' });
    } catch (error) {
      setMessage({ type: 'error', text: getErrorText(error, '个人信息更新失败') });
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    if (tab === 'home') loadHome(homeKeyword, homePage);
    if (!user) return;
    if (tab === 'my_contests') loadMyContests(myContestKeyword, myContestPage);
    if (tab === 'judge_reviews') loadJudgeReviews(judgeReviewsKeyword, judgeReviewsPage);
    if (tab === 'mine' && canCreateCompetition) loadMine(mineKeyword, minePage);
    if (tab === 'user_sync_review') loadUserSyncReviews(userSyncKeyword, userSyncPage, userSyncStatus);
  }, [
    tab,
    homeKeyword,
    homePage,
    mineKeyword,
    minePage,
    myContestKeyword,
    myContestPage,
    judgeReviewsKeyword,
    judgeReviewsPage,
    userSyncKeyword,
    userSyncPage,
    userSyncStatus,
    canCreateCompetition,
    canReviewUserSync,
    user?.email,
  ]);

  useEffect(() => {
    if (navItems.some((item) => item.key === tab)) return;
    setTab('home');
    if (routeTab !== 'home' && typeof onRouteChange === 'function') {
      onRouteChange('home');
    }
  }, [navItems, onRouteChange, routeTab, tab]);

  useEffect(() => {
    if (!routeTab || !navItems.some((item) => item.key === routeTab)) return;
    if (routeTab === tab) return;
    setTab(routeTab);
  }, [routeTab, navItems, tab]);

  useEffect(() => {
    const competitionId = Number(autoOpenCompetitionId || 0);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    if (!user?.email) return;
    const marker = `${String(user.email).toLowerCase()}#${competitionId}`;
    if (autoOpenedDetailRef.current === marker) return;
    autoOpenedDetailRef.current = marker;
    openDetailById(competitionId, false, null);
    if (typeof onAutoOpenCompetitionHandled === 'function') {
      onAutoOpenCompetitionHandled();
    }
  }, [autoOpenCompetitionId, onAutoOpenCompetitionHandled, user?.email]);

  useEffect(() => {
    const nextUser = user || null;
    setProfileData(nextUser);
    setProfileForm(buildProfileFormFromUser(nextUser));
    setProfileErrors({});
    setProfileEditing(false);
  }, [user?.email]);

  useEffect(() => {
    setMyParticipantMap({});
    setRegisteredCompetitionIds([]);
    setSubmittedCompetitionMap({});
  }, [user?.email]);

  useEffect(() => {
    if (!user) {
      setMyParticipantMap({});
      setRegisteredCompetitionIds([]);
      return;
    }
    loadRegisteredStatus();
  }, [user?.email]);

  useEffect(() => {
    if (!user) {
      setCanCreateCompetition(false);
      setCreatePermissionLoaded(false);
      return;
    }
    loadCreatePermission();
  }, [user?.email]);

  useEffect(() => {
    if (!user) {
      setCanReviewUserSync(false);
      setUserSyncPermissionLoaded(false);
      setUserSyncRows([]);
      setUserSyncHasNext(false);
      setUserSyncTotalPages(1);
      setUserSyncReviewOpen(false);
      setUserSyncReviewTarget(null);
      setUserSyncDecisionOpen(false);
      setUserSyncSelectedIds([]);
      setUserSyncBatchDecisionOpen(false);
      return;
    }
    loadUserSyncReviewPermission();
  }, [user?.email]);

  useEffect(() => {
    if (!userSyncRows.length) {
      setUserSyncSelectedIds((prev) => (prev.length ? [] : prev));
      return;
    }
    const visibleSet = new Set(
      userSyncRows
        .map((row) => Number(row?.contest_user_id))
        .filter((id) => !Number.isNaN(id) && id > 0)
    );
    setUserSyncSelectedIds((prev) => {
      const next = prev.filter((id) => visibleSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [userSyncRows]);

  useEffect(() => {
    if (!user) {
      setSubmittedCompetitionMap({});
      return;
    }
    loadSubmissionStatus();
  }, [user?.email]);

  useEffect(() => {
    if (homePage > homeTotalPages) setHomePage(homeTotalPages);
  }, [homePage, homeTotalPages]);

  useEffect(() => {
    if (minePage > mineTotalPages) setMinePage(mineTotalPages);
  }, [minePage, mineTotalPages]);

  useEffect(() => {
    if (myContestPage > myContestTotalPages) setMyContestPage(myContestTotalPages);
  }, [myContestPage, myContestTotalPages]);

  useEffect(() => {
    if (judgeReviewsPage > judgeReviewsTotalPages) setJudgeReviewsPage(judgeReviewsTotalPages);
  }, [judgeReviewsPage, judgeReviewsTotalPages]);

  useEffect(() => {
    if (userSyncPage > userSyncTotalPages) setUserSyncPage(userSyncTotalPages);
  }, [userSyncPage, userSyncTotalPages]);

  useEffect(() => {
    localStorage.setItem(
      DASHBOARD_VIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        userEmail: String(user?.email || ''),
        tab,
        homeKeywordInput,
        homeKeyword,
        homePage,
        mineKeywordInput,
        mineKeyword,
        minePage,
        userSyncKeywordInput,
        userSyncKeyword,
        userSyncStatus,
        userSyncPage,
        myContestKeywordInput,
        myContestKeyword,
        myContestPage,
        judgeReviewsKeywordInput,
        judgeReviewsKeyword,
        judgeReviewsPage,
        editOpen,
        editTarget,
        editForm,
        detailOpen,
        detailData,
        detailFromMine,
        deleteOpen,
        deleteTarget,
        deleteEmail,
        quitOpen,
        quitTarget,
        submissionOpen,
        submissionTarget,
        submissionMode,
        submissionForm,
        submissionAttachment,
        submissionExisting,
      })
    );
  }, [
    user?.email,
    tab,
    homeKeywordInput,
    homeKeyword,
    homePage,
    mineKeywordInput,
    mineKeyword,
    minePage,
    userSyncKeywordInput,
    userSyncKeyword,
    userSyncStatus,
    userSyncPage,
    myContestKeywordInput,
    myContestKeyword,
    myContestPage,
    judgeReviewsKeywordInput,
    judgeReviewsKeyword,
    judgeReviewsPage,
    editOpen,
    editTarget,
    editForm,
    detailOpen,
    detailData,
    detailFromMine,
    deleteOpen,
    deleteTarget,
    deleteEmail,
    quitOpen,
    quitTarget,
    submissionOpen,
    submissionTarget,
    submissionMode,
    submissionForm,
    submissionAttachment,
    submissionExisting,
  ]);

  const submitCreate = async () => {
    if (!canCreateCompetition) {
      setMessage({ type: 'error', text: '权限不足，仅管理员可创办比赛' });
      return;
    }
    const errs = validateForm(createForm);
    setCreateErrors(errs);
    if (Object.keys(errs).length) return;
    setActionLoading(true);
    try {
      await createCompetition(buildPayload(createForm));
      trackAction('competition_create_success', { user: user?.email, name: createForm.name });
      setCreateForm(EMPTY_FORM);
      setCreateErrors({});
      setMessage({ type: 'success', text: '创办成功，已显示到首页' });
      switchTab('home', true);
      setHomePage(1);
      await loadHome(homeKeyword, 1);
    } catch (error) {
      trackAction('competition_create_failed', { user: user?.email, reason: getErrorText(error, '创办失败') });
      setMessage({ type: 'error', text: getErrorText(error, '创办失败') });
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = async (row) => {
    const targetId = Number(row?.id);
    if (Number.isNaN(targetId) || targetId <= 0) return;

    let source = row || {};
    try {
      const requestId = createRequestId();
      const { data: detail, requestId: echoedRequestId } = await getCompetitionById(targetId, { requestId });
      if (requestId === echoedRequestId && detail) {
        source = detail;
      }
    } catch (error) {
      setMessage({ type: 'error', text: getErrorText(error, '加载比赛详情失败，无法进入修改') });
      return;
    }

    setEditTarget(source);
    setEditErrors({});
    setEditForm({
      ...EMPTY_FORM,
      ...source,
      description: source.description || '',
      registration_start: toInputDateTime(source.registration_start),
      registration_end: toInputDateTime(source.registration_end),
      submission_start: toInputDateTime(source.submission_start),
      submission_end: toInputDateTime(source.submission_end),
      review_start: toInputDateTime(source.review_start),
      review_end: toInputDateTime(source.review_end),
      participant_limit_mode: normalizeParticipantLimitMode(source.participant_limit_mode),
      school: '',
      major: '',
      grade: '',
      registration_code_required: registrationCodeRequired(source),
      allowed_formats: normalizeAllowedFormats(source.allowed_formats),
      attachment_mode: normalizeAttachmentMode(source.attachment_mode),
    });
    setEditOpen(true);
  };

  const openDetailById = async (competitionId, fromMine = false, fallbackRow = null) => {
    const targetId = Number(competitionId);
    if (Number.isNaN(targetId) || targetId <= 0) return;
    const requestId = createRequestId();
    latestRequestIdsRef.current.detail = requestId;
    setDetailData(fallbackRow || { id: targetId });
    setDetailFromMine(fromMine);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const { data: detail, requestId: echoedRequestId } = await getCompetitionById(targetId, { requestId });
      if (latestRequestIdsRef.current.detail !== echoedRequestId) return;
      setDetailData(detail || fallbackRow || { id: targetId });
      trackAction('competition_detail_open', { user: user?.email, id: targetId, fromMine });
    } catch (error) {
      if (latestRequestIdsRef.current.detail !== requestId) return;
      setMessage({ type: 'error', text: getErrorText(error, '加载比赛详情失败') });
    } finally {
      if (latestRequestIdsRef.current.detail === requestId) setDetailLoading(false);
    }
  };
  const openDetail = async (row, fromMine = false) => {
    const targetId = Number(row?.id);
    if (Number.isNaN(targetId) || targetId <= 0) return;
    await openDetailById(targetId, fromMine, row || null);
  };

  const openSubmissionDialog = async (row) => {
    const target = row || detailData;
    const competitionId = Number(target?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    const statusKey = statusOf(target).key;
    if (statusKey !== 'ongoing') {
      setMessage({ type: 'warning', text: '仅比赛进行中可提交作品' });
      return;
    }
    if (!registeredCompetitionIds.includes(competitionId)) {
      setMessage({ type: 'warning', text: '请先报名该比赛，再提交作品' });
      return;
    }

    const requestId = createRequestId();
    latestRequestIdsRef.current.submission = requestId;
    setSubmissionOpen(true);
    setSubmissionTarget(target);
    setSubmissionErrors({});
    setSubmissionFile(null);
    setSubmissionFilesByFormat({});
    setSubmissionClearedFormats({});
    setSubmissionAttachmentMenuAnchor(null);
    setSubmissionAttachmentMenuFormat('');
    setSubmissionProgress({ mode: 'idle', percent: 0 });
    setSubmissionLoading(true);
    try {
      try {
        const { data: latestCompetition, requestId: competitionRequestId } = await getCompetitionById(competitionId, { requestId });
        if (latestRequestIdsRef.current.submission !== competitionRequestId) return;
        if (latestCompetition) setSubmissionTarget(latestCompetition);
      } catch {
        // 详情刷新失败不阻断提交流程，继续使用已有行数据
      }

      const { data, requestId: echoedRequestId } = await getMySubmissionDetail(competitionId, { requestId });
      if (latestRequestIdsRef.current.submission !== echoedRequestId) return;
      setSubmissionMode('resubmit');
      setSubmissionExisting(data || null);
      setSubmissionForm(buildSubmissionFormFromRow(data));
      setSubmissionAttachment(normalizeAttachmentMeta(data));
      setSubmissionClearedFormats({});
      trackAction('submission_detail_loaded', { user: user?.email, competition_id: competitionId, mode: 'resubmit' });
    } catch (error) {
      if (latestRequestIdsRef.current.submission !== requestId) return;
      if (error?.response?.status === 404) {
        setSubmissionMode('create');
        setSubmissionExisting(null);
        setSubmissionForm(EMPTY_SUBMISSION_FORM);
        setSubmissionAttachment(null);
        setSubmissionClearedFormats({});
        trackAction('submission_detail_loaded', { user: user?.email, competition_id: competitionId, mode: 'create' });
      } else {
        setMessage({ type: 'error', text: getErrorText(error, '加载作品提交信息失败') });
      }
    } finally {
      if (latestRequestIdsRef.current.submission === requestId) setSubmissionLoading(false);
    }
  };

  const submitSubmission = async () => {
    const competitionId = Number(submissionTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    if (statusOf(submissionTarget || {}).key !== 'ongoing') {
      setMessage({ type: 'warning', text: '仅比赛进行中可提交作品' });
      return;
    }
    const errors = {};
    const title = String(submissionForm.title || '').trim();
    if (!title) errors.title = '作品标题不能为空';
    const allowedFormats = normalizeAllowedFormats(submissionTarget?.allowed_formats).map((item) => canonicalFormatToken(item));
    const attachmentMode = normalizeAttachmentMode(submissionTarget?.attachment_mode);
    const maxMb = Number(submissionTarget?.max_file_size_mb || 0);
    const maxBytes = !Number.isNaN(maxMb) && maxMb > 0 ? maxMb * 1024 * 1024 : 0;
    if (attachmentMode === 'multiple') {
      const missingFormats = allowedFormats.filter((fmt) => !submissionFilesByFormat[fmt] && !submissionExistingAttachmentMap[fmt]);
      if (missingFormats.length) {
        errors.file = `当前为多附件模式，需补充：${missingFormats.join('、')}`;
      }
      allowedFormats.forEach((fmt) => {
        const file = submissionFilesByFormat[fmt];
        if (!file) return;
        const selectedExt = canonicalFormatToken(extractFileExt(file.name));
        if (!selectedExt) {
          errors.file = `${fmt.toUpperCase()} 附件缺少后缀名，请重新选择`;
          return;
        }
        if (selectedExt !== fmt) {
          errors.file = `${fmt.toUpperCase()} 附件格式不匹配，请上传 .${fmt} 文件`;
          return;
        }
        if (maxBytes > 0 && file.size > maxBytes) {
          errors.file = `${fmt.toUpperCase()} 附件大小超限，最大 ${maxMb}MB`;
        }
      });
    } else {
      if (!submissionFile) errors.file = submissionMode === 'resubmit' ? '请先选择新附件，再执行修改提交' : '请先选择附件后再提交';
      const selectedExt = extractFileExt(submissionFile?.name);
      if (submissionFile && !selectedExt) {
        errors.file = '附件缺少后缀名，请重新选择文件';
      } else if (submissionFile && allowedFormats.length && !allowedFormats.includes(canonicalFormatToken(selectedExt))) {
        errors.file = `附件格式不符合要求，仅支持：${normalizeAllowedFormats(submissionTarget?.allowed_formats).join('、')}`;
      }
      if (submissionFile && maxBytes > 0 && submissionFile.size > maxBytes) {
        errors.file = `附件大小超限，最大 ${maxMb}MB`;
      }
    }

    setSubmissionErrors(errors);
    if (Object.keys(errors).length) return;

    const isCreateMode = submissionMode !== 'resubmit';
    setActionLoading(true);
    setSubmissionProgress({ mode: 'uploading', percent: 0 });
    try {
      let attachmentMeta = null;
      let multiAttachmentMetas = [];
      if (attachmentMode === 'multiple') {
        const attachmentMetaByExt = {};
        for (let index = 0; index < allowedFormats.length; index += 1) {
          const fmt = allowedFormats[index];
          const file = submissionFilesByFormat[fmt];
          if (file) {
            const { data } = await uploadSubmissionAttachment(competitionId, file, {
              requestId: createRequestId(),
              onUploadProgress: (event) => {
                const total = Number(event?.total || 0);
                const loaded = Number(event?.loaded || 0);
                if (total <= 0) return;
                const part = Math.min(1, Math.max(0, loaded / total));
                const percent = Math.min(100, Math.max(0, Math.round(((index + part) / allowedFormats.length) * 100)));
                setSubmissionProgress({ mode: 'uploading', percent });
              },
            });
            const meta = normalizeAttachmentMeta(data);
            if (!meta) throw new Error(`${fmt} 附件上传失败，请重试`);
            const canonicalExt = canonicalFormatToken(meta.attachment_ext || extractFileExt(meta.attachment_name || '')) || fmt;
            attachmentMetaByExt[canonicalExt] = {
              ...meta,
              attachment_ext: canonicalExt,
            };
            continue;
          }

          const existingMeta = normalizeAttachmentMeta(submissionExistingAttachmentMap[fmt]);
          if (!existingMeta) throw new Error(`缺少 ${fmt} 附件`);
          const existingExt = canonicalFormatToken(existingMeta.attachment_ext || extractFileExt(existingMeta.attachment_name || '')) || fmt;
          attachmentMetaByExt[existingExt] = {
            ...existingMeta,
            attachment_ext: existingExt,
          };
        }
        multiAttachmentMetas = allowedFormats.map((fmt) => attachmentMetaByExt[fmt]).filter(Boolean);
        if (multiAttachmentMetas.length !== allowedFormats.length) {
          throw new Error('附件上传不完整，请重新选择后再试');
        }
        attachmentMeta = multiAttachmentMetas.find((meta) => canonicalFormatToken(meta.attachment_ext || '') === 'pdf') || multiAttachmentMetas[0];
      } else {
        const { data } = await uploadSubmissionAttachment(competitionId, submissionFile, {
          requestId: createRequestId(),
          onUploadProgress: (event) => {
            const total = Number(event?.total || 0);
            const loaded = Number(event?.loaded || 0);
            if (total <= 0) return;
            const percent = Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
            setSubmissionProgress({ mode: 'uploading', percent });
          },
        });
        attachmentMeta = normalizeAttachmentMeta(data);
      }
      const workDescription = String(submissionForm.work_description || '').trim();
      setSubmissionProgress({ mode: 'saving', percent: 100 });

      const attachmentPayloadList = multiAttachmentMetas
        .map((meta) => toAttachmentPayload(meta))
        .filter(Boolean);
      const payload = {
        title,
        work_description: workDescription || '无',
        keywords: [],
        content_text: null,
        attachment_name: attachmentMeta?.attachment_name || null,
        attachment_path: attachmentMeta?.attachment_path || null,
        attachment_ext: attachmentMeta?.attachment_ext || null,
        attachment_mime: attachmentMeta?.attachment_mime || null,
        attachment_size: attachmentMeta?.attachment_size ?? null,
        attachment_hash: attachmentMeta?.attachment_hash || null,
        team_name: null,
        extra_meta: attachmentMode === 'multiple'
          ? { source: 'contest_front', attachments: attachmentPayloadList }
          : { source: 'contest_front' },
      };

      let response;
      if (isCreateMode) {
        response = await createSubmission({ competition_id: competitionId, ...payload }, { requestId: createRequestId() });
      } else {
        response = await resubmitSubmission(competitionId, payload, { requestId: createRequestId() });
      }

      const latestRow = response?.data || null;
      setSubmissionMode('resubmit');
      if (latestRow) {
        setSubmissionExisting(latestRow);
        setSubmissionAttachment(normalizeAttachmentMeta(latestRow) || attachmentMeta);
        setSubmissionForm(buildSubmissionFormFromRow(latestRow));
        setSubmissionClearedFormats({});
      } else {
        setSubmissionAttachment(attachmentMeta || null);
        setSubmissionClearedFormats({});
      }
      setSubmissionFile(null);
      setSubmissionFilesByFormat({});
      setSubmittedCompetitionMap((prev) => ({
        ...prev,
        [competitionId]: {
          submission_id: latestRow?.id || prev?.[competitionId]?.submission_id || null,
          submit_version: Number(latestRow?.submit_version || prev?.[competitionId]?.submit_version || 1),
          last_submitted_at: latestRow?.last_submitted_at || latestRow?.updated_at || new Date().toISOString(),
        },
      }));

      trackAction(isCreateMode ? 'submission_create_success' : 'submission_resubmit_success', {
        user: user?.email,
        competition_id: competitionId,
        submission_id: latestRow?.id,
      });
      setMessage({ type: 'success', text: isCreateMode ? '作品提交成功' : '作品修改提交成功' });
    } catch (error) {
      const rawErrorText = getErrorText(error, isCreateMode ? '提交作品失败' : '修改提交失败');
      const finalErrorText = isCreateMode
        ? rawErrorText
        : (rawErrorText.startsWith('修改失败：') ? rawErrorText : `修改失败：${rawErrorText}`);
      trackAction(isCreateMode ? 'submission_create_failed' : 'submission_resubmit_failed', {
        user: user?.email,
        competition_id: competitionId,
        reason: finalErrorText,
      });
      setMessage({ type: 'error', text: finalErrorText });
    } finally {
      setSubmissionProgress({ mode: 'idle', percent: 0 });
      setActionLoading(false);
    }
  };

  const openSubmissionAttachmentMenu = (event, format = '') => {
    const normalizedFormat = canonicalFormatToken(format);
    if (normalizedFormat) {
      const localFile = submissionFilesByFormat[normalizedFormat] || null;
      const storedMeta = submissionExistingAttachmentMap[normalizedFormat] || null;
      if (!localFile && !storedMeta) return;
    } else if (!hasSubmissionAttachment) {
      return;
    }
    setSubmissionAttachmentMenuFormat(normalizedFormat || '');
    setSubmissionAttachmentMenuAnchor(event.currentTarget);
  };

  const closeSubmissionDialog = () => {
    setSubmissionOpen(false);
    setSubmissionFilesByFormat({});
    setSubmissionClearedFormats({});
    setSubmissionAttachmentMenuAnchor(null);
    setSubmissionAttachmentMenuFormat('');
    setSubmissionProgress({ mode: 'idle', percent: 0 });
  };

  const closeSubmissionAttachmentMenu = () => {
    setSubmissionAttachmentMenuAnchor(null);
    setSubmissionAttachmentMenuFormat('');
  };

  const clearSubmissionAttachment = (format = '') => {
    const normalizedFormat = canonicalFormatToken(format);
    if (normalizedFormat) {
      setSubmissionFilesByFormat((prev) => {
        const next = { ...prev };
        delete next[normalizedFormat];
        return next;
      });
      setSubmissionClearedFormats((prev) => ({ ...prev, [normalizedFormat]: true }));
      if (submissionPrimaryFormat && normalizedFormat === submissionPrimaryFormat) {
        setSubmissionFile(null);
      }
    } else {
      setSubmissionFile(null);
      setSubmissionFilesByFormat({});
      setSubmissionAttachment(null);
      setSubmissionClearedFormats({});
    }
    setSubmissionErrors((prev) => ({ ...prev, file: '' }));
    closeSubmissionAttachmentMenu();
  };

  const openPreviewPageByUrl = (url) => {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      setMessage({ type: 'warning', text: '浏览器拦截了预览窗口，请允许弹窗后重试' });
      return false;
    }
    return true;
  };

  const escapePreviewHtml = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const openDocxPreviewWindow = () => {
    const win = window.open('', '_blank');
    if (!win) {
      setMessage({ type: 'warning', text: '浏览器拦截了预览窗口，请允许弹窗后重试' });
      return null;
    }
    win.document.open();
    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>文档预览加载中</title>
    <style>
      body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #2b1f3f; background: #faf7ff; }
      .loading { padding: 20px; font-size: 15px; }
    </style>
  </head>
  <body>
    <div class="loading">文档预览加载中，请稍候...</div>
  </body>
</html>`);
    win.document.close();
    return win;
  };

  const writeDocxPreviewWindow = (win, fileName, docxHtml, warnings = []) => {
    if (!win || win.closed) return;
    const safeTitle = escapePreviewHtml(fileName || '文档预览');
    const warningItems = [
      '预览格式与实际格式存在差异，建议下载查看',
      ...(warnings || []).map((item) => String(item || '').trim()).filter(Boolean),
    ];
    const warningHtml = `<div class="warn">${warningItems.map((item) => `<div>${escapePreviewHtml(item)}</div>`).join('')}</div>`;
    win.document.open();
    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #1f1330; background: #f7f2ff; }
      .layout { max-width: 980px; margin: 0 auto; padding: 20px 24px 36px; }
      .title { margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #4b2b7f; word-break: break-all; }
      .warn { margin-bottom: 14px; padding: 10px 12px; border: 1px solid #e8d9ff; border-radius: 8px; background: #fff8d9; color: #6d5200; font-size: 13px; line-height: 1.6; }
      .content { background: #fff; border: 1px solid #e8dcfa; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(75, 43, 127, 0.08); line-height: 1.8; overflow-x: auto; }
      .content table { border-collapse: collapse; max-width: 100%; }
      .content td, .content th { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
      .content img { max-width: 100%; height: auto; }
      .empty { color: #6f5c94; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="layout">
      <h1 class="title">${safeTitle}</h1>
      ${warningHtml}
      <div class="content">${docxHtml || '<div class="empty">文档内容为空</div>'}</div>
    </div>
  </body>
</html>`);
    win.document.close();
  };

  const writeDocxPreviewFallbackWindow = (win, fileName, message, downloadUrl = '') => {
    if (!win || win.closed) return;
    const safeTitle = escapePreviewHtml(fileName || '文档预览');
    const safeMessage = escapePreviewHtml(message || '当前文档暂无法在线预览');
    const previewDiffHint = escapePreviewHtml('预览格式与实际格式存在差异，建议下载查看');
    const downloadSection = downloadUrl
      ? `<div style="margin-top:14px;"><a href="${downloadUrl}" download="${safeTitle}" style="display:inline-block;padding:8px 14px;border-radius:8px;background:#4b2b7f;color:#fff;text-decoration:none;">下载原文件</a></div>`
      : '';
    win.document.open();
    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #1f1330; background: #f7f2ff; }
      .layout { max-width: 860px; margin: 0 auto; padding: 24px; }
      .title { margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #4b2b7f; word-break: break-all; }
      .panel { background: #fff; border: 1px solid #e8dcfa; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(75, 43, 127, 0.08); }
      .text { color: #533e79; line-height: 1.8; }
    </style>
  </head>
  <body>
    <div class="layout">
      <h1 class="title">${safeTitle}</h1>
      <div class="panel">
        <div class="text" style="margin-bottom:10px;color:#6d5200;">${previewDiffHint}</div>
        <div class="text">${safeMessage}</div>
        ${downloadSection}
      </div>
    </div>
  </body>
</html>`);
    win.document.close();
  };

  const previewDocxFromArrayBuffer = async (arrayBuffer, fileName = '文档预览') => {
    const win = openDocxPreviewWindow();
    if (!win) return;
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const downloadUrl = URL.createObjectURL(blob);
    try {
      const mammothModule = await import('mammoth');
      const mammothLib = (
        mammothModule && typeof mammothModule.convertToHtml === 'function'
      ) ? mammothModule : mammothModule.default;
      if (!mammothLib || typeof mammothLib.convertToHtml !== 'function') {
        throw new Error('missing_convert_to_html');
      }
      const result = await withTimeout(
        mammothLib.convertToHtml({ arrayBuffer }),
        DOCX_PREVIEW_TIMEOUT_MS,
        'docx_preview_timeout'
      );
      writeDocxPreviewWindow(win, fileName, result?.value || '', result?.messages || []);
    } catch {
      writeDocxPreviewFallbackWindow(
        win,
        fileName,
        '文档在线预览超时或解析失败，请下载后使用本地 Office/WPS 查看。',
        downloadUrl
      );
      setMessage({ type: 'warning', text: 'docx 在线预览失败，已提供下载入口' });
      return;
    } finally {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5 * 60 * 1000);
    }
  };

  const previewLocalSubmissionFile = async (file) => {
    if (!file) {
      setMessage({ type: 'warning', text: '当前没有可预览的附件，请先上传作品后再试' });
      return;
    }
    const fileName = file.name || '附件';
    const ext = canonicalFormatToken(extractFileExt(fileName));
    try {
      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        await previewDocxFromArrayBuffer(arrayBuffer, fileName);
        return;
      }
      if (!isPreviewableExt(ext)) {
        setMessage({ type: 'warning', text: '当前文件类型暂不支持预览，请下载后查看' });
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const opened = openPreviewPageByUrl(objectUrl);
      if (!opened) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
    } catch {
      setMessage({ type: 'error', text: '解析附件失败，请下载后查看' });
    }
  };

  const previewStoredSubmissionAttachment = async (competitionId, attachmentMeta, formatHint = '') => {
    const fallbackName = attachmentMeta?.attachment_name || '附件';
    const ext = canonicalFormatToken(
      formatHint || attachmentMeta?.attachment_ext || extractFileExt(fallbackName)
    );
    try {
      if (ext === 'docx') {
        const { blob, fileName } = await getMySubmissionAttachmentBlob(competitionId, {
          disposition: 'attachment',
          attachmentExt: ext,
        });
        if (!blob) {
          setMessage({ type: 'warning', text: '未找到可预览的附件，请重新提交后再试' });
          return;
        }
        const buffer = await blob.arrayBuffer();
        await previewDocxFromArrayBuffer(buffer, fileName || fallbackName || '文档预览');
        return;
      }
      if (isPreviewableExt(ext)) {
        openPreviewPageByUrl(buildSubmissionAttachmentUrl(competitionId, 'inline', ext));
      } else {
        setMessage({ type: 'warning', text: '当前文件类型暂不支持预览，请下载后查看' });
      }
    } catch {
      setMessage({ type: 'error', text: '预览失败：附件不可访问或已失效，请重新提交后再试' });
    }
  };

  const downloadLocalSubmissionFile = (file) => {
    if (!file) {
      setMessage({ type: 'warning', text: '当前没有可下载的附件，请先上传作品后再试' });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.name || 'submission';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
  };

  const downloadStoredSubmissionAttachment = (competitionId, attachmentMeta, formatHint = '') => {
    const fallbackName = attachmentMeta?.attachment_name || 'submission';
    const ext = canonicalFormatToken(
      formatHint || attachmentMeta?.attachment_ext || extractFileExt(fallbackName)
    );
    try {
      const link = document.createElement('a');
      link.href = buildSubmissionAttachmentUrl(competitionId, 'attachment', ext);
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMessage({ type: 'info', text: '已开始下载，请稍候…' });
    } catch {
      setMessage({ type: 'error', text: '下载失败：附件不可访问或链接异常，请重新提交后再试' });
    }
  };

  const previewSubmissionAttachmentByFormat = async (format = '') => {
    closeSubmissionAttachmentMenu();
    const normalizedFormat = canonicalFormatToken(format);
    const localFile = normalizedFormat
      ? (submissionFilesByFormat[normalizedFormat] || null)
      : submissionPrimaryFile;
    const storedMeta = normalizedFormat
      ? (submissionExistingAttachmentMap[normalizedFormat] || null)
      : submissionAttachment;

    if (localFile) {
      await previewLocalSubmissionFile(localFile);
      return;
    }
    if (!storedMeta) {
      setMessage({ type: 'warning', text: '当前没有可预览的附件，请先上传作品后再试' });
      return;
    }

    const competitionId = Number(submissionTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) {
      setMessage({ type: 'warning', text: '无法定位比赛信息，请关闭后重试' });
      return;
    }

    await previewStoredSubmissionAttachment(competitionId, storedMeta, normalizedFormat);
  };

  const downloadSubmissionAttachmentByFormat = (format = '') => {
    closeSubmissionAttachmentMenu();
    const normalizedFormat = canonicalFormatToken(format);
    const localFile = normalizedFormat
      ? (submissionFilesByFormat[normalizedFormat] || null)
      : submissionPrimaryFile;
    const storedMeta = normalizedFormat
      ? (submissionExistingAttachmentMap[normalizedFormat] || null)
      : submissionAttachment;

    if (localFile) {
      downloadLocalSubmissionFile(localFile);
      return;
    }
    if (!storedMeta) {
      setMessage({ type: 'warning', text: '当前没有可下载的附件，请先上传作品后再试' });
      return;
    }

    const competitionId = Number(submissionTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) {
      setMessage({ type: 'warning', text: '无法定位比赛信息，请关闭后重试' });
      return;
    }

    downloadStoredSubmissionAttachment(competitionId, storedMeta, normalizedFormat);
  };

  const previewSubmissionAttachment = async () => {
    await previewSubmissionAttachmentByFormat(submissionAttachmentMenuFormat || '');
  };

  const downloadSubmissionAttachment = () => {
    downloadSubmissionAttachmentByFormat(submissionAttachmentMenuFormat || '');
  };

  const submitEdit = async () => {
    if (!editTarget?.id) return;
    const errs = validateForm(editForm);
    setEditErrors(errs);
    if (Object.keys(errs).length) return;
    setActionLoading(true);
    try {
      await updateCompetition(editTarget.id, buildPayload(editForm));
      trackAction('competition_update_success', { user: user?.email, id: editTarget?.id });
      setEditOpen(false);
      setMessage({ type: 'success', text: '修改成功' });
      await loadMine(mineKeyword, minePage);
      await loadHome(homeKeyword, homePage);
    } catch (error) {
      const reasonText = getErrorText(error, '请稍后重试');
      const normalizedReason = reasonText === '更新失败'
        ? '服务端未返回具体原因，请检查输入后重试'
        : reasonText;
      trackAction('competition_update_failed', { user: user?.email, id: editTarget?.id, reason: normalizedReason });
      setMessage({
        type: 'error',
        text: `更新失败：${normalizedReason}`,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openDeleteDialog = (row) => {
    if (!row?.id) return;
    setDeleteTarget(row);
    setDeleteEmail(String(user?.email || ''));
    setDeletePassword('');
    setDeleteOpen(true);
  };

  const submitDelete = async () => {
    if (!deleteTarget?.id) return;
    if (!deleteEmail.trim() || !deletePassword) {
      setMessage({ type: 'warning', text: '请先输入账号和密码后再删除' });
      return;
    }
    setActionLoading(true);
    try {
      await deleteCompetition(deleteTarget.id, {
        email: deleteEmail.trim(),
        password: deletePassword,
      });
      trackAction('competition_delete_success', { user: user?.email, id: deleteTarget?.id });
      setMessage({ type: 'success', text: '删除成功' });
      setDetailOpen(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeletePassword('');
      await loadMine(mineKeyword, minePage);
      await loadHome(homeKeyword, homePage);
    } catch (error) {
      trackAction('competition_delete_failed', { user: user?.email, id: deleteTarget?.id, reason: getErrorText(error, '删除失败') });
      setMessage({
        type: 'error',
        text: getErrorText(error, '删除失败'),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const submitJoinCompetition = async (row, providedRegistrationCode = '') => {
    if (!user) {
      if (typeof onGoLogin === 'function') onGoLogin();
      return;
    }
    const target = row || detailData;
    const targetId = Number(target?.id);
    if (Number.isNaN(targetId) || targetId <= 0) return;
    if (registeredCompetitionIds.includes(targetId)) {
      setMessage({ type: 'warning', text: '当前账号已报名该比赛，请勿重复报名' });
      return;
    }
    const targetCurrent = Number(target?.current_participants || 0);
    const targetMax = Number(target?.max_participants || 0);
    const targetRegistrationFull = (target?.registration_is_full === true || Number(target?.registration_is_full) === 1)
      || (targetMax > 0 && targetCurrent >= targetMax);
    if (targetRegistrationFull) {
      setMessage({ type: 'warning', text: '报名人数已满' });
      return;
    }
    if (statusOf(target || {}).key !== 'registration') {
      setMessage({ type: 'warning', text: '当前不在报名阶段' });
      return;
    }
    const requiresCode = registrationCodeRequired(target);
    const normalizedRegistrationCode = String(providedRegistrationCode || '').trim();
    if (requiresCode && !normalizedRegistrationCode) {
      setJoinCodeTarget(target);
      setJoinCodeValue('');
      setJoinCodeOpen(true);
      return;
    }

    setActionLoading(true);
    try {
      await registerParticipant(
        {
          competition_id: targetId,
          ...(requiresCode ? { registration_code: normalizedRegistrationCode } : {}),
        },
        { requestId: createRequestId() },
      );
      trackAction('competition_register_success', { user: user?.email, id: targetId });
      setRegisteredCompetitionIds((prev) => normalizeCompetitionIds([...prev, targetId]));
      setMyParticipantMap((prev) => ({
        ...prev,
        [targetId]: prev?.[targetId] || {
          competition_id: targetId,
          user_id: Number(user?.id || user?.user_id || 0) || 0,
          name: String(user?.username || ''),
          phone: String(user?.phone || ''),
          email: String(user?.email || ''),
          study_status: String(user?.study_status || 'not_in_school'),
          school: String(user?.school || ''),
          major: String(user?.major || ''),
          grade: String(user?.grade || ''),
          occupation: String(user?.occupation || ''),
          bio: String(user?.bio || ''),
        },
      }));
      setMessage({ type: 'success', text: '报名成功' });
      setJoinCodeOpen(false);
      setJoinCodeTarget(null);
      setJoinCodeValue('');
      await loadRegisteredStatus();
      await loadMyContests(myContestKeyword, 1);
      await loadHome(homeKeyword, homePage);
      if (detailOpen && Number(detailData?.id) === targetId) {
        setDetailData((prev) => {
          if (!prev) return prev;
          const current = Number(prev.current_participants || 0);
          const max = Number(prev.max_participants || 0);
          const nextCurrent = current + 1;
          return {
            ...prev,
            current_participants: nextCurrent,
            registration_is_full: max > 0 ? nextCurrent >= max : false,
          };
        });
      }
    } catch (error) {
      trackAction('competition_register_failed', { user: user?.email, id: targetId, reason: getErrorText(error, '报名失败') });
      setMessage({ type: 'error', text: getErrorText(error, '报名失败') });
    } finally {
      setActionLoading(false);
    }
  };

  const submitJoinCompetitionWithCode = async () => {
    const code = String(joinCodeValue || '').trim();
    if (!code) {
      setMessage({ type: 'warning', text: '请先填写报名码' });
      return;
    }
    const target = joinCodeTarget;
    await submitJoinCompetition(target, code);
  };

  const copyRegistrationCode = async (code) => {
    const value = String(code || '').trim();
    if (!value) {
      setMessage({ type: 'warning', text: '当前比赛暂无报名码' });
      return;
    }
    try {
      const ok = await copyToClipboard(value);
      setMessage({ type: ok ? 'success' : 'warning', text: ok ? '报名码已复制' : '复制失败，请手动复制' });
    } catch {
      setMessage({ type: 'warning', text: '复制失败，请手动复制' });
    }
  };

  const openQuitDialog = (row) => {
    const target = row || detailData;
    if (!target?.id) return;
    if (!canQuitCompetition(target)) {
      setMessage({ type: 'warning', text: '比赛开始后无法退出比赛' });
      return;
    }
    setQuitTarget(target);
    setQuitOpen(true);
  };

  const submitQuitCompetition = async (row) => {
    const target = row || detailData;
    const targetId = Number(target?.id);
    if (Number.isNaN(targetId) || targetId <= 0) return;
    if (!canQuitCompetition(target)) {
      setMessage({ type: 'warning', text: '比赛开始后无法退出比赛' });
      return;
    }
    setActionLoading(true);
    try {
      await unregisterParticipant(targetId, { requestId: createRequestId() });
      trackAction('competition_quit_success', { user: user?.email, id: targetId });
      setRegisteredCompetitionIds((prev) => prev.filter((id) => Number(id) !== targetId));
      setMyParticipantMap((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setMessage({ type: 'success', text: '已退出比赛：你将无法再提交该比赛作品，如需再次参加请重新报名。' });
      if (detailOpen) setDetailOpen(false);
      setQuitOpen(false);
      setQuitTarget(null);
      await loadMyContests(myContestKeyword, myContestPage);
    } catch (error) {
      trackAction('competition_quit_failed', { user: user?.email, id: targetId, reason: getErrorText(error, '退出比赛失败') });
      setMessage({ type: 'error', text: getErrorText(error, '退出比赛失败') });
    } finally {
      setActionLoading(false);
    }
  };

  const loadParticipantsStatus = async ({
    competitionId,
    keyword = participantsKeyword,
    page = participantsPage,
    sort = participantsStatusOrder,
  }) => {
    if (Number.isNaN(Number(competitionId)) || Number(competitionId) <= 0) return;
    const requestId = createRequestId();
    latestRequestIdsRef.current.participants = requestId;
    setParticipantsLoading(true);
    try {
      const safePage = Math.max(1, Number(page) || 1);
      const offset = (safePage - 1) * PARTICIPANTS_PAGE_SIZE;
      const { items, total, requestId: echoedRequestId } = await listCompetitionParticipantsStatusPaged(
        Number(competitionId),
        PARTICIPANTS_PAGE_SIZE,
        offset,
        keyword || '',
        {
          sort,
          requestId,
        }
      );
      if (latestRequestIdsRef.current.participants !== echoedRequestId) return;
      const rows = Array.isArray(items) ? items : [];
      const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PARTICIPANTS_PAGE_SIZE));
      setParticipantsRows(rows);
      setParticipantsTotalPages(totalPages);
      setParticipantsHasNext(safePage < totalPages);
      trackAction('competition_participants_open', {
        user: user?.email,
        id: competitionId,
        count: rows.length,
        total: Number(total) || 0,
        keyword: keyword || '',
        sort,
      });
    } catch (error) {
      if (latestRequestIdsRef.current.participants !== requestId) return;
      setParticipantsRows([]);
      setParticipantsHasNext(false);
      setParticipantsTotalPages(1);
      setMessage({ type: 'error', text: getErrorText(error, '加载参赛选手信息失败') });
    } finally {
      if (latestRequestIdsRef.current.participants === requestId) setParticipantsLoading(false);
    }
  };

  const openParticipants = async (row) => {
    if (!row?.id) return;
    const competitionId = Number(row.id);
    setParticipantsTarget(row);
    setParticipantsRows([]);
    setParticipantsStatusOrder('submitted_first');
    setParticipantsKeywordInput('');
    setParticipantsKeyword('');
    setParticipantsPage(1);
    setParticipantsHasNext(false);
    setParticipantsTotalPages(1);
    setParticipantsOpen(true);
    await loadParticipantsStatus({
      competitionId,
      keyword: '',
      page: 1,
      sort: 'submitted_first',
    });
  };

  const toggleParticipantsStatusOrder = async () => {
    const competitionId = Number(participantsTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    const nextSort = participantsStatusOrder === 'submitted_first' ? 'unsubmitted_first' : 'submitted_first';
    setParticipantsStatusOrder(nextSort);
    setParticipantsPage(1);
    await loadParticipantsStatus({
      competitionId,
      keyword: participantsKeyword,
      page: 1,
      sort: nextSort,
    });
  };

  const searchParticipants = async () => {
    const competitionId = Number(participantsTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    const keyword = participantsKeywordInput.trim();
    setParticipantsKeyword(keyword);
    setParticipantsPage(1);
    await loadParticipantsStatus({
      competitionId,
      keyword,
      page: 1,
      sort: participantsStatusOrder,
    });
  };

  const clearParticipantsSearch = async () => {
    const competitionId = Number(participantsTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    setParticipantsKeywordInput('');
    setParticipantsKeyword('');
    setParticipantsPage(1);
    await loadParticipantsStatus({
      competitionId,
      keyword: '',
      page: 1,
      sort: participantsStatusOrder,
    });
  };

  const changeParticipantsPage = async (nextPage) => {
    const competitionId = Number(participantsTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    const safePage = Math.max(1, Number(nextPage) || 1);
    setParticipantsPage(safePage);
    await loadParticipantsStatus({
      competitionId,
      keyword: participantsKeyword,
      page: safePage,
      sort: participantsStatusOrder,
    });
  };

  const loadJudges = async ({
    competitionId,
    keyword = judgeKeyword,
    page = judgePage,
    status = judgeStatus,
  }) => {
    if (Number.isNaN(Number(competitionId)) || Number(competitionId) <= 0) return;
    const requestId = createRequestId();
    latestRequestIdsRef.current.judges = requestId;
    setJudgeLoading(true);
    try {
      const safePage = Math.max(1, Number(page) || 1);
      const offset = (safePage - 1) * JUDGE_PAGE_SIZE;
      const { items, total, requestId: echoedRequestId } = await listCompetitionJudgesPaged(
        Number(competitionId),
        JUDGE_PAGE_SIZE,
        offset,
        keyword || '',
        {
          status: status || 'all',
          requestId,
        }
      );
      if (latestRequestIdsRef.current.judges !== echoedRequestId) return;
      const rows = Array.isArray(items) ? items : [];
      const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / JUDGE_PAGE_SIZE));
      setJudgeRows(rows);
      setJudgeTotalPages(totalPages);
      setJudgeHasNext(safePage < totalPages);
    } catch (error) {
      if (latestRequestIdsRef.current.judges !== requestId) return;
      setJudgeRows([]);
      setJudgeTotalPages(1);
      setJudgeHasNext(false);
      setMessage({ type: 'error', text: getErrorText(error, '加载评委列表失败') });
    } finally {
      if (latestRequestIdsRef.current.judges === requestId) setJudgeLoading(false);
    }
  };

  const openJudgeDialog = async (row) => {
    if (!row?.id) return;
    const competitionId = Number(row.id);
    setJudgeTarget(row);
    setJudgeRows([]);
    setJudgeKeywordInput('');
    setJudgeKeyword('');
    setJudgeStatus('all');
    setJudgePage(1);
    setJudgeHasNext(false);
    setJudgeTotalPages(1);
    setJudgeAccount('');
    setJudgeOpen(true);
    await loadJudges({
      competitionId,
      keyword: '',
      page: 1,
      status: 'all',
    });
  };

  const searchJudges = async () => {
    const competitionId = Number(judgeTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    const keyword = judgeKeywordInput.trim();
    setJudgeKeyword(keyword);
    setJudgePage(1);
    await loadJudges({
      competitionId,
      keyword,
      page: 1,
      status: judgeStatus,
    });
  };

  const clearJudgesSearch = async () => {
    const competitionId = Number(judgeTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    setJudgeKeywordInput('');
    setJudgeKeyword('');
    setJudgePage(1);
    await loadJudges({
      competitionId,
      keyword: '',
      page: 1,
      status: judgeStatus,
    });
  };

  const changeJudgePage = async (nextPage) => {
    const competitionId = Number(judgeTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    const safePage = Math.max(1, Number(nextPage) || 1);
    setJudgePage(safePage);
    await loadJudges({
      competitionId,
      keyword: judgeKeyword,
      page: safePage,
      status: judgeStatus,
    });
  };

  const applyJudgeStatusFilter = async (nextStatus) => {
    const competitionId = Number(judgeTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    setJudgeStatus(nextStatus);
    setJudgePage(1);
    await loadJudges({
      competitionId,
      keyword: judgeKeyword,
      page: 1,
      status: nextStatus,
    });
  };

  const submitAddJudge = async () => {
    const competitionId = Number(judgeTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    const account = judgeAccount.trim();
    if (!account) {
      setMessage({ type: 'warning', text: '请先填写评委邮箱或手机号' });
      return;
    }
    setJudgeAddConfirmAccount(account);
    setJudgeAddConfirmOpen(true);
  };

  const confirmAddJudge = async () => {
    const competitionId = Number(judgeTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    const account = String(judgeAddConfirmAccount || '').trim();
    if (!account) {
      setJudgeAddConfirmOpen(false);
      return;
    }
    setJudgeSubmitting(true);
    try {
      await addCompetitionJudge(
        competitionId,
        { account, status: 'active' },
        { requestId: createRequestId() }
      );
      setJudgeAccount('');
      setJudgeAddConfirmAccount('');
      setJudgeAddConfirmOpen(false);
      setMessage({ type: 'success', text: '评委添加成功' });
      await loadJudges({
        competitionId,
        keyword: judgeKeyword,
        page: judgePage,
        status: judgeStatus,
      });
    } catch (error) {
      setMessage({ type: 'error', text: getErrorText(error, '添加评委失败') });
    } finally {
      setJudgeSubmitting(false);
    }
  };

  const switchJudgeStatus = async (row, nextStatus) => {
    const competitionId = Number(judgeTarget?.id);
    const judgeUserId = Number(row?.judge_user_id);
    if (Number.isNaN(competitionId) || competitionId <= 0 || Number.isNaN(judgeUserId) || judgeUserId <= 0) return;
    setJudgeSubmitting(true);
    try {
      await updateCompetitionJudgeStatus(
        competitionId,
        judgeUserId,
        { status: nextStatus },
        { requestId: createRequestId() }
      );
      setMessage({ type: 'success', text: '评委状态已更新' });
      await loadJudges({
        competitionId,
        keyword: judgeKeyword,
        page: judgePage,
        status: judgeStatus,
      });
    } catch (error) {
      setMessage({ type: 'error', text: getErrorText(error, '更新评委状态失败') });
    } finally {
      setJudgeSubmitting(false);
    }
  };

  const exportParticipantsExcel = async () => {
    const competitionId = Number(participantsTarget?.id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    setParticipantsExporting(true);
    let collectedRows = [];
    const buildExportConfig = (rows) => {
      let showInSchoolFields = false;
      let showOccupation = false;
      (rows || []).forEach((item) => {
        const status = normalizeStudyStatus(item?.study_status, item);
        if (status === 'in_school') showInSchoolFields = true;
        else showOccupation = true;
      });
      return { showInSchoolFields, showOccupation };
    };
    const mapExportRow = (item, config) => {
      const status = normalizeStudyStatus(item?.study_status, item);
      const inSchool = status === 'in_school';
      const row = {
        在读状态: studyStatusLabel(status),
        姓名: item?.name || '',
        状态: submissionStatusLabel(item?.submission_status),
        邮箱: item?.email || '',
        手机号: item?.phone || '',
      };
      if (config.showInSchoolFields) {
        row.学校 = inSchool ? (item?.school || '') : '';
        row.专业 = inSchool ? (item?.major || '') : '';
        row.年级 = inSchool ? (item?.grade || '') : '';
      }
      if (config.showOccupation) {
        row.职业 = inSchool ? '' : (item?.occupation || '');
      }
      row.最近提交时间 = item?.last_submitted_at ? dayjs(item.last_submitted_at).format('YYYY-MM-DD HH:mm:ss') : '';
      row.提交版本 = item?.submit_version ?? '';
      return row;
    };
    try {
      const rows = [];
      let offset = 0;
      let total = 0;
      let pageCount = 0;
      const limit = Math.max(1, Number(PARTICIPANTS_PAGE_SIZE) || 20);
      while (pageCount < 1000) {
        const { items, total: currentTotal } = await listCompetitionParticipantsStatusPaged(
          competitionId,
          limit,
          offset,
          '',
          {
            status: 'all',
            sort: participantsStatusOrder,
            requestId: createRequestId(),
          }
        );
        const pageRows = Array.isArray(items) ? items : [];
        rows.push(...pageRows);
        total = Number(currentTotal || 0);
        offset += pageRows.length;
        pageCount += 1;
        if (!pageRows.length || offset >= total) break;
      }
      collectedRows = rows;
      const xlsxModule = await import('xlsx');
      const xlsx = (xlsxModule?.default && xlsxModule.default.utils)
        ? xlsxModule.default
        : xlsxModule;
      const utils = xlsx?.utils;
      const write = xlsx?.write;
      if (!utils || typeof write !== 'function') {
        throw new Error('XLSX_RUNTIME_UNSUPPORTED');
      }
      const exportConfig = buildExportConfig(rows);
      const exportRows = rows.map((item) => mapExportRow(item, exportConfig));
      const workbook = utils.book_new();
      const worksheet = utils.json_to_sheet(exportRows);
      utils.book_append_sheet(workbook, worksheet, '参赛选手信息');
      const excelBytes = write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob(
        [excelBytes],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileBase = String(participantsTarget?.name || participantsTarget?.id || 'participants').replace(/[\\/:*?"<>|]/g, '_');
      link.href = objectUrl;
      link.download = `${fileBase}_参赛选手信息.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
      setMessage({ type: 'success', text: `导出成功，共 ${exportRows.length} 名选手` });
    } catch (error) {
      try {
        // 兜底：导出标准 CSV，避免 .xls 扩展名与实际内容不一致导致告警。
        const sourceRows = collectedRows.length ? collectedRows : participantsRowsDisplay;
        const exportConfig = buildExportConfig(sourceRows);
        const fallbackRows = sourceRows.map((item) => mapExportRow(item, exportConfig));
        const columns = [
          '在读状态',
          '姓名',
          '状态',
          '邮箱',
          '手机号',
          ...(exportConfig.showInSchoolFields ? ['学校', '专业', '年级'] : []),
          ...(exportConfig.showOccupation ? ['职业'] : []),
          '最近提交时间',
          '提交版本',
        ];
        const escapeCsv = (text) => {
          const value = String(text ?? '');
          if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        };
        const csvHeader = columns.join(',');
        const csvBody = fallbackRows.map((row) => columns.map((col) => escapeCsv(row[col])).join(',')).join('\n');
        const csv = `${csvHeader}\n${csvBody}`;
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileBase = String(participantsTarget?.name || participantsTarget?.id || 'participants').replace(/[\\/:*?"<>|]/g, '_');
        link.href = objectUrl;
        link.download = `${fileBase}_参赛选手信息.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
        setMessage({ type: 'warning', text: `已使用兼容模式导出（CSV），共 ${fallbackRows.length} 名选手` });
      } catch {
        setMessage({ type: 'error', text: getErrorText(error, '导出失败') });
      }
    } finally {
      setParticipantsExporting(false);
    }
  };

  const openMyInfo = (row) => {
    const targetId = Number(row?.id);
    if (Number.isNaN(targetId) || targetId <= 0) return;
    if (!myParticipantMap[targetId]) {
      setMessage({ type: 'warning', text: '暂未找到你的报名信息，请刷新后重试' });
      return;
    }
    setMyInfoCompetition(row);
    setMyInfoOpen(true);
  };

  const openJudgeReviewCompetition = (row) => {
    const competitionId = Number(row?.id || row?.competition_id);
    if (Number.isNaN(competitionId) || competitionId <= 0) return;
    if (typeof onOpenJudgeReviewCompetition === 'function') {
      onOpenJudgeReviewCompetition(competitionId);
      return;
    }
    setMessage({ type: 'warning', text: '当前路由未接入评审页面，请联系开发者配置' });
  };

  const homePane = (
    <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${CONTEST_THEME.panelBorder}`, background: CONTEST_THEME.panelGradient }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>比赛总览</Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="搜索比赛（名称/描述）"
          value={homeKeywordInput}
          onChange={(e) => setHomeKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setHomePage(1);
              setHomeKeyword(homeKeywordInput.trim());
            }
          }}
        />
        <Button
          variant="contained"
          onClick={() => {
            setHomePage(1);
            setHomeKeyword(homeKeywordInput.trim());
          }}
        >
          搜索
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setHomeKeywordInput('');
            setHomePage(1);
            setHomeKeyword('');
          }}
        >
          清空
        </Button>
      </Stack>
      <TableContainer sx={{ border: `1px solid ${CONTEST_THEME.tableBorder}`, borderRadius: 2, minHeight: 420 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ background: CONTEST_THEME.tableHeadBg }}>
              <TableCell>比赛名称</TableCell>
              <TableCell align="center">状态</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {homeRowsDisplay.map((row) => {
              const s = statusOf(row);
              return (
                <TableRow key={row.id} hover onClick={() => openDetail(row, false)} sx={{ cursor: 'pointer' }}>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Box>{row.name}</Box>
                    {!!statusTimeText(row, s.key) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {statusTimeText(row, s.key)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center"><Chip size="small" color={s.color} label={s.label} /></TableCell>
                </TableRow>
              );
            })}
            {!homeRowsDisplay.length && !homeLoading && (
              <TableRow><TableCell align="center" colSpan={2}>暂无比赛</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
        <Typography variant="body2" color="text.secondary">{homePage}/{homeTotalPages} 页</Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={homeLoading || homePage <= 1}
          onClick={() => setHomePage((p) => Math.max(1, p - 1))}
        >
          上一页
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={homeLoading || !homeHasNext}
          onClick={() => setHomePage((p) => p + 1)}
        >
          下一页
        </Button>
      </Stack>
    </Paper>
  );

  const createPane = (
    <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${CONTEST_THEME.panelBorder}` }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>创办比赛</Typography>
      {!canCreateCompetition && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          你当前没有创办比赛权限。仅管理员可提交创建申请。
        </Alert>
      )}
      <CompetitionForm form={createForm} setForm={setCreateForm} errors={createErrors} setErrors={setCreateErrors} />
      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          disabled={!canCreateCompetition || actionLoading}
          onClick={() => { setCreateForm(EMPTY_FORM); setCreateErrors({}); }}
        >
          清空
        </Button>
        <Button
          variant="contained"
          disabled={!canCreateCompetition || actionLoading}
          onClick={submitCreate}
        >
          {actionLoading ? '提交中...' : '提交创办'}
        </Button>
      </Stack>
    </Paper>
  );

  const minePane = (
    <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${CONTEST_THEME.panelBorder}` }}>
      <Alert severity="info" sx={{ mb: 2 }}>比赛信息可随时修改；删除前请确认，删除后不可恢复。</Alert>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="搜索我创办的比赛（名称/描述）"
          value={mineKeywordInput}
          onChange={(e) => setMineKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setMinePage(1);
              setMineKeyword(mineKeywordInput.trim());
            }
          }}
        />
        <Button
          variant="contained"
          onClick={() => {
            setMinePage(1);
            setMineKeyword(mineKeywordInput.trim());
          }}
        >
          搜索
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setMineKeywordInput('');
            setMinePage(1);
            setMineKeyword('');
          }}
        >
          清空
        </Button>
      </Stack>
      <TableContainer sx={{ border: `1px solid ${CONTEST_THEME.tableBorder}`, borderRadius: 2, minHeight: 420 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ background: CONTEST_THEME.tableHeadBg }}>
              <TableCell>比赛名称</TableCell>
              <TableCell align="center">状态</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mineRowsDisplay.map((row) => {
              const s = statusOf(row);
              return (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => {
                    const selectedText = String(window.getSelection?.()?.toString?.() || '').trim();
                    if (selectedText) return;
                    openDetail(row, true);
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Box>{row.name}</Box>
                    {registrationCodeRequired(row) && String(row.registration_code || '').trim() && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          报名码：{String(row.registration_code || '').trim()}
                        </Typography>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyRegistrationCode(row.registration_code);
                          }}
                          sx={{ minWidth: 0, px: 0.5 }}
                        >
                          复制
                        </Button>
                      </Stack>
                    )}
                    {!!statusTimeText(row, s.key) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {statusTimeText(row, s.key)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center"><Chip size="small" color={s.color} label={s.label} /></TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); openDetail(row, true); }}>查看详情</Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        修改
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openParticipants(row);
                        }}
                      >
                        参赛选手信息
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openJudgeDialog(row);
                        }}
                      >
                        评委管理
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteDialog(row);
                        }}
                      >
                        删除
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {!mineRowsDisplay.length && !mineLoading && (
              <TableRow><TableCell align="center" colSpan={3}>暂无你创办的比赛</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
        <Typography variant="body2" color="text.secondary">{minePage}/{mineTotalPages} 页</Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={mineLoading || minePage <= 1}
          onClick={() => setMinePage((p) => Math.max(1, p - 1))}
        >
          上一页
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={mineLoading || !mineHasNext}
          onClick={() => setMinePage((p) => p + 1)}
        >
          下一页
        </Button>
      </Stack>
    </Paper>
  );

  const myContestsPane = (
    <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${CONTEST_THEME.panelBorder}`, background: CONTEST_THEME.panelGradient }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        这里显示你已经报名的比赛，可以按名称搜索并翻页查看。
      </Alert>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="搜索我报名的比赛（名称/描述）"
          value={myContestKeywordInput}
          onChange={(e) => setMyContestKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setMyContestPage(1);
              setMyContestKeyword(myContestKeywordInput.trim());
            }
          }}
        />
        <Button
          variant="contained"
          onClick={() => {
            setMyContestPage(1);
            setMyContestKeyword(myContestKeywordInput.trim());
          }}
        >
          搜索
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setMyContestKeywordInput('');
            setMyContestPage(1);
            setMyContestKeyword('');
          }}
        >
          清空
        </Button>
      </Stack>
      <TableContainer sx={{ border: `1px solid ${CONTEST_THEME.tableBorder}`, borderRadius: 2, minHeight: 420 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ background: CONTEST_THEME.tableHeadBg }}>
              <TableCell>比赛名称</TableCell>
              <TableCell align="center">状态</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {myContestRowsDisplay.map((row) => {
              const s = statusOf(row);
              const submittedInfo = submittedCompetitionMap[Number(row.id)] || null;
              return (
                <TableRow key={`registered_${row.id}`} hover onClick={() => openDetail(row, false)} sx={{ cursor: 'pointer' }}>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Box>{row.name}</Box>
                    {!!statusTimeText(row, s.key) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {statusTimeText(row, s.key)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center"><Chip size="small" color={s.color} label={s.label} /></TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); openMyInfo(row); }}>我的信息</Button>
                      <Button variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); openDetail(row, false); }}>查看详情</Button>
                      {s.key === 'ongoing' && (
                        <Button
                          variant={submittedInfo ? 'outlined' : 'contained'}
                          color={submittedInfo ? 'warning' : 'primary'}
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSubmissionDialog(row);
                          }}
                        >
                          {submittedInfo ? '修改作品' : '提交作品'}
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        disabled={!canQuitCompetition(row)}
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuitDialog(row);
                        }}
                      >
                        退出比赛
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {!myContestRowsDisplay.length && !myContestsLoading && (
              <TableRow><TableCell align="center" colSpan={3}>暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mt: 1.2 }}>
        <Typography variant="body2" color="text.secondary">{myContestPage}/{myContestTotalPages} 页</Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={myContestsLoading || myContestPage <= 1}
          onClick={() => setMyContestPage((p) => Math.max(1, p - 1))}
        >
          上一页
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={myContestsLoading || !myContestHasNext}
          onClick={() => setMyContestPage((p) => p + 1)}
        >
          下一页
        </Button>
      </Stack>
    </Paper>
  );

  const judgeReviewsPane = (
    <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${CONTEST_THEME.panelBorder}`, background: CONTEST_THEME.panelGradient }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        这里展示你担任评委的比赛。点击“进入评审”后，会打开独立评审页面进行打分与填写评语。
      </Alert>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="搜索我评审的比赛（名称/描述）"
          value={judgeReviewsKeywordInput}
          onChange={(e) => setJudgeReviewsKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setJudgeReviewsPage(1);
              setJudgeReviewsKeyword(judgeReviewsKeywordInput.trim());
            }
          }}
        />
        <Button
          variant="contained"
          onClick={() => {
            setJudgeReviewsPage(1);
            setJudgeReviewsKeyword(judgeReviewsKeywordInput.trim());
          }}
        >
          搜索
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setJudgeReviewsKeywordInput('');
            setJudgeReviewsPage(1);
            setJudgeReviewsKeyword('');
          }}
        >
          清空
        </Button>
      </Stack>
      <TableContainer sx={{ border: `1px solid ${CONTEST_THEME.tableBorder}`, borderRadius: 2, minHeight: 420 }}>
        <Table>
            <TableHead>
              <TableRow sx={{ background: CONTEST_THEME.tableHeadBg }}>
                <TableCell>比赛名称</TableCell>
                <TableCell align="center">比赛状态</TableCell>
                <TableCell align="center">评委状态</TableCell>
                <TableCell align="center">作品总数</TableCell>
                <TableCell align="center">已评审作品数量</TableCell>
                <TableCell align="center">评审进度</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
            {judgeCompetitionRows.map((row) => {
              const competitionStatus = statusOf(row);
              const isJudgeActive = String(row.my_judge_status || '').toLowerCase() === 'active';
              const totalCount = Math.max(0, Number(row.my_assigned_count || 0));
              const reviewedCount = Math.min(totalCount, Math.max(0, Number(row.my_reviewed_count || 0)));
              const progressPercent = totalCount > 0 ? Number(((reviewedCount / totalCount) * 100).toFixed(1)) : 0;
              return (
                <TableRow
                  key={`judge_competition_${row.id}`}
                  hover
                  onClick={() => openDetail(row, false)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Box>{row.name}</Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                      评审时间：{formatTimeValue(row.review_start, '待定')} ~ {formatTimeValue(row.review_end, '待定')}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      color={competitionStatus.color}
                      label={competitionStatus.label}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      color={isJudgeActive ? 'success' : 'default'}
                      label={isJudgeActive ? '启用' : '停用'}
                    />
                  </TableCell>
                  <TableCell align="center">{totalCount}</TableCell>
                  <TableCell align="center">{reviewedCount}</TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#5a3b88' }}>
                      {`${progressPercent}%`}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!isJudgeActive}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isJudgeActive) {
                          setMessage({ type: 'warning', text: '当前评委状态为停用，无法进入评审' });
                          return;
                        }
                        openJudgeReviewCompetition(row);
                      }}
                    >
                      进入评审
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!judgeCompetitionRows.length && !judgeReviewsLoading && (
              <TableRow><TableCell align="center" colSpan={7}>暂无你参与评审的比赛</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mt: 1.2 }}>
        <Typography variant="body2" color="text.secondary">{judgeReviewsPage}/{judgeReviewsTotalPages} 页</Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={judgeReviewsLoading || judgeReviewsPage <= 1}
          onClick={() => setJudgeReviewsPage((p) => Math.max(1, p - 1))}
        >
          上一页
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={judgeReviewsLoading || !judgeReviewsHasNext}
          onClick={() => setJudgeReviewsPage((p) => p + 1)}
        >
          下一页
        </Button>
      </Stack>
    </Paper>
  );

  const profilePane = (
    <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${CONTEST_THEME.panelBorder}`, background: CONTEST_THEME.panelGradient }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        账号、手机号、邮箱由主平台维护；如需修改手机号或邮箱，请联系管理员处理。这里仅可编辑比赛系统资料。
      </Alert>
      <Grid2 container spacing={2}>
        <Grid2 size={4}>
          <TextField
            fullWidth
            size="small"
            label="用户名"
            value={profileValue(profileData?.username)}
            slotProps={{ input: { readOnly: true } }}
          />
        </Grid2>
        <Grid2 size={4}>
          <TextField
            fullWidth
            size="small"
            label="手机号"
            value={profileValue(profileData?.phone)}
            helperText="如需修改，请联系管理员"
            slotProps={{ input: { readOnly: true } }}
          />
        </Grid2>
        <Grid2 size={4}>
          <TextField
            fullWidth
            size="small"
            label="邮箱"
            value={profileValue(profileData?.email)}
            helperText="如需修改，请联系管理员"
            slotProps={{ input: { readOnly: true } }}
          />
        </Grid2>
      </Grid2>

      <Divider sx={{ my: 2 }} />

      <Stack spacing={2}>
        {profileEditing ? (
          <>
            <TextField
              select
              fullWidth
              size="small"
              label="在读状态 *"
              value={profileStatus}
              onChange={(e) => {
                const nextStatus = String(e.target.value || 'in_school');
                setProfileForm((prev) => ({
                  ...prev,
                  study_status: nextStatus,
                  school: nextStatus === 'in_school' ? prev.school : '',
                  major: nextStatus === 'in_school' ? prev.major : '',
                  grade: nextStatus === 'in_school' ? prev.grade : '',
                  occupation: nextStatus === 'in_school' ? '' : prev.occupation,
                }));
                setProfileErrors((prev) => ({
                  ...prev,
                  study_status: '',
                  school: '',
                  major: '',
                  grade: '',
                  occupation: '',
                }));
              }}
            >
              <MenuItem value="in_school">在读</MenuItem>
              <MenuItem value="not_in_school">非在读</MenuItem>
            </TextField>
            {profileInSchool ? (
              <Grid2 container spacing={2}>
                <Grid2 size={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="学校 *"
                    value={profileForm.school}
                    error={!!profileErrors.school}
                    helperText={profileErrors.school}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileForm((prev) => ({ ...prev, school: value }));
                      setProfileErrors((prev) => ({ ...prev, school: '' }));
                    }}
                  />
                </Grid2>
                <Grid2 size={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="专业 *"
                    value={profileForm.major}
                    error={!!profileErrors.major}
                    helperText={profileErrors.major}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileForm((prev) => ({ ...prev, major: value }));
                      setProfileErrors((prev) => ({ ...prev, major: '' }));
                    }}
                  />
                </Grid2>
                <Grid2 size={4}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="年级 *"
                    value={profileForm.grade}
                    error={!!profileErrors.grade}
                    helperText={profileErrors.grade}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileForm((prev) => ({ ...prev, grade: value }));
                      setProfileErrors((prev) => ({ ...prev, grade: '' }));
                    }}
                  >
                    {profileGradeOptions.map((item) => (
                      <MenuItem key={item} value={item}>{item}</MenuItem>
                    ))}
                  </TextField>
                </Grid2>
              </Grid2>
            ) : (
              <TextField
                fullWidth
                size="small"
                label="职业 *"
                value={profileForm.occupation}
                error={!!profileErrors.occupation}
                helperText={profileErrors.occupation}
                onChange={(e) => {
                  const value = e.target.value;
                  setProfileForm((prev) => ({ ...prev, occupation: value }));
                  setProfileErrors((prev) => ({ ...prev, occupation: '' }));
                }}
              />
            )}
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={3}
              label="个人简介"
              value={profileForm.bio}
              error={!!profileErrors.bio}
              helperText={profileErrors.bio || '最多 1000 字'}
              onChange={(e) => {
                const value = e.target.value;
                setProfileForm((prev) => ({ ...prev, bio: value }));
                setProfileErrors((prev) => ({ ...prev, bio: '' }));
              }}
            />
          </>
        ) : (
          <Stack spacing={0.2}>
            <DetailItem label="在读状态" value={studyStatusLabel(normalizeStudyStatus(profileData?.study_status, profileData || {}))} />
            {normalizeStudyStatus(profileData?.study_status, profileData || {}) === 'in_school' ? (
              <>
                <DetailItem label="学校" value={profileData?.school} />
                <DetailItem label="专业" value={profileData?.major} />
                <DetailItem label="年级" value={profileData?.grade} />
              </>
            ) : (
              <DetailItem label="职业" value={profileData?.occupation} />
            )}
            <DetailItem label="个人简介" value={profileData?.bio || '-'} />
            <DetailItem
              label="注册时间"
              value={profileData?.created_at && dayjs(profileData.created_at).isValid()
                ? dayjs(profileData.created_at).format('YYYY-MM-DD HH:mm')
                : '-'}
            />
          </Stack>
        )}
      </Stack>

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2.5 }}>
        {profileEditing ? (
          <>
            <Button variant="outlined" onClick={cancelEditProfile} disabled={profileSaving}>
              取消
            </Button>
            <Button variant="contained" onClick={submitProfileUpdate} disabled={profileSaving}>
              {profileSaving ? '保存中...' : '保存信息'}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={startEditProfile}>
            编辑信息
          </Button>
        )}
      </Stack>
    </Paper>
  );

  const userSyncReviewPane = (
    <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${CONTEST_THEME.panelBorder}`, background: CONTEST_THEME.panelGradient }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        仅管理员可审核：只展示“contest 本地注册且已报名、尚未同步到主平台 users”的用户。
      </Alert>
      <Alert severity="warning" sx={{ mb: 2 }}>
        {USER_SYNC_CONFLICT_HINT}
      </Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="搜索（用户名/手机号/邮箱/比赛名/创办者）"
          value={userSyncKeywordInput}
          onChange={(event) => setUserSyncKeywordInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') searchUserSyncReviews();
          }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>状态</InputLabel>
          <Select
            label="状态"
            value={userSyncStatus}
            onChange={(event) => changeUserSyncStatus(event.target.value)}
          >
            {USER_SYNC_REVIEW_STATUS_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" onClick={searchUserSyncReviews} disabled={userSyncLoading}>搜索</Button>
        <Button variant="outlined" onClick={clearUserSyncReviewsSearch} disabled={userSyncLoading}>清空</Button>
      </Stack>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 1.2 }}
      >
        <Typography variant="body2" color="text.secondary">
          已选择 {userSyncSelectedIds.length} 项
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            size="small"
            variant="contained"
            startIcon={<CheckCircleRoundedIcon />}
            disabled={userSyncLoading || !userSyncSelectedIds.length}
            onClick={() => openUserSyncBatchDecisionDialog('approve')}
          >
            批量通过并同步
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<CloseRoundedIcon />}
            disabled={userSyncLoading || !userSyncSelectedIds.length}
            onClick={() => openUserSyncBatchDecisionDialog('reject')}
          >
            批量拒绝
          </Button>
          <Button
            size="small"
            variant="text"
            disabled={!userSyncSelectedIds.length}
            onClick={clearUserSyncSelection}
          >
            清空已选
          </Button>
        </Stack>
      </Stack>

      <TableContainer sx={{ border: `1px solid ${CONTEST_THEME.tableBorder}`, borderRadius: 2, minHeight: 420 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ background: CONTEST_THEME.tableHeadBg }}>
              <TableCell align="center" sx={{ width: 56 }}>
                <Checkbox
                  size="small"
                  checked={userSyncAllCurrentSelected}
                  indeterminate={userSyncCurrentIndeterminate}
                  disabled={!userSyncCurrentPageIds.length}
                  onChange={(event) => {
                    event.stopPropagation();
                    toggleUserSyncSelectCurrentPage(event.target.checked);
                  }}
                />
              </TableCell>
              <TableCell>用户信息</TableCell>
              <TableCell>在读信息</TableCell>
              <TableCell>报名上下文</TableCell>
              <TableCell align="center">审核状态</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {userSyncRows.map((row) => {
              const contestUserId = Number(row?.contest_user_id);
              const selectable = !Number.isNaN(contestUserId) && contestUserId > 0;
              const checked = selectable && userSyncSelectedIdSet.has(contestUserId);
              const studyStatus = normalizeStudyStatus(row?.study_status, row);
              const competitions = row?.registration_context?.competitions || [];
              const latestReview = row?.latest_review || null;
              return (
                <TableRow
                  key={`user_sync_${row?.contest_user_id}`}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => openUserSyncReview(row)}
                >
                  <TableCell align="center" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={checked}
                      disabled={!selectable}
                      onChange={(event) => toggleUserSyncRowSelection(contestUserId, event.target.checked)}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {profileValue(row?.username)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      邮箱：{profileValue(row?.email)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      手机：{profileValue(row?.phone)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <Typography variant="body2">
                      在读状态：{studyStatusLabel(studyStatus)}
                    </Typography>
                    {studyStatus === 'in_school' ? (
                      <>
                        <Typography variant="body2" color="text.secondary">学校：{profileValue(row?.school)}</Typography>
                        <Typography variant="body2" color="text.secondary">专业：{profileValue(row?.major)}</Typography>
                        <Typography variant="body2" color="text.secondary">年级：{profileValue(row?.grade)}</Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">职业：{profileValue(row?.occupation)}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ minWidth: 320 }}>
                    <Typography variant="body2" color="text.secondary">
                      报名数：{Number(row?.registration_context?.competitions_count || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: competitions.length ? 0.6 : 0 }}>
                      最近报名：{formatTimeValue(row?.registration_context?.last_registered_at, '-')}
                    </Typography>
                    {!!competitions.length && (
                      <Stack spacing={0.3}>
                        {competitions.slice(0, 3).map((item) => (
                          <Typography key={`sync_comp_${row?.contest_user_id}_${item?.competition_id}`} variant="caption" color="text.secondary">
                            {profileValue(item?.competition_name)} ｜ 创办者：{profileValue(item?.competition_creator_name || item?.competition_creator_email)}
                          </Typography>
                        ))}
                        {competitions.length > 3 && (
                          <Typography variant="caption" color="text.secondary">... 还有 {competitions.length - 3} 场</Typography>
                        )}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>
                    <Chip
                      size="small"
                      color={userSyncReviewStatusColor(row?.review_status)}
                      label={userSyncReviewStatusLabel(row?.review_status)}
                    />
                    {String(row?.review_status || '').trim().toLowerCase() === 'conflict' && (
                      <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.6 }}>
                        需人工处理归属冲突
                      </Typography>
                    )}
                    {latestReview && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
                        最近：{formatTimeValue(latestReview?.created_at, '-')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ minWidth: 160 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={(event) => {
                        event.stopPropagation();
                        openUserSyncReview(row);
                      }}
                    >
                      审核
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!userSyncRows.length && !userSyncLoading && (
              <TableRow><TableCell align="center" colSpan={6}>暂无待审核用户</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
        <Typography variant="body2" color="text.secondary">{userSyncPage}/{userSyncTotalPages} 页</Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={userSyncLoading || userSyncPage <= 1}
          onClick={() => changeUserSyncPage(userSyncPage - 1)}
        >
          上一页
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={userSyncLoading || !userSyncHasNext}
          onClick={() => changeUserSyncPage(userSyncPage + 1)}
        >
          下一页
        </Button>
      </Stack>
    </Paper>
  );

  return (
    <Box sx={{ minHeight: '100vh', p: 2, overflowX: 'auto', background: CONTEST_THEME.pageBg }}>
      <Box sx={{ width: 'calc(100vw - 32px)', maxWidth: 1460, mx: 'auto', display: 'flex', gap: 2 }}>
        <Paper sx={{ width: 240, borderRadius: 4, border: `1px solid ${CONTEST_THEME.sideNavBorder}`, p: 1.5, background: CONTEST_THEME.sideNavBg, color: CONTEST_THEME.sideNavText }}>
          <Typography sx={{ textAlign: 'center', fontSize: 20, fontWeight: 700, letterSpacing: '.08em', mb: 1.5 }}>竞赛</Typography>
          <Stack spacing={1}>
            {navItems.map((item) => (
              <Button
                key={item.key}
                onClick={() => switchTab(item.key, true)}
                fullWidth
                startIcon={item.icon}
                sx={{ color: CONTEST_THEME.sideNavText, justifyContent: 'flex-start', borderRadius: 2, background: tab === item.key ? CONTEST_THEME.sideNavActiveBg : 'transparent' }}
              >
                <Box>{item.label}</Box>
              </Button>
            ))}
            <Divider sx={{ borderColor: CONTEST_THEME.sideNavDivider, my: 0.5 }} />
            <Button onClick={handleLogout} sx={{ color: CONTEST_THEME.sideNavText }}>
              {user ? '退出' : '登录'}
            </Button>
          </Stack>
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper sx={{ p: 2.5, borderRadius: 4, border: `1px solid ${CONTEST_THEME.panelBorder}`, mb: 2, background: CONTEST_THEME.headerGradient }}>
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: 36 }}>数智文献处理平台比赛系统</Typography>
            <Typography color="text.secondary">
              当前：{title} · 当前用户：{user?.username || user?.email || '游客'}
            </Typography>
          </Paper>

          {currentTabLoading ? (
            <Stack alignItems="center" sx={{ py: 10 }}><CircularProgress /></Stack>
          ) : (
            <>
              {tab === 'home' && homePane}
              {tab === 'my_contests' && myContestsPane}
              {tab === 'judge_reviews' && judgeReviewsPane}
              {tab === 'profile' && profilePane}
              {tab === 'create' && createPane}
              {tab === 'mine' && minePane}
              {tab === 'user_sync_review' && userSyncReviewPane}
            </>
          )}
        </Box>
      </Box>

      <Dialog
        open={editOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“取消”或“关闭”按钮，再关闭窗口' });
            return;
          }
          setEditOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          修改比赛信息
          <IconButton
            aria-label="关闭"
            onClick={() => setEditOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <CompetitionForm form={editForm} setForm={setEditForm} errors={editErrors} setErrors={setEditErrors} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={actionLoading}>取消</Button>
          <Button onClick={submitEdit} variant="contained" disabled={actionLoading}>
            {actionLoading ? '保存中...' : '保存修改'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={detailOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“关闭”按钮，再关闭窗口' });
            return;
          }
          setDetailOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          比赛详情
          <IconButton
            aria-label="关闭"
            onClick={() => setDetailOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }} spacing={1}>
              <CircularProgress size={26} />
              <Typography variant="body2" color="text.secondary">详情加载中...</Typography>
            </Stack>
          ) : !detailData ? (
            <Typography color="text.secondary">暂无详情数据</Typography>
          ) : (
            <Grid2 container spacing={2}>
              <Grid2 size={7}>
                <DetailItem label="比赛名称" value={detailData.name} />
                <DetailItem
                  label="比赛创办者"
                  value={detailData.created_by_username || (detailData.created_by ? `用户ID ${detailData.created_by}` : '-')}
                />
                <DetailItem label="比赛描述" value={detailData.description} />
                <DetailItem label="报名时间" value={`${formatTimeValue(detailData.registration_start, '-')} ~ ${formatTimeValue(detailData.registration_end, '待定')}`} />
                <DetailItem label="比赛时间" value={`${formatTimeValue(detailData.submission_start, '待定')} ~ ${formatTimeValue(detailData.submission_end, '待定')}`} />
                <DetailItem label="评审时间" value={`${formatTimeValue(detailData.review_start, '待定')} ~ ${formatTimeValue(detailData.review_end, '待定')}`} />
                <DetailItem
                  label="报名链接"
                  value={buildCompetitionShareUrl(detailData.id, 'register') || '-'}
                />
              </Grid2>
              <Grid2 size={5}>
                <DetailItem label="状态" value={statusOf(detailData).label} />
                <DetailItem label="参赛模式" value={teamModeText(detailData.team_mode)} />
                <DetailItem label="最大参赛人数" value={String(detailData.max_participants || '-')} />
                <DetailItem label="报名人数" value={detailParticipantCountText} />
                <DetailItem label="比赛限制" value={competitionLimitText(detailData)} />
                {detailFromMine && registrationCodeRequired(detailData) && (
                  <DetailItem label="报名码" value={String(detailData.registration_code || '').trim() || '-'} />
                )}
                <DetailItem label="作品提交格式" value={competitionAttachmentText(detailData)} />
                <DetailItem label="字数要求" value={`${detailData.min_word_count || 0} ~ ${detailData.max_word_count || 0}`} />
                <DetailItem label="文件大小上限(MB)" value={String(detailData.max_file_size_mb || '-')} />
                <DetailItem label="是否公开排名" value={Number(detailData.show_ranking) ? '是' : '否'} />
                {detailRegistered && (
                  <DetailItem
                    label="我的作品状态"
                    value={
                      detailSubmittedInfo
                        ? `已提交（版本 ${detailSubmittedInfo.submit_version || 1}）`
                        : '未提交'
                    }
                  />
                )}
              </Grid2>
            </Grid2>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 1.5 }}>
          <Box>
            {!detailFromMine && statusOf(detailData || {}).key === 'registration' && (
              <Stack direction="row" spacing={1}>
                <Button
                  variant={detailRegistered || detailRegistrationFull ? 'outlined' : 'contained'}
                  color={detailRegistered ? 'success' : (detailRegistrationFull ? 'warning' : 'primary')}
                  disabled={detailRegistered || detailRegistrationFull || actionLoading}
                  onClick={() => {
                    if (detailRegistered || detailRegistrationFull) return;
                    submitJoinCompetition(detailData);
                  }}
                >
                  {detailRegistered ? '已报名' : (detailRegistrationFull ? '报名人数已满' : '报名')}
                </Button>
                {detailRegistered && (
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={!canQuitCompetition(detailData) || actionLoading}
                    onClick={() => openQuitDialog(detailData)}
                  >
                    退出比赛
                  </Button>
                )}
              </Stack>
            )}
            {!detailFromMine && statusOf(detailData || {}).key === 'ongoing' && (
              detailRegistered ? (
                <Button
                  variant={detailSubmittedInfo ? 'outlined' : 'contained'}
                  color={detailSubmittedInfo ? 'warning' : 'primary'}
                  onClick={() => openSubmissionDialog(detailData)}
                >
                  {detailSubmittedInfo ? '修改作品' : '提交作品'}
                </Button>
              ) : (
                <Button variant="outlined" disabled>
                  未参赛
                </Button>
              )
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            {detailData && (detailFromMine || canCreateCompetition) && (
              <Button
                variant="outlined"
                onClick={() => openParticipants(detailData)}
              >
                参赛选手信息
              </Button>
            )}
            {detailData && (detailFromMine || canCreateCompetition) && (
              <Button
                variant="outlined"
                onClick={() => openJudgeDialog(detailData)}
              >
                评委管理
              </Button>
            )}
            {detailFromMine && detailData && (
              <Button
                variant="outlined"
                onClick={() => {
                  setDetailOpen(false);
                  openEdit(detailData);
                }}
              >
                修改比赛
              </Button>
            )}
            {detailFromMine && detailData && (
              <Button
                variant="outlined"
                color="error"
                onClick={() => openDeleteDialog(detailData)}
              >
                删除比赛
              </Button>
            )}
            <Button onClick={() => setDetailOpen(false)}>关闭</Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <Dialog
        open={joinCodeOpen}
        onClose={() => {
          if (actionLoading) return;
          setJoinCodeOpen(false);
          setJoinCodeTarget(null);
          setJoinCodeValue('');
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>输入报名码</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {joinCodeTarget?.name ? `比赛：${joinCodeTarget.name}` : '该比赛已启用报名码限制'}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="报名码"
              value={joinCodeValue}
              onChange={(event) => setJoinCodeValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitJoinCompetitionWithCode();
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setJoinCodeOpen(false);
              setJoinCodeTarget(null);
              setJoinCodeValue('');
            }}
            disabled={actionLoading}
          >
            取消
          </Button>
          <Button onClick={submitJoinCompetitionWithCode} variant="contained" disabled={actionLoading}>
            确认报名
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={submissionOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“关闭”或“确认提交”按钮，再关闭窗口' });
            return;
          }
          closeSubmissionDialog();
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          {submissionMode === 'resubmit' ? '修改提交作品' : '提交作品'}
          <IconButton
            aria-label="关闭"
            onClick={closeSubmissionDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {submissionLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }} spacing={1}>
              <CircularProgress size={26} />
              <Typography variant="body2" color="text.secondary">提交信息加载中...</Typography>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Alert severity={submissionMode === 'resubmit' ? 'info' : 'success'}>
                {submissionMode === 'resubmit'
                  ? `当前为修改提交：版本 ${submissionExisting?.submit_version || 1}，已修改 ${submissionUsedModifications} / ${submissionMaxModifications} 次，剩余可修改 ${submissionRemainingModifications} 次`
                  : '当前为首次提交：请填写作品信息后提交'}
              </Alert>

              <Typography variant="body2" color="text.secondary">
                附件格式：{normalizeAllowedFormats(submissionTarget?.allowed_formats).join('、')}；
                附件模式：{submissionAttachmentMode === 'multiple' ? '多附件（需全部格式）' : '单附件（任一格式）'}；
                字数范围：{submissionTarget?.min_word_count || 0} ~ {submissionTarget?.max_word_count || 0}；
                文件上限：{submissionTarget?.max_file_size_mb || '-'}MB；
                剩余可修改次数：{submissionRemainingModifications}。
              </Typography>

              <TextField
                fullWidth
                label="作品标题 *"
                value={submissionForm.title}
                onChange={(e) => {
                  const next = e.target.value;
                  setSubmissionForm((prev) => ({ ...prev, title: next }));
                  setSubmissionErrors((prev) => ({ ...prev, title: '' }));
                }}
                error={!!submissionErrors.title}
                helperText={submissionErrors.title}
              />

              <TextField
                fullWidth
                label="作品简介"
                value={submissionForm.work_description}
                onChange={(e) => setSubmissionForm((prev) => ({ ...prev, work_description: e.target.value }))}
              />

              {submissionAttachmentMode === 'multiple' ? (
                <Stack spacing={1}>
                  {submissionAllowedFormats.map((fmt) => {
                    const selectedFile = submissionFilesByFormat[fmt] || null;
                    const existingMeta = submissionExistingAttachmentMap[fmt] || null;
                    const hasAttachment = Boolean(selectedFile || existingMeta);
                    const attachmentName = selectedFile?.name || existingMeta?.attachment_name || `${fmt.toUpperCase()}附件`;
                    const attachmentSizeText = selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)}MB` : '';
                    return (
                      <Stack key={fmt} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Button variant="outlined" component="label">
                          选择{fmt.toUpperCase()}附件
                          <input
                            hidden
                            type="file"
                            accept={`.${fmt}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setSubmissionFilesByFormat((prev) => ({ ...prev, [fmt]: file }));
                              setSubmissionClearedFormats((prev) => {
                                if (!prev[fmt]) return prev;
                                const next = { ...prev };
                                delete next[fmt];
                                return next;
                              });
                              if (submissionPrimaryFormat && fmt === submissionPrimaryFormat) setSubmissionFile(file);
                              setSubmissionAttachmentMenuAnchor(null);
                              setSubmissionAttachmentMenuFormat('');
                              setSubmissionErrors((prev) => ({ ...prev, file: '' }));
                              e.target.value = '';
                            }}
                          />
                        </Button>
                        {hasAttachment ? (
                          <Box sx={{ position: 'relative', width: 268, maxWidth: '72vw', height: 50 }}>
                            <ButtonBase
                              onClick={(event) => openSubmissionAttachmentMenu(event, fmt)}
                              sx={{
                                width: '100%',
                                height: '100%',
                                border: `1px solid ${CONTEST_THEME.attachmentBorder}`,
                                borderRadius: 2,
                                bgcolor: CONTEST_THEME.attachmentBg,
                                boxShadow: CONTEST_THEME.attachmentShadow,
                                display: 'flex',
                                justifyContent: 'flex-start',
                                alignItems: 'center',
                                px: 1.25,
                                transition: 'all .2s ease',
                                '&:hover': {
                                  borderColor: CONTEST_THEME.attachmentHoverBorder,
                                  bgcolor: CONTEST_THEME.attachmentHoverBg,
                                  boxShadow: CONTEST_THEME.attachmentHoverShadow,
                                },
                              }}
                            >
                              <Box
                                sx={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 1.5,
                                  bgcolor: CONTEST_THEME.attachmentIconBoxBg,
                                  border: `1px solid ${CONTEST_THEME.attachmentIconBoxBorder}`,
                                  display: 'grid',
                                  placeItems: 'center',
                                  mr: 1,
                                  flexShrink: 0,
                                }}
                              >
                                <InsertDriveFileRoundedIcon sx={{ fontSize: 17, color: CONTEST_THEME.attachmentIcon }} />
                              </Box>
                              <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    color: CONTEST_THEME.attachmentText,
                                    fontWeight: 700,
                                    lineHeight: 1.15,
                                  }}
                                >
                                  {attachmentName}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: CONTEST_THEME.attachmentSubText,
                                    display: 'block',
                                    mt: 0.1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {attachmentSizeText ? `${attachmentSizeText} · 点击预览/下载` : '点击预览/下载'}
                                </Typography>
                              </Box>
                            </ButtonBase>
                            {hasAttachment && (
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  clearSubmissionAttachment(fmt);
                                }}
                                sx={{
                                  position: 'absolute',
                                  top: -9,
                                  right: -9,
                                  width: 22,
                                  height: 22,
                                  bgcolor: '#fff',
                                  border: `1px solid ${CONTEST_THEME.clearBtnBorder}`,
                                  '&:hover': { bgcolor: CONTEST_THEME.clearBtnHoverBg },
                                }}
                              >
                                <CloseRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="error.main">未选择</Typography>
                        )}
                      </Stack>
                    );
                  })}
                  <FormHelperText sx={{ m: 0 }}>
                    多附件模式下，必须为每种允许格式各提交一个附件。
                  </FormHelperText>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Button variant="outlined" component="label">
                    选择附件
                    <input
                      hidden
                      type="file"
                      accept={getSubmissionFileAccept(submissionTarget?.allowed_formats)}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSubmissionFile(file);
                        setSubmissionAttachmentMenuAnchor(null);
                        setSubmissionAttachmentMenuFormat('');
                        setSubmissionErrors((prev) => ({ ...prev, file: '' }));
                        e.target.value = '';
                      }}
                    />
                  </Button>
                  {hasSubmissionAttachment && (
                    <Box sx={{ position: 'relative', width: 268, maxWidth: '72vw', height: 50 }}>
                      <ButtonBase
                        onClick={openSubmissionAttachmentMenu}
                        sx={{
                          width: '100%',
                          height: '100%',
                          border: `1px solid ${CONTEST_THEME.attachmentBorder}`,
                          borderRadius: 2,
                          bgcolor: CONTEST_THEME.attachmentBg,
                          boxShadow: CONTEST_THEME.attachmentShadow,
                          display: 'flex',
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          px: 1.25,
                          transition: 'all .2s ease',
                          '&:hover': {
                            borderColor: CONTEST_THEME.attachmentHoverBorder,
                            bgcolor: CONTEST_THEME.attachmentHoverBg,
                            boxShadow: CONTEST_THEME.attachmentHoverShadow,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: 1.5,
                            bgcolor: CONTEST_THEME.attachmentIconBoxBg,
                            border: `1px solid ${CONTEST_THEME.attachmentIconBoxBorder}`,
                            display: 'grid',
                            placeItems: 'center',
                            mr: 1,
                            flexShrink: 0,
                          }}
                        >
                          <InsertDriveFileRoundedIcon sx={{ fontSize: 17, color: CONTEST_THEME.attachmentIcon }} />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: CONTEST_THEME.attachmentText,
                              fontWeight: 700,
                              lineHeight: 1.15,
                            }}
                          >
                            {submissionAttachmentName || '附件'}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: CONTEST_THEME.attachmentSubText,
                              display: 'block',
                              mt: 0.1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {submissionAttachmentSizeText ? `${submissionAttachmentSizeText} · 点击预览/下载` : '点击预览/下载'}
                          </Typography>
                        </Box>
                      </ButtonBase>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearSubmissionAttachment();
                        }}
                        sx={{
                          position: 'absolute',
                          top: -9,
                          right: -9,
                          width: 22,
                          height: 22,
                          bgcolor: '#fff',
                          border: `1px solid ${CONTEST_THEME.clearBtnBorder}`,
                          '&:hover': { bgcolor: CONTEST_THEME.clearBtnHoverBg },
                        }}
                      >
                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  )}
                </Stack>
              )}
              {!!submissionErrors.file && <FormHelperText error>{submissionErrors.file}</FormHelperText>}
              {submissionProgress.mode !== 'idle' && (
                <Stack spacing={0.6}>
                  <Typography variant="caption" color="text.secondary">
                    {submissionProgress.mode === 'uploading'
                      ? `附件上传中 ${submissionProgress.percent}%`
                      : '附件上传完成，正在保存作品...'}
                  </Typography>
                  <LinearProgress
                    variant={submissionProgress.mode === 'uploading' ? 'determinate' : 'indeterminate'}
                    value={submissionProgress.percent}
                    sx={{ height: 7, borderRadius: 999 }}
                  />
                </Stack>
              )}
              <Menu
                anchorEl={submissionAttachmentMenuAnchor}
                open={submissionAttachmentMenuOpen}
                onClose={closeSubmissionAttachmentMenu}
              >
                <MenuItem onClick={previewSubmissionAttachment}>预览</MenuItem>
                <MenuItem onClick={downloadSubmissionAttachment}>下载</MenuItem>
              </Menu>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSubmissionDialog} disabled={actionLoading}>关闭</Button>
          <Button variant="contained" onClick={submitSubmission} disabled={actionLoading || submissionLoading}>
            {actionLoading ? '提交中...' : (submissionMode === 'resubmit' ? '确认修改提交' : '确认提交')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={participantsOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“关闭”按钮，再关闭窗口' });
            return;
          }
          setParticipantsOpen(false);
        }}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pr: 6 }}>
          参赛选手信息（比赛：{participantsTarget?.name || participantsTarget?.id || '-'}）
          <IconButton
            aria-label="关闭"
            onClick={() => setParticipantsOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              label="搜索选手（姓名/邮箱/手机号/学校/专业/职业）"
              value={participantsKeywordInput}
              onChange={(e) => setParticipantsKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchParticipants();
              }}
            />
            <Button variant="contained" onClick={searchParticipants} disabled={participantsLoading}>搜索</Button>
            <Button variant="outlined" onClick={clearParticipantsSearch} disabled={participantsLoading}>清空</Button>
          </Stack>
          {participantsLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }} spacing={1}>
              <CircularProgress size={26} />
              <Typography variant="body2" color="text.secondary">参赛选手信息加载中...</Typography>
            </Stack>
          ) : !participantsRowsDisplay.length ? (
            <Typography color="text.secondary">当前比赛暂无参赛选手信息</Typography>
          ) : (
            <TableContainer sx={{ border: `1px solid ${CONTEST_THEME.tableBorder}`, borderRadius: 2, maxHeight: 460 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ background: CONTEST_THEME.tableHeadBg }}>
                    <TableCell>姓名</TableCell>
                    <TableCell align="center" sx={{ width: 170 }}>
                      <ButtonBase
                        onClick={toggleParticipantsStatusOrder}
                        sx={{
                          px: 0.6,
                          py: 0.25,
                          borderRadius: 1,
                          color: CONTEST_THEME.sortPrimary,
                          fontWeight: 700,
                          '&:hover': { bgcolor: CONTEST_THEME.sortPrimaryHover },
                        }}
                      >
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <span>状态</span>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              lineHeight: 1,
                              fontSize: 10,
                              color: CONTEST_THEME.sortSecondary,
                              userSelect: 'none',
                            }}
                          >
                            <span
                              style={{
                                opacity: participantsStatusOrder === 'submitted_first' ? 1 : 0.45,
                              }}
                            >
                              ▲
                            </span>
                            <span
                              style={{
                                opacity: participantsStatusOrder === 'unsubmitted_first' ? 1 : 0.45,
                              }}
                            >
                              ▼
                            </span>
                          </Box>
                        </Box>
                      </ButtonBase>
                    </TableCell>
                    <TableCell>邮箱</TableCell>
                    <TableCell>手机</TableCell>
                    <TableCell>在读状态</TableCell>
                    {participantsDisplayFieldFlags.showInSchoolFields && (
                      <>
                        <TableCell>学校</TableCell>
                        <TableCell>专业</TableCell>
                        <TableCell>年级</TableCell>
                      </>
                    )}
                    {participantsDisplayFieldFlags.showOccupation && <TableCell>职业</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {participantsRowsDisplay.map((item) => {
                    const status = normalizeStudyStatus(item?.study_status, item);
                    const inSchool = status === 'in_school';
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>{profileValue(item?.name)}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            color={item.submission_status === 'submitted' ? 'success' : 'default'}
                            variant={item.submission_status === 'submitted' ? 'filled' : 'outlined'}
                            label={submissionStatusLabel(item.submission_status)}
                          />
                        </TableCell>
                        <TableCell>{profileValue(item?.email)}</TableCell>
                        <TableCell>{profileValue(item?.phone)}</TableCell>
                        <TableCell>{studyStatusLabel(status)}</TableCell>
                        {participantsDisplayFieldFlags.showInSchoolFields && (
                          <>
                            <TableCell>{inSchool ? profileValue(item?.school) : ''}</TableCell>
                            <TableCell>{inSchool ? profileValue(item?.major) : ''}</TableCell>
                            <TableCell>{inSchool ? profileValue(item?.grade) : ''}</TableCell>
                          </>
                        )}
                        {participantsDisplayFieldFlags.showOccupation && (
                          <TableCell>{inSchool ? '' : profileValue(item?.occupation)}</TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {!participantsLoading && !!participantsRowsDisplay.length && (
            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mt: 1.25 }}>
              <Typography variant="body2" color="text.secondary">{participantsPage}/{participantsTotalPages} 页</Typography>
              <Button
                size="small"
                variant="outlined"
                disabled={participantsPage <= 1}
                onClick={() => changeParticipantsPage(participantsPage - 1)}
              >
                上一页
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!participantsHasNext}
                onClick={() => changeParticipantsPage(participantsPage + 1)}
              >
                下一页
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={exportParticipantsExcel}
            disabled={participantsLoading || participantsExporting}
          >
            {participantsExporting ? '导出中...' : '导出全部Excel'}
          </Button>
          <Button onClick={() => setParticipantsOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={judgeOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“关闭”按钮，再关闭窗口' });
            return;
          }
          setJudgeOpen(false);
          setJudgeTarget(null);
          setJudgeAddConfirmOpen(false);
          setJudgeAddConfirmAccount('');
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          评委管理（比赛：{judgeTarget?.name || judgeTarget?.id || '-'}）
          <IconButton
            aria-label="关闭"
            onClick={() => {
              setJudgeOpen(false);
              setJudgeTarget(null);
              setJudgeAddConfirmOpen(false);
              setJudgeAddConfirmAccount('');
            }}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="info">
              通过手机号或邮箱添加评委。评委采用“启用/停用”管理，不提供删除操作。
            </Alert>
            <Typography variant="subtitle2" color="text.secondary">新增评委</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                fullWidth
                size="small"
                id="judge-account-input"
                name="judge_account"
                label="新增评委（手机号 / 邮箱）"
                value={judgeAccount}
                onChange={(event) => setJudgeAccount(event.target.value)}
                autoComplete="new-password"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitAddJudge();
                }}
              />
              <Button
                variant="contained"
                onClick={submitAddJudge}
                disabled={judgeSubmitting}
                sx={{ minWidth: { xs: '100%', sm: 96 } }}
              >
                添加评委
              </Button>
            </Stack>
            <Typography variant="subtitle2" color="text.secondary">筛选评委</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                fullWidth
                size="small"
                id="judge-search-input"
                name="judge_search"
                label="搜索评委（用户名/邮箱/手机号）"
                value={judgeKeywordInput}
                onChange={(event) => setJudgeKeywordInput(event.target.value)}
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') searchJudges();
                }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="judge-status-label">状态</InputLabel>
                <Select
                  labelId="judge-status-label"
                  label="状态"
                  value={judgeStatus}
                  onChange={(event) => applyJudgeStatusFilter(String(event.target.value || 'all'))}
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value="active">启用</MenuItem>
                  <MenuItem value="disabled">停用</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" onClick={searchJudges} disabled={judgeLoading}>搜索</Button>
              <Button variant="outlined" onClick={clearJudgesSearch} disabled={judgeLoading}>清空</Button>
            </Stack>

            {judgeLoading ? (
              <Stack alignItems="center" sx={{ py: 4 }} spacing={1}>
                <CircularProgress size={26} />
                <Typography variant="body2" color="text.secondary">评委列表加载中...</Typography>
              </Stack>
            ) : !judgeRows.length ? (
              <Typography color="text.secondary">当前比赛暂无评委</Typography>
            ) : (
              <TableContainer sx={{ border: `1px solid ${CONTEST_THEME.tableBorder}`, borderRadius: 2, maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ background: CONTEST_THEME.tableHeadBg }}>
                      <TableCell>用户名</TableCell>
                      <TableCell>邮箱</TableCell>
                      <TableCell>手机号</TableCell>
                      <TableCell align="center">状态</TableCell>
                      <TableCell>添加人</TableCell>
                      <TableCell>添加时间</TableCell>
                      <TableCell align="center">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {judgeRows.map((row) => (
                      <TableRow key={`${row.competition_id}_${row.judge_user_id}`} hover>
                        <TableCell>{row.judge_username || '-'}</TableCell>
                        <TableCell>{row.judge_email || '-'}</TableCell>
                        <TableCell>{row.judge_phone || '-'}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            color={String(row.status || '').toLowerCase() === 'disabled' ? 'warning' : 'success'}
                            variant={String(row.status || '').toLowerCase() === 'disabled' ? 'outlined' : 'filled'}
                            label={judgeStatusLabel(row.status)}
                          />
                        </TableCell>
                        <TableCell>{row.invited_by_username || row.invited_by_email || '-'}</TableCell>
                        <TableCell>{formatTimeValue(row.invited_at, '-')}</TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={judgeSubmitting}
                              onClick={() => switchJudgeStatus(
                                row,
                                String(row.status || '').toLowerCase() === 'disabled' ? 'active' : 'disabled'
                              )}
                            >
                              {String(row.status || '').toLowerCase() === 'disabled' ? '启用' : '停用'}
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {!judgeLoading && !!judgeRows.length && (
              <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
                <Typography variant="body2" color="text.secondary">{judgePage}/{judgeTotalPages} 页</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={judgePage <= 1}
                  onClick={() => changeJudgePage(judgePage - 1)}
                >
                  上一页
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!judgeHasNext}
                  onClick={() => changeJudgePage(judgePage + 1)}
                >
                  下一页
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setJudgeOpen(false);
              setJudgeTarget(null);
              setJudgeAddConfirmOpen(false);
              setJudgeAddConfirmAccount('');
            }}
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={judgeAddConfirmOpen}
        onClose={(event, reason) => {
          if (judgeSubmitting || reason === 'backdropClick') return;
          setJudgeAddConfirmOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>确认添加评委</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="warning">
              确认将「{judgeAddConfirmAccount || '-'}」添加为当前比赛评委吗？
            </Alert>
            <Typography variant="body2" color="text.secondary">
              添加后评委默认状态为“启用”。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setJudgeAddConfirmOpen(false)}
            disabled={judgeSubmitting}
          >
            取消
          </Button>
          <Button
            variant="contained"
            onClick={confirmAddJudge}
            disabled={judgeSubmitting}
          >
            {judgeSubmitting ? '提交中...' : '确认添加'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={myInfoOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“关闭”按钮，再关闭窗口' });
            return;
          }
          setMyInfoOpen(false);
          setMyInfoCompetition(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 6 }}>
          我的信息：{myInfoCompetition?.name || myInfoCompetition?.id || '-'}
          <IconButton
            aria-label="关闭"
            onClick={() => {
              setMyInfoOpen(false);
              setMyInfoCompetition(null);
            }}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {!myInfoData ? (
            <Typography color="text.secondary">暂无你的报名信息</Typography>
          ) : (
            (() => {
              const status = normalizeStudyStatus(myInfoData?.study_status, myInfoData);
              const inSchool = status === 'in_school';
              return (
                <Stack spacing={0.2}>
                  <DetailItem label="姓名" value={myInfoData.name} />
                  <DetailItem label="邮箱" value={myInfoData.email} />
                  <DetailItem label="手机号" value={myInfoData.phone} />
                  <DetailItem label="在读状态" value={studyStatusLabel(status)} />
                  {inSchool ? (
                    <>
                      <DetailItem label="学校" value={myInfoData.school} />
                      <DetailItem label="专业" value={myInfoData.major} />
                      <DetailItem label="年级" value={myInfoData.grade} />
                    </>
                  ) : (
                    <DetailItem label="职业" value={myInfoData.occupation} />
                  )}
                  {!!String(myInfoData?.bio || '').trim() && (
                    <DetailItem label="个人简介" value={myInfoData.bio} />
                  )}
                </Stack>
              );
            })()
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setMyInfoOpen(false); setMyInfoCompetition(null); }}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={userSyncReviewOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“关闭”按钮，再关闭窗口' });
            return;
          }
          closeUserSyncReview();
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          用户同步审核
          <IconButton
            aria-label="关闭"
            onClick={closeUserSyncReview}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {!userSyncReviewTarget ? (
            <Typography color="text.secondary">暂无审核目标</Typography>
          ) : (
            <Stack spacing={1.5}>
              {String(userSyncReviewTarget?.review_status || '').trim().toLowerCase() === 'conflict' && (
                <Alert severity="warning">
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>当前状态为“冲突”</Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {USER_SYNC_CONFLICT_HINT}
                  </Typography>
                  <Typography variant="body2">
                    建议先在主平台核对 users 中该手机号/邮箱归属，再回到此处重新执行“通过并同步”。
                  </Typography>
                </Alert>
              )}
              <Grid2 container spacing={2}>
                <Grid2 size={6}>
                  <DetailItem label="用户名" value={userSyncReviewTarget?.username} />
                  <DetailItem label="手机号" value={userSyncReviewTarget?.phone} />
                  <DetailItem label="邮箱" value={userSyncReviewTarget?.email} />
                  <DetailItem
                    label="在读状态"
                    value={studyStatusLabel(normalizeStudyStatus(userSyncReviewTarget?.study_status, userSyncReviewTarget || {}))}
                  />
                  {normalizeStudyStatus(userSyncReviewTarget?.study_status, userSyncReviewTarget || {}) === 'in_school' ? (
                    <>
                      <DetailItem label="学校" value={userSyncReviewTarget?.school} />
                      <DetailItem label="专业" value={userSyncReviewTarget?.major} />
                      <DetailItem label="年级" value={userSyncReviewTarget?.grade} />
                    </>
                  ) : (
                    <DetailItem label="职业" value={userSyncReviewTarget?.occupation} />
                  )}
                </Grid2>
                <Grid2 size={6}>
                  <DetailItem
                    label="当前审核状态"
                    value={userSyncReviewStatusLabel(userSyncReviewTarget?.review_status)}
                  />
                  <DetailItem
                    label="报名比赛数"
                    value={String(Number(userSyncReviewTarget?.registration_context?.competitions_count || 0))}
                  />
                  <DetailItem
                    label="最近报名时间"
                    value={formatTimeValue(userSyncReviewTarget?.registration_context?.last_registered_at, '-')}
                  />
                  <DetailItem
                    label="报名比赛列表"
                    value={(userSyncReviewTarget?.registration_context?.competitions || [])
                      .map((item) => `${profileValue(item?.competition_name)}（创办者：${profileValue(item?.competition_creator_name || item?.competition_creator_email)}）`)
                      .join('\n')}
                  />
                  {!!String(userSyncReviewTarget?.latest_review?.reason || '').trim() && (
                    <DetailItem label="最近审核说明" value={userSyncReviewTarget?.latest_review?.reason} />
                  )}
                </Grid2>
              </Grid2>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUserSyncReview}>关闭</Button>
          <Button
            variant="outlined"
            color="warning"
            disabled={!userSyncReviewTarget || userSyncDecisionLoading}
            onClick={() => openUserSyncDecisionDialog('reject')}
            startIcon={<CloseRoundedIcon />}
          >
            拒绝
          </Button>
          <Button
            variant="contained"
            disabled={!userSyncReviewTarget || userSyncDecisionLoading}
            onClick={() => openUserSyncDecisionDialog('approve')}
            startIcon={<CheckCircleRoundedIcon />}
          >
            通过并同步
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={userSyncDecisionOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“取消”或“确认提交”按钮，再关闭窗口' });
            return;
          }
          closeUserSyncDecisionDialog();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          二次确认：{userSyncReviewActionText(userSyncDecisionAction)}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity={userSyncDecisionAction === 'reject' ? 'warning' : 'info'}>
              请确认操作对象：{profileValue(userSyncReviewTarget?.username)}（{profileValue(userSyncReviewTarget?.email)}）
            </Alert>
            <Typography variant="body2" color="text.secondary">
              请输入确认口令：{USER_SYNC_REVIEW_CONFIRM_TEXT[userSyncDecisionAction]}
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="确认口令"
              value={userSyncDecisionConfirmText}
              onChange={(event) => setUserSyncDecisionConfirmText(event.target.value)}
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="审核说明（选填）"
              value={userSyncDecisionReason}
              onChange={(event) => setUserSyncDecisionReason(event.target.value)}
              helperText="可填写审核原因，便于后续追踪。"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUserSyncDecisionDialog} disabled={userSyncDecisionLoading}>取消</Button>
          <Button
            variant="contained"
            color={userSyncDecisionAction === 'reject' ? 'warning' : 'primary'}
            onClick={submitUserSyncDecision}
            disabled={userSyncDecisionLoading}
          >
            {userSyncDecisionLoading ? '提交中...' : '确认提交'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={userSyncBatchDecisionOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“取消”或“确认提交”按钮，再关闭窗口' });
            return;
          }
          closeUserSyncBatchDecisionDialog();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          批量二次确认：{userSyncReviewActionText(userSyncBatchAction)}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity={userSyncBatchAction === 'reject' ? 'warning' : 'info'}>
              已选择 {userSyncSelectedIds.length} 个用户，将批量执行“{userSyncReviewActionText(userSyncBatchAction)}”。
            </Alert>
            <Typography variant="body2" color="text.secondary">
              请输入确认口令：{USER_SYNC_REVIEW_CONFIRM_TEXT[userSyncBatchAction]}
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="确认口令"
              value={userSyncBatchConfirmText}
              onChange={(event) => setUserSyncBatchConfirmText(event.target.value)}
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="审核说明（选填）"
              value={userSyncBatchReason}
              onChange={(event) => setUserSyncBatchReason(event.target.value)}
              helperText="可填写批量处理原因，便于后续追踪。"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUserSyncBatchDecisionDialog} disabled={userSyncBatchDecisionLoading}>取消</Button>
          <Button
            variant="contained"
            color={userSyncBatchAction === 'reject' ? 'warning' : 'primary'}
            onClick={submitUserSyncBatchDecision}
            disabled={userSyncBatchDecisionLoading}
          >
            {userSyncBatchDecisionLoading ? '提交中...' : '确认提交'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“取消”按钮，再关闭窗口' });
            return;
          }
          setDeleteOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 6 }}>
          确认删除比赛
          <IconButton
            aria-label="关闭"
            onClick={() => setDeleteOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              确认删除比赛「{deleteTarget?.name || deleteTarget?.id || ''}」吗？删除后不可恢复。
            </Alert>
            <Typography variant="body2" color="text.secondary">
              请输入当前账号和密码完成删除校验。
            </Typography>
            <TextField
              label="账号（邮箱）"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label="密码"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>取消</Button>
          <Button color="error" variant="contained" onClick={submitDelete} disabled={actionLoading}>
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={quitOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            setMessage({ type: 'warning', text: '请先点击“取消”或“确认退出”按钮，再关闭窗口' });
            return;
          }
          setQuitOpen(false);
          setQuitTarget(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 6 }}>
          确认退出比赛
          <IconButton
            aria-label="关闭"
            onClick={() => {
              setQuitOpen(false);
              setQuitTarget(null);
            }}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              你确认退出比赛「{quitTarget?.name || quitTarget?.id || ''}」吗？
            </Alert>
            <Typography variant="body2" color="text.secondary">
              退出后将失去当前报名资格，且无法提交该比赛作品；如需再次参加，请重新报名。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setQuitOpen(false); setQuitTarget(null); }}>取消</Button>
          <Button
            color="error"
            variant="contained"
            disabled={actionLoading}
            onClick={() => submitQuitCompetition(quitTarget)}
          >
            确认退出
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
export default Dashboard;
