import axios from 'axios';
import {
  contestRuntimeConfig,
  getHostAuthAdapter,
  resolveAccessToken,
} from '../../config/contestRuntimeConfig';
import { toUserFriendlyError } from '../../utils/errorText';

const REQUEST_ID_HEADER = contestRuntimeConfig.api.requestIdHeaderName || 'X-Request-Id';
const CONTEST_API_PREFIX = (contestRuntimeConfig.api.contestApiPrefix || '/api').replace(/\/+$/, '');
const SIGN_UP_API_PREFIX = `${CONTEST_API_PREFIX}/sign-up`;

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function hasHeader(headers = {}, headerName = '') {
  if (!headerName) return false;
  const target = headerName.toLowerCase();
  return Object.keys(headers || {}).some((key) => String(key).toLowerCase() === target);
}

function normalizeError(error) {
  return toUserFriendlyError(error, '请求失败，请稍后重试');
}

function applyCommonRequestHeaders(config) {
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
}

const signUpApi = axios.create({
  baseURL: SIGN_UP_API_PREFIX,
  timeout: Number(contestRuntimeConfig.api.timeoutMs || 12000),
  withCredentials: !!contestRuntimeConfig.api.withCredentials,
});

const userApi = axios.create({
  timeout: Number(contestRuntimeConfig.api.timeoutMs || 12000),
  withCredentials: !!contestRuntimeConfig.api.withCredentials,
});

signUpApi.interceptors.request.use(applyCommonRequestHeaders);
userApi.interceptors.request.use(applyCommonRequestHeaders);

signUpApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeError(error)),
);

userApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeError(error)),
);

export async function sendSignUpVerificationCode(payload) {
  const { data } = await signUpApi.post('/verification-codes', payload);
  return data;
}

export async function submitSignUp(payload) {
  const { data } = await signUpApi.post('', payload);
  return data;
}

export async function getCurrentUserProfile() {
  const mode = String(contestRuntimeConfig.auth.mode || 'embedded').toLowerCase();
  const adapter = getHostAuthAdapter();
  if (mode === 'host' && adapter && typeof adapter.getCurrentUser === 'function') {
    const user = await adapter.getCurrentUser();
    return user || null;
  }

  const meEndpoint = String(contestRuntimeConfig.auth.endpoints.me || '/api/sign-up/me');
  const { data } = await userApi.get(meEndpoint);
  return data?.data?.user || data?.user || null;
}

export default signUpApi;
