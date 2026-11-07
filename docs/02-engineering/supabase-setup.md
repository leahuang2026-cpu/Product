# Personal OS｜Supabase 私有数据基础安装

## 当前进度：安装后核验（2026-11-07）

Owner 已报告安装完成，并说明实际登录邮箱与先前不同。已更新忽略文件中的应用邮箱白名单，没有将邮箱写入仓库或日志。远端 Auth settings 200、五表和两个列表 RPC 匿名请求均为 401/42501；原先的 404/PGRST205 已不再出现。以上不等于全部 RLS 与本人访问验收完成。

Owner 已反馈[只读安装检查](verify-private-records-v2.sql)七个字段全为 true，作为用户执行反馈记录，无须重跑安装。此检查读取系统目录、白名单、账号验证状态和 bucket 元数据，不返回个人记录或账户标识。它检查策略集合和权限，但不替代策略正文审查、另一身份访问及真实会话原件测试。

本地登录服务已启动，390 宽度实际页面渲染通过；配置了本地 APP_ORIGIN，未登录读取返回 401，非本人邮箱登录请求返回 403/FORBIDDEN，非法邮箱 400，跨来源 403。没有发出 OTP 邮件，也未获取用户会话。当前没有 SQL 管理或共享浏览器控制工具，无法代替用户执行管理核查或邮箱登录。已在本地忽略配置启用数据开关供本人联验；开关本身不代表已登录或保存成功。

当前等待本人交互登录：服务只监听云环境回环地址，不能把该地址当作用户自己电脑可访问的网站。共享桌面能力已启用但运行状态 unknown；当前未提供 `cua_repl.js` 或 `open_in_codex`，无法代用户打开/控制登录浏览器。环境标识为 `ccarenv_b64_Y2NhcmVudl81YjRiYTQxNTliYjA4MTkxYmMwYTZkNmEzOWU1ZjgwNg`。用户已明确没有 Desktop 入口；不再要求其寻找该入口。改为准备[预览访问方案](preview-access-plan.md)，外部推送/部署获准前不创建公网隧道或擅自上线。

下方保留安装前步骤和故障处理历史；历史生成的安装包包含当时的配置，不作为当前登录邮箱依据。

用途：执行 Owner 于 2026-11-07 明确批准的数据与私有权限方案。状态：已获批准；本环境没有 SQL 管理连接，尚未在云端执行。此页不是生产部署说明。

## 当前已核实

- 发布后的环境域名规则已生效；实际只读 `/auth/v1/settings` 返回 200，邮箱 provider 启用。
- 对 `personal_os_owners` 的零行 REST 查询返回 404 / PGRST205：Data API schema cache 中未找到该表，不能据此断言整个数据库为空。
- 当前只有发布用客户端密钥及本人邮箱配置，没有管理 Token、数据库管理连接或可用 Supabase 管理工具。客户端密钥不具有创建表/策略的权限。
- 不要求在聊天提供密码或管理密钥。使用项目自带 SQL Editor 完成一次执行即可。

## 安装文件

版本来源：[已批准 SQL](proposals/private-records-v2.sql)。在项目目录运行：

```bash
npx --no-install tsx scripts/prepare-supabase.ts
```

这只生成 `.supabase-setup/install-private-records-v2.sql`，不连接数据库。生成器从安全配置读取本人邮箱，将其匹配到已验证 Auth 用户并在同一事务初始化白名单，因此不需要手工抄 UID。生成文件包含本人邮箱但不包含 API Key，以 0600 权限保存并被 Git 忽略；不能提交或粘贴到开发日志。已有文件不会被覆盖。

1. 在现有 Supabase 项目打开 **SQL Editor → New query**。
2. 粘贴生成文件的完整内容，确认是本人已创建的项目，执行一次。不要只执行选中片段。
3. 成功应返回 `personal_os_v2_installed`。只需反馈该状态；失败反馈错误文字，不发送密钥或整份含邮箱脚本。

若提示 `Expected exactly one verified existing Auth user`，请检查 Authentication → Users 的本人账号及邮箱验证状态；脚本没有创建或修改 Auth 用户。若提示已有 Personal OS 对象或 Storage 策略，停止重跑并交给工程核查，不删除现有对象来绕过保护。任何安装错误使本次事务不能提交；如编辑器保留失败事务，先执行 `ROLLBACK;` 再核查。

## 执行内容与保护

- 独立五表：本人白名单、原始记录、附件、条目、幂等请求；保留旧表、原件和旧灵感，不执行迁移。
- 新表显式撤销 PUBLIC/anon/authenticated 的默认宽授权，再按需要授予本人会话 SELECT/INSERT/UPDATE。白名单仅 SELECT；无 DELETE/TRUNCATE。RLS 限定 auth.uid() 与白名单。
- 原件和附件不可变触发器、版本检查、请求去重；RPC 限制调用角色。
- 私有 `personal-os-private` bucket；本人文件夹的读取/新增策略，不添加更新/删除策略。
- 在任何变更前检查同名前缀对象、bucket 及既有 Storage 策略。存在时停止，避免重复安装或叠加宽权限。
- Owner 邮箱必须精确匹配一个已验证账户；白名单初始化与建表在同一事务。安装后通知 PostgREST 刷新 schema cache。

## 后续验收（尚未执行）

安装成功后先核查表、白名单、RLS/RPC 和 bucket 配置，再验证匿名/另一身份不可访问（A10）。邮件回调需允许实际应用 `/auth/callback`，本人真实登录后用合成材料完成文字、图片、失败恢复与跨设备测试（A01/A02/A03/A10/A11）。云备份和恢复另行验证。

`PERSONAL_OS_DATA_CONTRACT` 暂不启用；不能把安装成功或配置开关当作权限已验收。真实产品不需要服务角色密钥处理普通 CRUD。没有发布环境、部署网站、自动发送邮件或修改目标。

## SQL Editor 报 42601：复制或选区截断

2026-11-07 用户反馈 `unterminated dollar-quoted string`，提交片段含 `&#x20;`、行尾反斜杠，且在 `personal_os_get_record` 内中止，缺失闭合 dollar quote 与后续 SQL。原始生成文件为 172 行，不含上述转义，独立数据库可执行；尚不能区分是哪一层复制转换或仅执行选区导致。

本次提供 `.supabase-setup/personal-os-private-setup.zip`（原始 SQL 与英文说明）和 `.supabase-setup/install-private-records-v2.copy.md`（完整 SQL fenced code block）。均为 Git 忽略的私有交付文件，不公开提交；ZIP 解包后与原始 SQL 逐字节一致。

恢复步骤：在原查询会话单独执行 `ROLLBACK;`（若提示没有事务，无需处理），然后新建空白查询。解压 ZIP，用纯文本编辑器打开 SQL，全选复制；不要从富文本预览复制，也不要只选中部分语句执行。若使用 fenced 版本，使用代码块复制按钮且不要包含 Markdown 围栏。完整文件最后一句必须是：

```sql
select 'personal_os_v2_installed' as status;
```

完整脚本的已有对象保护仍生效；若停止并提示已有对象，反馈错误后核查，不删表或改成无条件覆盖。最新匿名零行检查五表均为 404/PGRST205，只证明 API cache 中不可见，不构成完整数据库回滚证明。云端安装与权限验收仍待执行。

下载不可用时：直接使用聊天中的完整 SQL 代码块复制按钮；将唯一 `YOUR_LOGIN_EMAIL` 占位符换为本人已验证邮箱的小写形式，保留单引号。粘贴到新建查询，确认最后一句成功标识后运行全文。内容与已验证安装文件一致，仅隐藏本人邮箱；不需要重新批准。
