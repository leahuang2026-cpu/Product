# Personal OS｜API 设计草案

最新增量：Owner 已批准回收站，records/entries 增加 deleted_at 与 /api/trash 移入/恢复接口；不删除原文附件。数据、权限和兼容细节见[回收站说明](recycle-bin.md)，远端安装尚未确认。

当前依据已更新为 UX Sprint 01 确认规则及[实施交付](../05-review/ux-sprint-01-implementation.md)。五模块、多领域、标记灵感、统一采集优先于下文历史方案；真实云端仍待网络与数据契约启用。

> 用途：记录现有调用边界，以及后续服务端接口的候选契约。
> 状态：UX 阶段已实现 `src/app/api/`；真实数据库安装与联验待完成。下方 M1-01.1 接口描述保留历史，最新执行边界见[安装说明](supabase-setup.md)。
> 更新：2026-11-06（Asia/Shanghai）。

## 历史：初始原型接口事实

`src/app` 只有页面和布局，没有业务 `route.ts` 或 Server Actions。页面通过 `useStore()` 和领域函数读写 localStorage；Prisma 未接入运行。不要把页面 URL 或下面的示意路径当作现存 API。

| 当前本地接口                | 行为                                                    | 证据                           |
| --------------------------- | ------------------------------------------------------- | ------------------------------ |
| `useStore().update(fn)`     | 读取最新状态，校验后写入；普通更新在损坏存储时被阻止    | `src/components/store.tsx`     |
| `useStore().replace(state)` | 导入/清空等明确确认后的全量替换；存储失败返回 false     | 同上；仅本地能力               |
| `parseImport / exportState` | 版本化 JSON 的 Zod 校验与序列化                         | `src/lib/domain.ts`            |
| `decideSuggestion`          | 显式确认及 pending 状态检查；接受后改目标标题并记录决定 | 同上；无服务端授权或数据库事务 |

## M1-01.1 当前接口契约

日期：2026-11-06。状态：工程设计已交付，接口尚未实现。基于 Owner 已确认的首批范围；下面的 F01–F03 契约优先于后面的历史候选表。

采用 Next.js REST Route Handlers，便于浏览器、权限集成和重试测试使用同一契约；不同时维护相同业务的 Server Actions。客户端通过异步 repository 调用；生产仓储使用本人会话和 Supabase，设计样例不得默认接入真实数据。现有同步 localStorage Store 不直接承担云端成功状态。

### 数据形状与校验

```ts
type Domain = "职业" | "财富" | "能力" | "自我" | "生活";
type RecordDTO = {
  id: string; // UUID
  kind: "text" | "image";
  originalText: string | null; // 原文，只读
  originalNote: string | null; // 图片首次说明，只读
  note: string; // 当前可编辑说明
  domain: Domain | null;
  createdAt: string; // 服务端 UTC ISO 时间
  updatedAt: string;
  version: number; // 从 1 开始的乐观锁
  attachment: null | {
    id: string;
    mime: "image/jpeg" | "image/png";
    bytes: number;
    contentPath: string; // 同源、要求本人会话；不是公开或签名下载地址
  };
};
```

创建文字请求 `{kind:"text", originalText}`；创建图片请求 `{kind:"image", uploadId, originalNote}`。图片允许空说明，文字必须 trim 后非空，实际保存未经 trim 的输入。创建请求不接受分类、ownerId、AI 字段或客户端时间；首次 domain=null，图片 note 初始化为 originalNote，文字 note 初始空字符串。未知字段拒绝，不静默吸收。

工程沿用原型文字上限 10,000 个 UTF-16 code units，说明同上；空说明可用空字符串，图片无 originalText。超限前后端均明确提示。图片为单张 JPEG/PNG 且 0 < bytes ≤ 10,000,000，验证真实文件签名和可解码性，不能信任客户端 MIME。图片校验应放在有资源限制的解码环境；像素/解码资源阈值在上传实现时基于测试确定，纳入工程校验而不擅自改变已批准的字节上限。元数据补充限制不代表已通过手机大图实测。

### 端点

| 方法 / 路径                        | 请求                                         | 成功响应                                                 | 权限和错误                                                                                    |
| ---------------------------------- | -------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| POST `/api/uploads`                | MIME、bytes；`Idempotency-Key`               | 201：uploadId、受限签名上传凭证、expiresAt、状态 pending | 从会话取得 owner；每次仅一个文件；415 格式不支持，413 超限                                    |
| 存储上传                           | 向凭证限定的对象路径 PUT 原图                | 存储确认；仍未代表记录保存成功                           | 私有 bucket、禁止覆盖已有对象；凭证不写日志/持久化到记录                                      |
| POST `/api/uploads/:id/complete`   | 空对象，可重试                               | 200：uploadId、状态 ready、mime、bytes、sha256           | 验证所有权、实际字节与可解码性；尚无对象 409；校验失败 422；已 ready 返回同一结果             |
| POST `/api/records`                | 上述文字/图片创建体；`Idempotency-Key`       | 首次 201/重放 200：`{data:RecordDTO}`                    | 原文与唯一请求键事务写入；图片必须为本人 ready 且未绑定的 uploadId，原子绑定；无效/未就绪 409 |
| GET `/api/records`                 | q、domain、limit、cursor                     | 200：`{data:RecordDTO[],nextCursor:string                | null}`                                                                                        | 每次授权过滤；列表附件可仅取元信息，不内嵌原图 |
| GET `/api/records/:id`             | 无                                           | 200：`{data:RecordDTO}`                                  | 不存在或非本人统一 404                                                                        |
| PATCH `/api/records/:id/metadata`  | `{version,note?,domain?}`；`Idempotency-Key` | 200：更新后的 RecordDTO                                  | 必须至少一个元数据字段；原件字段拒绝；version 旧值 409；成功 version+1                        |
| GET `/api/attachments/:id/content` | 本人会话                                     | 200：原图字节、正确 MIME，私有 `no-store`                | 401 无会话，404 不存在/非本人；不重定向到可转发的签名读 URL                                   |

列表 domain 缺省=全部，`unclassified`=null，其余为五领域之一；q 去除查询首尾空格后按字面包含匹配文字 originalText 或图片当前 note，AND 领域过滤；空 q=无关键词。参数化查询并转义 SQL 模式字符；不使用拼接 SQL。limit 默认 20、范围 1–50；游标为不透明的 createdAt/id 排序位置，校验合法性，变更过滤时重置。查询和分页始终带用户归属；游标本身不授予访问权限。

签名上传凭证续期端点：`POST /api/uploads/:id/credentials`，仅本人且 pending 状态可调用；返回同一 uploadId/对象路径的新凭证与 expiresAt。已 ready/绑定返回 409；未授权按上表拒绝。该操作不创建新附件，凭证续期不改变业务上传请求的幂等身份。

### 幂等、附件一致性和重试

- 每次新建/元数据编辑操作生成 UUID 请求键，按 owner + 操作 + key 唯一；服务器存请求指纹及结果。相同键/相同体返回此前结果，相同键/不同体返回 409 `IDEMPOTENCY_MISMATCH`。客户端防连点只是体验，数据库唯一约束才保证不重复。
- 创建记录的幂等结果至少随记录生命周期保留，首批不设置自动过期；元数据更新在同一事务登记结果。重放命中需先于 version 检查，避免响应丢失后正确重试被误判冲突。
- 上传凭证过期可为同一 pending uploadId 重新签发，复用对象路径；已 ready/已绑定附件拒绝签发可写凭证。上传后存在同名对象时先 complete 验证，不开启 upsert。完成验证需保证后续原件不可被旧凭证覆盖；对同路径写入拒绝 UPDATE，同时测试凭证重复使用。
- 创建图片记录必须在一个数据库事务内确认附件 ready、owner 一致、尚未绑定并绑定记录；同一 uploadId 不得被并发请求绑定两次。校验失败对象不对普通列表暴露。
- 对象存储与数据库没有跨服务事务；上传已完成但 record 提交失败时保留上传状态并重试绑定。禁止用删除真实对象补偿请求失败；未绑定对象的保留/清理期限待数据保留规则评审。
- 断网/超时返回结果未知，客户端同键查询/重试恢复原结果。失败输入若被修改，使用前一键与前一请求体核对结果后，用户明确决定另存，禁止相同键写入新内容。

### 统一错误及权限

JSON 错误形状：`{error:{code,message,retryable,requestId,fieldErrors?}}`。错误日志只有请求标识、错误码、耗时等诊断元信息，不包含原文、文件、授权头或上传凭证。

400 输入或参数错误；401 会话过期；403 本应用未授权账户；404 无此可访问对象；409 版本、绑定或幂等冲突；413 超限；415 格式不支持；422 文件校验失败；429 限流（含 Retry-After）；5xx 服务异常。网络超时由客户端转换为“结果尚未确认”，不能伪造服务端失败响应。非可重试校验错误不自动重试；重试等待遵循限流响应并有上限。

所有端点强制本人会话、服务端允许账户规则与 RLS，附件关联也验证归属。Cookie 写请求检查 Origin/CSRF；不允许跨域公开写入。普通 CRUD 使用用户 JWT，服务密钥不得出现在浏览器；具体策略与账号方式在 M1-02.1 实施。此处定义接口行为，不代表 Supabase 项目已配置安全。

### 映射与后续实施

A01→POST/GET records；A02→uploads/complete + records + content；A03→校验、幂等、异常恢复；A04→metadata 更新及读回；A05→上述路径无 AI 依赖；A06→列表查询与补说明。A10/A11 由 M1-02 补充权限和跨设备测试。具体样例见 [验收设计](../04-testing/m1-01-1-acceptance.md)。本轮没有创建 route.ts、迁移、云资源或执行这些请求。

## 历史候选设计（保留，不作为首批授权）

### 候选 HTTP 边界

REST 仅为建议；也可以采用 Server Actions，待认证和仓储方案明确后记录最终选择。以下不是已冻结接口，当前本地 v1 数据不能直接发送为服务端持久化对象。

| 操作 / 候选路径                                      | 请求意图                                         | 关键约束                                                              |
| ---------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `POST /api/records`                                  | 主动新增原文、输入类型、领域、手动标签及处理意图 | ownerId 由 session 推导；原文只追加；意图结构待 Q-03                  |
| `GET /api/records` / `GET /api/records/:id`          | 搜索、领域筛选、详情                             | 每次鉴权；分页游标格式待设计；不得跨用户读取                          |
| `POST /api/records/:id/processing`                   | 用户主动请求 AI 整理/解答                        | 先明确发送范围；返回任务与独立结果，不改原文；AI 提供商待确认         |
| `GET/POST /api/goals`、`/api/projects`               | 管理目标与项目                                   | 关联所有权与输入校验；完整编辑/删除契约另行确认                       |
| `POST /api/goals/:id/proposals/:proposalId/decision` | 接受或拒绝目标提案                               | 明确 decision、预期目标 version；事务内校验 pending、所有权、版本冲突 |
| `/api/focus`（路径暂定）                             | 用户选择当前阶段重点及关联                       | 对象与基数尚待 Q-01/02，当前不定义不可逆字段                          |
| `POST /api/ideas/:id/transitions`                    | 状态演变并追加历史                               | 用户操作来源、前后状态、时间；合法状态机待 Q-04                       |
| `POST /api/ideas/:id/project`                        | 主动转项目                                       | 保留原灵感；关联两对象，幂等行为待设计                                |
| `POST /api/reflections`                              | 手写复盘及真实记录引用                           | 明确时间区间和时区，所有引用属于本人，引用结构待 Q-05                 |
| `GET /api/export`                                    | 用户导出自己的全部数据                           | 附件与结构版本一起导出；格式/异步任务方式待设计                       |

记录删除与公开发布没有当前 API，也不在本轮实施。未来设计必须带明确确认、授权、生命周期和审计方案，不能仅靠前端按钮判断权限。

## 错误、事务与隐私建议

- 建议区分 400 输入错误、401 无会话、403 无权限、404 不可访问对象、409 版本/状态冲突、413 附件过大、429 请求频率；统一响应结构与状态策略待服务端实施确认。
- 目标决策、灵感转项目等多对象操作使用事务；重试不会重复生成对象。当前仅 schema 中有目标版本字段，不能写成事务已实现。
- 私有媒体通过授权上传/下载；不把原文、附件、密钥和令牌写入服务端日志。
- cookie 会话的 CSRF 防护、跨域策略、文件内容验证、配额与速率限制在实现时一起设计及测试。
- 以真实数据库集成测试和跨用户拒绝测试作为后端就绪证据；本地 E2E 不覆盖这些契约。
