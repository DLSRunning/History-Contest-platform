import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { clearClientAuthState, getCurrentUser, logout as logoutApi } from '../../api';
import { contestRuntimeConfig, getHostAuthAdapter } from '../../config/contestRuntimeConfig';
import { getUserFriendlyErrorText } from '../../utils/errorText';
import DashboardPage, { DASHBOARD_VIEW_STATE_STORAGE_KEY } from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from '../register/RegisterPage';

function isRetryableProbeError(error) {
  if (!error) return true;
  if (!error.response) return true;
  const status = Number(error.response.status || 0);
  return status >= 500;
}

function getApiErrorMessage(error) {
  return String(
    error?.response?.data?.message
    || error?.response?.data?.detail
    || error?.message
    || ''
  ).trim();
}

function shouldForceRelogin(error) {
  const status = Number(error?.response?.status || 0);
  if (status !== 401) return false;
  const msg = getApiErrorMessage(error);
  if (!msg || msg.includes('缺少 access_token')) return false;
  return (
    msg.includes('用户不存在或已失效')
    || msg.includes('无效的 access_token')
    || msg.includes('access_token 已过期')
  );
}

function normalizePath(path) {
  const raw = String(path || '/').trim();
  if (!raw) return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

function normalizeSearch(search = '') {
  const raw = String(search || '').trim();
  if (!raw) return '';
  return raw.startsWith('?') ? raw : `?${raw}`;
}

function isCompetitionPath(path, competitionPathPrefix = '/competitions', competitionRegisterSuffix = '/register') {
  const escapedPrefix = String(competitionPathPrefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSuffix = String(competitionRegisterSuffix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reg = new RegExp(`^${escapedPrefix}/\\d+(?:${escapedSuffix})?$`);
  return reg.test(String(path || ''));
}

function parseCompetitionPath(path, competitionPathPrefix = '/competitions', competitionRegisterSuffix = '/register') {
  const escapedPrefix = String(competitionPathPrefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSuffix = String(competitionRegisterSuffix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reg = new RegExp(`^${escapedPrefix}/(\\d+)(?:(${escapedSuffix}))?$`);
  const matched = String(path || '').match(reg);
  if (!matched) return null;
  const id = Number(matched[1]);
  if (Number.isNaN(id) || id <= 0) return null;
  return { competitionId: id };
}

function buildPathWithNext(basePath, nextPath = '') {
  if (!nextPath) return basePath;
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}next=${encodeURIComponent(nextPath)}`;
}

function resolveSafeNextPath(search = '', isRoutablePath = () => false) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const rawNext = String(params.get('next') || '').trim();
  if (!rawNext || !rawNext.startsWith('/')) return '';
  if (rawNext.startsWith('//')) return '';
  try {
    const parsed = new URL(rawNext, window.location.origin);
    if (parsed.origin !== window.location.origin) return '';
    const normalizedPath = normalizePath(parsed.pathname);
    if (!isRoutablePath(normalizedPath)) return '';
    return `${normalizedPath}${parsed.search || ''}`;
  } catch {
    return '';
  }
}

function buildHomeCompetitionModalPath(homePath, competitionId) {
  const id = Number(competitionId);
  if (Number.isNaN(id) || id <= 0) return String(homePath || '/');
  const base = String(homePath || '/').trim() || '/';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}open_competition_id=${id}`;
}

function normalizeComparableUser(user) {
  if (!user || typeof user !== 'object') return null;
  const read = (value) => String(value ?? '').trim();
  return {
    id: Number(user.user_id || user.id || 0),
    email: read(user.email).toLowerCase(),
    phone: read(user.phone),
    username: read(user.username || user.name),
    role: read(user.role),
    study_status: read(user.study_status),
    school: read(user.school),
    major: read(user.major),
    grade: read(user.grade),
    occupation: read(user.occupation),
    bio: read(user.bio),
  };
}

function isSameUser(left, right) {
  const a = normalizeComparableUser(left);
  const b = normalizeComparableUser(right);
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Object.keys(a).every((key) => a[key] === b[key]);
}

export default function ContestApp({
  pathname = '/',
  search = '',
  loginPath = '/login',
  registerPath = '/sign-up',
  homePath = '/',
  myContestsPath = '/my-contests',
  createPath = '/create',
  minePath = '/mine',
  profilePath = '/profile',
  userSyncReviewPath = '/user-sync-review',
  competitionPathPrefix = '/competitions',
  competitionRegisterSuffix = '/register',
  onNavigate,
}) {
  const [message, setMessage] = useState(null);
  const [messageVisible, setMessageVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const authMode = String(contestRuntimeConfig.auth.mode || 'embedded').toLowerCase();
  const useHostAuth = authMode === 'host';
  const currentPath = normalizePath(pathname);
  const currentSearch = normalizeSearch(search);
  const normalizedLoginPath = normalizePath(loginPath);
  const normalizedRegisterPath = normalizePath(registerPath);
  const normalizedHomePath = normalizePath(homePath);
  const normalizedMyContestsPath = normalizePath(myContestsPath);
  const normalizedCreatePath = normalizePath(createPath);
  const normalizedMinePath = normalizePath(minePath);
  const normalizedProfilePath = normalizePath(profilePath);
  const normalizedUserSyncReviewPath = normalizePath(userSyncReviewPath);
  const normalizedCompetitionPathPrefix = normalizePath(competitionPathPrefix);
  const competitionRegisterPathSuffix = String(competitionRegisterSuffix || '/register').trim() || '/register';
  const staticPathToTab = useMemo(
    () => ({
      [normalizedHomePath]: 'home',
      [normalizedMyContestsPath]: 'my_contests',
      [normalizedCreatePath]: 'create',
      [normalizedMinePath]: 'mine',
      [normalizedProfilePath]: 'profile',
      [normalizedUserSyncReviewPath]: 'user_sync_review',
    }),
    [
      normalizedHomePath,
      normalizedMyContestsPath,
      normalizedCreatePath,
      normalizedMinePath,
      normalizedProfilePath,
      normalizedUserSyncReviewPath,
    ]
  );
  const tabToPath = useMemo(
    () => ({
      home: normalizedHomePath,
      my_contests: normalizedMyContestsPath,
      create: normalizedCreatePath,
      mine: normalizedMinePath,
      profile: normalizedProfilePath,
      user_sync_review: normalizedUserSyncReviewPath,
    }),
    [
      normalizedHomePath,
      normalizedMyContestsPath,
      normalizedCreatePath,
      normalizedMinePath,
      normalizedProfilePath,
      normalizedUserSyncReviewPath,
    ]
  );
  const isRoutablePath = useCallback(
    (path) => {
      const normalized = normalizePath(path);
      if (normalized === normalizedLoginPath || normalized === normalizedRegisterPath) return true;
      if (Object.keys(staticPathToTab).includes(normalized)) return true;
      return isCompetitionPath(normalized, normalizedCompetitionPathPrefix, competitionRegisterPathSuffix);
    },
    [
      normalizedCompetitionPathPrefix,
      competitionRegisterPathSuffix,
      normalizedLoginPath,
      normalizedRegisterPath,
      staticPathToTab,
    ]
  );
  const competitionRoute = parseCompetitionPath(
    currentPath,
    normalizedCompetitionPathPrefix,
    competitionRegisterPathSuffix
  );
  const autoOpenCompetitionId = useMemo(() => {
    if (currentPath !== normalizedHomePath) return 0;
    const params = new URLSearchParams(String(currentSearch || '').replace(/^\?/, ''));
    const id = Number(params.get('open_competition_id') || 0);
    if (Number.isNaN(id) || id <= 0) return 0;
    return id;
  }, [currentPath, currentSearch, normalizedHomePath]);
  const applyUser = useCallback((nextUser) => {
    const normalized = nextUser || null;
    setUser((prev) => (isSameUser(prev, normalized) ? prev : normalized));
  }, []);
  const clearUser = useCallback(() => {
    setUser((prev) => (prev ? null : prev));
  }, []);
  const navigateTo = useCallback((targetPath) => {
    if (typeof onNavigate === 'function') {
      onNavigate(targetPath);
      return;
    }
    window.location.href = targetPath;
  }, [onNavigate]);

  const handleDashboardRouteChange = useCallback(
    (nextTab) => {
      const targetPath = tabToPath[nextTab] || normalizedHomePath;
      if (targetPath !== currentPath) navigateTo(targetPath);
    },
    [tabToPath, normalizedHomePath, currentPath, navigateTo]
  );
  const handleAutoOpenCompetitionHandled = useCallback(() => {
    if (currentPath !== normalizedHomePath) return;
    const params = new URLSearchParams(String(currentSearch || '').replace(/^\?/, ''));
    if (!params.has('open_competition_id')) return;
    params.delete('open_competition_id');
    const remain = params.toString();
    navigateTo(`${normalizedHomePath}${remain ? `?${remain}` : ''}`);
  }, [currentPath, currentSearch, navigateTo, normalizedHomePath]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const currentUser = await getCurrentUser({ timeoutMs: 3500 });
        if (!mounted) return;
        applyUser(currentUser || null);
        setBackendUnavailable(false);
      } catch (error) {
        if (!mounted) return;
        clearUser();
        if (shouldForceRelogin(error)) {
          clearClientAuthState();
          localStorage.removeItem(DASHBOARD_VIEW_STATE_STORAGE_KEY);
          setMessage({ type: 'warning', text: '登录已失效，请重新登录' });
        }
        setBackendUnavailable(isRetryableProbeError(error));
      } finally {
        if (mounted) setAuthLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applyUser, clearUser]);

  useEffect(() => {
    if (user || !backendUnavailable) return undefined;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const currentUser = await getCurrentUser({ timeoutMs: 2500 });
        if (cancelled) return;
        if (currentUser) {
          applyUser(currentUser);
          setMessage({ type: 'success', text: '后端已恢复连接' });
        }
        setBackendUnavailable(false);
      } catch (error) {
        if (cancelled) return;
        if (!isRetryableProbeError(error)) {
          setBackendUnavailable(false);
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applyUser, user, backendUnavailable]);

  useEffect(() => {
    if (!message) return undefined;
    setMessageVisible(true);
    const fadeTimer = setTimeout(() => {
      setMessageVisible(false);
    }, 1200);
    const timer = setTimeout(() => {
      setMessage(null);
    }, 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(timer);
    };
  }, [message]);

  useEffect(() => {
    if (authLoading) return;
    const isAuthPage = currentPath === normalizedLoginPath || currentPath === normalizedRegisterPath;
    const safeNext = resolveSafeNextPath(currentSearch, isRoutablePath);

    if (!isRoutablePath(currentPath)) {
      navigateTo(user ? normalizedHomePath : buildPathWithNext(normalizedLoginPath, normalizedHomePath));
      return;
    }

    if (!user && !isAuthPage) {
      navigateTo(buildPathWithNext(normalizedLoginPath, `${currentPath}${currentSearch}`));
      return;
    }

    if (user && competitionRoute) {
      const targetPath = buildHomeCompetitionModalPath(
        normalizedHomePath,
        competitionRoute.competitionId
      );
      if (`${currentPath}${currentSearch}` !== targetPath) {
        navigateTo(targetPath);
      }
      return;
    }

    if (user && isAuthPage) {
      navigateTo(safeNext || normalizedHomePath);
    }
  }, [
    authLoading,
    competitionRoute,
    currentPath,
    currentSearch,
    isRoutablePath,
    navigateTo,
    normalizedHomePath,
    normalizedLoginPath,
    normalizedRegisterPath,
    user,
  ]);

  const logout = async () => {
    try {
      await logoutApi();
      clearClientAuthState();
      localStorage.removeItem(DASHBOARD_VIEW_STATE_STORAGE_KEY);
      clearUser();
      setMessage({ type: 'info', text: '已退出登录' });
      navigateTo(normalizedLoginPath);
      return;
    } catch (error) {
      clearClientAuthState();

      // 若后端登出接口异常，尝试校验当前登录态；仍有效时不切换到未登录界面，避免“假退出”。
      try {
        const currentUser = await getCurrentUser({ timeoutMs: 2500 });
        if (!currentUser) {
          localStorage.removeItem(DASHBOARD_VIEW_STATE_STORAGE_KEY);
          clearUser();
          setMessage({ type: 'warning', text: '退出接口异常，但当前登录态已清理' });
          navigateTo(normalizedLoginPath);
          return;
        }
      } catch {
        // ignore verification errors, fallback to explicit error message below
      }

      setMessage({ type: 'error', text: getUserFriendlyErrorText(error, '退出登录失败，请重试') });
      return;
    }
  };

  const jumpToHostLogin = () => {
    const adapter = getHostAuthAdapter();
    if (adapter && typeof adapter.openLoginPage === 'function') {
      adapter.openLoginPage();
      return;
    }
    const hostLoginUrl = String(contestRuntimeConfig.auth.hostLoginUrl || '/login').trim() || '/login';
    window.location.href = hostLoginUrl;
  };

  if (authLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {message && (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 3000,
            opacity: messageVisible ? 1 : 0,
            transform: messageVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 700ms ease, transform 700ms ease',
            pointerEvents: 'none',
          }}
        >
          <Alert severity={message.type}>{message.text}</Alert>
        </Box>
      )}
      {backendUnavailable && (
        <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 3000 }}>
          <Alert severity="warning">后端连接中断，正在自动重试...</Alert>
        </Box>
      )}
      {!user && useHostAuth && currentPath === normalizedLoginPath ? (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, background: 'linear-gradient(140deg, #f6f0ff 0%, #e9ddfb 40%, #f8f4ff 100%)' }}>
          <Stack spacing={2} alignItems="center" sx={{ maxWidth: 520, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              请先在宿主系统完成登录
            </Typography>
            <Typography color="text.secondary">
              当前比赛模块已配置为复用宿主前端登录页，不再使用内置登录页。
            </Typography>
            <Button variant="contained" onClick={jumpToHostLogin}>
              前往宿主登录页
            </Button>
          </Stack>
        </Box>
      ) : !user && currentPath === normalizedLoginPath ? (
        <LoginPage
          registerUrl={buildPathWithNext(
            normalizedRegisterPath,
            resolveSafeNextPath(currentSearch, isRoutablePath)
          )}
          onNavigate={navigateTo}
          onSuccess={(currentUser) => {
            applyUser(currentUser);
            const safeNext = resolveSafeNextPath(currentSearch, isRoutablePath);
            navigateTo(safeNext || normalizedHomePath);
          }}
          setMessage={setMessage}
        />
      ) : !user && currentPath === normalizedRegisterPath ? (
        <RegisterPage
          search={currentSearch}
          onNavigate={navigateTo}
          onSuccess={(currentUser, targetPath) => {
            applyUser(currentUser);
            navigateTo(targetPath || normalizedHomePath);
          }}
        />
      ) : !user ? (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <DashboardPage
          routeTab={staticPathToTab[currentPath] || 'home'}
          onRouteChange={handleDashboardRouteChange}
          competitionPathPrefix={normalizedCompetitionPathPrefix}
          competitionRegisterSuffix={competitionRegisterPathSuffix}
          autoOpenCompetitionId={autoOpenCompetitionId}
          onAutoOpenCompetitionHandled={handleAutoOpenCompetitionHandled}
          user={user}
          onLogout={logout}
          onGoLogin={() => navigateTo(normalizedLoginPath)}
          setMessage={setMessage}
          userSyncReviewPath={normalizedUserSyncReviewPath}
        />
      )}
    </>
  );
}
