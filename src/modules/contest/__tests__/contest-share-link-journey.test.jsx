import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const getCurrentUserMock = vi.fn();
const logoutMock = vi.fn(async () => ({ message: 'ok' }));
const clearClientAuthStateMock = vi.fn();
const createRequestIdMock = vi.fn(() => 'req_test');
const getCompetitionTrainingManualMetaMock = vi.fn(async () => ({ data: null, requestId: 'req_test' }));
const getCompetitionTrainingManualContentMock = vi.fn(async () => ({ data: null, requestId: 'req_test' }));
const upsertCompetitionTrainingManualContentMock = vi.fn(async () => ({ data: null, requestId: 'req_test' }));
const deleteCompetitionTrainingManualContentMock = vi.fn(async () => ({ data: null, requestId: 'req_test' }));

vi.mock('../../../api', () => ({
  createRequestId: (...args) => createRequestIdMock(...args),
  getCurrentUser: (...args) => getCurrentUserMock(...args),
  logout: (...args) => logoutMock(...args),
  clearClientAuthState: (...args) => clearClientAuthStateMock(...args),
  getCompetitionTrainingManualMeta: (...args) => getCompetitionTrainingManualMetaMock(...args),
  getCompetitionTrainingManualContent: (...args) => getCompetitionTrainingManualContentMock(...args),
  upsertCompetitionTrainingManualContent: (...args) => upsertCompetitionTrainingManualContentMock(...args),
  deleteCompetitionTrainingManualContent: (...args) => deleteCompetitionTrainingManualContentMock(...args),
}));

vi.mock('../pages/DashboardPage', () => ({
  DASHBOARD_VIEW_STATE_STORAGE_KEY: 'contest_dashboard_view_state_v1',
  default: ({ routeTab, autoOpenCompetitionId }) => (
    <div data-testid="dashboard-page">
      {`tab=${routeTab};open=${Number(autoOpenCompetitionId || 0)}`}
    </div>
  ),
}));

vi.mock('../pages/LoginPage', () => ({
  default: ({ registerUrl }) => <div data-testid="login-page">{registerUrl || ''}</div>,
}));

vi.mock('../../register/RegisterPage', () => ({
  default: () => <div data-testid="register-page">register</div>,
}));

import App from '../../../App';

function authUser() {
  return {
    id: 7,
    email: 'user@example.com',
    username: 'user',
    role: 'user',
  };
}

describe('分享链接与登录回跳自动化旅程', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('未登录访问分享链接会跳转登录页并保留 next 参数', async () => {
    getCurrentUserMock.mockRejectedValueOnce({ response: { status: 401 } });
    window.history.replaceState({}, '', '/competitions/42/register?from=share');

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.get('next')).toBe('/competitions/42/register?from=share');
    expect(screen.getByTestId('login-page')).toBeTruthy();
  });

  it('已登录访问分享链接会回到首页并自动打开目标比赛详情', async () => {
    getCurrentUserMock.mockResolvedValueOnce(authUser());
    window.history.replaceState({}, '', '/competitions/88/register');

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
      const params = new URLSearchParams(window.location.search);
      expect(params.get('open_competition_id')).toBe('88');
    });
    expect(screen.getByTestId('dashboard-page').textContent).toContain('open=88');
  });

  it('登录页携带 next=分享链接时会自动回跳并打开目标比赛详情', async () => {
    getCurrentUserMock.mockResolvedValueOnce(authUser());
    window.history.replaceState({}, '', '/login?next=/competitions/135/register');

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
      const params = new URLSearchParams(window.location.search);
      expect(params.get('open_competition_id')).toBe('135');
    });
    expect(screen.getByTestId('dashboard-page').textContent).toContain('open=135');
  });
});
