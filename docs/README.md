# Personal OS｜文档导航与维护规范

## 当前实施状态：UX Sprint 01

用户最新设计与“确认/继续”已授权界面和接入代码实施：五模块、领域多选、记录灵感标记、统一混合采集；Focus 关联/下一步可空，数量不受主卡限制。上述规则替代下文旧单选/单条 Focus 设计。

本轮界面与 Supabase 认证/API 代码已实现；真实云端登录、RLS、持久化和跨设备未联验。SQL 提案已通过独立内存 PostgreSQL 测试但未应用到云端；数据库/权限变更仍需单独确认。当前进度与实际边界见 [实施交付](05-review/ux-sprint-01-implementation.md)。

当前入口：[项目状态](../PROJECT_STATUS.md)、[正式 PRD 与本轮确认](PRD.md)、[任务](TASKS.md)。M1-01.1 设计已交付，见[录入流程](01-design/m1-01-1-capture-flow.md)；下文 M0/T01 保留历史。

> 用途：提供唯一文档入口、状态定义和每轮交付的维护顺序。
> 状态：文档规范已建立；产品草案待用户审核。
> 更新：2026-11-06（Asia/Shanghai）。

## 当前 M0-02 交付入口

[工程核查、可复用内容、技术待决项与带验收编号的开发顺序](02-engineering/m0-02-engineering-review.md)已形成评审交付，等待 Owner 确认。当前依据是远程 `main` 的文档提交 `973727f` 与 PRD V1.0 评审稿；正式任务编号为 M1-01～M1-04。本地原型仍未提交，远程文档与本地工程尚未整合。四份指定文档的固定版本入口见报告第 1 节。

## 历史 T01 交付入口

本轮已读取用户上传的 R0.1 与 PRD V1.0 **评审稿**，对齐最新 D09–D14；草案中的拟定项仍需确认。沿用现有 `00-product`～`05-review`，与请求中的 product/design/engineering/development/testing/review 一一对应，不再创建平行目录。

1. [engineering-audit.md：工程审查](02-engineering/engineering-audit.md)
2. [architecture-v0.1.md：技术架构](02-engineering/architecture-v0.1.md)
3. [data-model-v0.1.md：最小模型](02-engineering/data-model-v0.1.md)
4. [technical-feasibility.md：流程可行性](02-engineering/technical-feasibility.md)
5. [development-roadmap.md：F/A 对应任务](00-product/development-roadmap.md)
6. [open-questions.md：T01 当前问题](00-product/open-questions.md)

另见 [需求依据](00-product/t01-product-baseline.md) 与 [T01 交付报告](05-review/t01-delivery-report.md)。以下旧文档保留工程事实与历史演变；新方案不表示替换已经运行的代码。

## 阅读顺序

开发前先读 [AGENTS.md](../AGENTS.md)、[PRD](00-product/prd.md)、[当前 Roadmap](00-product/roadmap.md)，再读相关技术资料。产品需求的依据是用户明确指令；草案中的建议、估计和可选方案均不自动成为开发授权。

| 模块           | 文档与用途                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00-product     | [产品背景](00-product/product-brief.md)、[PRD](00-product/prd.md)、[用户故事](00-product/user-stories.md)、[Roadmap](00-product/roadmap.md)、[待确认事项](00-product/open-questions.md) |
| 01-design      | [信息架构](01-design/information-architecture.md)、[用户流程](01-design/user-flows.md)                                                                                                  |
| 02-engineering | [技术架构](02-engineering/architecture.md)、[数据模型](02-engineering/data-model.md)、[API 设计](02-engineering/api-design.md)                                                          |
| 03-development | [开发日志](03-development/development-log.md)、[关键决策](03-development/decisions.md)、[版本变更](03-development/changelog.md)                                                         |
| 04-testing     | [验收标准](04-testing/acceptance.md)、[测试用例](04-testing/test-cases.md)、[Bug 与验证缺口](04-testing/bugs.md)、[本轮核查报告](04-testing/verification-2026-11-05.md)                 |
| 05-review      | [阶段复盘与交付报告](05-review/phase-review.md)、[项目案例草稿](05-review/case-study.md)                                                                                                |

旧的 ARCHITECTURE.md、DATA_MODEL.md、PAGES.md、ROADMAP.md、ACCEPTANCE.md 正文已迁移，原位置只保留跳转指引，避免双份维护。根 README 继续负责本地运行。

## 状态语言

| 标记   | 含义                                                       |
| ------ | ---------------------------------------------------------- |
| 已实现 | 能在代码或文件中指出对应实现；不表示覆盖全部场景           |
| 已测试 | 有执行日期、命令、范围和结果；须指明测试的是哪个实现或文档 |
| 待验证 | 实现、假设或方案缺少相应证据，不能宣称可用或已验收         |
| 计划中 | 尚未实现；包括需求差距及候选迭代，不代表已获开发授权       |
| 待确认 | 缺失的产品细则、重大范围或用户决策；必须保留为问题         |

实现、验证、产品批准分别记录。例如“模型已实现／语法关系已测试／真实数据库待验证／服务端接入计划中”。**测试通过不等于用户验收通过。** 用户验收仅由用户明确反馈确认；当前尚未记录此类结论。

## 单个独立任务的完成条件

1. 记录本轮授权范围，关联 PRD 需求 ID 和 Roadmap 条目；不清楚则列入待确认事项。
2. 核对工作区和已有个人数据；保留用户改动，不对真实数据运行清空/覆盖类测试。
3. 执行适用检查，保留退出码与实际用例数量；未执行、跳过、失败与通过分别记录。
4. 在开发日志追加目标、实际内容、文件、测试、问题、解决方法、遗留及下一步。
5. 同步 Roadmap、相关设计/工程资料和版本变更；重要取舍进入 decisions.md。
6. 总结完成内容、测试结果、风险和下一步，列出需要用户审核的具体方案。

文档统一使用 `# Personal OS｜文档名称`；开头说明用途、状态、更新时间，必要时说明来源。补录历史必须标“补录”并说明依据；没有证据的耗时、日期、反馈和指标标为「待确认」。本地应用尚无 Git 提交；远程已有文档提交，两种基线须分别标注，不虚构应用提交号或发布标签。

## 隐私与记录边界

只记录实现与脱敏摘要。开发日志、测试报告和案例不得包含个人真实日记、情绪原文、工作内部内容、API Key、访问令牌、真实连接串或完整环境转储。测试使用独立上下文及合成数据；导出备份和用户附件不提交仓库。当前 .gitignore 不是全面的秘密扫描机制，提交前仍需检查。
