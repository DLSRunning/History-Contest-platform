/**
 * contest 前端运行配置（迁移配置入口）
 *
 * 迁移到其它前端项目时，优先改这里（或通过同名环境变量覆盖）：
 * 1) auth.mode: 认证模式
 *    - embedded: 使用本模块内置登录页（开发联调用）
 *    - host: 复用宿主前端登录页（迁移推荐）
 * 2) auth.accessToken.*: access_token 注入规则（是否注入、从哪里读取、请求头名）
 * 3) api.contestApiPrefix: contest 后端接口前缀（默认 /api）
 * 4) route.loginPathPrefix/loginPageUrl/registerPathPrefix/registerPageUrl: 登录/注册路径与跳转地址
 * 5) agreement.*: 登录页用户协议配置（是否强制勾选、文案、协议内容）
 *
 * 说明：
 * - 本模块默认仍支持 cookie 鉴权；若宿主项目使用 Authorization Bearer token，
 *   请开启 auth.accessToken.enabled 并按宿主规则配置 header/storage。
 */

function asBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizePrefix(value, fallback) {
  const raw = String(value || fallback || '').trim();
  if (!raw) return fallback;
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || fallback;
}

function readTokenFromStorage(storageType, storageKey) {
  if (!storageKey) return '';
  try {
    if (storageType === 'sessionStorage' && typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(storageKey) || '';
    }
    if (storageType === 'localStorage' && typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(storageKey) || '';
    }
  } catch {
    return '';
  }
  return '';
}

const env = import.meta.env || {};
const runtimeOverride = (typeof window !== 'undefined' && window.__CONTEST_FRONT_CONFIG__) || {};

const defaults = {
  auth: {
    // 当前项目默认使用内置登录，便于本地开发联调
    mode: 'embedded',
    hostAuthAdapterGlobal: '__CONTEST_HOST_AUTH__',
    hostLoginUrl: '/login',
    endpoints: {
      login: '/api/sign-up/login',
      smsSendCode: '/api/sign-up/verification-codes/sms',
      smsLogin: '/api/sign-up/login/phone',
      me: '/api/sign-up/me',
      logout: '/api/sign-up/logout',
    },
    accessToken: {
      enabled: false,
      headerName: 'Authorization',
      prefix: 'Bearer ',
      storageType: 'localStorage',
      storageKey: 'access_token',
    },
  },
  api: {
    contestApiPrefix: '/api',
    requestIdHeaderName: 'X-Request-Id',
    withCredentials: true,
    timeoutMs: 12000,
  },
  route: {
    loginPathPrefix: '/login',
    loginPageUrl: '/login',
    registerPathPrefix: '/sign-up',
    registerPageUrl: '/sign-up',
    homeUrl: '/',
    myContestsPath: '/my-contests',
    createPath: '/create',
    minePath: '/mine',
    profilePath: '/profile',
    competitionPathPrefix: '/competitions',
    competitionRegisterSuffix: '/register',
  },
  agreement: {
    requiredOnLogin: true,
    title: '用户协议',
    promptText: '我已阅读并同意',
    linkText: '《用户协议》',
    content: [
      '欢迎使用数智文献比赛系统。',
      '本协议用于说明平台的基本使用规范，具体条款以后续正式发布版本为准。',
      '登录即表示你已阅读并同意遵守平台规则。',
    ].join('\n'),
  },
};

export const contestRuntimeConfig = {
  auth: {
    mode: String(runtimeOverride?.auth?.mode || env.VITE_CONTEST_AUTH_MODE || defaults.auth.mode).trim(),
    hostAuthAdapterGlobal: String(
      runtimeOverride?.auth?.hostAuthAdapterGlobal
      || env.VITE_CONTEST_HOST_AUTH_ADAPTER_GLOBAL
      || defaults.auth.hostAuthAdapterGlobal
    ).trim(),
    hostLoginUrl: String(runtimeOverride?.auth?.hostLoginUrl || env.VITE_CONTEST_HOST_LOGIN_URL || defaults.auth.hostLoginUrl).trim(),
    endpoints: {
      login: String(runtimeOverride?.auth?.endpoints?.login || env.VITE_CONTEST_LOGIN_ENDPOINT || defaults.auth.endpoints.login).trim(),
      smsSendCode: String(
        runtimeOverride?.auth?.endpoints?.smsSendCode
        || env.VITE_CONTEST_SMS_SEND_CODE_ENDPOINT
        || defaults.auth.endpoints.smsSendCode
      ).trim(),
      smsLogin: String(
        runtimeOverride?.auth?.endpoints?.smsLogin
        || env.VITE_CONTEST_SMS_LOGIN_ENDPOINT
        || defaults.auth.endpoints.smsLogin
      ).trim(),
      me: String(runtimeOverride?.auth?.endpoints?.me || env.VITE_CONTEST_ME_ENDPOINT || defaults.auth.endpoints.me).trim(),
      logout: String(runtimeOverride?.auth?.endpoints?.logout || env.VITE_CONTEST_LOGOUT_ENDPOINT || defaults.auth.endpoints.logout).trim(),
    },
    accessToken: {
      enabled: asBool(runtimeOverride?.auth?.accessToken?.enabled ?? env.VITE_CONTEST_ACCESS_TOKEN_ENABLED, defaults.auth.accessToken.enabled),
      headerName: String(
        runtimeOverride?.auth?.accessToken?.headerName
        || env.VITE_CONTEST_ACCESS_TOKEN_HEADER
        || defaults.auth.accessToken.headerName
      ).trim(),
      prefix: String(
        runtimeOverride?.auth?.accessToken?.prefix
        || env.VITE_CONTEST_ACCESS_TOKEN_PREFIX
        || defaults.auth.accessToken.prefix
      ),
      storageType: String(
        runtimeOverride?.auth?.accessToken?.storageType
        || env.VITE_CONTEST_ACCESS_TOKEN_STORAGE
        || defaults.auth.accessToken.storageType
      ).trim(),
      storageKey: String(
        runtimeOverride?.auth?.accessToken?.storageKey
        || env.VITE_CONTEST_ACCESS_TOKEN_KEY
        || defaults.auth.accessToken.storageKey
      ).trim(),
    },
  },
  api: {
    contestApiPrefix: normalizePrefix(
      runtimeOverride?.api?.contestApiPrefix || env.VITE_CONTEST_API_PREFIX,
      defaults.api.contestApiPrefix
    ),
    requestIdHeaderName: String(
      runtimeOverride?.api?.requestIdHeaderName
      || env.VITE_CONTEST_REQUEST_ID_HEADER
      || defaults.api.requestIdHeaderName
    ).trim(),
    withCredentials: asBool(
      runtimeOverride?.api?.withCredentials ?? env.VITE_CONTEST_WITH_CREDENTIALS,
      defaults.api.withCredentials
    ),
    timeoutMs: Number(runtimeOverride?.api?.timeoutMs || env.VITE_CONTEST_TIMEOUT_MS || defaults.api.timeoutMs),
  },
  route: {
    loginPathPrefix: normalizePrefix(
      runtimeOverride?.route?.loginPathPrefix || env.VITE_LOGIN_PATH_PREFIX,
      defaults.route.loginPathPrefix
    ),
    loginPageUrl: String(runtimeOverride?.route?.loginPageUrl || env.VITE_LOGIN_PAGE_URL || defaults.route.loginPageUrl).trim(),
    registerPathPrefix: normalizePrefix(
      runtimeOverride?.route?.registerPathPrefix || env.VITE_REGISTER_PATH_PREFIX,
      defaults.route.registerPathPrefix
    ),
    registerPageUrl: String(runtimeOverride?.route?.registerPageUrl || env.VITE_REGISTER_PAGE_URL || defaults.route.registerPageUrl).trim(),
    homeUrl: String(runtimeOverride?.route?.homeUrl || env.VITE_CONTEST_HOME_URL || defaults.route.homeUrl).trim(),
    myContestsPath: normalizePrefix(
      runtimeOverride?.route?.myContestsPath || env.VITE_CONTEST_MY_CONTESTS_PATH,
      defaults.route.myContestsPath
    ),
    createPath: normalizePrefix(
      runtimeOverride?.route?.createPath || env.VITE_CONTEST_CREATE_PATH,
      defaults.route.createPath
    ),
    minePath: normalizePrefix(
      runtimeOverride?.route?.minePath || env.VITE_CONTEST_MINE_PATH,
      defaults.route.minePath
    ),
    profilePath: normalizePrefix(
      runtimeOverride?.route?.profilePath || env.VITE_CONTEST_PROFILE_PATH,
      defaults.route.profilePath
    ),
    competitionPathPrefix: normalizePrefix(
      runtimeOverride?.route?.competitionPathPrefix || env.VITE_CONTEST_COMPETITION_PATH_PREFIX,
      defaults.route.competitionPathPrefix
    ),
    competitionRegisterSuffix: String(
      runtimeOverride?.route?.competitionRegisterSuffix
      || env.VITE_CONTEST_COMPETITION_REGISTER_SUFFIX
      || defaults.route.competitionRegisterSuffix
    ).trim() || defaults.route.competitionRegisterSuffix,
  },
  agreement: {
    requiredOnLogin: asBool(
      runtimeOverride?.agreement?.requiredOnLogin ?? env.VITE_CONTEST_AGREEMENT_REQUIRED,
      defaults.agreement.requiredOnLogin
    ),
    title: String(
      runtimeOverride?.agreement?.title
      || env.VITE_CONTEST_AGREEMENT_TITLE
      || defaults.agreement.title
    ).trim(),
    promptText: String(
      runtimeOverride?.agreement?.promptText
      || env.VITE_CONTEST_AGREEMENT_PROMPT_TEXT
      || defaults.agreement.promptText
    ).trim(),
    linkText: String(
      runtimeOverride?.agreement?.linkText
      || env.VITE_CONTEST_AGREEMENT_LINK_TEXT
      || defaults.agreement.linkText
    ).trim(),
    content: String(
      runtimeOverride?.agreement?.content
      || env.VITE_CONTEST_AGREEMENT_CONTENT
      || defaults.agreement.content
    ),
  },
};

export function getHostAuthAdapter() {
  if (typeof window === 'undefined') return null;
  const key = contestRuntimeConfig.auth.hostAuthAdapterGlobal;
  if (!key) return null;
  const adapter = window[key];
  return adapter && typeof adapter === 'object' ? adapter : null;
}

export function resolveAccessToken() {
  const { accessToken } = contestRuntimeConfig.auth;
  if (!accessToken?.enabled) return '';

  const adapter = getHostAuthAdapter();
  if (adapter && typeof adapter.getAccessToken === 'function') {
    try {
      return String(adapter.getAccessToken() || '').trim();
    } catch {
      // ignore host adapter token read errors
    }
  }

  return String(readTokenFromStorage(accessToken.storageType, accessToken.storageKey) || '').trim();
}
