# 设计：DSH Host Capability Foundation

## 背景

已归档的 `integrate-dsh-runtime-core` 建立了 Windows runtime 供应链、Supervisor 生命周期、generation/lease 栅栏、JSONL transport 与最小 RuntimeFacade。后续 Coding 工作站 Host Gate 发现：生产路径仍采用一次性 loopback 执行进程，返回占位 snapshot，也没有接通 workspace/session controller、interaction、artifact、terminal、preset 或动态 Host 扩展。如果直接构建工作站 UI，展示层将被迫虚构 Host 行为。

本 change 将缺失的 Host 控制面作为独立可测试设计轴实现。设计遵循 [CONTEXT.md](../../../CONTEXT.md)、[ADR 0004](../../../docs/adr/0004-stage-dsh-host-capabilities-before-the-workstation.md)、[ADR 0005](../../../docs/adr/0005-isolate-dsh-releases-behind-official-control-adapters.md) 和 [Host Gate 报告](../../../docs/superpowers/reports/2026-09-07-add-dsh-coding-workstation-host-gate.md)。生产实现仍位于独立 `aiohub-plugin-dsh-workspace` 仓库；AIO 负责 OpenSpec、门禁、跨仓集成测试和确有必要的最小公共集成修改。

DSH `v0.1.2-rc.1` 与最新验证基线 `v0.1.3-alpha.2` 在 session persistence、wire、persona 配置、队列/子代理事件和 subprocess handle 行为上存在差异；alpha.2 还修复了 Windows Python SDK 启动崩溃并改善进程清理。DSH 提供 Session Controller、Typert Remote、SessionPersistence、Cordis service、terminal registry 和动态包机制。本 change 只依赖这些官方公开面，不复用 DSH Web UI/BFF 实现，也不读取其存储文件。

## 目标 / 非目标

### 目标

- 用长期驻留的权威 DSH Host 替换占位执行与会话行为，同时支持多个 workspace 和 session。
- 以 capability/schema 判定兼容性，通过官方公开面 Adapter 隔离发行版差异。
- 完成 Host Gate R1–R17、R19–R20，使 R18 明确 fail closed，并将 R8 替换为真实 snapshot。
- 提供 session 控制、事件、interaction、artifact、terminal、preset、创造模式 Host-half 动态包及有界 context summary 的稳定契约。
- 保证 mutation exactly-once，崩溃或不确定状态后绝不重放 Prompt、approval、tool、terminal 或动态包操作。
- 为后续 change 提供 maintenance 协调状态机和版本化 External Tool Provider 扩展缝。
- 在不把版本写入通用逻辑的前提下，用两个首发 DSH 基线验证 Windows x64。

### 非目标

- Coding 工作站 UI、导航、时间线、Inspector 或 side-chat UI。
- 生态 catalog、package 下载、安装、升级、卸载或供应链治理。
- 具体 AIO/VCP External Tool Provider，或 DSH Agent 调用 AIO 工具/插件。
- 在 AIO 内执行 DSH browser/UI package。
- 持久化 side-chat。
- 解析、复制、改写或迁移 DSH JSONL/session storage。
- 支持现有 Windows x64 首发范围以外的平台。

## 决策

### 1. 保持插件仓独立，并在 Build 阶段使用链接 Worktree

不移动或复制原插件仓库。Build 开始时，在 `E:\workspace\projects\aio-hub\.worktrees\aiohub-plugin-dsh-host-capability-foundation` 创建 `aiohub-plugin-dsh-workspace` 的 Git worktree，基于已验收提交 `14c76483bcf7a7bdab9d4b59fb93e1ddad8b4bb0`。这样 Agent 可在 AIO workspace 范围内操作，同时保留插件独立 object database、分支、历史、发布生命周期和现有 runtime-core worktree。

AIO 侧修改仅限公共集成契约、Host Gate fixture 和生产 IPC E2E。DSH 源码检出仅作为只读参考，任何构建或运行路径均不得依赖其本机绝对路径。

### 2. 使用单一长期驻留 Host Domain 与发行版隔离 Adapter

Supervisor 为每个 execution domain 管理一个长期驻留 DSH Host。一个 Host 可承载多个已注册 workspace 和 session；DSH 始终是执行、持久化、lineage、策略与 interaction 的唯一权威。

稳定核心只消费内部 Adapter interface。每个已验收 Adapter 由对应发行版的官方 Session Controller、Typert Remote、SessionPersistence、Cordis lifecycle、interaction 与 terminal API 组成，只在边界转换为稳定 DTO。Adapter 不得导入私有 registry、复制 Web BFF、检查 JSONL 或模拟缺失 mutation。

握手证据包含 contract/schema revision、Adapter identity、runtime provenance、平台事实和 capability inventory。`v0.1.2-rc.1` 是可执行实现基线，`v0.1.3-alpha.2` 是官方源码/API 兼容性 fixture；两者都不是稳定核心中散布的条件分支。alpha.2 Adapter 必须按能力/schema 处理 persona 前后缀、队列发送中状态、可继续子代理控制、PTC 命令输出与无 pid 的普通 subprocess handle；terminal 仍只依赖官方 terminal handle。未知发行版只有在 Adapter 证明必需 capability 与 schema 后才能接入。

### 3. 将稳定 Envelope 与版本化 Payload Schema 分离

Command、reply 和 event 使用稳定 envelope，携带 contract revision、request/event identity、domain generation、connection sequence，以及适用的 workspace/session/Turn/step/tool/job/subagent identity。Payload 是初始化时协商的版本化可辨识 schema。

RuntimeFacade 发布操作级 availability，而不是扁平 feature 列表。每项操作包含稳定 ID、schema revision、enabled 状态和结构化 unavailable 原因。缺失 mutation 行为 fail closed；只在 snapshot/history 仍然权威时允许只读兼容模式。

Typed error 包含稳定 code、retryability、受影响 capability 和脱敏诊断。Request identity 用于 exactly-once mutation：重复请求返回已记录结果或明确 indeterminate，绝不二次执行。

### 4. 在 Managed Home 中保持 DSH 存储权威

插件拥有隔离 Managed DSH Home/Profile。AIO 只保存 workspace/session 引用、draft 和 UI 偏好。稳定 Host workspace ID 将用户显式注册映射到路径，但不复制或取得 workspace 源码所有权。

Session 创建、打开、恢复、搜索、历史、重命名、归档、恢复归档、删除、分叉与队列操作都委派给官方 DSH service，并仅在当前 Adapter 证明后暴露。Session schema 的打开和迁移全部由 DSH 完成。维护前 Host 可备份受管数据，但绝不备份或回退 workspace 源码与 Git 状态。

兼容的 DSH Web 或 CLI 可通过 DSH 文档化机制打开 Managed Home。Session mutation 仍遵守单一显式 controller lease；其他客户端在转移成功前都是 observer。

### 5. 从真实 Snapshot 恢复投影，绝不重放副作用

Host 将 DSH durable event 规范化为带 sequence 的有界事件流。可丢弃 text/reasoning/progress delta 可合并，但 durable start、completion、interaction 与 terminal state 不得丢失。真实 Adapter snapshot 包含 DSH 派生的 durable facts、history cursor、event sequence、当前 interaction 与执行状态。

发现 sequence 缺口或 generation 变化时，客户端停止增量投影并请求 snapshot-plus-cursor 恢复。Host 崩溃后，所有受 generation 约束的 pending command、interaction 和 handle 变为 interrupted 或 indeterminate。重启只重建 durable state，绝不重新提交 Prompt、approval、tool invocation、terminal command 或动态包操作。

### 6. 在 Host 边界规范化 Interaction、Artifact 与 Presenter 元数据

Approval 和 question 具有稳定 interaction identity，并通过当前 controller lease exactly-once 收敛。附件按已广告类型、数量与大小限制检查，在 Host 自有临时目录按 hash 暂存并显式清理。

Presenter record 使用稳定或 namespaced kind ID 表达 message、reasoning、tool、job、workflow、context、file、diff、terminal 与 subagent，包含生命周期、source/model/preset provenance 和独立广告的操作。未知 kind 保留脱敏结构化内容供通用 presenter 使用，不强制转换为已知 UI 类型。

数据离开 Host 边界前统一脱敏；log、support artifact、event 与 error detail 使用同一策略。File/Diff 与 terminal 操作保留权威 DSH/Host handle；能够渲染不代表具有 mutation 权限。

### 7. 保留 Model、Preset 与 Turn Provenance

AIO LLM Profile 是默认模型配置输入。Adapter 只映射已经证明的 provider 语义，首个必需映射为 VCP/OpenAI-compatible Chat Completions。DSH 必需但 AIO 未覆盖的设置可保存在 Managed Profile。兼容 DSH-native Profile 只能由用户显式高级选择，不能作为 fallback。

Host 从 DSH capability 数据发现 minimal、standard、PTC 和未来 preset。每个 Turn 开始时冻结 route、实际 model、service/source、preset、非秘密参数、prompt contribution、workspace、permission 和 sandbox policy。历史 presenter 在当前设置变化后仍保留执行时 provenance。

### 8. 本 Change 只支持创造模式的 Host Half

当 DSH 广告 creative mode 时，Host 暴露 Host-half 动态包的 define/run/update/stop/undefine/inventory/diagnostics，并按 Agent/session 与 generation 隔离。进入更高风险 generation 需要显式用户确认的证据。崩溃后不静默恢复或重放临时定义。

DSH browser/UI package 不挂载。除非后续 change 提供隔离且认证的 browser bridge，否则一律 fail closed。这样既兼容 DSH Host 创造能力，也不允许生成的前端代码修改或拖垮 AIO。

### 9. 只提供 Maintenance 与 External Provider 扩展缝

Maintenance 状态机协调 blocker 检查、drain、显式 cancel、stop、DSH migration、health check、restart 与 rollback hook。它会 fence 新 mutation，但不获取或替换 runtime/package；后者属于 ecosystem-manager change。

External Tool Provider seam 借鉴 VCPToolBox 中可复用的结构：动态发现、规范化 catalog、关联 invocation event、cancel 与 lifecycle；同时补强协商 capability、schema revision、有序 event、policy/approval 元数据与 typed error。本 change 不连接 provider。DSH 原生工具保持不变，该 seam 不能绕过 DSH policy。

### 10. 以契约、Adapter 与生产路径证据完成门禁

测试从聚焦 contract/reducer 与 Adapter fixture 开始，再进入进程集成和一次里程碑生产路径回归。每个 Adapter 都使用其真实发行版基线。Host Gate 必须针对生产 RuntimeFacade/Sidecar IPC 重跑，并证明 R1–R17、R19–R20 通过、R18 fail closed、R8 为真实数据。

Windows native E2E 继续使用现有三态分类。只有发生在测试用例执行前的 WebDriver、端口或 runner 基础设施故障，且 build、package、artifact verification、executable smoke 均通过时，才可临时豁免。该证据仍为 `gatePassed=false` 和 `formalReleaseBlocked=true`；产品断言及 IPC/Sidecar 失败不得豁免。

## 风险 / 取舍

- **上游 API 快速变化：**发行版 Adapter 会增加工作量，但可将变化隔离在稳定契约外，比长期维护复制的 BFF 或存储逻辑成本更低。
- **长期 Host 的复杂度：**多 session、lease 与背压需要更严格的状态管理；generation fencing、typed envelope 与 snapshot recovery 将复杂性收敛在单一边界。
- **互操作控制权竞争：**Web/CLI 接入可能造成 controller 冲突；显式 observer/controller 语义能保留权威事实，而不是隐藏竞争。
- **官方能力不完整：**部分 DSH 发行版可能缺少目标 mutation；操作级 availability 使缺口可见且 fail closed，避免本地模拟。
- **创造模式动态包：**支持 Host-half 扩大安全面；generation 隔离、显式转换和禁止重放降低风险，browser half 保持范围外。
- **跨仓协作：**AIO 与插件必须联合验证；链接 worktree 改善本地控制，但不合并仓库所有权。

## 迁移计划

1. Build 开始时，从已验收 runtime-core 提交 `14c7648` 在 AIO 内创建链接插件 worktree，不移动原仓库。
2. 在保持既有最小生命周期路径可工作的同时，先通过兼容 Adapter 深化协议与 RuntimeFacade DTO，并补聚焦失败测试。
3. 实现并以官方 wheel 验证 `v0.1.2-rc.1` Adapter，再使用同一稳定契约套件和官方 tag/commit 源码 fixture 实现 `v0.1.3-alpha.2` 兼容 Adapter，覆盖 persona、队列/子代理、PTC 输出及 subprocess handle 差异；alpha.2 的 Windows SDK 启动/清理仅在官方 wheel 可获得后补验，不阻断当前实现，也不得记为通过。
4. 用长期 Host、官方控制操作与 snapshot/event recovery 替换 loopback session 和占位 snapshot。
5. 按相关问题组集中加入 interaction、artifact、terminal、presenter、preset provenance、有界 summary 与创造模式 Host-half 生命周期，每组只跑聚焦测试。
6. 加入 maintenance 与 provider seam，但不实现生态管理或具体 provider。
7. 运行跨发行版 contract matrix、Supervisor/process 测试、package/release verifier 与生产 IPC Host Gate；里程碑只运行一次完整 Windows native E2E，允许的基础设施阻塞必须如实记录且不得写成通过。
8. Host 验证后更新 Coding 工作站 Host Gate；只有全部 mandatory 行通过且 R8 为真实数据，工作站 change 才能继续。

回退在插件/runtime 选择边界执行：保留已验收 runtime-core 产物和 Managed Home 备份，fence mutation，停止新 Host generation，选择之前验证过的插件/runtime。任何回退操作都不修改 workspace 源码或 Git 状态。
