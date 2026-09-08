## 1. 建立隔离实施工作区与验证基线

- [x] 1.1 基于已验收提交 `14c76483bcf7a7bdab9d4b59fb93e1ddad8b4bb0`，在 `E:\workspace\projects\aio-hub\.worktrees\aiohub-plugin-dsh-host-capability-foundation` 创建 `aiohub-plugin-dsh-workspace` Git worktree；核验两个仓库仍有独立根目录与历史，并记录准确分支和基线提交
- [x] 1.2 阅读链接 worktree 中的插件仓规范、manifest、package scripts 与 runtime-core 直接调用链，记录 AIO、插件与 DSH 的最小修改边界，并核验生产路径不依赖本机 DSH 源码检出目录
- [x] 1.3 通过 runtime lock/获取流程准备不可变的 `v0.1.2-rc.1` 官方 wheel 实现输入，并记录 `v0.1.3-alpha.2` 官方 tag/commit 源码兼容性 fixture 及 wheel acquisition-pending 状态；核验可用产物的来源、hash、license、SBOM 与平台 provenance，且通用组件中不引入发行版硬编码
- [x] 1.4 为 Host Gate 缺失的 R1–R7、R11–R20、R8 真实数据条件和 R18 显式 fail-closed 条件补充聚焦失败测试，并核验基线确实因已记录的缺失行为失败

## 2. 深化协议与 RuntimeFacade 契约

- [x] 2.1 在协议单一事实源中定义版本化、可辨识的 command、reply、event、snapshot 与 error schema，重新生成 JSON Schema 和 TypeScript declarations，并核验生成物无人工漂移
- [x] 2.2 为初始化加入 contract、Adapter、平台、runtime provenance 与 schema 协商字段；通过矩阵测试核验两个固定发行版 fixture 被接受，未知或不完整 schema 被拒绝
- [x] 2.3 实现带稳定 ID 和结构化原因的操作级 capability availability；核验未支持 mutation 在调用 Adapter 前 fail closed，同时允许有权威事实保证的只读降级
- [x] 2.4 加入请求身份和 mutation exactly-once 结果追踪；核验重复、过期 generation 与过期 lease 请求均不能二次执行
- [x] 2.5 扩展不依赖 Vue/Pinia 的 RuntimeFacade 类型与客户端行为，并核验 TypeScript 契约测试及既有生命周期 API 兼容套件通过

## 3. 实现基于官方能力的发行版隔离 Adapter

- [x] 3.1 定义覆盖 lifecycle、workspace、session、history、snapshot、interaction、artifact、terminal、preset 和动态 Host 操作的内部 DSH Adapter seam，并核验通用 Host 模块没有发行版分支或 DSH 私有导入
- [x] 3.2 使用官方 Session Controller、Typert Remote、SessionPersistence、Cordis 及相关公共服务实现 `v0.1.2-rc.1` Adapter，并核验其真实 runtime 聚焦契约套件通过
- [x] 3.3 针对 persistence/wire、persona 前后缀、队列/子代理状态、PTC 输出和普通 subprocess handle 无 pid 等差异实现 `v0.1.3-alpha.2` 兼容 Adapter，并通过同一稳定契约套件和官方源码 fixture 核验；因无官方 wheel，Windows SDK 启动/进程清理记为待补验证且不阻断当前实现
- [x] 3.4 按协商证据而非语义版本猜测选择 Adapter，并核验不完整或未知发行版进入结构化 `incompatible` 或权威只读状态
- [x] 3.5 增加 import/storage guard，禁止 DSH 私有 registry、复制 Web BFF 及解析或修改 JSONL，并核验生产 bundle 与源码审计通过

## 4. 用长期驻留 Managed Host 替换 loopback 执行

- [x] 4.1 为每个 Supervisor execution domain 启动一个可承载多个 workspace/session 的长期 DSH Host；核验 readiness 等待 Cordis settlement，且全部后代进程受 Windows Job Object 清理
- [x] 4.2 创建并保护隔离的 Managed DSH Home/Profile；核验权限、凭据原子处理和清理流程均不触碰用户默认 DSH Home
- [x] 4.3 扩展 upgrading、recovering、maintenance 与 incompatible 生命周期状态；通过聚焦状态机测试核验合法转换、mutation fencing 和脱敏诊断
- [x] 4.4 实现官方 DSH flush/dispose 与崩溃恢复；核验活动 Turn/handle 变为 interrupted、持久事实被重建，且 Prompt 或副作用绝不重放

## 5. 交付权威 Workspace 与 Session 控制面

- [x] 5.1 实现显式 workspace 注册、稳定 Host ID、列表/打开/移除投影与安全路径处理，并核验默认移除操作保留 workspace 文件、Git 状态和 DSH session
- [x] 5.2 实现 capability-gated 的 session 创建、列表、打开、恢复、重命名、归档、恢复归档、删除和分叉；核验已支持操作保持 DSH identity/lineage，未支持操作 fail closed
- [x] 5.3 实现可取消且受 generation 约束的全局搜索与分页历史；核验被替代搜索和过期分页结果不能改变当前投影
- [x] 5.4 通过官方语义实现跨客户端 controller/observer lease 获取、转移与释放；核验聚焦不会夺取控制权，过期写入不会触达 DSH
- [x] 5.5 将 submit、queue、队列项编辑/移除、steer、cancel 与 restart 实现为独立广告的操作；核验取消到达权威终态，restart 是新的显式操作

## 6. 交付真实 Snapshot、事件恢复与有界 Summary

- [x] 6.1 用 DSH 派生的 durable facts、cursor、sequence、执行状态和活动 interaction 替换占位 snapshot，并核验 R8 测试拒绝 `cursor-0` 或合成空快照
- [x] 6.2 规范化带全部可用 workspace/session/Turn/step/tool/job/subagent identity 的有序事件 envelope，并核验两个 Adapter 的确定性去重和排序
- [x] 6.3 实现有界 ingress/egress queue、可丢弃 delta 合并与 overload 诊断，并通过慢消费者压力测试核验 durable start、终态和 interaction 不丢失
- [x] 6.4 实现通过 snapshot-plus-cursor 处理缺口与 generation 恢复，并核验 remount、reconnect 与 crash fixture 重建相同权威投影且不重放
- [x] 6.5 实现带 provenance、遗漏和 stale 元数据的脱敏、有界 workspace/session context summary，并核验生成 summary 不修改或占用 DSH 主会话上下文

## 7. 完成交互、附件、工件与终端

- [x] 7.1 通过当前 lease 接通 approval 与 user-question 的请求/收敛及 exactly-once correlation；核验重复、迟到、撤回、超时和 generation 过期响应均不影响 DSH
- [x] 7.2 实现附件限制广告及 Host 自有的 hash staging/cleanup；核验无效类型、数量和大小在提交 Prompt 前失败，且用户源文件不被修改
- [x] 7.3 为 message、reasoning、tool、job、workflow、context、file、diff、terminal 与 subagent 规范化 presenter 元数据，并核验未知 kind 使用脱敏通用记录且不暴露不安全操作
- [x] 7.4 实现权威 file/Diff snapshot provenance 和独立 capability-gated 操作；核验只读 Diff 可审阅，而缺失的 apply/revert/open 操作 fail closed
- [x] 7.5 通过官方 seam 实现 terminal handle 的 start/input/resize/interrupt/close 与进程清理；核验 generation 停止后 handle 不可写、后代被回收且命令不重放
- [x] 7.6 投影 DSH 自有的 job、workflow 与 subagent identity、父子关系、进度和控制；核验 Host 不建立平行 AIO 所有权，也不从展示文本推断控制能力

## 8. 完成模型、Preset 与创造模式 Host 能力

- [x] 8.1 暴露 model/service/source/preset catalog provenance 与不可变 Turn 配置快照，并核验历史 Turn 在设置变化后仍保留执行时取值
- [x] 8.2 保持 AIO LLM Profile 为默认入口，同时隔离 DSH 特有设置与显式兼容的 DSH-native Profile；核验不引入启发式 provider fallback 或重复的 AIO 设置 UI 契约
- [x] 8.3 通过能力发现 minimal、standard、PTC 和未来 preset 及其 generation/switch scope 元数据，并核验切换仅依 DSH 语义影响允许的 session 或后续 Turn
- [x] 8.4 实现需显式确认、按 Agent/session/generation 隔离的 Host-half 动态包 define/run/update/stop/undefine/inventory/diagnostics，并核验崩溃恢复后临时包保持 inactive 且不重放
- [x] 8.5 独立强制 browser-half fail closed，并核验浏览器包返回结构化 unavailable，不向 AIO 加载代码且不影响 Host-half 稳定性

## 9. 增加面向后续 change 的扩展缝

- [x] 9.1 实现 maintenance blocker、drain、显式 cancel、stop、migration、health-check、restart 与 rollback-hook 协调状态，并核验新 mutation 被 fence、受管 session 仍可恢复
- [x] 9.2 只通过官方 DSH Adapter API 打开或迁移 session schema，并为受管数据实现 backup/restore；核验失败恢复绝不解析 JSONL 或改变 workspace 源码/Git 状态
- [x] 9.3 定义版本化 External Tool Provider descriptor、catalog、invocation、有序事件、cancel、policy、typed error 与 lifecycle 契约；核验未连接具体 AIO/VCP provider，且 DSH 原生工具行为不变

## 10. 集成、门禁与报告同步

- [x] 10.1 运行聚焦的协议生成、TypeScript typecheck/build、Rust 测试和两个真实发行版 Adapter 契约套件；记录准确命令与结果，不重复无关完整测试
- [x] 10.2 构建 release-shaped Windows 插件 ZIP，运行 manifest-selected checksum、license/SBOM、runtime closure、release verifier 与 executable smoke；核验 manifest 不依赖 Cargo target cache 或本机 DSH 源码目录
- [x] 10.3 通过生产 AIO 插件安装与 resident Sidecar IPC 运行集成测试；使用隔离 app-data 核验真实 workspace/session、snapshot 恢复、interaction、cancel、进程树清理、升级/回退 hook、卸载与数据保留（双 lane 8/8+6/6，ZIP `1f9db8f9`，证据 `.dev-data/dsh-hostcap-r1b|r2b/artifacts/`；workspace 管理操作的生产路由缺口记入 Host Gate v2 §4，不属本行枚举场景）
- [ ] 10.4 重跑 Coding Workstation Host Gate；仅当 R1–R17、R19–R20 全部通过、R18 明确 fail closed、R8 包含真实 DSH facts 时更新门禁报告为通过（已重跑：10 pass / 11 missing / 0 incompatible，R8 真实 facts 与 R18 fail-closed 满足；11 行 missing 根因为生产 wire 接线未排期，见 gate 报告 v2 §4——未达勾选条件，保持未勾选）
- [ ] 10.5 在已记录的离线策略下仅运行一次 Windows native E2E 里程碑；只有 build/package/artifact/smoke 成功后的受控 pre-test 基础设施故障可临时豁免，并必须保持 `gatePassed=false`、`formalReleaseBlocked=true`，不得写成产品 E2E 通过（本机隔离双 lane 14/14 通过；GitHub 离线 CI lane 待推送授权后重跑，`formalReleaseBlocked=true` 维持——保持未勾选）
- [x] 10.6 同步 OpenSpec tasks、Superpowers 实施/验证报告及跨仓 commit/provenance 引用，并核验在已验收 Host Gate 未完全满足前 Coding Workstation 仍保持阻塞（gate 报告 v2 + host-capability 验证报告收尾复验节已同步；UI change 冻结维持，见 gate v2 §7）
