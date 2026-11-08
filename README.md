# Personal OS

过去的沉淀、现在的关注、未来的方向。默认私密的个人知识与人生档案应用。

先读 [PROJECT_STATUS.md](PROJECT_STATUS.md)、[PRD](docs/PRD.md)、[TASKS](docs/TASKS.md)。已实现五模块与 Supabase 私人同步；Owner 已确认指定登录/保存/跨设备/回收站流程，完整边界见[本人联验记录](docs/04-testing/owner-cloud-verification.md)。云端导出与本地校验已发布；新增恢复前只读预检已实现并通过本地测试，发布核查见[预检说明](docs/02-engineering/backup-restore-preview.md)。预检不写入数据，无需新 SQL，实际恢复仍未开放。

## 本地运行

Node.js 22+（当前验证 24.22.1）：

```bash
npm ci
npm run dev
```

生产构建：`npm run build`，之后 `npm start`。默认绑定 `127.0.0.1:3000`。无配置也能查看空界面和真实错误提示；应用不会默认写入示例或将失败显示为成功。

安全配置见 [.env.example](.env.example)。填入本地忽略文件 `.env.local` 或部署环境，不能提交真实值。配置 Supabase 项目 URL、发布用客户端密钥及本人邮箱；可附加 Auth UUID 固定身份。服务端只用用户会话，不使用 service-role 密钥执行普通 CRUD。

认证支持邮箱 OTP 与 PKCE 邮件链接：Supabase 必须已有本人 Auth 用户（应用禁止自动注册），Auth 的 Redirect URLs 需允许实际应用的 `/auth/callback`。若使用验证码输入，邮件模板需包含 `{{ .Token }}`；默认邮件链接可走回调。APP_ORIGIN 与访问域名一致。本人登录已获用户确认；具体反馈与未测边界见联验记录。

云环境访问项目域名需要环境网络允许列表。已保存的配置草稿不代表当前网络已放行；Node.js 24 在代理环境可用 `NODE_USE_ENV_PROXY=1 npm run dev`，沿用受支持代理，不绕过网络限制。

## 页面与已实现交互

- 五模块：现在 `/`（`/focus` 兼容入口）、过去 `/archive`、未来 `/direction`、灵感 `/ideas`、复盘 `/reflection`。
- 全局采集：混合正文、JPEG/PNG 图片、URL；真实浏览器录音和试听；保存后多选领域及灵感标记。录音上传上限尚待配置，未接转写。
- Archive：列表/原件阅读、说明与领域编辑、返回列表焦点恢复、正文/说明查找、未分类与多领域任一匹配。
- Focus 可空关联和下一步；Direction 与手写周/月复盘表单、来源选择；没有完成率、四状态灵感按钮或伪 AI 草稿。
- `/settings`：本人登录、退出、回收站，以及云端 ZIP 导出/本地校验（新只读增量待安装）、旧浏览器档案只读访问与原始 JSON 备份。旧 `personal-os:v1` 不自动迁移或覆盖。

写入交互调用真实 API。**Owner 已确认指定真实保存与跨设备流程；仍必须本人登录，不能推断所有权限/失败边界均通过**。`PERSONAL_OS_DATA_CONTRACT=reviewed-v2` 只能在单独评审的数据契约、RLS 和存储策略完成隔离验证后设置；它本身不是安全证明。

SQL 方案位于 [private-records-v2.sql](docs/02-engineering/proposals/private-records-v2.sql)，Owner 已报告执行完成，远端匿名拒绝已实测通过；下一步按[安装说明](docs/02-engineering/supabase-setup.md)核查白名单/RLS/Storage，勿重复安装。首次部署还需检查 Supabase 默认授权、既有 Storage 策略和 RPC 权限；不要直接运行旧 Prisma 迁移。照片原件经会话鉴权入口读取，不发公开下载地址。

DeepSeek 为后续 AI 接口方向，尚未接入。公开页面、自动任务/提醒、原文覆盖/永久删除、备份恢复写入未实现。导出/本地校验代码已完成，启用与真实联验待完成。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run test:contract
npm run test:backup
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

## Render 与 Docker

Owner 已选择 Render，复用现有 Supabase。配置、控制台步骤、环境变量和迁移边界见 [Render 部署说明](docs/02-engineering/render-deployment.md)。既有版本已部署并获得本人指定流程反馈；本轮备份代码尚未推送或部署。

## 回收站

Owner 已批准原记录/方向/复盘移入与恢复；不永久删除。需在已有 v2 基础执行一次增量 SQL，详见[回收站安装及验收](docs/02-engineering/recycle-bin.md)。不要重新执行初始建库脚本；数据库未升级时界面会报告回收站尚未接通。

## 云端备份（BKP-01～03）

范围已获确认：手动未加密 ZIP，含回收站、绑定原件与关系。设置中生成并在本机校验后显式保存；可选择已有包做离线校验。只读增量安装与六项检查见[实施交接](docs/02-engineering/cloud-backup-export-implementation.md)。本轮未应用远端 SQL 或部署；不重复安装基础库。恢复预检与写入尚未实现。

`npm run test:backup` 运行合成格式/隔离 SQL 测试；`npm run benchmark:backup` 测量合成档案，不连接云端或输出私人数据。容量上限和未验证的真机/Render 边界见实施交接；校验通过不代表恢复已演练。
