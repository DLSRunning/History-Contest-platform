import { test, expect } from '@playwright/test';

function buildResult({ code = 200, message = 'ok', data = null } = {}) {
  return { code, message, data };
}

function buildCompetitionSummary({ id = 501 } = {}) {
  return {
    id,
    name: `E2E_比赛_${id}`,
    description: 'E2E 自动化测试比赛',
    registration_start: '2026-03-01T00:00:00',
    registration_end: '2026-03-30T23:59:59',
    submission_start: '2026-03-31T00:00:00',
    submission_end: '2026-04-15T23:59:59',
    review_start: '2026-04-16T00:00:00',
    review_end: '2026-04-30T23:59:59',
    max_participants: 100,
    current_participants: 0,
    registration_is_full: false,
    participant_limit_mode: 'unlimited',
    registration_code_required: true,
    registration_code: '',
    allowed_formats: ['pdf'],
    attachment_mode: 'single',
    min_word_count: 0,
    max_word_count: 5000,
    max_file_size_mb: 20,
    max_modifications: 3,
    created_by: 1,
    created_by_username: 'admin',
    team_mode: 'individual',
    show_ranking: 1,
    ranking_visibility: 'all',
  };
}

async function mockContestApi(page, options = {}) {
  const state = {
    authenticated: !!options.authenticated,
    registered: !!options.registered,
    registrationCode: String(options.registrationCode || 'ABCD1357'),
    competitionId: Number(options.competitionId || 501),
  };

  const user = {
    id: 7,
    email: 'e2e_user@example.com',
    username: 'e2e_user',
    role: 'user',
    study_status: 'in_school',
    school: '南京大学',
    major: '软件工程',
    grade: '本科生',
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;
    const query = url.searchParams;

    const json = (status, payload) => route.fulfill({
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (path === '/api/sign-up/me' && method === 'GET') {
      if (!state.authenticated) {
        return json(401, buildResult({ code: 401, message: '未登录', data: null }));
      }
      return json(200, buildResult({ data: { user } }));
    }

    if (path === '/api/sign-up/login' && method === 'POST') {
      const body = request.postDataJSON() || {};
      if (String(body.account || '').trim() === 'e2e_user@example.com' && String(body.password || '') === 'Test@123456') {
        state.authenticated = true;
        return json(200, buildResult({ message: '登录成功', data: { access_token: 'e2e_token', user } }));
      }
      return json(400, buildResult({ code: 400, message: '账号或密码错误', data: null }));
    }

    if (path === '/api/sign-up/verification-codes' && method === 'POST') {
      return json(200, buildResult({
        message: '验证码已发送（5分钟内有效）！',
        data: { phone: '13800138000', debug_code: '123456' },
      }));
    }

    if (path === '/api/sign-up' && method === 'POST') {
      state.authenticated = true;
      return json(200, buildResult({
        message: '注册成功',
        data: { user: { ...user, email: 'new_user@example.com', username: '新用户' } },
      }));
    }

    if (path === '/api/sign-up/logout' && method === 'POST') {
      state.authenticated = false;
      state.registered = false;
      return json(200, buildResult({ message: '已退出登录' }));
    }

    if (path === '/api/competitions/list' && method === 'GET') {
      const item = buildCompetitionSummary({ id: state.competitionId });
      item.current_participants = state.registered ? 1 : 0;
      return json(200, buildResult({
        data: {
          items: [item],
          pagination: {
            total: 1,
            limit: Number(query.get('limit') || 7),
            offset: Number(query.get('offset') || 0),
          },
        },
      }));
    }

    if (path === '/api/competitions/mine/list' && method === 'GET') {
      return json(200, buildResult({
        data: { items: [], pagination: { total: 0, limit: 7, offset: 0 } },
      }));
    }

    if (path === '/api/competitions/my/registered/list' && method === 'GET') {
      const items = state.registered ? [buildCompetitionSummary({ id: state.competitionId })] : [];
      return json(200, buildResult({
        data: {
          items,
          pagination: {
            total: items.length,
            limit: Number(query.get('limit') || 7),
            offset: Number(query.get('offset') || 0),
          },
        },
      }));
    }

    if (path === '/api/register/participants' && method === 'GET') {
      const participants = state.registered
        ? [{ id: 1, user_id: user.id, competition_id: state.competitionId, email: user.email }]
        : [];
      return json(200, buildResult({ data: participants }));
    }

    if (path === '/api/submissions/my/list' && method === 'GET') {
      return json(200, buildResult({
        data: { items: [], pagination: { total: 0, limit: 50, offset: 0 } },
      }));
    }

    if (path === '/api/competitions/permissions/create' && method === 'GET') {
      return json(200, buildResult({ data: { can_create: false } }));
    }

    if (path === `/api/competitions/${state.competitionId}` && method === 'GET') {
      const detail = buildCompetitionSummary({ id: state.competitionId });
      detail.registration_code_required = true;
      detail.registration_code = '';
      detail.current_participants = state.registered ? 1 : 0;
      return json(200, buildResult({ data: detail }));
    }

    if (path === '/api/register' && method === 'POST') {
      const body = request.postDataJSON() || {};
      const code = String(body.registration_code || '').trim().toUpperCase();
      if (!code) {
        return json(400, buildResult({ code: 400, message: '该比赛需填写报名码后才能报名' }));
      }
      if (code !== state.registrationCode.toUpperCase()) {
        return json(400, buildResult({ code: 400, message: '报名码错误，请确认后重试' }));
      }
      state.registered = true;
      return json(200, buildResult({ message: '报名成功', data: { participant_id: 1001 } }));
    }

    return json(404, buildResult({ code: 404, message: `未匹配的接口: ${method} ${path}` }));
  });

  return state;
}

test.describe('Contest 自动化 E2E + 用户旅程', () => {
  test('分享链接入口：未登录跳转到登录并保留 next', async ({ page }) => {
    await mockContestApi(page, { authenticated: false, competitionId: 501 });

    await page.goto('/competitions/501/register?from=share');

    await expect(page).toHaveURL(/\/login\?next=%2Fcompetitions%2F501%2Fregister%3Ffrom%3Dshare/);
    await expect(page.getByText('账号密码登录')).toBeVisible();
  });

  test('登录回跳 + 报名码报名旅程', async ({ page }) => {
    await mockContestApi(page, { authenticated: false, competitionId: 502, registrationCode: 'ABCD1357' });

    await page.goto('/competitions/502/register');
    await expect(page).toHaveURL(/\/login\?/);

    await page.getByLabel('账号（邮箱/手机号）').fill('e2e_user@example.com');
    await page.getByLabel('密码').fill('Test@123456');
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: '登录', exact: true }).click();

    await expect(page.getByText('比赛详情')).toBeVisible();
    await page.getByRole('button', { name: '报名' }).click();

    await expect(page.getByText('输入报名码')).toBeVisible();
    await page.getByRole('button', { name: '确认报名' }).click();
    await expect(page.getByText('请先填写报名码')).toBeVisible();
    await expect(page.getByText('输入报名码')).toBeVisible();

    await page.getByRole('textbox', { name: '报名码' }).fill('WRONG999');
    await page.getByRole('button', { name: '确认报名' }).click();
    await expect(page.getByText('报名码错误')).toBeVisible();
    await expect(page.getByText('输入报名码')).toBeVisible();

    await page.getByRole('textbox', { name: '报名码' }).fill('ABCD1357');
    await page.getByRole('button', { name: '确认报名' }).click();
    await expect(page.getByText('报名成功')).toBeVisible();
    await expect(page.getByText('输入报名码')).not.toBeVisible();
  });

  test('注册页旅程：发送验证码并提交注册后自动登录进入首页', async ({ page }) => {
    await mockContestApi(page, { authenticated: false });

    await page.goto('/sign-up');

    await page.getByLabel('用户名*').fill('E2E用户');
    await page.getByLabel('手机号*').fill('13800138000');
    await page.getByLabel('邮箱*').fill('new_user@example.com');
    await page.getByLabel('密码*').fill('Test@123456');
    await page.getByLabel('学校*').fill('南京大学');
    await page.getByLabel('专业*').fill('软件工程');
    await page.getByLabel('年级*').click();
    await page.getByRole('option', { name: '本科生' }).click();

    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送')).toBeVisible();

    await page.getByLabel('手机验证码*').fill('123456');
    await page.getByRole('button', { name: '注册' }).click();

    await expect(page.getByText('注册成功')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('E2E_比赛_501')).toBeVisible();
  });
});
