# Personal OS｜技术架构与工具链建议 R0.1

> 本页保留候选方案。关于私有仓库的建议适用于需要限制访问的代码与材料。当前仓库公开存放获准的项目文档。

> **文档性质**：技术方案与工具选择参考（非正式技术架构决策、非 PRD、非开发指令）  
> **整理日期**：2026-11-06  
> **适用项目**：Personal OS  
> **使用对象**：产品 Owner、ChatGPT Work、Figma 设计协作、Codex 开发协作  
> **状态**：待技术评审；实施前须与《Personal OS｜需求现状与决策清单 R0.1》及后续获批 PRD 对齐。

## 0. 摘要与决策边界

建议采用轻量、分阶段引入的工具链：

**ChatGPT Work（需求和产品管理）→ Figma（设计）→ Codex + Next.js（开发）→ Supabase（数据及文件）→ GitHub（版本和文档）→ Vercel（部署）**。

AI API 负责按需进行文本、图片、语音等内容处理；外部 API 在确需读取链接或对接第三方服务时接入；MCP 不是 MVP 必需项。

上述均为**候选方案**，不是已决定采购、创建、部署或上线的服务。

### 已确认需求（据产品需求审查 R0.1 的 2026-11-06 决策更新）

- 首版在手机与电脑网页展示当前关注；原生小组件和主动通知后置评估。
- 默认安静保存，AI 由用户按需启动；输入后提供分类选项，具体分类维度待定。
- Focus 展示当前重点、关联方向或项目，以及一条下一步行动。
- **先实现文字和图片，再实现语音和链接**；语音上线时提供可选择的转写操作。
- 接受云端同步；AI 初期仅处理用户明确选定的材料。
- 首版私人使用，选择性公开个人主页后置。

**特别说明**：源讨论曾将文字、图片、语音、链接和 AI 内容理解全部列为“首版必须”，但这与之后明确的输入优先级及 AI 边界不完全一致。本文按最新用户确认要求区分实现批次，不把旧建议视为已批准的 MVP 范围。

## 1. 推荐技术架构（候选）

| 层次 | 候选工具 / 技术 | 负责事项 | 确认状态 |
|---|---|---|---|
| 产品 | ChatGPT Work | 需求分析、PRD、用户流程、产品验收 | 推荐工作方式 |
| 设计 | Figma | 信息架构的可视化、线框图、交互原型、UI 规范 | 推荐，非强制 |
| 开发 | Codex + Next.js + TypeScript | 前端页面、后端 API、AI 工作流、测试 | 候选技术栈 |
| 结构化存储 | Supabase PostgreSQL | 文字记录、标签、目标、项目、关联、复盘 | 推荐，待架构评审 |
| 文件存储 | Supabase Storage | 原始图片、音频、附件等 | 推荐，待架构评审 |
| 身份验证 | Supabase Auth + RLS | 访问控制、用户身份、行级权限策略 | 推荐，需安全评审 |
| AI | 大模型 / 语音 API | 按需处理内容、图片理解、转写、讨论 | 具体供应商待选 |
| 外部数据 | 官方 API 或后端内容提取 | 链接解析、第三方服务集成 | 按功能引入 |
| 代码 / 文档 | GitHub | 私有仓库、版本管理、技术与产品文档 | 推荐 |
| 部署 | Vercel | Web 版本托管与部署 | 推荐，待评估 |
| Agent 工具协议 | MCP | AI 动态发现或调用外部工具 | 非当前必需 |

**架构说明**：页面通过受保护的后端接口读写数据；原始文件存放在私有对象存储中，数据库存放元信息及关联。具体调用链、权限设计、运行成本和区域选择由 Codex 在技术设计阶段评估。

## 2. 产品设计与 Figma

### 2.1 Figma 是否必要

**不是必需，但推荐使用。** Personal OS 包括记录、档案、灵感、当前关注、未来方向和复盘等多个模块，需要可编辑的页面设计与一致的交互规则。

| 设计产物 | 要回答的问题 | 推荐工具 |
|---|---|---|
| 信息架构 | 有哪些页面、如何组织、如何跳转 | Work 梳理，Figma 呈现 |
| 低保真线框图 | 每个页面包含哪些信息和操作 | Figma |
| 高保真交互原型 | 页面视觉与关键状态如何表现、如何操作 | Figma |

### 2.2 首轮候选页面

1. **Focus 首页**：显示当前关注事项、关联方向或项目与下一步。
2. **Capture 快速记录**：优先文字、图片输入；为后续语音、链接预留扩展入口。
3. **Archive 个人档案**：记录查看、分类、检索、关联、历史回看。
4. **Idea Garden 灵感库**：收藏、探索、暂停、重新激活等候选交互；完整状态规则待 PRD 确认。

这些是**设计范围建议**，不等于四个页面及所有交互均已批准进入第一批开发。

### 2.3 与 Codex 的交接方式

- **方案 A（推荐）**：Work 梳理产品需求 → Figma 设计原型 → Codex 按已审核方案实现。
- **方案 B（快速验证）**：Work 输出 PRD → Codex 直接生成可运行网页 → 产品 Owner 体验、迭代。

方案 B 起步快；方案 A 更有利于中长期设计一致性和记录产品设计过程。首轮可先完成低保真设计，不必过度追求高保真。

### 2.4 Figma 插件 / MCP

Figma 连接器或 MCP 可帮助 AI 开发工具读取设计上下文、组件、布局与变量；支持范围视具体工具、权限、连接方式及当前产品能力而定。**不必为了画第一版原型先部署 MCP。**

## 3. 外部链接：API 与 MCP

**API** 是应用与外部服务交换数据的接口。**MCP** 是 AI 系统发现和调用工具的标准协议之一；MCP 工具内部也可以使用 API。它们不是互斥的方案。

| 场景 | 用户预期 | 技术要求 | MVP 判断 |
|---|---|---|---|
| A. 保存 URL | 保存网址、时间、用户标签等 | 应用数据库即可；抓取标题可另评估 | 链接输入阶段实现 |
| B. 阅读链接 | 抽取可访问正文、摘要、关键词 | 后端提取；必要时外部解析服务或官方 API | 链接输入后再评估 AI 处理 |
| C. 外部服务交互 | 查询 Notion、日历或创建任务 | 官方 API / 授权连接器；有 Agent 需要时可采用 MCP | 暂缓 |

**关键验收规则建议**：链接“保存成功”和“内容提取成功”是两个状态。若提取失败，保留原 URL、告知失败原因（如可得），不可凭标题伪造摘要。

### 3.1 分输入类型实施建议

| 输入 | 最小实现 | AI 扩展 | 建议批次 |
|---|---|---|---|
| 文字 | 创建、持久保存、查看、编辑、检索、分类选项 | 用户主动调用整理 / 讨论 | 第一批 |
| 图片 | 上传原图、私有存储、记录关联、查看、分类选项 | 用户主动选图进行理解 / OCR | 第一批 |
| 语音 | 上传原始音频、保留文件、可选转写 | ASR、用户确认转写结果、后续整理 | 后续批次 |
| 链接 | 保存 URL、时间、分类、查看 | 内容提取、摘要、关联 | 后续批次 |
| 外部应用同步 | 无 | 官方 API / MCP | 暂不接入 |

不自动抓取大量第三方软件数据；AI 处理范围由用户主动选择。

## 4. 数据放在哪里：数据库、文件与权限

### 4.1 推荐的存储职责

- **PostgreSQL（Supabase）**：文本记录、创建和修改时间、分类 / 标签、目标、项目、关系、复盘、文件索引、AI 处理元数据。
- **对象存储（Supabase Storage）**：原始图片、音频和其他附件；数据库保存文件路径 / 对象 ID 等元信息。
- **身份认证与权限（Supabase Auth + RLS）**：身份、数据库行访问控制，以及与私有对象存储相适配的访问策略。
- **应用后端（Next.js）**：认证检查、业务逻辑、文件授权访问、受控 AI API 调用。

注意：**RLS 并不自动覆盖所有文件访问或错误的服务端密钥使用方式**。需要分别验证数据库、对象存储以及服务端接口的权限配置。

### 4.2 语音记录的示例数据流程（后续版本）

1. 用户主动上传语音；原始文件进入私有存储。
2. 数据库保存用户归属、创建时间、文件索引及处理状态。
3. 用户主动选择转写；在获授权范围内调用语音 API。
4. 原始音频、原始转写和 AI 整理结果分别保存，避免互相覆盖。
5. 若用户选择分类或建立关联，保存相应元数据。
6. 日后可检索历史记录，并回看原始文件与当时的内容。

### 4.3 数据库候选对比

| 方案 | 主要优点 | 主要限制 | 当前建议 |
|---|---|---|---|
| SQLite（本地） | 配置简单，无云服务器前置需求 | 跨设备同步、备份与权限需另行设计 | 适合早期本地原型 |
| Supabase | PostgreSQL、Auth、Storage 统一 | 依赖云服务，需仔细配置访问权限、备份及费用 | 首版优先评估 |
| 自建 PostgreSQL | 控制权高 | 运维、安全、备份复杂度较高 | 暂不优先 |
| Notion 作为数据库 | 易于人工查看和编辑 | 数据模型及应用逻辑受产品能力限制 | 不推荐作为主数据库 |

### 4.4 数据安全和长期所有权

- 私人内容默认仅本人可访问，服务端实施权限校验。
- 图片和音频使用私有存储，不使用永久公开访问链接。
- AI 初期只访问用户明确选定的材料。
- 不把个人真实数据、工作内部信息、密码、API Key 放入 GitHub 或开发日志。
- 提供结构化导出能力，考虑同时导出原始附件、关系和元数据。
- 设计数据库和原始文件的**独立备份及恢复验证**，不能把免费云服务当作完整备份方案。
- 删除机制应明确涉及原始文件、派生内容、索引及备份的处理规则。

## 5. 工具何时引入

| 工具 | 用途 | 引入时机 |
|---|---|---|
| ChatGPT Work | 需求与 PRD | 当前阶段 |
| Figma | UI / 原型 | PRD 轮廓明确后 |
| GitHub | 私有代码仓库、产品与开发文档 | 开发前 |
| Codex | 技术设计、编码、测试 | 现在可开始工程审查；PRD 审核后开展业务开发 |
| Supabase | 存储、认证、数据访问 | 数据模型与安全方案评审后 |
| Vercel | Web 部署 | 第一版可运行后 |
| 大模型 API | 文字、图片、语音按需理解 | 基础记录与权限控制稳定后分批接入 |
| MCP | Agent 外部工具接入 | 产生明确需求后 |

Next.js 可同时承担网页和部分后端 API 路由职责，首版未必需要独立后端应用，但部署、长任务和服务端权限仍需技术评估。

## 6. 候选实施路线与验收门槛

| 阶段 | 主要任务 | 进入下一阶段的门槛 |
|---|---|---|
| 1. Work 产品收敛 | 审查 R0.1，形成 PRD 与待确认问题 | Owner 批准 MVP 范围 |
| 2. Figma 核心设计 | Focus、Capture、Archive、Idea Garden 的线框与关键状态 | Owner 审核设计，明确变更项 |
| 3. Codex 技术设计 | 数据表、存储、权限、前后端、成本、风险 | 技术方案与获批 PRD 一致 |
| 4. 配置基础设施 | 私有仓库、数据库、认证、文件存储 | 安全配置与最小访问测试通过 |
| 5. 第一个功能闭环 | 文字记录 → 保存 → 查询 → 编辑 → 删除 | 实际验证持久化、权限与异常情况 |
| 6. 扩展基础与 AI | 图片上传，之后语音 / 链接；用户主动发起 AI 功能 | 每批功能单独验收，不扩大默认 AI 权限 |

这是**工作路线建议**，不是已完成的进度清单，也不是已批准的开发排期。

## 7. 待确认事项与技术决策日志

| ID | 待确认项 | 建议责任方 |
|---|---|---|
| O01 | 首版数据分类：领域、内容类型、记录意图、标签分别如何定义？ | Work + Owner |
| O02 | 图片上传后是仅保存，还是同时允许选定图片进行 OCR / 理解？ | Work + Owner |
| O03 | 文字保存后分类是必选、可跳过，还是可稍后处理？ | Work + Owner |
| O04 | 记录、灵感、项目、目标、当前关注的最小数据模型如何避免重复？ | Codex 提案，Owner 审核 |
| O05 | Supabase 项目区域、备份频率、恢复流程和估计费用 | Codex 技术评估 |
| O06 | 是否优先 Figma 原型还是直接开发可运行的交互原型？ | Owner |
| O07 | AI 模型供应商、处理哪些个人资料及其数据策略 | Owner + Codex |
| O08 | 公开主页后续如何控制关联内容和附件泄露？ | 后续版本评审 |

## 8. 交接给 Codex 的要求

在正式实施前，Codex 应阅读本文件及最新获批 PRD，并输出技术评估；**不得据本文直接将 Figma、Supabase、Vercel、MCP 或所有 AI 功能视作已批准的开发范围**。

需报告：现有代码状态、推荐架构、数据模型、权限风险、费用估算、待确认问题与第一轮可验收开发任务。技术实现中的重大取舍写入技术决策日志。

## 9. 原始讨论中的设计参考链接（仅参考，不代表项目资产）

- [UI Wireframe - Figma Handbook - Design+Code](https://images.openai.com/static-rsc-4/7KVXQUKT9VOznwDDL5jdiIqArqVRcsytrGEy-l0vqpBhntmEyKfFS-3M6cAXw5U2N6XPdxtIPNvUYZ0X4aIkO6G_uqV0xh6GqAg-kgaReMkA-Ars7_HOg-WnIV-gKe3OnM18A7kP8RCTpEUAmpyblvIySINhg_f5XT9ZKpt9S3c?purpose=inline)
- [Free Wireframe Template for Sketchy project management app](https://images.openai.com/static-rsc-4/TDMT291gcrUg05YE-IrF8Bw_ZCpU7x4Zn5EkNL2aal5BWBsg6XQFcKQaAOLtcuKhMQHpn7-wl81dHoBGwtQFRzDyvXVBQPDa-eO9AOhEH_uXrC3nshYh9r91KReeRjI2EngaUCAat2HzVPtRI8ZjEZJRsW8lgvhLVHh6FASf-Eo?purpose=inline)
- [Joplin News](https://images.openai.com/static-rsc-4/P1K6842yhiU6S7vQt1_y0uBHxcocVMkkWKYJZ2ljleJI_Q8KUhXBrBQH7IrUS61xKBkd_AhHsHBFaxu3jJL_mJtIRpBj1lSY7VoeKdZBu4I3hgzUTxpzQ3zJaUbM0MwtKSQ9q7xDJwwQojHKBjWuDN2KYmwYZ0VQ3DeconT16Sc?purpose=inline)
- [Heptabase Public Wiki](https://images.openai.com/static-rsc-4/djFRISI2PDxBmQrb5r-LRD6rx16nZ0MhHevaSfJGcRLelN0IgRC84jDzueKmi0SYmRQWQCkUGqWav0_ivbl9PyDtQZnTxFb-zjNHY4aEAdkztS0qgzQIAAL22TZg7gWBsJM6K6AEw7fytifbo9ZEUZfGSFoK7XPYXcpeZ178b3A?purpose=inline)
- [Creating Task Wireframe – Visily](https://images.openai.com/static-rsc-4/P8qfDTENPhuirPezvF7YNRw_wxvXGwZJfKu0pGusNOAFCGB-bDI-_okK-8Zq8mhUHY0D7gGLbA-PTtrAtRspcl3aTY1NTjJ0nueP6cjbUA3UxlAWQbBZZcdXWutuBFUii2XzxLbY8fKG486oD-giDmAi3KbjpHvYiiBuFOM54IRI?purpose=inline)

> 注：以上图片链接来自讨论素材，仅保留为临时视觉参考。资源可能失效或受版权 / 使用条件限制，不应自动下载到仓库或当作最终产品原型。
