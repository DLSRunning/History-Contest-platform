import axios from 'axios';
import {
  contestRuntimeConfig,
  getHostAuthAdapter,
  resolveAccessToken,
} from './config/contestRuntimeConfig';

// 迁移适配说明（access_token）：
// 1) 若复用宿主前端登录，请将 auth.mode 设为 host；本模块不再负责登录入口。
// 2) 若宿主后端要求 Authorization access_token，请开启 auth.accessToken.enabled 并配置 header/storage。
// 3) 后端 get_current_user/get_current_admin 的 token 解析规则必须与这里保持一致。
const REQUEST_ID_HEADER = contestRuntimeConfig.api.requestIdHeaderName || 'X-Request-Id';
const CONTEST_API_PREFIX = (contestRuntimeConfig.api.contestApiPrefix || '/api').replace(/\/+$/, '');
const COMPETITIONS_API_PREFIX = `${CONTEST_API_PREFIX}/competitions`;
const REGISTER_API_PREFIX = `${CONTEST_API_PREFIX}/register`;
const SUBMISSIONS_API_PREFIX = `${CONTEST_API_PREFIX}/submissions`;
const USER_SYNC_API_PREFIX = `${CONTEST_API_PREFIX}/user-sync`;

function normalizePath(path = '') {
  const value = String(path || '').trim();
  if (!value) return '';
  return value.startsWith('/') ? value : `/${value}`;
}

function uniquePaths(paths = []) {
  const seen = new Set();
  const result = [];
  for (const item of paths) {
    const normalized = normalizePath(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function hasHeader(headers = {}, headerName = '') {
  if (!headerName) return false;
  const target = headerName.toLowerCase();
  return Object.keys(headers || {}).some((key) => String(key).toLowerCase() === target);
}

function headerValue(headers = {}, headerName = '') {
  if (!headerName) return '';
  const target = headerName.toLowerCase();
  const key = Object.keys(headers || {}).find((item) => String(item).toLowerCase() === target);
  return key ? headers[key] : '';
}

export function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickRequestId(headers = {}) {
  return (
    headerValue(headers, REQUEST_ID_HEADER)
    || headerValue(headers, 'X-Request-Id')
    || headerValue(headers, 'x-request-id')
    || ''
  );
}

function pickFileName(headers = {}) {
  const contentDisposition = headerValue(headers, 'Content-Disposition') || '';
  if (!contentDisposition) return '';
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]).trim();
    } catch {
      return encodedMatch[1].trim();
    }
  }
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return '';
}

function normalizeMethod(method = '') {
  return String(method || '').trim().toLowerCase();
}

function buildLoginRedirectUrl() {
  const defaultPath = '/login';
  const configured = String(
    contestRuntimeConfig.route?.loginPageUrl
    || contestRuntimeConfig.route?.loginPathPrefix
    || defaultPath
  ).trim() || defaultPath;
  return configured;
}

function redirectToLoginWithNext() {
  if (typeof window === 'undefined') return;
  const loginUrl = buildLoginRedirectUrl();
  const loginPath = normalizePath(loginUrl.split('?')[0] || '/login');
  const currentPath = normalizePath(window.location.pathname || '/');
  if (currentPath === loginPath) return;

  const next = encodeURIComponent(
    `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`
  );
  const separator = loginUrl.includes('?') ? '&' : '?';
  window.location.href = `${loginUrl}${separator}next=${next}`;
}

const client = axios.create({
  withCredentials: !!contestRuntimeConfig.api.withCredentials,
  timeout: Number(contestRuntimeConfig.api.timeoutMs || 12000),
});

client.interceptors.request.use((config) => {
  const headers = config.headers || {};

  if (!hasHeader(headers, REQUEST_ID_HEADER)) {
    headers[REQUEST_ID_HEADER] = createRequestId();
  }

  const tokenConfig = contestRuntimeConfig.auth.accessToken || {};
  if (tokenConfig.enabled) {
    const token = resolveAccessToken();
    const tokenHeaderName = String(tokenConfig.headerName || 'Authorization').trim();
    if (token && tokenHeaderName && !hasHeader(headers, tokenHeaderName)) {
      const prefix = String(tokenConfig.prefix || '');
      headers[tokenHeaderName] = `${prefix}${token}`;
    }
  }

  config.headers = headers;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = Number(error?.response?.status || 0);
    const method = normalizeMethod(error?.config?.method);
    const isWriteMethod = ['post', 'put', 'patch', 'delete'].includes(method);
    if (status === 401 && isWriteMethod) {
      redirectToLoginWithNext();
    }
    return Promise.reject(error);
  }
);

function requestIdHeaders(requestId = '') {
  if (!requestId) return undefined;
  return { [REQUEST_ID_HEADER]: requestId };
}

function toPagedResult(response, limit, offset, fallbackRequestId = '') {
  const data = response?.data;
  const requestId = pickRequestId(response?.headers) || fallbackRequestId;
  if (Array.isArray(data?.data)) {
    return {
      items: data.data,
      total: data.data.length,
      limit,
      offset,
      requestId,
    };
  }
  return {
    items: data?.data?.items || [],
    total: Number(data?.data?.pagination?.total || 0),
    limit: Number(data?.data?.pagination?.limit || limit),
    offset: Number(data?.data?.pagination?.offset || offset),
    requestId,
  };
}

export async function login(account, password) {
  const mode = String(contestRuntimeConfig.auth.mode || 'embedded').toLowerCase();
  const adapter = getHostAuthAdapter();
  if (mode === 'host') {
    if (adapter && typeof adapter.login === 'function') {
      return adapter.login({ account, password });
    }
    throw new Error('当前模块已配置为复用宿主登录，请在宿主系统完成登录');
  }

  const loginEndpoint = String(contestRuntimeConfig.auth.endpoints.login || '/api/sign-up/login');
  const { data } = await client.post(loginEndpoint, { account, password });
  return data;
}

export async function sendSmsLoginCode(phone) {
  const mode = String(contestRuntimeConfig.auth.mode || 'embedded').toLowerCase();
  if (mode === 'host') {
    throw new Error('当前模块已配置为复用宿主登录，请在宿主系统完成短信登录');
  }

  const smsCodeEndpoint = String(
    contestRuntimeConfig.auth.endpoints.smsSendCode || '/api/sign-up/verification-codes/sms'
  );
  const { data } = await client.post(smsCodeEndpoint, { phone, type: 'login' });
  return data;
}

export async function loginWithSmsCode(phone, code) {
  const mode = String(contestRuntimeConfig.auth.mode || 'embedded').toLowerCase();
  if (mode === 'host') {
    throw new Error('当前模块已配置为复用宿主登录，请在宿主系统完成短信登录');
  }

  const smsLoginEndpoint = String(contestRuntimeConfig.auth.endpoints.smsLogin || '/api/sign-up/login/phone');
  const { data } = await client.post(smsLoginEndpoint, { phone, code });
  return data;
}

export async function getCurrentUser(options = {}) {
  const mode = String(contestRuntimeConfig.auth.mode || 'embedded').toLowerCase();
  const adapter = getHostAuthAdapter();
  const timeoutMs = Number(options?.timeoutMs || 0);

  if (mode === 'host' && adapter && typeof adapter.getCurrentUser === 'function') {
    const user = await adapter.getCurrentUser();
    if (user) return user;
  }

  const meEndpoint = String(contestRuntimeConfig.auth.endpoints.me || '/api/sign-up/me');
  const requestConfig = timeoutMs > 0 ? { timeout: timeoutMs } : undefined;
  const { data } = await client.get(meEndpoint, requestConfig);
  return data?.data?.user || data?.user || null;
}

export async function updateCurrentUserProfile(payload, options = {}) {
  const { requestId } = options;
  const meEndpoint = String(contestRuntimeConfig.auth.endpoints.me || '/api/sign-up/me');
  const response = await client.put(meEndpoint, payload, {
    headers: requestIdHeaders(requestId),
  });
  return {
    data: response?.data?.data?.user || response?.data?.user || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function logout() {
  const mode = String(contestRuntimeConfig.auth.mode || 'embedded').toLowerCase();
  const adapter = getHostAuthAdapter();

  if (mode === 'host' && adapter && typeof adapter.logout === 'function') {
    return adapter.logout();
  }

  const configuredEndpoint = String(contestRuntimeConfig.auth.endpoints.logout || '').trim();
  const fallbackByPrefix = `${CONTEST_API_PREFIX}/sign-up/logout`;
  const fallbackApi = '/api/sign-up/logout';
  const fallbackContestApi = '/contest/api/sign-up/logout';
  const candidates = uniquePaths([configuredEndpoint, fallbackByPrefix, fallbackApi, fallbackContestApi]);

  if (!candidates.length) return { message: 'ok' };

  let lastError = null;
  for (const endpoint of candidates) {
    try {
      const { data } = await client.post(endpoint);
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('退出登录失败');
}

export function clearClientAuthState() {
  const tokenConfig = contestRuntimeConfig.auth.accessToken || {};
  const storageType = String(tokenConfig.storageType || '').trim();
  const storageKey = String(tokenConfig.storageKey || '').trim();
  if (!storageKey) return;

  try {
    if (storageType === 'sessionStorage' && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // ignore storage cleanup errors
  }
}

export async function listCompetitions(limit = 100, offset = 0, keyword = '', options = {}) {
  const { fields = 'summary', requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/list`, {
    params: { limit, offset, keyword, fields },
    headers: requestIdHeaders(requestId),
  });
  return response?.data?.data?.items || [];
}

export async function listMyCompetitions(limit = 100, offset = 0, keyword = '', options = {}) {
  const { fields = 'summary', requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/mine/list`, {
    params: { limit, offset, keyword, fields },
    headers: requestIdHeaders(requestId),
  });
  return response?.data?.data?.items || [];
}

export async function listCompetitionsPaged(limit = 20, offset = 0, keyword = '', options = {}) {
  const { fields = 'summary', requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/list`, {
    params: { limit, offset, keyword, fields },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function listMyCompetitionsPaged(limit = 20, offset = 0, keyword = '', options = {}) {
  const { fields = 'summary', requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/mine/list`, {
    params: { limit, offset, keyword, fields },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function listMyRegisteredCompetitionsPaged(limit = 20, offset = 0, keyword = '', options = {}) {
  const { fields = 'summary', requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/my/registered/list`, {
    params: { limit, offset, keyword, fields },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function batchGetCompetitions(ids = [], options = {}) {
  const { fields = 'full', requestId } = options;
  const response = await client.post(
    `${COMPETITIONS_API_PREFIX}/batch`,
    { ids },
    {
      params: { fields },
      headers: requestIdHeaders(requestId),
    }
  );
  return {
    items: response?.data?.data?.items || [],
    missingIds: response?.data?.data?.missing_ids || [],
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function getCompetitionById(id, options = {}) {
  const { requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/${id}`, {
    headers: requestIdHeaders(requestId),
  });
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function getCompetitionTrainingManualMeta(competitionId, options = {}) {
  const { requestId } = options;
  const response = await client.get(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/training-manual/meta`,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function getCompetitionTrainingManualContent(competitionId, options = {}) {
  const { requestId } = options;
  const response = await client.get(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/training-manual/content`,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function upsertCompetitionTrainingManualContent(competitionId, payload, options = {}) {
  const { requestId } = options;
  const response = await client.put(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/training-manual/content`,
    payload,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function updateCompetitionTrainingManualStatus(competitionId, payload, options = {}) {
  const { requestId } = options;
  const response = await client.patch(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/training-manual/status`,
    payload,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function deleteCompetitionTrainingManualContent(competitionId, options = {}) {
  const { requestId } = options;
  const response = await client.delete(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/training-manual/content`,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function uploadCompetitionTrainingManualAsset(competitionId, assetType, file, options = {}) {
  const { requestId, onUploadProgress, timeoutMs } = options;
  const formData = new FormData();
  formData.append('asset_type', String(assetType || '').trim().toLowerCase());
  formData.append('file', file);
  const resolvedTimeout = Number(
    timeoutMs
    || contestRuntimeConfig?.api?.uploadTimeoutMs
    || contestRuntimeConfig?.api?.timeoutMs
    || 120000
  );
  const response = await client.post(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/training-manual/assets/upload`,
    formData,
    {
      headers: {
        ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
      timeout: Number.isFinite(resolvedTimeout) && resolvedTimeout > 0 ? resolvedTimeout : undefined,
    }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function deleteCompetitionTrainingManualAsset(competitionId, assetId, options = {}) {
  const { requestId } = options;
  const response = await client.delete(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/training-manual/assets/${Number(assetId)}`,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function createCompetition(payload, options = {}) {
  const { requestId } = options;
  const response = await client.post(`${COMPETITIONS_API_PREFIX}/create`, payload, {
    headers: requestIdHeaders(requestId),
  });
  return response.data;
}

export async function updateCompetition(id, payload, options = {}) {
  const { requestId } = options;
  const response = await client.put(`${COMPETITIONS_API_PREFIX}/${id}`, payload, {
    headers: requestIdHeaders(requestId),
  });
  return response.data;
}

export async function deleteCompetition(id, payload, options = {}) {
  const { requestId } = options;
  const response = await client.delete(`${COMPETITIONS_API_PREFIX}/${id}`, {
    data: payload,
    headers: requestIdHeaders(requestId),
  });
  return response.data;
}

export async function listCompetitionJudgesPaged(competitionId, limit = 20, offset = 0, keyword = '', options = {}) {
  const { status = 'all', requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges/list`, {
    params: { limit, offset, keyword, status },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function previewCompetitionJudgeCandidate(competitionId, account, options = {}) {
  const { requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges/candidate`, {
    params: { account },
    headers: requestIdHeaders(requestId),
  });
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function addCompetitionJudge(competitionId, payload, options = {}) {
  const { requestId } = options;
  const response = await client.post(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges`,
    payload,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function updateCompetitionJudgeStatus(competitionId, judgeUserId, payload, options = {}) {
  const { requestId } = options;
  const response = await client.put(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges/${Number(judgeUserId)}/status`,
    payload,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function listMyJudgeCompetitionsPaged(limit = 20, offset = 0, keyword = '', options = {}) {
  const { requestId } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/judges/me/competitions/list`, {
    params: { limit, offset, keyword },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function listMyAssignedSubmissionsPaged(
  competitionId,
  limit = 20,
  offset = 0,
  keyword = '',
  options = {}
) {
  const { requestId } = options;
  const response = await client.get(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges/me/assigned-submissions/list`,
    {
      params: { limit, offset, keyword },
      headers: requestIdHeaders(requestId),
    }
  );
  return toPagedResult(response, limit, offset, requestId);
}

export async function getAssignedSubmissionAttachmentBlob(competitionId, submissionId, options = {}) {
  const { requestId, disposition = 'inline', attachmentExt = 'pdf' } = options;
  const response = await client.get(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges/me/assigned-submissions/${Number(submissionId)}/attachment`,
    {
      params: {
        disposition,
        attachment_ext: String(attachmentExt || '').trim().toLowerCase().replace(/^\./, '') || 'pdf',
      },
      headers: requestIdHeaders(requestId),
      responseType: 'blob',
    }
  );
  return {
    blob: response?.data || null,
    fileName: pickFileName(response?.headers) || '',
    contentType: headerValue(response?.headers || {}, 'Content-Type') || '',
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function getMyAssignedSubmissionReview(competitionId, submissionId, options = {}) {
  const { requestId } = options;
  const response = await client.get(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges/me/assigned-submissions/${Number(submissionId)}/review`,
    {
      headers: requestIdHeaders(requestId),
    }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function submitAssignedSubmissionReview(competitionId, submissionId, payload, options = {}) {
  const { requestId } = options;
  const response = await client.post(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges/me/assigned-submissions/${Number(submissionId)}/review`,
    payload,
    {
      headers: requestIdHeaders(requestId),
    }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function deleteCompetitionJudge(competitionId, judgeUserId, options = {}) {
  const { requestId } = options;
  const response = await client.delete(
    `${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/judges/${Number(judgeUserId)}`,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function sendRegisterCode(payload = {}, options = {}) {
  const { requestId } = options;
  const { data } = await client.post(`${REGISTER_API_PREFIX}/verification-codes`, payload, {
    headers: requestIdHeaders(requestId),
  });
  return data;
}

export async function registerParticipant(payload, options = {}) {
  const { requestId } = options;
  const { data } = await client.post(`${REGISTER_API_PREFIX}`, payload, {
    headers: requestIdHeaders(requestId),
  });
  return data;
}

export async function unregisterParticipant(competitionId, options = {}) {
  const { requestId } = options;
  const { data } = await client.delete(`${REGISTER_API_PREFIX}`, {
    data: { competition_id: Number(competitionId) },
    headers: requestIdHeaders(requestId),
  });
  return data;
}

export async function listParticipants(options = {}) {
  const { requestId } = options;
  const { data } = await client.get(`${REGISTER_API_PREFIX}/participants`, {
    headers: requestIdHeaders(requestId),
  });
  if (Array.isArray(data?.data)) return data.data;
  return Array.isArray(data) ? data : [];
}

export async function listParticipantsByCompetition(competitionId, options = {}) {
  const params = { competition_id: Number(competitionId) };
  if (options.email) params.email = options.email;
  const { data } = await client.get(`${REGISTER_API_PREFIX}/participants`, { params });
  if (Array.isArray(data?.data)) return data.data;
  return Array.isArray(data) ? data : [];
}

export async function listCompetitionParticipantsStatusPaged(competitionId, limit = 20, offset = 0, keyword = '', options = {}) {
  const {
    status = 'all',
    sort = 'submitted_first',
    requestId,
  } = options;
  const response = await client.get(`${COMPETITIONS_API_PREFIX}/${Number(competitionId)}/participants/status`, {
    params: { limit, offset, keyword, status, sort },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function getCreatePermission(options = {}) {
  const { requestId } = options;
  const { data } = await client.get(`${COMPETITIONS_API_PREFIX}/permissions/create`, {
    headers: requestIdHeaders(requestId),
  });
  return !!data?.data?.can_create;
}

export async function getUserSyncReviewPermission(options = {}) {
  const { requestId } = options;
  const { data } = await client.get(`${USER_SYNC_API_PREFIX}/permissions/review`, {
    headers: requestIdHeaders(requestId),
  });
  return !!data?.data?.can_review;
}

export async function listUserSyncReviewsPaged(limit = 20, offset = 0, keyword = '', options = {}) {
  const {
    status = 'pending',
    requestId,
  } = options;
  const response = await client.get(`${USER_SYNC_API_PREFIX}/reviews`, {
    params: { limit, offset, keyword, status },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function decideUserSyncReview(contestUserId, payload, options = {}) {
  const { requestId } = options;
  const response = await client.post(
    `${USER_SYNC_API_PREFIX}/reviews/${Number(contestUserId)}/decision`,
    payload,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function batchDecideUserSyncReview(payload, options = {}) {
  const { requestId } = options;
  const response = await client.post(
    `${USER_SYNC_API_PREFIX}/reviews/batch-decision`,
    payload,
    { headers: requestIdHeaders(requestId) }
  );
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function getMySubmissionDetail(competitionId, options = {}) {
  const { requestId } = options;
  const response = await client.get(`${SUBMISSIONS_API_PREFIX}/my/detail`, {
    params: { competition_id: Number(competitionId) },
    headers: requestIdHeaders(requestId),
  });
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function uploadSubmissionAttachment(competitionId, file, options = {}) {
  const { requestId, onUploadProgress, timeoutMs } = options;
  const formData = new FormData();
  formData.append('competition_id', String(Number(competitionId)));
  formData.append('file', file);
  const resolvedTimeout = Number(
    timeoutMs
    || contestRuntimeConfig?.api?.uploadTimeoutMs
    || contestRuntimeConfig?.api?.timeoutMs
    || 120000
  );
  const response = await client.post(`${SUBMISSIONS_API_PREFIX}/upload`, formData, {
    headers: {
      ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
    timeout: Number.isFinite(resolvedTimeout) && resolvedTimeout > 0 ? resolvedTimeout : undefined,
  });
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function listMySubmissionsPaged(limit = 20, offset = 0, keyword = '', options = {}) {
  const { fields = 'summary', requestId } = options;
  const response = await client.get(`${SUBMISSIONS_API_PREFIX}/my/list`, {
    params: { limit, offset, keyword, fields },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function listCompetitionSubmissionsPaged(competitionId, limit = 20, offset = 0, keyword = '', options = {}) {
  const { fields = 'summary', requestId } = options;
  const response = await client.get(`${SUBMISSIONS_API_PREFIX}/competition/${Number(competitionId)}/list`, {
    params: { limit, offset, keyword, fields },
    headers: requestIdHeaders(requestId),
  });
  return toPagedResult(response, limit, offset, requestId);
}

export async function getMySubmissionAttachmentBlob(competitionId, options = {}) {
  const { requestId, disposition = 'attachment', attachmentExt = '' } = options;
  const normalizedExt = String(attachmentExt || '').trim().toLowerCase().replace(/^\./, '');
  const response = await client.get(`${SUBMISSIONS_API_PREFIX}/my/attachment`, {
    params: {
      competition_id: Number(competitionId),
      disposition,
      ...(normalizedExt ? { attachment_ext: normalizedExt } : {}),
    },
    headers: requestIdHeaders(requestId),
    responseType: 'blob',
  });
  return {
    blob: response?.data || null,
    fileName: pickFileName(response?.headers) || '',
    contentType: headerValue(response?.headers || {}, 'Content-Type') || '',
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function createSubmission(payload, options = {}) {
  const { requestId } = options;
  const response = await client.post(`${SUBMISSIONS_API_PREFIX}/create`, payload, {
    headers: requestIdHeaders(requestId),
  });
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function submitSubmission(payload, options = {}) {
  const { requestId } = options;
  const response = await client.post(`${SUBMISSIONS_API_PREFIX}/submit`, payload, {
    headers: requestIdHeaders(requestId),
  });
  return {
    data: response?.data?.data || null,
    message: String(response?.data?.message || '').trim(),
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}

export async function resubmitSubmission(competitionId, payload, options = {}) {
  const { requestId } = options;
  const response = await client.put(`${SUBMISSIONS_API_PREFIX}/${Number(competitionId)}/resubmit`, payload, {
    headers: requestIdHeaders(requestId),
  });
  return {
    data: response?.data?.data || null,
    requestId: pickRequestId(response?.headers) || requestId || '',
  };
}
