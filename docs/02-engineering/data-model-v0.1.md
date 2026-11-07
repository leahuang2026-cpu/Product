# Personal OS｜最小数据模型草案 V0.1（T01）

> 用途：提出云端最小关系模型，说明对象边界、原始记录保护和数据所有权。
> 状态：候选模型，未修改既有 Prisma schema、未创建 SQL 迁移、未操作数据库。
> 更新：2026-11-06（Asia/Shanghai）。
> 依据：[T01 基线](../00-product/t01-product-baseline.md)；现有 13 模型见 [当前数据模型](data-model.md)。

## 建模原则

模型按功能启用逐步落地，不一次创建所有未来表。首个云端纵向切片需要认证主体、Record，随后加 Attachment；RecordRevision 仅在完整编辑与保留策略获批后启用；Focus、项目、灵感和复盘在对应需求明确后添加。供应商账号系统是身份来源，不另建密码表或多租户组织系统。

输入媒介、分类、处理意图是三个不同概念：媒介可为 text/image，保留未来 audio/link；分类维度尚未确定；处理意图不能暗示 AI 执行权限。当前代码的必填单领域 enum 不能作为云端正式需求的定案。

## 对象选择与替代方案

| 对象             | 推荐形态                                        | 原因与最小字段                                                                                               | 不采用/待确认                                                                           |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 身份             | 直接引用 Auth 用户主键                          | 业务 `owner_id` 对齐认证 UUID；只有确需偏好时才加 profile                                                    | 不重复保存密码/凭据；单人也要所有权                                                     |
| Record           | 独立表 `records`                                | `id, owner_id, kind, original_text?, source_url?, current_revision_id?, version, created_at`；原始字段只追加 | 不做包含所有对象的万能 JSON 表；标题可由当前内容派生，不冒充原文                        |
| RecordRevision   | 独立表候选，D15/F03 编辑获批后启用              | `id, owner_id, record_id, edited_text, created_at, base_version`；保存用户编辑版本，不覆盖 original_text     | 当前版本指针原子更新；编辑语义待 Owner 确认；AI 结果不能直接成为用户编辑                |
| Attachment       | 独立表 `attachments`                            | `id, owner_id, record_id, object_key, original_name, mime_type, byte_size, checksum, status, created_at`     | 原件不可被缩略图覆盖；多附件上限待确认；音频元数据按需添加                              |
| Idea             | 首批若批准 F04，优先记录上的灵感标记/可过滤属性 | 与 PRD F04 拟定一致，不复制同一份内容；无任务或项目义务                                                      | 现有独立 Idea 保留；仅独立生命周期/历史获批后才引入独立表或侧表，不擅自迁移             |
| Goal / Direction | 暂用同一 `goals` 表，UI 叫方向                  | `id, owner_id, title, rationale?, created_at, version`                                                       | 是否需要方向下多个可量化目标尚不明确，不能擅自建两层实体                                |
| Project          | 独立表                                          | `id, owner_id, title, description?, goal_id?, created_at`                                                    | 项目不等于当前重点；多目标关系仅在确认后加连接表                                        |
| Focus            | 建议独立表                                      | `id, owner_id, title, goal_id?, project_id?, next_action_text, version, created_at`；用户主动设置            | 单纯查询“最近项目”不能表达个人选择；同时关联、必须关联与否、当前选择/排序待确认，见下文 |
| Review           | 独立表，保留 Reflection 的产品兼容称呼          | `id, owner_id, cadence, period_start, period_end, body, created_at`                                          | 不同时建 Review 和 Reflection 两套数据；周期与自由文本/三问映射待确认                   |

字段为候选名，不是已冻结 API。每个领域表的 `updated_at` 可由服务端维护；创建时间由服务端生成，导入原始时间应保留并标来源，不静默重写。

## 分类、搜索和关联如何最小化

- 分类先允许“未分类”，原文保存不依赖分类完成。具体维度确定前不实现通用分类引擎；若批准自由标签，可从用户内标签数组或 Tag/RecordTag 开始，选择取决于重命名/筛选需求。五领域可作为经确认后的一个维度，不默认等同全部分类。
- 手工记录关联建议 `record_links(owner_id, source_record_id, target_record_id, relation_type?)`；复合外键保证两端同一用户，唯一约束防重复，禁止自关联是否需要由产品定义。
- 初期搜索当前可见文本和经确认的分类，保留原文入口。中文先评估受控 substring/ILIKE；参数化查询、分页及候选 pg_trgm 索引。PostgreSQL 默认英文分词不能直接保证中文检索体验，须用合成中文样例检验，再决定扩展。
- 首页 Focus 是用户选择的实体及关联查询视图，不另存一张复制项目/目标全文的首页表。下一行动先用单条文本候选，保留已有 Action 模型作为历史；若要求绑定任务，再用 `action_id` 替代复制。二选一需产品确认，避免两份行动不同步。
- Focus 关联可用显式 nullable FK，避免 `target_type + target_id` 丢失数据库外键。若确认“方向或项目只能选一个”，加 XOR CHECK；未确认前不执行该约束。经项目间接关联方向时，首页标明来源，不能自动改项目的目标。
- Review 需要引用时加 `review_sources(review_id, record_id, revision_id?, owner_id)`，不提前建设知识图谱。来源无权限、删除或版本变化应显式呈现，不补造事实。

## AI 派生结果（后续才启用）

建议在用户选择保存时建立独立 `derived_results`，包含结果类型、内容、模型/提示版本、创建时间；`derived_result_sources` 引用明确选择的记录版本和附件 ID。输入清单需是用户确认时的快照，后续记录编辑或新增附件不能扩大一次处理的范围。

推理期间返回未保存的预览，用户不保存则不写入业务结果表。服务商的日志/留存并不因“不保存”自动消失，实施前需另行确认政策。若未来必须异步执行，可增短期 job 并规定清理，当前不预建长期通用任务系统。AI 不能直接更新 Goal、Focus、RecordRevision 或扩大输入集合。

## 权限、事务与约束

- UUID 身份为用户归属；每个业务对象 `owner_id NOT NULL`。读写应用校验 + RLS 双重控制，匿名没有业务权限。
- 父表建立 `(id, owner_id)` 唯一键；子表 FK 同时包含父对象 ID 和 owner，拒绝跨用户关联。
- 原文保护不能只靠界面禁用：数据库权限/受控函数或触发器限制 original 字段更新；追加 revision 与更新 version/当前指针在同一事务，旧版本冲突返回明确结果。
- Attachment `pending → ready/failed` 为技术状态；对象存储与数据库不是原子事务，需可重试完成确认及有时间界限的孤儿清理。pending 记录不应被显示为已完成上传。
- 类型和最大长度、大小、安全 MIME、文件头、分页、超时均在服务端验证；具体容量是待确认的产品/费用选项，不沿用原型 1 MB 作为正式规则。
- 软删、硬删、归档和保留期未确认；本轮不默认增加自动删除逻辑，也不把云 DB 级联删除等同已获用户确认。

## 保留旧数据与导出/备份

当前浏览器 v1 用中文领域、嵌套 Action、单附件 Base64、单 AI 结果及字符串复盘周期。云端 Auth UUID、附件对象键、历史版本和真实日期区间均不同，不能把旧 JSON 直接当数据库 insert。

将来迁移：用户主动导出备份 → dry-run 映射及计数 → 不支持/歧义字段明示 → 确认目标账号 → 按幂等映射导入 → 下载校验 → 用户选择是否保留原副本。复盘范围不能从缺少年份的显示字符串猜出；未确定分类保留源字段而不硬映射。禁止自动迁入示例数据或自动清空原浏览器。

用户导出建议包含 schemaVersion、UTC 时间/用户时区、全部本人记录与编辑版本、关联、已保存 AI 结果/引用，以及原附件文件和哈希清单；排除密码、会话 token 和内部密钥。备份需分别覆盖 DB 与 Storage 原件，并在隔离环境恢复核对。频率、保留期、RPO/RTO 与费用待 Owner 确认；同步不是备份。

## 与现有模型的处置

复用 Record/Attachment/Goal/Project/Idea/Reflection 概念、关联约束与导出校验经验；改进认证归属、文本编辑历史、独立 Focus 和原件上传状态。原 13 模型不是本草案已落地的证据，不删除旧 schema，不直接生成生产迁移。正式 PRD 和关系规则通过后再选择最小启用集。

## PRD 对照与实施约束

F01/F02/F03/F07 对应 Record、Attachment 与认证主体的首批候选；F05/F06 对应独立 Focus 或引用集合、现有 Goal/Project；F04 灵感标记为 P1 候选，Review/AI 属于 F08 增强候选。原文编辑与全版本保留（F03/D15）尚待产品确认，不能以数据库已经能做为由默认加入首批。分类维度、五领域单选及未分类仍按 PRD 标注为拟定，不先冻结 enum。
