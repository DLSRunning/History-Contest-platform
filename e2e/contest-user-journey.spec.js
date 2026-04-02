import { test, expect } from '@playwright/test';

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(base, days) {
  return new Date(base.getTime() + (days * DAY_MS));
}

function toIsoNoTimezone(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function buildResult({ code = 200, message = 'ok', data = null } = {}) {
  return { code, message, data };
}

function buildCompetitionSummary({ id = 501 } = {}) {
  const now = new Date();
  return {
    id,
    name: `E2E_比赛_${id}`,
    description: 'E2E 自动化测试比赛',
    registration_start: toIsoNoTimezone(addDays(now, -1)),
    registration_end: toIsoNoTimezone(addDays(now, 7)),
    submission_start: toIsoNoTimezone(addDays(now, 8)),
    submission_end: toIsoNoTimezone(addDays(now, 22)),
    review_start: toIsoNoTimezone(addDays(now, 23)),
    review_end: toIsoNoTimezone(addDays(now, 37)),
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
    await page.getByLabel('专业*').click();
    await page.getByRole('option', { name: '中国古代史' }).click();
    await page.getByLabel('年级*').click();
    await page.getByRole('option', { name: '本科生' }).click();

    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送')).toBeVisible();

    await page.getByLabel('手机验证码*').fill('123456');
    await page.getByRole('button', { name: '注册' }).click();
    await expect(page.getByRole('dialog', { name: '确认注册信息' })).toBeVisible();
    await page.getByRole('button', { name: '确认注册' }).click();

    await expect(page.getByText('注册成功，正在进入系统...')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('E2E_比赛_501')).toBeVisible();
  });
});

async function mockUserSyncReviewApi(page, options = {}) {
  const role = String(options.role || 'admin').trim().toLowerCase();
  const canReview = options.canReview ?? (role === 'admin');
  const decisionConflict = !!options.decisionConflict;
  const state = {
    decisions: [],
    batchDecisions: [],
    reviews: [
      {
        contest_user_id: 901,
        username: 'E2E_待审用户',
        phone: '13800138111',
        email: 'e2e_review_user@example.com',
        source_type: 'contest_local',
        synced_to_users: 0,
        study_status: 'in_school',
        school: '南京大学',
        major: '软件工程',
        grade: '本科生',
        occupation: '',
        bio: '',
        review_status: 'pending',
        registration_context: {
          competitions_count: 2,
          last_registered_at: '2026-03-15T10:00:00',
          competitions: [
            {
              competition_id: 801,
              competition_name: 'E2E_比赛_A',
              competition_creator_id: 1,
              competition_creator_name: 'admin',
              competition_creator_email: 'admin@example.com',
              registered_at: '2026-03-14T10:00:00',
            },
            {
              competition_id: 802,
              competition_name: 'E2E_比赛_B',
              competition_creator_id: 1,
              competition_creator_name: 'admin',
              competition_creator_email: 'admin@example.com',
              registered_at: '2026-03-15T10:00:00',
            },
          ],
        },
        latest_review: null,
      },
      {
        contest_user_id: 902,
        username: 'E2E_待审用户_B',
        phone: '13800138222',
        email: 'e2e_review_user_b@example.com',
        source_type: 'contest_local',
        synced_to_users: 0,
        study_status: 'not_in_school',
        school: '',
        major: '',
        grade: '',
        occupation: '工程师',
        bio: '',
        review_status: 'pending',
        registration_context: {
          competitions_count: 1,
          last_registered_at: '2026-03-15T12:00:00',
          competitions: [
            {
              competition_id: 803,
              competition_name: 'E2E_比赛_C',
              competition_creator_id: 1,
              competition_creator_name: 'admin',
              competition_creator_email: 'admin@example.com',
              registered_at: '2026-03-15T12:00:00',
            },
          ],
        },
        latest_review: null,
      },
    ],
  };

  const user = {
    id: role === 'admin' ? 1 : 2,
    email: role === 'admin' ? 'admin@example.com' : 'user@example.com',
    username: role === 'admin' ? 'admin' : 'user',
    role,
    study_status: 'not_in_school',
    school: '',
    major: '',
    grade: '',
    occupation: '工程师',
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;

    const json = (status, payload) => route.fulfill({
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (path === '/api/sign-up/me' && method === 'GET') {
      return json(200, buildResult({ data: { user } }));
    }
    if (path === '/api/competitions/list' && method === 'GET') {
      return json(200, buildResult({ data: { items: [], pagination: { total: 0, limit: 7, offset: 0 } } }));
    }
    if (path === '/api/competitions/mine/list' && method === 'GET') {
      return json(200, buildResult({ data: { items: [], pagination: { total: 0, limit: 7, offset: 0 } } }));
    }
    if (path === '/api/competitions/my/registered/list' && method === 'GET') {
      return json(200, buildResult({ data: { items: [], pagination: { total: 0, limit: 7, offset: 0 } } }));
    }
    if (path === '/api/register/participants' && method === 'GET') {
      return json(200, buildResult({ data: [] }));
    }
    if (path === '/api/submissions/my/list' && method === 'GET') {
      return json(200, buildResult({ data: { items: [], pagination: { total: 0, limit: 50, offset: 0 } } }));
    }
    if (path === '/api/competitions/permissions/create' && method === 'GET') {
      return json(200, buildResult({ data: { can_create: role === 'admin' } }));
    }
    if (path === '/api/user-sync/permissions/review' && method === 'GET') {
      return json(200, buildResult({ data: { can_review: !!canReview } }));
    }
    if (path === '/api/user-sync/reviews' && method === 'GET') {
      const status = String(url.searchParams.get('status') || 'pending').trim().toLowerCase();
      let items = [...state.reviews];
      if (status !== 'all') {
        items = items.filter((item) => String(item?.review_status || 'pending').trim().toLowerCase() === status);
      }
      return json(200, buildResult({
        data: {
          items,
          pagination: { total: items.length, limit: 20, offset: 0 },
        },
      }));
    }
    if (/^\/api\/user-sync\/reviews\/\d+\/decision$/.test(path) && method === 'POST') {
      const body = request.postDataJSON() || {};
      const reviewId = Number(path.match(/^\/api\/user-sync\/reviews\/(\d+)\/decision$/)?.[1] || 0);
      const review = state.reviews.find((item) => Number(item?.contest_user_id) === reviewId);
      state.decisions.push({ ...body, contest_user_id: reviewId });
      const action = String(body.action || '').trim().toLowerCase();
      if (!body.confirm) {
        return json(400, buildResult({ code: 400, message: '请先完成二次确认后再提交审核' }));
      }
      if (action === 'approve' && String(body.confirm_text || '').trim() !== '确认同步') {
        return json(400, buildResult({ code: 400, message: '二次确认口令错误，请输入“确认同步”' }));
      }
      if (action === 'reject' && String(body.confirm_text || '').trim() !== '确认拒绝') {
        return json(400, buildResult({ code: 400, message: '二次确认口令错误，请输入“确认拒绝”' }));
      }
      if (decisionConflict && action === 'approve' && review) {
        review.review_status = 'conflict';
        review.latest_review = {
          id: 9001,
          action: 'approve',
          result_status: 'conflict',
          reason: '同步冲突：手机号/邮箱在 users 表中存在冲突，请人工处理',
          reviewed_by: 1,
          reviewed_by_email: 'admin@example.com',
          created_at: new Date().toISOString(),
        };
        return json(409, buildResult({ code: 409, message: '同步冲突：手机号/邮箱在 users 表中存在冲突，请人工处理' }));
      }
      if (review && action === 'reject') {
        review.review_status = 'rejected';
        review.latest_review = {
          id: 9002,
          action: 'reject',
          result_status: 'success',
          reason: String(body.reason || ''),
          reviewed_by: 1,
          reviewed_by_email: 'admin@example.com',
          created_at: new Date().toISOString(),
        };
      }
      if (review && action === 'approve') {
        state.reviews = state.reviews.filter((item) => Number(item?.contest_user_id) !== reviewId);
      }
      return json(200, buildResult({
        data: {
          contest_user_id: reviewId || 901,
          action,
          result_status: 'success',
          synced_to_users: action === 'approve' ? 1 : 0,
          users_user_id: action === 'approve' ? 1001 : null,
          audit_id: 66,
        },
      }));
    }
    if (path === '/api/user-sync/reviews/batch-decision' && method === 'POST') {
      const body = request.postDataJSON() || {};
      state.batchDecisions.push(body);
      const action = String(body.action || '').trim().toLowerCase();
      const confirmText = String(body.confirm_text || '').trim();
      if (!body.confirm) {
        return json(400, buildResult({ code: 400, message: '请先完成二次确认后再提交审核' }));
      }
      if (action === 'approve' && confirmText !== '确认同步') {
        return json(400, buildResult({ code: 400, message: '二次确认口令错误，请输入“确认同步”' }));
      }
      if (action === 'reject' && confirmText !== '确认拒绝') {
        return json(400, buildResult({ code: 400, message: '二次确认口令错误，请输入“确认拒绝”' }));
      }

      const ids = [...new Set((body.contest_user_ids || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
      const summary = {
        total: ids.length,
        success: 0,
        failed: 0,
        conflict: 0,
        approved: 0,
        rejected: 0,
        idempotent: 0,
      };
      const items = [];

      ids.forEach((id) => {
        const review = state.reviews.find((item) => Number(item?.contest_user_id) === id);
        if (!review) {
          summary.failed += 1;
          items.push({
            contest_user_id: id,
            ok: false,
            action,
            result_status: 'failed',
            message: '审核目标用户不存在',
            error_code: 'contest_user_not_found',
          });
          return;
        }

        if (action === 'approve' && decisionConflict && id === 901) {
          review.review_status = 'conflict';
          review.latest_review = {
            id: 9010,
            action: 'approve',
            result_status: 'conflict',
            reason: '同步冲突：手机号/邮箱在 users 表中存在冲突，请人工处理',
            reviewed_by: 1,
            reviewed_by_email: 'admin@example.com',
            created_at: new Date().toISOString(),
          };
          summary.failed += 1;
          summary.conflict += 1;
          items.push({
            contest_user_id: id,
            ok: false,
            action,
            result_status: 'conflict',
            message: '同步冲突：手机号/邮箱在 users 表中存在冲突，请人工处理',
            error_code: 'users_conflict',
          });
          return;
        }

        if (action === 'approve') {
          summary.success += 1;
          summary.approved += 1;
          state.reviews = state.reviews.filter((item) => Number(item?.contest_user_id) !== id);
          items.push({
            contest_user_id: id,
            ok: true,
            action: 'approve',
            result_status: 'success',
            message: '审核成功',
            users_user_id: 1000 + id,
          });
          return;
        }

        const idempotent = String(review.review_status || '') === 'rejected';
        review.review_status = 'rejected';
        review.latest_review = {
          id: 9020,
          action: 'reject',
          result_status: 'success',
          reason: String(body.reason || ''),
          reviewed_by: 1,
          reviewed_by_email: 'admin@example.com',
          created_at: new Date().toISOString(),
        };
        summary.success += 1;
        summary.rejected += 1;
        if (idempotent) summary.idempotent += 1;
        items.push({
          contest_user_id: id,
          ok: true,
          action: 'reject',
          result_status: 'success',
          message: idempotent ? '重复拒绝已幂等处理' : '审核成功',
          idempotent,
        });
      });

      return json(200, buildResult({ data: { summary, items }, message: '批量审核完成' }));
    }

    return json(404, buildResult({ code: 404, message: `未匹配的接口: ${method} ${path}` }));
  });

  return state;
}

test.describe('用户同步审核模块 E2E', () => {
  test('管理员可进入审核页并完成双重确认通过', async ({ page }) => {
    const state = await mockUserSyncReviewApi(page, { role: 'admin', canReview: true });
    await page.goto('/user-sync-review');

    await expect(page).toHaveURL(/\/user-sync-review$/);
    await expect(page.getByRole('button', { name: '用户同步审核', exact: true })).toBeVisible();
    const firstUserRow = page.getByRole('row', { name: /e2e_review_user@example\.com/i });
    await expect(firstUserRow).toBeVisible();

    await firstUserRow.click();
    const reviewDialog = page.getByRole('dialog').first();
    await expect(reviewDialog).toBeVisible();

    await reviewDialog.getByRole('button', { name: '通过并同步' }).click();
    const decisionDialog = page.getByRole('dialog', { name: /二次确认：通过/ });
    await expect(decisionDialog).toBeVisible();

    await decisionDialog.getByRole('button', { name: '确认提交' }).click();
    await expect(page.getByText('请输入“确认同步”后再提交')).toBeVisible();

    await decisionDialog.getByLabel('确认口令').fill('确认同步');
    await decisionDialog.getByLabel('审核说明（选填）').fill('E2E 审核通过');
    await decisionDialog.getByRole('button', { name: '确认提交' }).click();

    await expect(page.getByText('审核成功：已通过')).toBeVisible();
    expect(state.decisions.length).toBeGreaterThanOrEqual(1);
  });

  test('普通用户访问审核路由会回退到首页', async ({ page }) => {
    await mockUserSyncReviewApi(page, { role: 'user', canReview: false });
    await page.goto('/user-sync-review');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/当前：\s*首页/)).toBeVisible();
  });

  test('管理员可完成双重确认拒绝审核', async ({ page }) => {
    const state = await mockUserSyncReviewApi(page, { role: 'admin', canReview: true });
    await page.goto('/user-sync-review');

    await page.getByRole('row', { name: /e2e_review_user@example\.com/i }).click();
    const reviewDialog = page.getByRole('dialog').first();
    await expect(reviewDialog).toBeVisible();

    await reviewDialog.getByRole('button', { name: '拒绝' }).click();
    const decisionDialog = page.getByRole('dialog', { name: /二次确认：拒绝/ });
    await expect(decisionDialog).toBeVisible();

    await decisionDialog.getByRole('button', { name: '确认提交' }).click();
    await expect(page.getByText('请输入“确认拒绝”后再提交')).toBeVisible();

    await decisionDialog.getByLabel('确认口令').fill('确认拒绝');
    await decisionDialog.getByLabel('审核说明（选填）').fill('E2E 拒绝审核');
    await decisionDialog.getByRole('button', { name: '确认提交' }).click();

    await expect(page.getByText('审核成功：已拒绝')).toBeVisible();
    expect(state.decisions.some((item) => String(item?.action || '').toLowerCase() === 'reject')).toBeTruthy();
  });

  test('管理员审核通过遇到冲突时显示可读错误', async ({ page }) => {
    await mockUserSyncReviewApi(page, { role: 'admin', canReview: true, decisionConflict: true });
    await page.goto('/user-sync-review');

    await page.getByRole('row', { name: /e2e_review_user@example\.com/i }).click();
    const reviewDialog = page.getByRole('dialog').first();
    await expect(reviewDialog).toBeVisible();

    await reviewDialog.getByRole('button', { name: '通过并同步' }).click();
    const decisionDialog = page.getByRole('dialog', { name: /二次确认：通过/ });
    await decisionDialog.getByLabel('确认口令').fill('确认同步');
    await decisionDialog.getByRole('button', { name: '确认提交' }).click();

    await expect(page.getByText(/同步冲突/).first()).toBeVisible();
    await expect(decisionDialog).not.toBeVisible();
  });

  test('管理员可批量拒绝审核（双重确认）', async ({ page }) => {
    const state = await mockUserSyncReviewApi(page, { role: 'admin', canReview: true });
    await page.goto('/user-sync-review');

    await page.getByRole('row', { name: /e2e_review_user@example\.com/i }).getByRole('checkbox').check();
    await page.getByRole('row', { name: /e2e_review_user_b@example\.com/i }).getByRole('checkbox').check();
    await page.getByRole('button', { name: '批量拒绝' }).click();

    const batchDialog = page.getByRole('dialog', { name: /批量二次确认：拒绝/ });
    await expect(batchDialog).toBeVisible();
    await batchDialog.getByRole('button', { name: '确认提交' }).click();
    await expect(page.getByText('请输入“确认拒绝”后再提交')).toBeVisible();

    await batchDialog.getByLabel('确认口令').fill('确认拒绝');
    await batchDialog.getByRole('button', { name: '确认提交' }).click();

    await expect(page.getByText(/批量审核完成/)).toBeVisible();
    expect(state.batchDecisions.length).toBeGreaterThanOrEqual(1);
  });

  test('管理员批量通过遇到冲突时返回汇总结果', async ({ page }) => {
    await mockUserSyncReviewApi(page, { role: 'admin', canReview: true, decisionConflict: true });
    await page.goto('/user-sync-review');

    await page.getByRole('row', { name: /e2e_review_user@example\.com/i }).getByRole('checkbox').check();
    await page.getByRole('row', { name: /e2e_review_user_b@example\.com/i }).getByRole('checkbox').check();
    await page.getByRole('button', { name: '批量通过并同步' }).click();

    const batchDialog = page.getByRole('dialog', { name: /批量二次确认：通过/ });
    await batchDialog.getByLabel('确认口令').fill('确认同步');
    await batchDialog.getByRole('button', { name: '确认提交' }).click();

    await expect(page.getByText(/批量审核完成：/)).toBeVisible();
    await expect(page.getByText(/冲突 1/)).toBeVisible();
  });
});
