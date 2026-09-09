# Comet Design Handoff

- Change: add-dsh-host-capability-foundation
- Phase: design
- Mode: compact
- Context hash: 2a79694bc22e61142dc53adf786f05e72e609689f23e0874e93f963cc7e91bf2

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/add-dsh-host-capability-foundation/proposal.md

- Source: openspec/changes/add-dsh-host-capability-foundation/proposal.md
- Lines: 1-39
- SHA256: fbdbfceffa7f8b153ba84d799fdd7e18aacdca527d942a89ff35aa6eab9b638b

```md
## Why

已归档的 runtime-core 只交付了 Supervisor、供应链、最小 RuntimeFacade 骨架和一次性 loopback 执行通道；Coding 工作站需要的真实 DSH Workspace、Session、事件、交互、工件、终端、preset 与动态 Host 扩展控制面仍不存在，导致 `add-dsh-coding-workstation` 的 Host Gate 有 17 行缺失并停止生产 UI 实施。现在需要一个独立、可验收的 Host capability change，通过 DSH 官方公开控制面补齐这些能力，同时以 `v0.1.2-rc.1` 为可执行实现基线，并隔离最新源码兼容性基线 `v0.1.3-alpha.2` 的破坏性差异。

## What Changes

- 将 runtime-core 的最小 RuntimeFacade 扩展为 capability/schema 驱动的完整 Host 控制面，提供 per-action availability、结构化原因、平台与正式发布状态，并允许只读兼容时安全降级。
- 在 AIO 管理的隔离 DSH Home/Profile 中，通过版本隔离 Adapter 组合 DSH 官方 Session Controller、Typert Remote、SessionPersistence、Cordis lifecycle 与 Terminal seam；不解析或迁移 DSH JSONL，不复制 DSH Web BFF。
- 交付真实 Workspace 和 Session 生命周期、全局搜索、分页历史、snapshot/cursor、连续事件、controller lease、submit/queue/steer/cancel/restart、审批与问题收敛。
- 交付消息、reasoning、工具、job、workflow、context、文件、Diff、Terminal 与 Subagent 的稳定 presenter 元数据、来源身份、可用操作和脱敏通用回退。
- 交付 Host 报告的 preset roster、模型/服务来源和 Turn 级不可变配置，并沿用 AIO LLM Profile 作为 AIO 发起会话的默认配置入口。
- 交付创造模式所需的 Host-half 临时动态扩展生命周期、Agent/Session/generation 隔离和诊断；browser half 明确 fail closed，崩溃后不自动重放或激活。
- 交付通用 maintenance 状态机，为 runtime 维护及后续生态管理提供 drain、显式取消、停止、重启、健康检查和 rollback hook，但不执行扩展下载、安装或更新。
- 为后续 AIO/VCP 工具共享预留强类型 External Tool Provider 边界，包括发现、catalog、调用、取消、事件、策略、错误和生命周期；本 change 不接入任何具体 Provider。
- 以官方 wheel 真实验证 `v0.1.2-rc.1` Adapter，并以官方 tag/commit 源码 fixture 验证 `v0.1.3-alpha.2` 公共 API 兼容性；alpha.2 无官方 wheel 不阻断实现，但不得写成可执行 runtime 已通过。未知 DSH 发行版仅在必需 capability 与 schema 完整协商后进入；不得用语义版本或名称猜测兼容。
- 重新执行 Coding 工作站 Host Gate：R1–R17、R19–R20 必须通过，R18 必须为明确 fail-closed，R8 必须返回真实快照而非占位数据。

## Capabilities

### New Capabilities

- `dsh-host-capability-contract`: 定义 RuntimeFacade 握手、schema/capability 协商、操作级 availability、结构化错误、平台/发布状态和版本 Adapter 边界。
- `dsh-host-workspace-session`: 定义受管 DSH Home 中 Workspace/Session 身份、生命周期、搜索、分页历史、真实快照、事件连续性和多客户端控制语义。
- `dsh-host-interactions-artifacts`: 定义审批、问题、附件、文件、Diff、Terminal、Job、Workflow、Subagent、presenter 元数据和脱敏边界。
- `dsh-host-dynamic-runtime`: 定义 preset generation、创造模式 Host-half 动态扩展、维护窗口及未来 External Tool Provider 扩展缝。

### Modified Capabilities

- `dsh-runtime-lifecycle`: 扩展运行态为 upgrading、recovering、maintenance 与 incompatible，定义受管 DSH Home、官方迁移、恢复点和正式发布阻塞传播。
- `dsh-execution-bridge`: 将一次性 loopback/占位快照基础升级为基于 DSH 官方 Controller/Remote 的长期驻留、多会话真实控制面。
- `dsh-model-and-prompt-sync`: 增加 Host 模型 catalog、preset roster、实际 model/service/preset provenance 和跨 Turn 配置切换规则。

## Impact

- 主要生产实现位于独立仓库 `aiohub-plugin-dsh-workspace` 的新 worktree，并基于已验收 runtime-core 提交 `14c76483bcf7a7bdab9d4b59fb93e1ddad8b4bb0`；原插件仓和已有 worktree 不迁移。
- AIO 仓库承载 OpenSpec、Host Gate、跨仓集成与 Windows production IPC E2E；仅在公开集成契约确有缺口时做最小、增量、默认行为不变的修改。
- `deepseek-harness-alpha5-build` 与 `deepseek-harness-audit` 仅用于只读审计和版本对照；生产构建继续消费 runtime lock 选择的官方 wheel，不依赖本机源码绝对路径。
- `add-dsh-coding-workstation` 在本 change 验收并重跑 Host Gate 前保持阻塞。现有 `add-dsh-ecosystem-manager` 作为第四个 change，承接持久扩展目录、安装、升级、卸载、供应链治理及具体 AIO/VCP 工具桥接。
- Windows x64 是本 change 的完整支持平台。CI 基础设施豁免只能记录为 `infrastructure-blocked`、`gatePassed=false`、`formalReleaseBlocked=true`，不得作为产品 E2E 通过或正式发布证据。

```

## openspec/changes/add-dsh-host-capability-foundation/design.md

- Source: openspec/changes/add-dsh-host-capability-foundation/design.md
- Lines: 1-123
- SHA256: c289e549d41dfb4d3a86cbc38416870ef969744396914a74dc26d9d43795291e

[TRUNCATED]

```md
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


```

Full source: openspec/changes/add-dsh-host-capability-foundation/design.md

## openspec/changes/add-dsh-host-capability-foundation/tasks.md

- Source: openspec/changes/add-dsh-host-capability-foundation/tasks.md
- Lines: 1-77
- SHA256: ab2dbc1c93d6bbf4f9a85bf3f0909efa0d7a3728b79d0c6676427a520264ac05

```md
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
- [ ] 3.4 按协商证据而非语义版本猜测选择 Adapter，并核验不完整或未知发行版进入结构化 `incompatible` 或权威只读状态
- [ ] 3.5 增加 import/storage guard，禁止 DSH 私有 registry、复制 Web BFF 及解析或修改 JSONL，并核验生产 bundle 与源码审计通过

## 4. 用长期驻留 Managed Host 替换 loopback 执行

- [ ] 4.1 为每个 Supervisor execution domain 启动一个可承载多个 workspace/session 的长期 DSH Host；核验 readiness 等待 Cordis settlement，且全部后代进程受 Windows Job Object 清理
- [ ] 4.2 创建并保护隔离的 Managed DSH Home/Profile；核验权限、凭据原子处理和清理流程均不触碰用户默认 DSH Home
- [ ] 4.3 扩展 upgrading、recovering、maintenance 与 incompatible 生命周期状态；通过聚焦状态机测试核验合法转换、mutation fencing 和脱敏诊断
- [ ] 4.4 实现官方 DSH flush/dispose 与崩溃恢复；核验活动 Turn/handle 变为 interrupted、持久事实被重建，且 Prompt 或副作用绝不重放

## 5. 交付权威 Workspace 与 Session 控制面

- [ ] 5.1 实现显式 workspace 注册、稳定 Host ID、列表/打开/移除投影与安全路径处理，并核验默认移除操作保留 workspace 文件、Git 状态和 DSH session
- [ ] 5.2 实现 capability-gated 的 session 创建、列表、打开、恢复、重命名、归档、恢复归档、删除和分叉；核验已支持操作保持 DSH identity/lineage，未支持操作 fail closed
- [ ] 5.3 实现可取消且受 generation 约束的全局搜索与分页历史；核验被替代搜索和过期分页结果不能改变当前投影
- [ ] 5.4 通过官方语义实现跨客户端 controller/observer lease 获取、转移与释放；核验聚焦不会夺取控制权，过期写入不会触达 DSH
- [ ] 5.5 将 submit、queue、队列项编辑/移除、steer、cancel 与 restart 实现为独立广告的操作；核验取消到达权威终态，restart 是新的显式操作

## 6. 交付真实 Snapshot、事件恢复与有界 Summary

- [ ] 6.1 用 DSH 派生的 durable facts、cursor、sequence、执行状态和活动 interaction 替换占位 snapshot，并核验 R8 测试拒绝 `cursor-0` 或合成空快照
- [ ] 6.2 规范化带全部可用 workspace/session/Turn/step/tool/job/subagent identity 的有序事件 envelope，并核验两个 Adapter 的确定性去重和排序
- [ ] 6.3 实现有界 ingress/egress queue、可丢弃 delta 合并与 overload 诊断，并通过慢消费者压力测试核验 durable start、终态和 interaction 不丢失
- [ ] 6.4 实现通过 snapshot-plus-cursor 处理缺口与 generation 恢复，并核验 remount、reconnect 与 crash fixture 重建相同权威投影且不重放
- [ ] 6.5 实现带 provenance、遗漏和 stale 元数据的脱敏、有界 workspace/session context summary，并核验生成 summary 不修改或占用 DSH 主会话上下文

## 7. 完成交互、附件、工件与终端

- [ ] 7.1 通过当前 lease 接通 approval 与 user-question 的请求/收敛及 exactly-once correlation；核验重复、迟到、撤回、超时和 generation 过期响应均不影响 DSH
- [ ] 7.2 实现附件限制广告及 Host 自有的 hash staging/cleanup；核验无效类型、数量和大小在提交 Prompt 前失败，且用户源文件不被修改
- [ ] 7.3 为 message、reasoning、tool、job、workflow、context、file、diff、terminal 与 subagent 规范化 presenter 元数据，并核验未知 kind 使用脱敏通用记录且不暴露不安全操作
- [ ] 7.4 实现权威 file/Diff snapshot provenance 和独立 capability-gated 操作；核验只读 Diff 可审阅，而缺失的 apply/revert/open 操作 fail closed
- [ ] 7.5 通过官方 seam 实现 terminal handle 的 start/input/resize/interrupt/close 与进程清理；核验 generation 停止后 handle 不可写、后代被回收且命令不重放
- [ ] 7.6 投影 DSH 自有的 job、workflow 与 subagent identity、父子关系、进度和控制；核验 Host 不建立平行 AIO 所有权，也不从展示文本推断控制能力

## 8. 完成模型、Preset 与创造模式 Host 能力

- [ ] 8.1 暴露 model/service/source/preset catalog provenance 与不可变 Turn 配置快照，并核验历史 Turn 在设置变化后仍保留执行时取值
- [ ] 8.2 保持 AIO LLM Profile 为默认入口，同时隔离 DSH 特有设置与显式兼容的 DSH-native Profile；核验不引入启发式 provider fallback 或重复的 AIO 设置 UI 契约
- [ ] 8.3 通过能力发现 minimal、standard、PTC 和未来 preset 及其 generation/switch scope 元数据，并核验切换仅依 DSH 语义影响允许的 session 或后续 Turn
- [ ] 8.4 实现需显式确认、按 Agent/session/generation 隔离的 Host-half 动态包 define/run/update/stop/undefine/inventory/diagnostics，并核验崩溃恢复后临时包保持 inactive 且不重放
- [ ] 8.5 独立强制 browser-half fail closed，并核验浏览器包返回结构化 unavailable，不向 AIO 加载代码且不影响 Host-half 稳定性

## 9. 增加面向后续 change 的扩展缝

- [ ] 9.1 实现 maintenance blocker、drain、显式 cancel、stop、migration、health-check、restart 与 rollback-hook 协调状态，并核验新 mutation 被 fence、受管 session 仍可恢复
- [ ] 9.2 只通过官方 DSH Adapter API 打开或迁移 session schema，并为受管数据实现 backup/restore；核验失败恢复绝不解析 JSONL 或改变 workspace 源码/Git 状态
- [ ] 9.3 定义版本化 External Tool Provider descriptor、catalog、invocation、有序事件、cancel、policy、typed error 与 lifecycle 契约；核验未连接具体 AIO/VCP provider，且 DSH 原生工具行为不变

## 10. 集成、门禁与报告同步

- [ ] 10.1 运行聚焦的协议生成、TypeScript typecheck/build、Rust 测试和两个真实发行版 Adapter 契约套件；记录准确命令与结果，不重复无关完整测试
- [ ] 10.2 构建 release-shaped Windows 插件 ZIP，运行 manifest-selected checksum、license/SBOM、runtime closure、release verifier 与 executable smoke；核验 manifest 不依赖 Cargo target cache 或本机 DSH 源码目录
- [ ] 10.3 通过生产 AIO 插件安装与 resident Sidecar IPC 运行集成测试；使用隔离 app-data 核验真实 workspace/session、snapshot 恢复、interaction、cancel、进程树清理、升级/回退 hook、卸载与数据保留
- [ ] 10.4 重跑 Coding Workstation Host Gate；仅当 R1–R17、R19–R20 全部通过、R18 明确 fail closed、R8 包含真实 DSH facts 时更新门禁报告为通过
- [ ] 10.5 在已记录的离线策略下仅运行一次 Windows native E2E 里程碑；只有 build/package/artifact/smoke 成功后的受控 pre-test 基础设施故障可临时豁免，并必须保持 `gatePassed=false`、`formalReleaseBlocked=true`，不得写成产品 E2E 通过
- [ ] 10.6 同步 OpenSpec tasks、Superpowers 实施/验证报告及跨仓 commit/provenance 引用，并核验在已验收 Host Gate 未完全满足前 Coding Workstation 仍保持阻塞

```

## openspec/changes/add-dsh-host-capability-foundation/specs/dsh-execution-bridge/spec.md

- Source: openspec/changes/add-dsh-host-capability-foundation/specs/dsh-execution-bridge/spec.md
- Lines: 1-59
- SHA256: 7a141d6e68813de3e1fc968a53c47cc4af733487e5923a52f49a467e522f3ce1

```md
# dsh-execution-bridge Specification Delta

## MODIFIED Requirements

### Requirement: 公开扩展点上的完整无头执行域
桥接层 SHALL 作为项目侧 TypeScript/ESM DSH Cordis 插件运行，并由发行版隔离 Adapter 组合 DSH 公开的 Session Controller、Typert Remote、Workspace Controller、SessionPersistence、settings、credentials、prompt、terminal 和交互服务。桥接层 MUST NOT 修改或复制 Agent Loop、DSH Web BFF、会话持久化、上下文压缩、工具策略、审批、沙箱、工作流、Skill、子 Agent，也不得启动 DSH Web UI、导入私有注册表或解析 JSONL。DSH SHALL 始终是执行与会话的唯一权威。

#### Scenario: 桥接启动
- **WHEN** 受管 `aio-coding` Profile 完成 Cordis Loader settlement 且 Adapter 验证必需公开服务
- **THEN** 桥接才公布就绪状态、runtime provenance、sandbox 状态、Adapter identity 和版本化能力清单

#### Scenario: 公开服务缺失
- **WHEN** 当前 DSH runtime 未提供任一必需公共服务或行为契约
- **THEN** 桥接拒绝就绪或仅进入明确的权威只读模式，并列出缺失项，不导入私有模块或静默实现替代 Agent 行为

### Requirement: 完整会话控制契约
桥接 SHALL 维持一个可承载多个 Workspace 与 Session 的长期 DSH Host，并通过版本化、类型化命令提供创建、列出、全局搜索、打开、恢复、分页历史、提交 Prompt、取消、steer、队列新增/编辑/移除、重启、分叉、重命名、归档、恢复归档、删除、模型选择和工作区关联能力；每项能力 SHALL 映射到 DSH 公共控制服务并独立协商。DSH durable session 与日志是执行事实源，AIO 只保存引用、draft 和 UI 偏好。

#### Scenario: 恢复冷会话
- **WHEN** AIO 打开只存在于 DSH 持久化中的会话
- **THEN** 桥接使用 DSH 冷读取/恢复能力返回权威历史投影，不创建重复会话

#### Scenario: 分叉已完成 Turn
- **WHEN** 用户从已完成 Turn 分叉且 Host 广告 fork 能力
- **THEN** DSH 创建携带正确 lineage 的新 session；AIO 仅保存新引用，且两个分支不共享可变 session

#### Scenario: 取消活动任务
- **WHEN** controller 取消活动 Turn
- **THEN** 桥接调用 DSH 官方取消能力并持续转发状态，直到权威终态或执行域断开

#### Scenario: 操作未被当前 Adapter 证明
- **WHEN** 客户端请求一个未协商的 session mutation
- **THEN** 桥接结构化拒绝且不以相似命令或本地数据操作模拟该行为

### Requirement: 权威快照、可丢弃增量与有界背压
DSH 的 durable events、开始/完成事实和由官方控制面读取的真实 snapshots SHALL 是恢复依据；占位 cursor、合成空 facts 或 UI 缓存 MUST NOT 作为产品快照。文本、reasoning 和进度 delta MAY 被合并或丢弃，且不得成为唯一事实。桥接 SHALL 使用有界 ingress/egress queue、过载诊断、重连退避及 snapshot-plus-cursor 恢复。检测到事件缺口、重复、代际变化或 UI remount 时，AIO MUST 以权威快照重建后再应用连续增量。

#### Scenario: UI 重新挂载
- **WHEN** Coding工作站 UI 卸载后重挂载而 DSH 仍运行
- **THEN** 桥接先返回权威 snapshot，再从确认 cursor 继续增量，不依赖 UI 内存

#### Scenario: 慢消费者导致队列饱和
- **WHEN** presentation delta 的产生速度超过 AIO 消费速度
- **THEN** 桥接可合并或丢弃 disposable delta，但必须保留终态和可恢复事实，并报告 overload 诊断

#### Scenario: 发现事件缺口
- **WHEN** AIO 检测到 sequence 不连续或 generation 改变
- **THEN** 系统暂停增量投影并请求 snapshot/history 重建，禁止猜测缺失内容

### Requirement: 审批与用户问题往返
桥接 SHALL 将 DSH runtime-to-host approval 和 user-question request 作为带稳定 interaction id、generation、session 与 Turn identity 的类型化 interaction 转发给 AIO，并 SHALL 将当前 controller 的 allow、deny、answer、cancel 或 timeout 结果只完成一次。DSH 始终保留最终策略裁决权；interaction 结束时必须发送 `interaction/resolved` 清除所有 UI 投影。重复、迟到或代际不匹配的响应 MUST NOT 触达 DSH。

#### Scenario: 用户批准一次操作
- **WHEN** DSH 请求审批且当前 controller 选择单次允许
- **THEN** 桥接只完成匹配 generation、lease 和 interaction id 的等待请求一次，并由 DSH 决定操作是否继续

#### Scenario: 请求在响应前失效
- **WHEN** Turn 取消、租约转移、执行域重启或 DSH 撤回 interaction
- **THEN** 所有观察视图收到 resolved 通知，迟到响应被拒绝且不得作用到新请求

```

## openspec/changes/add-dsh-host-capability-foundation/specs/dsh-host-capability-contract/spec.md

- Source: openspec/changes/add-dsh-host-capability-foundation/specs/dsh-host-capability-contract/spec.md
- Lines: 1-46
- SHA256: a8c320c6db92235c39467784f60216e5d5e73946b19ca282396cf530903a282c

```md
# dsh-host-capability-contract Specification

## Purpose
定义与版本解耦的 RuntimeFacade 契约，使 AIO 无需猜测兼容性或导入上游内部实现即可消费已支持的 DSH Host 发行版。

## ADDED Requirements

### Requirement: 基于能力与 Schema 协商的 Host 握手
Host SHALL 在初始化时声明 contract、Adapter、平台、runtime provenance 与支持的 schema revision。兼容性 SHALL 根据必需 capability 与 schema 证据判定，不得依赖硬编码 DSH 版本比较。首个可执行验收基线 SHALL 使用 `v0.1.2-rc.1` 官方 wheel；`v0.1.3-alpha.2` SHALL 通过只使用 DSH 公共控制面的官方源码 fixture 验证 API 兼容性，并在官方 wheel 缺失时明确保持 runtime 验证未完成而不阻断 Host 实现。

#### Scenario: 已支持发行版完成初始化
- **WHEN** Adapter 为其 runtime 提供全部必需 capability 与兼容 schema
- **THEN** Host 返回协商后的契约，且只启用该协商已证明的操作

#### Scenario: 未知发行版具有相似版本模式
- **WHEN** 没有 Adapter 能为某 runtime 证明必需 capability 与 schema 集合
- **THEN** Host 进入 `incompatible`、报告缺失证据，且不根据版本字符串推断兼容性

### Requirement: 操作级可用性与安全降级
RuntimeFacade SHALL 使用稳定 capability ID 和结构化 unavailable 原因发布操作级可用性。缺失的 mutation capability SHALL fail closed。仅当 Host 能证明其暴露的全部状态仍然权威，并明确标记每个不可用操作时，客户端 MAY 进入只读兼容模式。

#### Scenario: Archive 操作不可用
- **WHEN** 当前 Adapter 无法将 session archive 映射到官方 DSH 操作
- **THEN** archive 被声明为不可用并附稳定原因，尝试执行时在触达 DSH 前被拒绝

#### Scenario: 只读兼容条件满足
- **WHEN** snapshot 与 history schema 兼容，但必需 mutation capability 不完整
- **THEN** Host 可以暴露权威只读投影，同时禁用所有未经证明的 mutation

### Requirement: 类型化命令、事件与错误
Command 与 event SHALL 使用版本化可辨识 DTO，不得使用无类型 payload。每个 mutation SHALL 携带 request identity，并在适用时携带 domain generation 与 controller lease。Error SHALL 暴露稳定 code、retryability、受影响 capability 和脱敏诊断；重复或过期 mutation identity MUST NOT 导致操作再次执行。

#### Scenario: Mutation 响应丢失
- **WHEN** 客户端因响应丢失而重复同一 mutation request identity
- **THEN** Host 返回已记录结果或结构化 indeterminate 结果，不再次执行 mutation

#### Scenario: Adapter 返回未知事件
- **WHEN** Host 无法用协商后的 schema 验证上游事件
- **THEN** Host 报告脱敏兼容诊断，且不将该事件投影为已知 durable fact

### Requirement: 平台与发布验证状态
Host SHALL 分别报告平台支持、runtime 完整性、Adapter 验证状态和 native E2E 发布状态。`infrastructure-blocked` native E2E 结果 SHALL 保持 `gatePassed=false` 与 `formalReleaseBlocked=true`，MUST NOT 表述为产品验证通过。

#### Scenario: Windows runner 的 WebDriver 不可用
- **WHEN** build、package、artifact verification 与 executable smoke 均通过，但 native E2E 被分类为允许的测试前基础设施故障
- **THEN** change 可带明确临时豁免继续，而 Host 仍报告正式发布被阻塞

```

## openspec/changes/add-dsh-host-capability-foundation/specs/dsh-host-dynamic-runtime/spec.md

- Source: openspec/changes/add-dsh-host-capability-foundation/specs/dsh-host-dynamic-runtime/spec.md
- Lines: 1-42
- SHA256: 1d4f38a6d05f38fec075b0f74d7173e03d6da36e4a73dc1b6532fe57799bd31f

```md
# dsh-host-dynamic-runtime Specification

## Purpose
定义能力驱动的 preset、创造模式 Host-half 动态包、维护协调和未来 External Tool Provider 扩展缝，但不实现生态管理。

## ADDED Requirements

### Requirement: 能力驱动的 Preset Roster 与 Generation
Host SHALL 发布 DSH preset roster、语义模式、来源、generation、switch scope 与转换要求。Minimal、standard、PTC 与未来模式 SHALL 从 Host capability 数据发现，不得硬编码版本表。Preset 切换 SHALL 遵循 DSH 语义，且 SHALL NOT 改变活动 Turn 的不可变配置。

#### Scenario: Runtime 新增 Preset
- **WHEN** Adapter 验证新广告的 preset schema
- **THEN** Host 暴露其声明语义，无需新增版本名称判断

### Requirement: 显式的创造模式 Host-half 动态包生命周期
当 DSH 支持创造模式时，Host-half 动态包 SHALL 按 Agent/session 与 domain generation 隔离，并 SHALL 暴露类型化 define、run、update、stop、undefine、inventory 与 diagnostic 操作。进入更高风险的 creative generation SHALL 要求显式用户确认转换的证据。崩溃或重启 SHALL 让之前的临时包保持 inactive，MUST NOT 自动重建或重新运行。

#### Scenario: Creative Package 活动时崩溃
- **WHEN** Host generation 意外退出
- **THEN** package 在恢复后被报告为 interrupted 或 inactive，且需要用户显式操作才能重新 define 或 run

### Requirement: Browser-half Package Fail Closed
除非后续 capability 提供隔离、认证且 schema-validated 的 browser bridge，否则 Host SHALL NOT 在 AIO 内加载或执行 DSH browser/UI package。缺少该 capability SHALL 报告 unavailable，且 MUST NOT 影响 Host-half package 稳定性。

#### Scenario: Package 需要 Browser 执行
- **WHEN** 动态包声明 browser half，但未协商 browser bridge capability
- **THEN** Host 以结构化兼容原因拒绝该部分，同时保持 Host 安全运行

### Requirement: Maintenance 协调状态机
Host SHALL 为 drain、显式 cancel、stop、migration、health check、restart 与 rollback hook 暴露计划维护状态和操作。Maintenance SHALL fence 新 mutation 并保留 DSH 自有 session。本 change SHALL NOT 下载、安装、更新或删除 runtime 或生态 package。

#### Scenario: 存在活动工作时进入 Maintenance
- **WHEN** 调用方在 session 存在活动 Turn 或 interaction 时请求维护
- **THEN** Host 报告 blocker，并在停止 domain 前要求显式选择 drain 或 cancel

### Requirement: 版本化 External Tool Provider 扩展缝
Host SHALL 定义 provider-neutral 扩展边界，包含 provider identity、协商 capability、版本化 catalog snapshot、invocation ID、有序 event、cancel、policy/approval 元数据、typed error 与 connect/refresh/drain/disconnect 生命周期。本 change SHALL NOT 启用具体 AIO 或 VCP Provider，且该 seam MUST NOT 绕过 DSH 工具策略。

#### Scenario: 未配置 External Provider
- **WHEN** Host 初始化时没有 provider 实现
- **THEN** DSH 原生工具继续正常工作，external-provider capability 明确不可用


```

## openspec/changes/add-dsh-host-capability-foundation/specs/dsh-host-interactions-artifacts/spec.md

- Source: openspec/changes/add-dsh-host-capability-foundation/specs/dsh-host-interactions-artifacts/spec.md
- Lines: 1-49
- SHA256: 3ed50534d21709be64314b4d16fa262a1fbd1e7f3fdeff60d9db68d44f22e0b5

```md
# dsh-host-interactions-artifacts Specification

## Purpose
定义 Coding 工作站消费的 Host 侧交互、附件、工件、终端和执行 presenter 契约。

## ADDED Requirements

### Requirement: Exactly-once Approval 与 User Question
Host SHALL 将 DSH approval 与 user question 投影为带稳定 correlation、generation、session 和 Turn identity 的类型化 interaction。只有当前 controller MAY 响应。Allow、deny、answer、cancel、withdrawal 与 timeout SHALL 使 interaction 恰好收敛一次，且 DSH SHALL 保持最终策略权威。

#### Scenario: 迟到的 Approval 响应
- **WHEN** approval 已因撤回、超时、取消、控制权转移或重启而失效
- **THEN** 响应作为 stale 被拒绝，且不能影响后续 interaction

### Requirement: 由 Capability 广告的附件暂存
Host SHALL 广告附件数量、类型与大小限制。已接受附件 SHALL 暂存于 Host 自有临时存储，并带 content hash、所有权与生命周期元数据；来自 AIO 的 workspace 路径不得因此被视为可信。被拒绝或放弃的附件 SHALL 清理，且不修改用户源文件。

#### Scenario: 附件超出 Runtime 限制
- **WHEN** 候选附件违反已广告限制
- **THEN** staging 在提交 Prompt 前以结构化原因失败

### Requirement: 稳定 Presenter 元数据与脱敏回退
Host SHALL 将 message、reasoning、tool、job、workflow、context、file、diff、terminal 与 subagent 规范化为稳定 kind ID、source/model/preset provenance、生命周期状态和已广告操作。未知 kind SHALL 通过通用脱敏 presenter 保持可检查，MUST NOT 被错误标记为已知 kind。秘密和敏感路径 SHALL 在 event、log 或支持产物离开 Host 边界前完成脱敏。

#### Scenario: 遇到新的 DSH Event Kind
- **WHEN** 已支持 runtime 发出没有专用 presenter 的事件
- **THEN** Host 输出其稳定或 namespaced kind、脱敏结构化数据及零不安全操作，使 UI 可使用通用 presenter

### Requirement: 权威 File 与 Diff 工件
File 与 Diff 投影 SHALL 标识 workspace、path、revision/base 与 snapshot provenance。Preview、open、apply、revert 或 external-editor 操作 SHALL 独立广告并委派给官方 DSH 或 Host 受控操作；Host MUST NOT 因 UI 能渲染工件就宣称文件操作可用。

#### Scenario: Diff 可审阅但不可应用
- **WHEN** Host 有权威 Diff snapshot，但没有安全 apply capability
- **THEN** Host 暴露审阅数据，并以原因标记 apply 不可用

### Requirement: Terminal 生命周期与清理
Terminal 投影 SHALL 绑定 Agent、session、domain generation 与官方 terminal handle。Start、input、resize、interrupt 与 close SHALL 受 capability gate。Host 或 terminal 崩溃 SHALL 将 terminal 转为 interrupted 或 closed，并 SHALL 清理进程树且不重放命令。

#### Scenario: Domain Generation 结束
- **WHEN** Host generation 在 terminal 活动期间停止
- **THEN** 每个 terminal handle 变为不可写、报告最终状态，且其后代进程被回收

### Requirement: Job、Workflow 与 Subagent 保持 DSH 所有权
Host SHALL 暴露 DSH 自有 job、workflow 与 subagent identity、父子关系、进度、终态及受支持控制，不得建立平行的 AIO 执行所有权。缺失控制 SHALL 保持不可用，不得从 event 文本模拟。

#### Scenario: 观察到 Subagent
- **WHEN** DSH 在 Turn 下启动 subagent
- **THEN** Host 投影其权威父子关系与状态，且所有控制操作仅限 DSH 广告的 capability


```

## openspec/changes/add-dsh-host-capability-foundation/specs/dsh-host-workspace-session/spec.md

- Source: openspec/changes/add-dsh-host-capability-foundation/specs/dsh-host-workspace-session/spec.md
- Lines: 1-61
- SHA256: 042f8164a52e732010433c98512fb8ff40380b25b54fa2a4909a98f165f07dea

```md
# dsh-host-workspace-session Specification

## Purpose
定义长期驻留 DSH Host 的权威工作区、会话、历史、事件、控制与恢复行为。

## ADDED Requirements

### Requirement: 受管 DSH Home 与稳定 Workspace Identity
Host SHALL 使用 AIO 自有的隔离 DSH Home/Profile，同时 DSH 保持 session 与执行事实的唯一所有者。Workspace 注册 SHALL 是用户显式操作，并 SHALL 分配不依赖显示名称或路径拼写的稳定 Host workspace ID。移除 workspace SHALL 默认只移除 Host 注册，除非用户独立确认了已广告的破坏性操作。

#### Scenario: 用户注册目录
- **WHEN** 用户显式添加有效目录
- **THEN** Host 创建或复用其稳定 workspace identity，且不复制或取得 workspace 源码与 Git 状态的所有权

#### Scenario: 用户移除 Workspace
- **WHEN** 用户从 AIO 移除 workspace
- **THEN** Host 保留目录与 DSH session 数据，除非用户另行请求并确认受支持的破坏性操作

### Requirement: 权威 Session 生命周期与发现
Host SHALL 通过官方 DSH 控制 API 暴露 capability-gated 的创建、列表、全局搜索、打开、恢复、重命名、归档、恢复归档、删除与分叉。搜索和历史 SHALL 支持分页、取消并受当前 domain generation 约束。AIO SHALL 只存储引用、draft 与 UI 偏好，不得建立第二份持久 session 记录。

#### Scenario: 打开冷 Session
- **WHEN** session 只存在于 DSH persistence 中
- **THEN** Host 通过发行版 Adapter 打开或恢复它，并返回相同的权威 identity 与 lineage

#### Scenario: 搜索被新请求替代
- **WHEN** 新的全局搜索替代仍在执行的旧搜索
- **THEN** 旧请求被取消，或其受 generation 约束的结果被丢弃，且不改变任何 session

### Requirement: 真实 Snapshot 与连续事件恢复
Host SHALL 提供来自真实 DSH 的 session snapshot，其中包含 durable facts、history cursor、event sequence、活动 interaction 与执行状态。规范化 event SHALL 携带 domain generation、单调有序 sequence，以及可用的 workspace、session、Turn、step、tool、job 与 subagent identity。重复事件 SHALL 幂等；出现缺口或 generation 变化 SHALL 强制通过 snapshot-plus-cursor 重建。

#### Scenario: 客户端发现 Sequence 缺口
- **WHEN** 下一事件 sequence 不连续
- **THEN** 客户端停止应用 delta，Host 在继续推送事件前提供新的权威 snapshot

#### Scenario: 运行中 Turn 的 UI 重新挂载
- **WHEN** workstation view 在 Host 仍存活时重新挂载
- **THEN** 它从 Host snapshot 与 cursor 重建，不依赖之前的 UI 内存

### Requirement: 显式 Controller Lease 与 Observer 互操作
每个 DSH session SHALL 最多有一个 mutation controller，并 MAY 在兼容的 AIO、DSH Web 与 DSH CLI 客户端间存在多个 observer。控制权获取和转移 SHALL 显式执行、受 generation fence，并通过 DSH 官方语义实现。聚焦或查看 session MUST NOT 静默取得控制权。

#### Scenario: 其他客户端持有控制权
- **WHEN** AIO 打开由兼容 DSH 客户端控制的 session
- **THEN** AIO 获得 observer 投影，只有显式转移成功后才能 mutation

### Requirement: Turn 提交、排队与中断语义
仅当发行版 Adapter 能证明对应 DSH 行为时，Host SHALL 暴露 submit、queue、steer、队列项编辑/移除、cancel 与 restart。取消 SHALL 持续到 DSH 报告权威终态。Restart 或 recovery MUST 创建新的显式操作，MUST NOT 重放之前的 Prompt 或副作用。

#### Scenario: Host 在 Turn 期间崩溃
- **WHEN** 进程 generation 在 Turn 到达 durable 终态前退出
- **THEN** Host 将 Turn 标记为 interrupted、清除受 generation 约束的控制与 interaction、重启后重建 durable state，且不重新提交工作

### Requirement: 面向只读消费者的有界 Context Summary
Host SHALL 暴露适用于临时只读提问的脱敏、有界 session/workspace summary 与 provenance。Summary SHALL 来自 DSH 权威事实，SHALL 标识遗漏或 stale 状态，并 SHALL NOT 修改或占用主 session 上下文。

#### Scenario: 完整 Summary 超出预算
- **WHEN** 权威上下文超过请求的 capsule budget
- **THEN** Host 返回带明确遗漏与来源 identity 的压缩有界 summary，不静默截断 provenance


```

## openspec/changes/add-dsh-host-capability-foundation/specs/dsh-model-and-prompt-sync/spec.md

- Source: openspec/changes/add-dsh-host-capability-foundation/specs/dsh-model-and-prompt-sync/spec.md
- Lines: 1-33
- SHA256: 165007b2bc04b594f36e5ec6ac708c8bfd24c35b439972e620fea05e7986a599

```md
# dsh-model-and-prompt-sync Specification Delta

## MODIFIED Requirements

### Requirement: AIO 是默认模型配置入口
系统 SHALL 默认允许用户从 AIO 已启用的 LLM Profile 中为 Coding工作站选择模型，并 SHALL 通过 `aiohub-sdk` 公共能力读取同步输入；工作站不得复制 AIO 已有的 AI 服务或模型元数据设置。`AioProfileAdapter` SHALL 使用显式、版本化、可验证的映射，首发必需映射为 VCP/OpenAI-compatible Chat Completions。若 DSH 官方能力要求 AIO 尚未覆盖的设置，Host MAY 在受管 DSH Profile 中保存该最小补充；兼容 DSH-native Profile 仅可作为显式高级选择，且不得成为静默 fallback。

#### Scenario: 选择 VCP/OpenAI-compatible Profile
- **WHEN** Profile 的 Base URL、Bearer 凭据、model、headers 和 Chat Completions 语义可完整映射
- **THEN** adapter 生成精确 DSH route、credential ref 与 capability 声明，并在启动前通过验证

#### Scenario: 其他 Provider 映射已完整验证
- **WHEN** Anthropic、Gemini、DeepSeek 或其他 Provider 的请求、流、错误、取消、tool call 和扩展字段均有明确映射及黑盒测试
- **THEN** 系统可通过独立 adapter 启用该 Provider，而不改变默认 VCP/OpenAI-compatible 路径

#### Scenario: 使用兼容的 DSH-native Profile
- **WHEN** 用户显式选择 Host 验证过的 DSH-native Profile 且所需能力不属于 AIO 现有设置面
- **THEN** Host 在隔离受管 Profile 中应用该配置、标明来源，并保持 AIO 默认 Profile 路径不变

### Requirement: Turn 级不可变运行配置
每个新 Turn SHALL 在开始时冻结模型 route、实际 model、service/source、preset、非秘密参数、System Prompt contribution、workspace、权限与 sandbox policy 的版本化快照。该快照 SHALL 跨 steps、retry、tool execution 和 compaction 保持不变并随历史事件保留 provenance；用户对 Profile、Prompt、preset、workspace 或权限的编辑只应用于同一 session 的下一个新 Turn。仅凭据值可按 operation 轮换，不得改变 route identity。

#### Scenario: 活动 Turn 期间修改 Prompt 或模型
- **WHEN** 用户在 Turn 执行中修改 AIO Profile、System Prompt 或 DSH preset
- **THEN** 当前 Turn 继续使用原 generation 和完整配置快照，新配置仅在下一个 Turn 生效且 Host 同时报告当前值与待应用值

#### Scenario: compaction 发生
- **WHEN** DSH 在活动 Turn 内压缩上下文
- **THEN** 压缩由 DSH 独立完成，且不会重新读取或替换该 Turn 的 AIO 配置快照

#### Scenario: 查看历史 Turn
- **WHEN** 当前 catalog 或 Profile 已发生变化
- **THEN** 历史 Turn 仍显示执行时记录的 model、service/source 和 preset，而不是用当前配置重写

```

## openspec/changes/add-dsh-host-capability-foundation/specs/dsh-runtime-lifecycle/spec.md

- Source: openspec/changes/add-dsh-host-capability-foundation/specs/dsh-runtime-lifecycle/spec.md
- Lines: 1-38
- SHA256: d23f5480d18a311118bda76ce02ee4e5f210906fded17876beacbac654950369

```md
# dsh-runtime-lifecycle Specification Delta

## MODIFIED Requirements

### Requirement: 受管生命周期、崩溃语义与 Windows 进程后端
Supervisor SHALL 管理 stopped、starting、ready、busy、stopping、crashed、unavailable、upgrading、recovering、maintenance 和 incompatible 状态，并使用 `domainGenerationId` 隔离每次启动。首发 Windows SHALL 使用 Job Object 与 DACL。DSH 意外退出后 MAY 自动恢复 runtime readiness，但 MUST NOT 自动重放活动任务、Prompt、交互响应、工具、Terminal 或动态包；受影响 Turn 和临时执行句柄 SHALL 标记为 interrupted，并由用户在新操作中显式继续。维护状态 SHALL fence 新 mutation，并区分产品不兼容、运行时故障和正式发布阻塞。

#### Scenario: 正常停止
- **WHEN** 用户停止执行域、禁用插件或退出 AIO
- **THEN** Supervisor 请求 flush/dispose，并在超时后使用平台后端回收全部后代进程

#### Scenario: 活动任务期间崩溃
- **WHEN** DSH 在 Turn 执行期间意外退出
- **THEN** 系统终结该代际所有 pending 操作、清除交互投影、标记 Turn 为 interrupted，且不自动重发 Prompt 或任何副作用

#### Scenario: 旧代际迟到输出
- **WHEN** 已停止代际产生迟到帧或退出通知
- **THEN** Supervisor 按 `domainGenerationId` 丢弃该输出，不改变新代际会话或作业状态

#### Scenario: 进入维护窗口
- **WHEN** runtime 进入 migration、health-check 或 rollback 协调过程
- **THEN** Supervisor 报告明确的 maintenance 子状态、拒绝新 mutation，并保留可恢复的 DSH session facts

### Requirement: 隔离数据、可回退升级与 POSIX 安装兼容
系统 SHALL 将受管 DSH Home/Profile、凭据镜像、桥接状态和临时文件放入插件拥有的隔离目录，并在升级失败时保留最后可用 runtime 与持久会话。任何 DSH session 数据升级 SHALL 通过对应发行版的官方迁移或打开流程执行；AIO 和插件 MUST NOT 解析、重写或自行迁移 DSH JSONL。维护前备份 SHALL 只覆盖受管 Host 数据，不得复制、覆盖或回退 workspace 源码与 Git 状态。POSIX 上 AIO ZIP 安装器 SHALL 安全保留普通文件的 Unix mode，或仅为 manifest 选中的当前平台 Native/Sidecar 二进制恢复可执行位；路径校验 MUST 保持不变并 MUST 拒绝 symlink 与特殊文件，Windows 行为不得改变。

#### Scenario: 未来 POSIX 安装并启动 Sidecar
- **WHEN** 后续平台扩展 change 启用 Linux 或 macOS 插件 ZIP 安装
- **THEN** 经 manifest 验证的 Supervisor 和必要 helper 必须具备可执行权限，且未被选中的数据文件不会被任意提升权限；此条件不构成当前 Windows 首发的支持声明

#### Scenario: 升级握手失败
- **WHEN** 新 runtime 或 bridge 无法通过校验、契约握手或冒烟测试
- **THEN** 系统回退最后可用版本，不迁移或删除原会话，并显示失败原因

#### Scenario: DSH session schema 需要迁移
- **WHEN** 新 Adapter 检测到受管 Home 使用旧 session schema
- **THEN** 它仅调用该 DSH 发行版的官方迁移路径并在失败时恢复受管数据备份，不接触 workspace 源码或 Git 状态


```
