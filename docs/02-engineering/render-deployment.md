# Personal OS｜Render 部署与迁移说明

## 2026-11-08 备份版本发布准备

Owner 已完成只读备份增量并反馈六项全 true。新版本在现有测试分支发布，不改 main 或重装数据库。Docker 上下文排除引用 tests 的容量脚本与私人备份；fflate 补丁版 0.8.3，最终镜像及无凭据启动检查通过（见 DEV-020）。此前登录/跨设备/回收站指定流程已获 Owner 反馈，下方首次部署状态保留为历史。新备份的真实导出与手机文件保存仍待验证。

用途：提供可迁移的 Docker 部署配置及本人登录联验步骤。
日期：2026-11-07（Asia/Shanghai）。状态：Owner 已选择 Render；本地容器构建和无配置启动烟测已通过，未创建云服务，未批准付费套餐。

## 部署方式

复用 `preview/personal-os-login` 分支、现有 Next.js 和 Supabase。Docker 多阶段构建，运行 Next.js standalone，非 root 用户，监听 0.0.0.0，使用平台注入的 PORT（默认 3000）。不使用应用本地磁盘存放用户附件或数据库。运行时从环境读取配置，不把真实 env 或私人安装包放入镜像。

Render 控制台：New → Web Service → 连接现有 GitHub 仓库 → 分支 `preview/personal-os-login` → Runtime Docker → Dockerfile `./Dockerfile`、构建上下文仓库根目录。先关闭自动部署（如可配置），避免后续提交未经核查即发布。服务属于独立测试入口，不能把它称为 Render 自动隔离的 Preview 环境。Health Check 使用 `/login`，仅证明服务可响应，不代表 Supabase 或登录成功。

实例先查看当前 Free 可用性及休眠、额度限制；如需付费，先向 Owner 展示实际套餐和价格，不自动选择。此前聊天价格为参考，尚未实时核验。免费实例不承诺长期稳定运行、无冷启动或完整备份。

## 环境变量与回调

在 Render 环境设置中安全填写，不提交仓库、不发送聊天：SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY、PERSONAL_OS_OWNER_EMAIL，以及与已安装契约一致的 PERSONAL_OS_DATA_CONTRACT=reviewed-v2。PERSONAL_OS_OWNER_ID 仅在已知正确时填写。不要配置 service-role 密钥。音频上传上限仍待确认。

创建后使用实际分配的 HTTPS origin 设置 APP_ORIGIN，之后重新部署；Supabase Auth Redirect URLs 添加同一 origin 的 `/auth/callback`。不要复制本地 localhost origin。首次域名未确定、环境未配齐时，不宣称登录可用。本人自行在页面完成登录，密码/验证码不得发给工程代理。

无需 DATABASE_URL、DeepSeek 密钥或数据库迁移。已安装的数据库和私有权限保持不变。

## 本地构建与运行

```sh
docker build -t personal-os:local .
docker run --rm --env-file .env.local -e PORT=3000 -p 127.0.0.1:3000:3000 personal-os:local
```

本地 APP_ORIGIN 应匹配实际访问地址；部署时单独配置。镜像构建不需要真实用户配置。托管云环境代理 CA 可以通过可选 BuildKit secret `proxy_ca` 传入，不复制进镜像。不要关闭 TLS 验证。

## 验收与风险

- RENDER-01：Docker 构建成功；镜像无真实 env、私有安装包；非 root 启动并响应平台 PORT。
- RENDER-02：真实 HTTPS 地址 `/login` 可打开，匿名数据读写拒绝；部署状态不能替代 HTTP 验证。
- RENDER-03：配置实际 origin/回调后本人登录成功；仅用合成记录验证文字保存、刷新找回、分类和灵感标记。
- RENDER-04：小图和 10 MB 原图实际上传、鉴权读取、重试和一致性验证。常驻服务不沿用 Vercel Functions 限制，但平台代理、内存、应用限制仍需实测。
- RENDER-05：手机/电脑同账户读取验证；另一个账号不能访问。用户验收另记，不以模拟 API 测试代替。

当前无 Render 连接器或已验证账号授权。需要 Owner 在控制台完成账号和 GitHub 仓库授权；不索取聊天中的管理 Token。构建、真实部署和验收结果在开发日志分别记录。

## 迁移与维护

同一 Dockerfile 可部署自有服务器或其他支持容器的平台。保留同一 Supabase 时不用迁移数据库/附件；变更域名后更新 APP_ORIGIN、认证回调并重新验证。自有服务器另配 HTTPS 反向代理、更新和监控。Supabase 免费/付费额度、独立备份恢复及数据导出仍需后续落实，容器镜像不是用户数据备份。基础 Node 镜像为可更新的主版本标签，正式稳定发布前记录构建摘要并安排安全更新。

## 首次云端部署证据（Owner 截图）

2026-11-07 Owner 提供 Render 控制台截图：提交 d6e27b4，Deploy succeeded / Live，Next.js 监听 0.0.0.0:10000；主地址 https://product-xfca.onrender.com 。此为 Owner 提供的平台证据，未等同工程代理 HTTP 实测。免费实例页面提示空闲休眠后请求可能延迟 50 秒或更久。

代理只读请求在默认沙箱遇 EPERM，外层以同一 URL/默认代理重试得到 Tunnel 403；当前环境未放行该 Render 域名，未取得页面或接口响应，不将其解释为应用故障。环境变量是否齐全、实际回调与本人登录尚未确认。
