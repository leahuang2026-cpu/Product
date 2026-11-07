# Personal OS｜可访问预览交接方案

用途：在用户没有 Desktop 入口、无法下载工作区压缩包的情况下，为本人登录与保存联验提供可审核的访问路径。
日期：2026-11-07（Asia/Shanghai）。状态：Owner 已明确回复“批准”，授权新测试分支推送与 Vercel Preview。当前执行中，实际进度见开发日志；main、正式生产、付费及私人数据公开仍不在授权内。

## 最新决定

Owner 已改选 Render；Vercel 设备授权等待已停止，无 Vercel 项目或部署。以下保留为历史执行记录，后续使用 [Render 说明](render-deployment.md)。

## 当前执行结果

- 应用提交 `2a6b9f2f9741bfdb8bb0632f1641a7a6ff10e3d5` 已推送至 `preview/personal-os-login`；父提交为原 main，未改 main、未强推。
- Vercel CLI 65.12.1 已通过 npm 临时工具缓存安装并可运行；项目依赖/锁文件未因工具安装改变。官方 CLI `whoami` 返回 Logged out，无可复用登录。
- 上轮 `api.vercel.com`、`vercel.com` 代理连接返回 403，已保存追加域名且保留现有 Supabase 的网络草稿。Owner 随后发布环境，新实例观察为 current/enforced 且含这两个域名，新连接均返回 200。
- 普通 dry-run 因缺凭据退出；`--temporary --dry` 也返回 login_required/temporary unavailable。没有上传或生成临时部署；不能把本地忽略规则检查称为 Vercel 实际上传清单已通过。
- Owner 发布环境后网络已通过新连接验证。已启动 `vercel login` 浏览器设备授权，当前等待本人在 Vercel 确认；不要在聊天提供 Token/密码。没有账号授权和网络前，不创建资源。

## 已核实条件

- 用户明确没有 Desktop 入口；当前工具中没有共享浏览器、打开桌面、预览或端口转发操作。桌面能力虽声明 enabled，状态 unknown，不能据此声称用户可以操作。
- 本地 Next.js 登录页已运行，数据契约已为本人联验启用；实际匿名读写仍拒绝。Owner 反馈七项数据库安装检查全 true；未取得本人应用会话。
- 只读查询远程 main 为 `973727fc0a33cec96d0bfc79f47e063b9ffec37f`，共有 11 个文件；源码仅 `src/.gitkeep`，没有可构建应用。这次执行前应用尚未提交；现已进入上述测试分支。
- 远程读取与测试分支推送已验证。CLI 可用，网络配置已在新实例生效；Vercel 账号授权仍在等待本人确认，尚无项目绑定或部署。

## 推荐范围：独立预览部署

1. 在当前 checkout 保留全部工作，基于远程 main 的历史建立新的测试分支 `preview/personal-os-login`（如已存在则先核查）。将已审查的应用代码、锁文件、测试与脱敏过程文档纳入一次可审核提交。保留远程历史，不强推，不合并或改变 main，不另建仓库或工作树。
2. 经 Owner 授权 Vercel 账号后，关联测试项目，使用默认 Preview 部署（CLI `vercel deploy`，不使用 `--prod`）。账号与套餐、可用额度由实际控制台核实，不购买付费资源。
3. 配置 Preview 环境变量；实际预览或稳定分支域名确定后，设置精确 APP_ORIGIN 和 Supabase Auth Redirect URL，再重建预览。首次地址确定前不宣称登录可用，不发送测试邮件。不能以主站的 localhost 回调代替预览域名。
4. 预览登录页可能具有公开 URL；私人数据仍要求本人会话与数据库 RLS。若账号支持平台 Deployment Protection，开启并实测本人访问；不能把 Preview 一词当作天然网络私有的证明。此步骤不增加个人公开主页或公开数据功能。
5. 用本人浏览器完成登录，仅在页面输入验证码或密码。先验证文字、分类、标记、刷新找回和失败恢复，再验证附件。模拟记录与真实资料分开，不能把配置完成当作联验通过。

首次授权可能需要 Owner 在自己浏览器登录 Vercel/授权 GitHub，或通过支持的安全环境配置提供连接。不要向聊天索取管理 Token、密码或 OTP。没有有效授权就停止外部创建/部署，继续保留本地成果。

## 将上传与排除的内容

- 应用构建输入：`src/`、`package.json`、锁文件、TypeScript/Next 配置与必要仓库配置。
- Git 分支可以包含脱敏设计/验证文档及测试，便于后续审阅；Vercel CLI 上传另由 `.vercelignore` 排除文档/测试/产物等无关文件。
- `.env.local`、其他真实 `.env*`、`.supabase-setup/` 中含本人邮箱的 SQL/ZIP、`.vercel/` 项目元数据、依赖目录和生成产物均不作为源码提交或上传。仅 `.env.example` 为可提交的空值模板。
- 本轮新增 `.vercelignore` 并将 `.vercel/` 加入 `.gitignore`；不创建假部署链接或公开隧道。

## Preview 环境变量

| 名称                        | 用途 / 配置方式                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| SUPABASE_URL                | 现有项目 URL，在平台环境设置配置                                                            |
| SUPABASE_PUBLISHABLE_KEY    | 现有发布用客户端密钥，服务端读取；不写 Git 或构建命令                                       |
| PERSONAL_OS_OWNER_EMAIL     | 本人当前实际邮箱，不沿用历史安装包里的旧邮箱                                                |
| PERSONAL_OS_OWNER_ID        | 可选 UUID 固定；需与实际白名单一致，不能编造                                                |
| APP_ORIGIN                  | 精确的实际 Preview HTTPS origin，不附路径；与访问地址一致                                   |
| PERSONAL_OS_DATA_CONTRACT   | 本轮安装检查已获 Owner 全 true 反馈；为登录后的合成联验使用 reviewed-v2，不把此值当验收证明 |
| PERSONAL_OS_MAX_AUDIO_BYTES | 尚待批准/验证，保持空；不以录音预览冒充云语音可用                                           |

平台构建使用 `npm ci` 与 `npm run build`，Next.js 预设，输出目录自动识别。当前本地验证 Node 24.22.1；平台 Node 版本的支持情况部署前核对。无须为运行时添加 ChatGPT/Codex 或 DeepSeek 密钥。

## 附件限制与验证边界

当前 `/api/uploads` 将原件经 Next.js 接口接收再上传 Supabase，`/api/attachments/[id]/content` 经会话鉴权返回原图。Vercel Functions 已知存在请求/响应体大小限制（常见限制为 4.5 MB），本轮未在线核验供应商最新规则。10 MB 原图收发可能在进入应用逻辑前失败，不能以当前本地成功宣称平台支持。

首个预览先验登录、文字与小图；10 MB 图片仍保留为产品规格和未完成验收，不擅自改上限。需要在部署前/后实测平台限制，并另行设计受控分段上传/读取或合适的服务承载方案；不能为绕过限制把原件 bucket 改公开、发长期公共原图链接或取消会话鉴权。参考核查入口：https://vercel.com/docs/functions/limitations 。

## 可验证的完成条件

- PVIEW-01：新测试分支保留历史、main 未变，源码/产物未包含真实凭据或私人安装文件。
- PVIEW-02：真实 Preview URL 可由 Owner 的手机/电脑打开；平台保护（如启用）、应用本人身份和匿名拒绝分别验证。
- PVIEW-03：实际 HTTPS origin、Auth 回调与邮箱模板一致，Owner 自行登录成功；不将默认控制台用户等同应用会话。
- PVIEW-04：合成文字保存、刷新、找回、多领域/灵感标记和失败重试通过；再开展小图与原图一致性测试。
- PVIEW-05：明确 10 MB 图片、语音、真实跨设备、备份恢复及另一个真实账户测试的通过/失败/未测状态。未通过项保持未完成。

## 当前验证与已批准动作

本地生产构建复核结果见 DEV-012；候选源码清单和敏感路径/限定字面量检查已执行。检查不代表完整安全审计、Vercel 构建成功或真实云端登录通过。

Owner 已明确批准的动作：将当前已审查源码推送到指定仓库的新测试分支，并创建 Vercel Preview 用于本人联验。授权不包括改 main、正式生产部署、购买资源、公开私人记录、数据库迁移/删除或调整既有权限。本方案准备阶段没有任何提交、推送或部署；本次执行进度以 DEV-013 为准。
