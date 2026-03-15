# contest_front

用于配合 `contest` 后端模块的前端项目。

## 1. 环境要求

- Node.js 18.19+（当前项目按 Node 18 兼容版本维护）
- npm 9+

## 2. 本地开发

```bash
npm install
npm run dev
```

测试工具链当前按 `Node 18` 兼容版本锁定（`vitest@3`、`jsdom@24`）；若升级到 `Node 20+`，可再统一升级测试依赖。

可选 HTTPS 本地调试：

```bash
npm run dev:https
```

## 3. 常用命令

```bash
# 本地开发
npm run dev

# 生产构建
npm run build

# 本地预览构建结果
npm run preview
```

## 4. 自动化测试

```bash
# 前端组件/路由测试（Vitest）
npm run test -- src/modules/contest/__tests__/contest-share-link-journey.test.jsx

# 浏览器 E2E + 用户旅程测试（Playwright）
npm run test:e2e -- e2e/contest-user-journey.spec.js
```

首次运行 Playwright 如缺少浏览器，请执行：

```bash
npx playwright install chromium
```

## 5. 生产部署配置
- 为实现“比赛链接可共享且可回跳”，你需要按如下方式部署到服务器上，如果部署失败，请求助AI


### 1) 确定部署基路径

先确定前端对外访问基路径（`BASE_PATH`）：

- 子路径部署：例如 `https://domain.com/contest/`，则 `BASE_PATH=/contest`
- 子域名根路径部署：例如 `https://contest.domain.com/`，则 `BASE_PATH=`（空，代表根路径）

### 2) 环境变量映射规则

把下面规则中的 `${BASE_PATH}` 按你的实际值替换：

- `VITE_PUBLIC_BASE=${BASE_PATH}/`（根路径时为 `/`）
- `VITE_CONTEST_API_PREFIX=${BASE_PATH}/api`（根路径时为 `/api`）
- `VITE_CONTEST_HOME_URL=${BASE_PATH}/`（根路径时为 `/`）
- `VITE_LOGIN_PATH_PREFIX=${BASE_PATH}/login`
- `VITE_LOGIN_PAGE_URL=${BASE_PATH}/login`
- `VITE_REGISTER_PATH_PREFIX=${BASE_PATH}/sign-up`
- `VITE_REGISTER_PAGE_URL=${BASE_PATH}/sign-up`
- `VITE_CONTEST_MY_CONTESTS_PATH=${BASE_PATH}/my-contests`
- `VITE_CONTEST_CREATE_PATH=${BASE_PATH}/create`
- `VITE_CONTEST_MINE_PATH=${BASE_PATH}/mine`
- `VITE_CONTEST_PROFILE_PATH=${BASE_PATH}/profile`
- `VITE_CONTEST_COMPETITION_PATH_PREFIX=${BASE_PATH}/competitions`
- `VITE_CONTEST_COMPETITION_REGISTER_SUFFIX=/register`

建议流程：

```bash
cp .env.example .env.production
# 按映射规则修改 .env.production
npm run build
```

## 示例：部署到 https://www.digitalilab.cn/contest/

此时 `BASE_PATH=/contest`，对应关键配置如下：

- `VITE_PUBLIC_BASE=/contest/`
- `VITE_CONTEST_API_PREFIX=/contest/api`
- 其它路由全部使用 `/contest/*`

`.env.example` 已包含这一套示例值，可直接复制为 `.env.production` 后按需微调。

## Nginx 配置（通用模板）

将 `<BASE_PATH>` 替换为你的实际路径（如 `/contest`，根路径则去掉该层）。

```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;

    # 前端静态资源
    location ^~ <BASE_PATH>/ {
        alias /var/www/contest_front/dist/;
        try_files $uri $uri/ <BASE_PATH>/index.html;
    }

    # 后端接口反向代理
    location ^~ <BASE_PATH>/api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 部署后检查

1. 登录页 URL 是否为 `${BASE_PATH}/login`。  
2. 首页 URL 是否为 `${BASE_PATH}/`。  
3. 比赛详情中的报名链接是否为 `${BASE_PATH}/competitions/:id/register`。  
4. 打开分享链接后，登录成功应回到主页并自动弹出对应比赛详情弹窗。  

## 6. 开发者信息

- 开发者：`xianyu`
- 联系邮箱：`2646163045@qq.com`
