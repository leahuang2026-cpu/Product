# Personal OS｜回收站增量实现与安装

用途：记录 Owner 已批准的软删除语义、接口、兼容边界及一次性数据库更新。
日期：2026-11-08（Asia/Shanghai）。状态：本地已实现并通过隔离验证；14 项单元、21 项隔离契约、完整 64 项浏览器和最终定向 12 项回收站验证通过（均为本地/合成测试），细节见开发日志；Owner 已确认真实 Supabase 增量安装、六项检查全 true 及 Render b1847ad Live；Owner 已确认记录/Garden、方向引用保护及复盘三项指定移入/恢复流程均可行；完整失败/边界路径尚未做用户云端验收。

## 已批准范围

- 过去：移入后 Archive 和 Idea Garden 隐藏同一条记录，原文、附件、领域及灵感标记保留；恢复后重新出现。
- 未来：所有仍保留 Focus 关联的方向禁止移入，包括已移出当前关注但未解除关联的条目。方向卡提供“编辑关联关注”，由用户在原表单手动解除；不自动改 Focus。
- 复盘：仅移除该复盘，周期、手写正文和来源保留，原始材料不受影响。
- 设置 → 回收站：查看摘要、移除时间和恢复。不自动清理，不提供永久删除。Focus 原有“移出当前关注”保持独立语义，不加入本轮回收站。
- 引用已移除原件：普通详情显示中性提示，引用 ID 保留；恢复后来源重新可访问。不复制正文、不级联删除。

## 数据模型与权限

现有 personal_os_records / personal_os_entries 增加可空 deleted_at，NULL 表示正常；移入/恢复更新该时间和 version，不修改正文、附件、sourceIds 或 relationId。不增加 DELETE/TRUNCATE 权限，不改变私有 Storage 策略、Owner 绑定或既有原件保护触发器。

普通列表 RPC 排除 deleted_at 非空内容；记录详情 RPC 对已移除项仅返回 id/deletedAt，HTTP 层返回 410 和恢复提示，不返回原文。附件 HTTP 入口先检查所属记录，移除后不提供新下载。私人 Storage 仍由本人 RLS 控制；回收站是可恢复状态，不是密码学擦除或撤销本人已下载副本，也不撤销本人对底层私有存储的既有权限。

新增数据库触发器阻止编辑未恢复条目、阻止删除有 Focus 关联的方向、阻止新 Focus 指向已移除方向；同一 Owner 的 entry 保存/移除操作使用事务级 advisory lock，关联检查和修改在数据库内执行。直接更新仍受触发器和 RLS 约束；并发压力尚未在真实 PostgreSQL 联验，冲突时需刷新重试。

## API

- GET /api/trash：本人回收站摘要 `{id,kind,title,deletedAt,version}`；不受跨模块领域筛选限制。
- POST /api/trash：`{id,kind:record|direction|reflection,version,deleted:boolean}`，必须带 UUID Idempotency-Key、同源校验和本人会话。true 移入，false 恢复；每次状态变化推进版本，旧版本 409，重试复用同请求 key。方向有关联时 409/DIRECTION_LINKED。
- 其他内容 API 沿用 reviewed-v2；不更换当前数据开关。数据库未安装时 /api/trash 返回 TRASH_NOT_READY，界面保留条目并明确失败，不伪造移入成功。
- 已移除内容的普通详情/附件返回 410；无权用户仍先 401/403。老版本页面可能持有旧副本，应刷新；不会为兼容旧表单解除原文保护。

## 在现有 Supabase 安装（仅执行增量文件）

1. 打开现有 Supabase 项目 SQL Editor，新建查询。
2. 打开 [recycle-bin-v1.sql](proposals/recycle-bin-v1.sql)，复制完整纯文本，从 begin 前的注释到最后 SELECT。GitHub 文件页可点 Raw 后全选复制；不要从富文本复制，也不要重复执行 private-records-v2.sql。
3. 执行。成功结果为 `personal_os_recycle_bin_v1_installed`。整个更改在事务内完成，不更新现有个人内容，既有行默认正常状态。
4. 执行 [只读检查](verify-recycle-bin-v1.sql)，六项应为 true。
5. 确认 Render 部署了本轮提交，刷新页面；用虚构记录验证后再处理个人内容。

脚本核对基础 RPC 源码指纹（忽略空白）、原件触发器和 RLS；若存在同名列、不同实现或缺失基础则停止，不覆盖未知对象。不要盲目重跑：失败后先执行 ROLLBACK，再提供去除私密信息的错误；成功后只跑只读检查。脚本没有用户邮箱、UID 或密钥，不需要重新绑定 Auth 用户。

Owner 已反馈安装成功及六项检查全 true。代理当前没有数据库管理连接，没有独立执行或核验远端 SQL。安装是技术前置，Owner 已批准该方案，无需重复范围批准。应用可先部署，但安装前移入/恢复会显示未接通；成功操作不得仅凭按钮出现判断。

## 验收编号

- TRASH-01：已有合成数据升级后保持正文/附件/关联，Owner/匿名隔离，原件不可覆盖，无 DELETE/TRUNCATE；重复安装停止。
- TRASH-02：Archive/Garden 统一隐藏与恢复、原件访问、保留领域/标记、已有引用中性提示。
- TRASH-03：有 Focus 关联的方向被拒绝，手动解除后可移入；恢复不重新建立用户已经解除的关联。
- TRASH-04：周/月复盘移入/恢复保留周期和材料，原记录不变。
- TRASH-05：取消不发送请求；保存失败不隐藏；响应丢失后同 key 重试不重复改变版本；未装 SQL 显示真实错误。
- TRASH-06：1440/390/320/768 宽度操作，键盘/原生确认、恢复反馈；真实云端和手机实测由 Owner 单独确认。

本轮不包含完整导出/备份、永久清空、自动保留期、批量迁移、原件正文编辑或公开功能。
