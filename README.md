# Personal OS

过去的沉淀、现在的关注、未来的方向。默认私密的个人知识与人生档案应用。

先读 [PROJECT_STATUS.md](PROJECT_STATUS.md)、[PRD](docs/PRD.md)、[TASKS](docs/TASKS.md)。当前交付是五模块界面与 Supabase 接入代码；**云端登录/持久化尚未联验完成**，详见[本轮交付与阻塞](docs/05-review/ux-sprint-01-implementation.md)。

## 本地运行

Node.js 22+（当前验证 24.22.1）：

```bash
npm ci
npm run dev
```

生产构建：`npm run build`，之后 `npm start`。默认绑定 `127.0.0.1:3000`。无配置也能查看空界面和真实错误提示；应用不会默认写入示例或将失败显示为成功。

安全配置见 [.env.example](.env.example)。填入本地忽略文件 `.env.local` 或部署环境，不能提交真实值。配置 Supabase 项目 URL、发布用客户端密钥及本人邮箱；可附加 Auth UUID 固定身份。服务端只用用户会话，不使用 service-role 密钥执行普通 CRUD。

认证支持邮箱 OTP 与 PKCE 邮件链接：Supabase 必须已有本人 Auth 用户（应用禁止自动注册），Auth 的 Redirect URLs 需允许实际应用的 `/auth/callback`。若使用验证码输入，邮件模板需包含 `{{ .Token }}`；默认邮件链接可走回调。APP_ORIGIN 与访问域名一致。邮件送达、回调和真实登录尚未验证。

云环境访问项目域名需要环境网络允许列表。已保存的配置草稿不代表当前网络已放行；Node.js 24 在代理环境可用 `NODE_USE_ENV_PROXY=1 npm run dev`，沿用受支持代理，不绕过网络限制。

## 页面与已实现交互

- 五模块：现在 `/`（`/focus` 兼容入口）、过去 `/archive`、未来 `/direction`、灵感 `/ideas`、复盘 `/reflection`。
- 全局采集：混合正文、JPEG/PNG 图片、URL；真实浏览器录音和试听；保存后多选领域及灵感标记。录音上传上限尚待配置，未接转写。
- Archive：列表/原件阅读、说明与领域编辑、返回列表焦点恢复、正文/说明查找、未分类与多领域任一匹配。
- Focus 可空关联和下一步；Direction 与手写周/月复盘表单、来源选择；没有完成率、四状态灵感按钮或伪 AI 草稿。
- `/settings`：本人登录、退出、旧浏览器档案只读访问与原始 JSON 备份。旧 `personal-os:v1` 不自动迁移或覆盖。

写入交互调用真实 API。**Owner 已反馈七项安装检查全 true，本地数据开关已启用供联验；仍必须本人登录，真实保存与跨设备尚未验证**。`PERSONAL_OS_DATA_CONTRACT=reviewed-v2` 只能在单独评审的数据契约、RLS 和存储策略完成隔离验证后设置；它本身不是安全证明。

SQL 方案位于 [private-records-v2.sql](docs/02-engineering/proposals/private-records-v2.sql)，Owner 已报告执行完成，远端匿名拒绝已实测通过；下一步按[安装说明](docs/02-engineering/supabase-setup.md)核查白名单/RLS/Storage，勿重复安装。首次部署还需检查 Supabase 默认授权、既有 Storage 策略和 RPC 权限；不要直接运行旧 Prisma 迁移。照片原件经会话鉴权入口读取，不发公开下载地址。

DeepSeek 为后续 AI 接口方向，尚未接入。公开页面、自动任务/提醒、原文覆盖/删除、云端导出恢复未实现。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run test:contract
npm run db:check
npm run build
CI=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

单元测试包括旧格式兼容和新多领域/混合输入/请求边界。浏览器测试采用 1440、390、320、768 宽度：交互使用明确的合成 API 夹具；匿名/跨来源拒绝测试访问真实本地端点。**这些测试不证明 Supabase RLS、真实跨设备保存或邮件认证通过。** `db:check` 仅校验保留的 Prisma 草案；新 SQL 提案已通过独立内存 PostgreSQL 契约测试（Auth/Storage 为测试替身），尚未做真实 Supabase 集成验证。

## 主要目录

- `src/components/os/`：新界面、共享状态、采集、详情、五模块与登录。
- `src/lib/os/`：新契约和客户端请求；`src/lib/server/`：认证、请求边界和服务端转换。
- `src/app/api/`、`src/app/auth/callback/`：登录、会话、记录、附件、条目接口。
- 原 `src/components/workspace.tsx`、`store.tsx`、`src/lib/domain.ts` 保留旧实现/备份解析，已不作为新界面的自动写入入口。
- `docs/`：正式产品入口、工程方案、历史与实际验证证据。
