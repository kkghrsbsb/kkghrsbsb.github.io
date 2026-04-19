# 博客写作入口（FAB + GitHub OAuth）

**日期**：2026-04-19  
**状态**：草案

---

## 功能目标

在博客前端加入一个仅对站长可见的悬浮写作按钮（FAB），实现"在博客界面直接写文章 → 提交到 GitHub 仓库 → 触发 CI 自动构建部署"的流程。

整个方案不改变博客的静态构建方式，写作界面是纯客户端的叠加层。

---

## 动机

每次写博客需要在本地编辑 mdx 文件、git push、等待 CI 部署。希望有一个轻量的浏览器内写作入口，减少这条链路的摩擦。

---

## 方案设计

### 整体架构

```
浏览器（博客前端）
  │
  ├─ FAB 按钮（React Island，默认隐藏）
  │     │
  │     └─ 点击 → 检查 localStorage session_id
  │              ├─ 无 session → 跳转 GitHub OAuth 授权
  │              └─ 有 session → 打开写作面板
  │
  ├─ OAuth 回调页 /auth/callback
  │     │
  │     └─ 携带 code → POST /exchange (Worker)
  │                       ├─ 用 secret 换 access_token
  │                       ├─ 校验用户为 kkghrsbsb
  │                       ├─ 生成 session_id，存入 KV（key=session_id, value=access_token, TTL=7d）
  │                       └─ 只返回 session_id 给前端
  │
  └─ 写作面板（React）
        └─ POST /submit (Worker)，携带 session_id + 文件内容
              ├─ Worker 从 KV 取出 access_token
              └─ 用 access_token 调用 GitHub API 提交文件
```

**关键原则**：`access_token` 始终只存在于 Worker 的 KV 中，不经过浏览器。

### 各部分细节

#### 1. GitHub OAuth App

- 创建一个 GitHub OAuth App，`Authorization callback URL` 设为 `https://kkghrsbsb.github.io/auth/callback`（或自定义域名对应地址）
- 只需要 `repo` scope（写入仓库内容）
- Client ID 可以公开放在前端；Client Secret 只存在 Cloudflare Worker 的环境变量中

#### 2. Cloudflare Worker

Worker 绑定：
- 环境变量：`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`
- KV 命名空间：`SESSIONS`（key=session_id, value=access_token, TTL=7天）

**路由 1：`POST /exchange`**

请求体：`{ code: string, state: string }`

逻辑：
```
1. 校验 state（防 CSRF，与前端生成时一致）
2. 用 code + CLIENT_ID + CLIENT_SECRET 向 GitHub 换取 access_token
3. 用 access_token 调用 GET https://api.github.com/user，校验 login === "kkghrsbsb"
4. 生成 session_id（crypto.randomUUID()）
5. KV.put(session_id, access_token, { expirationTtl: 604800 })  // 7天
6. 返回 { session_id }
```

**路由 2：`POST /submit`**

请求体：`{ session_id: string, path: string, content: string, message: string }`

逻辑：
```
1. token = await KV.get(session_id)
2. 若 token 为空 → 返回 401
3. 检查 GitHub API 该路径是否已存在（GET /contents/{path}），若存在则取 sha
4. 调用 GitHub API PUT /repos/.../contents/{path}，附带 token 和可选 sha
5. 返回 GitHub API 的结果
```

**路由 3：`POST /logout`**（可选）

```
KV.delete(session_id)
返回 200
```

#### 3. OAuth 登录流程（前端）

1. 用户点击 FAB → 前端检测 `localStorage.getItem('session_id')`
2. 无 session：生成随机 `state` 存入 `sessionStorage`，构造 GitHub 授权 URL，跳转
3. 回调页 `/auth/callback`：
   - 读取 URL 中的 `code` 和 `state`
   - 校验 `state` 与 `sessionStorage` 中一致
   - POST `/exchange` 给 Worker，获取 `session_id`
   - 将 `session_id` 存入 `localStorage`
   - 跳回首页
4. 登出：POST `/logout`，清除 `localStorage` 中的 `session_id`

#### 4. FAB 与写作面板（React Island）

FAB 只在 `localStorage` 中存有 `session_id` 时渲染为可见。

写作面板字段：
| 字段 | 说明 |
|---|---|
| 标题（title） | 文章标题，也用于生成文件名 |
| 描述（description） | Front matter description |
| 标签（tags） | 逗号分隔 |
| 内容（body） | MDX 正文，纯文本编辑器 |

提交逻辑：
1. 根据标题和当前日期生成文件路径，如 `src/content/blog/20260419_标题/index.mdx`
2. 拼装 front matter + 正文，base64 编码（GitHub API 要求）
3. POST `/submit` 给 Worker，附带 `session_id` + 编码内容
4. Worker 代持 token 完成 GitHub 写入
5. 成功后提示"已提交，CI 构建中"；若收到 401 则提示"登录已过期，请重新登录"

#### 5. 静态路由 /auth/callback

新增 `src/pages/auth/callback.astro`，页面内容极简：仅渲染一个 React Island（`CallbackHandler`），负责读取 query string 并完成 token 交换，无需服务端逻辑。

---

## 受影响的文件 / 模块

| 文件 | 变更类型 |
|---|---|
| `src/pages/auth/callback.astro` | 新增 |
| `src/components/WriterFAB.tsx` | 新增（React Island） |
| `src/components/WriterPanel.tsx` | 新增（写作面板） |
| `src/layouts/Layout.astro` | 修改：注入 FAB Island |
| `cloudflare-worker/index.js` | 新增（Worker 主逻辑） |
| `cloudflare-worker/wrangler.toml` | 新增（KV 绑定配置） |

---

## 潜在风险与边界情况

| 风险 | 处理方式 |
|---|---|
| session_id 被 XSS 读取 | session_id 本身无法直接操作 GitHub，只能在 Worker 内换取 token；攻击者拿到 session_id 最多在 TTL 内通过 `/submit` 提交文章，危害远小于直接拿到 token |
| session_id 被 XSS 读取后调用 /submit 提交恶意内容 | 博客是静态站，XSS 面极小；且提交触发 CI，内容可审查 |
| session 过期（7天 TTL） | `/submit` 返回 401，前端提示重新登录，清除 `localStorage` |
| 非 kkghrsbsb 账号走完流程 | Worker `/exchange` 侧强制校验 GitHub login，返回 403 |
| state 未校验导致 CSRF | 前端生成 state 存 sessionStorage，回调时比对 |
| 文件名冲突（同日期同标题） | Worker `/submit` 调用 GET 检查文件是否存在，存在则读取 sha（用于更新），不存在则新建 |
| KV 免费额度 | Cloudflare KV 免费套餐 100k 读/天、1k 写/天，个人使用绝对够用 |

---

## 实施步骤

1. **创建 GitHub OAuth App**（手动，在 GitHub 设置里操作）
2. **实现 Cloudflare Worker**
   - 新建 `cloudflare-worker/` 目录
   - 创建 KV 命名空间 `SESSIONS`，在 `wrangler.toml` 中绑定
   - 实现三条路由：`/exchange`、`/submit`、`/logout`
   - 配置环境变量 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET` 并部署
3. **新增 `/auth/callback` 页面**
   - `src/pages/auth/callback.astro` + `src/components/CallbackHandler.tsx`
4. **实现 WriterFAB + WriterPanel**
   - FAB：检测 `session_id`，控制显隐
   - Panel：表单 UI，提交时 POST 给 Worker `/submit`
5. **在 Layout.astro 中注入 FAB**
   - 用 `client:only="react"` 避免 SSG 阶段读取 localStorage
6. **本地联调**：用 `wrangler dev` 跑 Worker，配合 `npm run dev` 测试完整流程
7. **部署 Worker**，更新 OAuth App 的回调 URL，验收
