import { useCallback, useEffect, useMemo, useState } from 'react';
import ContestApp from './modules/contest';
import { contestRuntimeConfig } from './config/contestRuntimeConfig';

function normalizePath(path) {
  const raw = String(path || '/').trim();
  if (!raw) return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

function normalizeSearch(search) {
  const raw = String(search || '').trim();
  if (!raw) return '';
  return raw.startsWith('?') ? raw : `?${raw}`;
}

function parseTargetLocation(target) {
  const url = new URL(String(target || '/'), window.location.origin);
  return {
    pathname: normalizePath(url.pathname),
    search: normalizeSearch(url.search),
  };
}

function isCompetitionPath(pathname, competitionPathPrefix, competitionRegisterSuffix) {
  const escapedPrefix = String(competitionPathPrefix || '/competitions').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSuffix = String(competitionRegisterSuffix || '/register').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reg = new RegExp(`^${escapedPrefix}/\\d+(?:${escapedSuffix})?$`);
  return reg.test(String(pathname || ''));
}

export default function App() {
  const routeConfig = contestRuntimeConfig.route || {};
  const loginPathPrefix = normalizePath(routeConfig.loginPathPrefix || '/login');
  const registerPathPrefix = normalizePath(routeConfig.registerPathPrefix || '/sign-up');
  const homePath = normalizePath(routeConfig.homeUrl || '/');
  const myContestsPath = normalizePath(routeConfig.myContestsPath || '/my-contests');
  const createPath = normalizePath(routeConfig.createPath || '/create');
  const minePath = normalizePath(routeConfig.minePath || '/mine');
  const profilePath = normalizePath(routeConfig.profilePath || '/profile');
  const competitionPathPrefix = normalizePath(routeConfig.competitionPathPrefix || '/competitions');
  const competitionRegisterSuffix = String(routeConfig.competitionRegisterSuffix || '/register').trim() || '/register';
  const [locationState, setLocationState] = useState(() => ({
    pathname: normalizePath(window.location.pathname),
    search: normalizeSearch(window.location.search),
  }));

  const allowedStaticPaths = useMemo(
    () => new Set([
      homePath,
      loginPathPrefix,
      registerPathPrefix,
      myContestsPath,
      createPath,
      minePath,
      profilePath,
    ]),
    [
      homePath,
      loginPathPrefix,
      registerPathPrefix,
      myContestsPath,
      createPath,
      minePath,
      profilePath,
    ]
  );

  const isAllowedPath = useCallback((pathname) => {
    if (allowedStaticPaths.has(pathname)) return true;
    return isCompetitionPath(pathname, competitionPathPrefix, competitionRegisterSuffix);
  }, [allowedStaticPaths, competitionPathPrefix, competitionRegisterSuffix]);

  const navigateReplace = useCallback((targetPath) => {
    const next = parseTargetLocation(targetPath);
    setLocationState((prev) => {
      if (prev.pathname === next.pathname && prev.search === next.search) return prev;
      window.history.replaceState({}, '', `${next.pathname}${next.search}`);
      return next;
    });
  }, []);

  const pathname = locationState.pathname;
  const search = locationState.search;

  useEffect(() => {
    const onPopState = () => {
      setLocationState({
        pathname: normalizePath(window.location.pathname),
        search: normalizeSearch(window.location.search),
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!isAllowedPath(pathname)) {
      navigateReplace(homePath);
    }
  }, [homePath, isAllowedPath, navigateReplace, pathname]);

  return (
    <ContestApp
      pathname={pathname}
      search={search}
      loginPath={loginPathPrefix}
      registerPath={registerPathPrefix}
      homePath={homePath}
      myContestsPath={myContestsPath}
      createPath={createPath}
      minePath={minePath}
      profilePath={profilePath}
      competitionPathPrefix={competitionPathPrefix}
      competitionRegisterSuffix={competitionRegisterSuffix}
      onNavigate={navigateReplace}
    />
  );
}
