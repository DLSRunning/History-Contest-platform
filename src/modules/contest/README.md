# Contest Frontend Module

- `ContestApp.jsx`: contest 模块总入口（登录态检查、全局消息、退出登录）。
- `pages/DashboardPage.jsx`: 比赛主界面（首页、我的比赛、创办比赛、我创办的比赛、个人信息）。
- `pages/CompetitionEntryPage.jsx`: 比赛独立入口页（`/competitions/:id` 与 `/competitions/:id/register`）。
- `pages/LoginPage.jsx`: contest 内置登录页（仅 `auth.mode=embedded` 时使用）。
- `modules/register/RegisterPage.jsx`: contest 注册页。
- `index.js`: 模块导出入口。

说明：
- 根 `src/App.jsx` 负责路由归一化与导航状态；`ContestApp` 负责登录态守卫与页面分发。
- 迁移配置统一在 `src/config/contestRuntimeConfig.js`：
  - `auth.mode=host` 时复用宿主登录页，不展示内置登录页
  - `auth.accessToken.*` 用于对接宿主 access_token 请求头注入
- 后续若继续拆分，可优先按 `pages/components/hooks/services` 结构扩展。
