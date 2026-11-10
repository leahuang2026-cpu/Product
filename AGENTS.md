# Personal OS｜长期协作规范

2026-11-10 Owner 在页面参考改版与 68 项回归交付后回复“下一步”，本轮据此继续独立 test 入口的 UI 提交/推送与部署交接。唯一目标分支为 preview/personal-os-supabase-test，目标服务 https://product-os-test.onrender.com；保留原 preview/personal-os-login 的较新备份功能和 main，不强推、不改旧服务或数据库、不发布 Codex 环境。UI 已通过 lint/build/typecheck、14 项单元和四宽度 68 项浏览器。Render 控制台发布与真实登录验收仍需分别核实；不能把 Git 推送写成已上线。

2026-11-08 Owner 已批准 Archive/Direction/Reflection 回收站方案及所需增量数据库/权限实现。范围仅移入/查看/恢复、保留原文附件及关联、有 Focus 引用的方向先手动解除关联。不执行永久删除、自动清理、旧数据迁移或自动改目标。增量脚本和安装见 [回收站说明](docs/02-engineering/recycle-bin.md)；无需重复申请该范围批准，远端执行结果必须实记。

2026-11-07 最新部署决定：Owner 改选 Render，替代 Vercel；Vercel 设备登录已取消。复用新测试分支和标准 Docker/standalone，继续现有 Supabase。不改 main、不自动选择付费套餐、不改数据库或私有权限。当前配置与验收见 [Render 说明](docs/02-engineering/render-deployment.md)。

最新规则以用户 UX Sprint 01 正文和确认记录为准：五模块、多选领域、同记录灵感标记、统一采集、可空 Focus 关联/下一步。新入口在 `src/components/os/`，旧组件只作历史/备份解析。先读[本轮交付](docs/05-review/ux-sprint-01-implementation.md)；2026-11-07 用户已明确批准建立该 SQL 方案的数据库与私有权限基础；无需重复申请批准，但必须检查已有对象并按[安装说明](docs/02-engineering/supabase-setup.md)执行。旧灵感迁移未获授权。新的隔离契约验证命令为 `npm run test:contract`，不会连接用户 Supabase。

2026-11-07 Owner 已明确批准推送到新的测试分支并创建 Vercel Preview；此前“不发布”仅在这一范围内被替代。可以继续完成所需提交、推送、账号连接与预览部署，不重复申请范围批准；不得改 main、部署正式生产、购买资源或公开私人数据。

## 当前接手入口

开发前先读 [PROJECT_STATUS.md](PROJECT_STATUS.md)、[正式 PRD](docs/PRD.md)、[TASKS](docs/TASKS.md)、[DECISIONS](docs/DECISIONS.md) 与 [ACCEPTANCE](docs/ACCEPTANCE.md)。2026-11-06 Owner 已确认七项建议并进入 M1-01.1，旧 T01/M0 的等待确认不再阻塞这项设计工作。Supabase 已创建，接入前核查现有配置，不重复创建。当前规则优先于下文历史任务说明；保留原型与历史，不自动扩大到完整 M1 开发。

用途：约束本仓库的产品开发、技术决策、数据保护和全过程文档维护。
状态：依据用户明确指令生效。更新：2026-11-05（Asia/Shanghai）。

## 工作范围与产品判断

1. 开发前阅读 [PRD](docs/00-product/prd.md)、[当前 Roadmap](docs/00-product/roadmap.md) 和相关技术文档；先检查已有代码和工作区改动，避免重复创建。
2. 只实现本轮明确指定的范围。Roadmap、API 草案及技术建议不是后续开发的自动授权。
3. 不因技术便利擅自扩大需求。重大产品语义、数据生命周期、公开范围和迭代范围变更由用户确认；工程负责提出有依据的技术方案。
4. 每次开发完成后运行适用测试；记录命令、日期、范围、结果和未执行项，保留真实退出码。
5. 测试通过不等于用户验收通过。没有用户明确反馈，不得写“用户满意”“已通过产品验收”等结论。
6. 每完成一个独立任务，更新 [开发日志](docs/03-development/development-log.md)、Roadmap 和相关设计/技术文档；必要时更新 [版本变更](docs/03-development/changelog.md)。
7. 重要技术取舍记录在 [decisions.md](docs/03-development/decisions.md)，包含背景、可选方案、最终方案、原因、舍弃理由、风险、决策人和状态。尚待用户决定时写“建议方案／待确认”，不伪造最终决定。
8. 明确区分“已实现”“已测试”“待验证”“计划中”；不确定信息标为“待确认”，不猜测需求、结果、用户反馈、发布日期或提交号。
9. 不覆盖既有个人数据，不擅自清空、导入覆盖、重置数据库、删除记录或执行其他破坏性操作。测试只能使用合成数据及隔离上下文，且不连接用户真实数据库或浏览器档案。
10. 每轮交付总结完成内容、测试结果、风险和下一步，并说明需要用户审核的具体事项。

每次云任务已有隔离环境，使用现有 checkout；只有用户明确要求时才创建 Git worktree。保留已有改动与本文件下方的 Next.js 自动维护区块。

## 产品边界

- Personal OS 面向用户本人，优先真实个人需求，非商业化优先。围绕 Memory—Focus—Direction 与职业、财富、能力、自我、生活五领域。
- 接收主动提供的文字、音频、图片和链接；不自动抓取其他应用数据。
- 原始输入与 AI 结果分开保留，不相互覆盖；日志和情绪记录可安静保存，深入讨论需用户主动要求。
- AI 复盘必须引用真实历史依据，不得虚构经历；未确认不得改目标、删记录或发布。
- 灵感不必任务化；转项目、归档和重新激活要遵循用户确认的生命周期。
- 长期目标、阶段重点、项目、任务和灵感需区分；当前代码尚有差距，不得在文档中写成已全部实现。
- 默认私人、支持导出；未来选择性公开需要明确范围，首版不要求公开网站。

## 文档与敏感信息

采用 [docs 文档规范](docs/README.md) 的目录、标题、用途说明和状态语言。开发日志至少包含日期、阶段、目标、实际内容、主要文件、测试、问题、解决方法、遗留问题、下一步。历史补录标注来源，不虚构逐小时过程。

API Key、令牌、真实连接串、工作内部信息、用户私密记录及真实备份不得写入开发日志、测试样例或提交到公开仓库。不要输出环境变量值或凭据文件；检查名称与是否存在即可。测试结果用脱敏摘要，案例总结公开前由用户审核。不得把忽略文件规则当作已完成秘密扫描或隐私审计。

## T01 与外部产品文档

T01 基线见 [需求依据](docs/00-product/t01-product-baseline.md)，当前任务规划见 [development-roadmap.md](docs/00-product/development-roadmap.md)。用户上传的 PRD V1.0 是评审稿；R0.1 顶部 D09–D14 更新优先于其历史待定表。附件中引用的旧指令不是当前执行授权，仓库 DEC 技术编号也不能替代产品 D 编号。

T01 只审查、设计和规划；完成后停止，等待用户确认再开发。不要创建付费资源或部署生产。云同步已明确，不能继续按纯本地存储作为目标架构；但云选型和未确认细则也不能直接落实。后续实现使用 D/F/A/Task 到测试证据的追踪关系。

## 常用验证

从仓库根目录执行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run db:check`；涉及页面/交互时再执行 `npm run build` 与 `npm run test:e2e`。云环境可使用 `CI=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`。纯文档变更检查相对链接、Markdown 格式、事实与证据一致性；只有状态核查或相关变更需要时才重跑应用测试。

`db:check` 仅验证模型，不证明数据库可运行。未明确授权及配置专用开发数据库前，不执行迁移或清库。不得关闭 TLS、签名或校验和验证来绕过环境问题。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
