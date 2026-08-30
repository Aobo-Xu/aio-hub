# Comet Design Handoff

- Change: integrate-dsh-runtime-core
- Phase: design
- Mode: compact
- Context hash: 5cb5d7556e56955b3114c8ced5fa32fac3cfa73582c01dcfd8b086f5af14751b

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/integrate-dsh-runtime-core/proposal.md

- Source: openspec/changes/integrate-dsh-runtime-core/proposal.md
- Lines: 1-35
- SHA256: fd19584e71354c662724109b72bfb942acef4cd0cc26b5fa40a3c7749c4db4a2

```md
## Why

AIO 缺少面向代码任务的完整本地执行域，而 DeepSeek Harness（DSH）已提供 Agent Loop、持久会话、工具策略、审批、沙箱、工作流与子 Agent。需要以独立插件和公开扩展点将 DSH 纳入 AIO，使其成为可销毁、可重建、受策略约束的执行域，同时保持 AIO 日常启动轻量，并避免把 DSH 内部组件拆散后形成第二套不完整实现。

## What Changes

- 建立独立的 `aiohub-plugin-dsh-workspace` 仓库，开发期通过目录联接接入 AIO；Phase 1A 交付无头 runtime core，后续 change 再提供同级工具 `Coding工作站` 的完整 UI。
- AIO 只常驻轻量 Rust Supervisor，并按需或按预热设置启动 DSH 重型子进程。DSH 继续完整拥有 Agent Loop、会话日志、上下文压缩、工具、审批、沙箱、工作流、Skill 与子 Agent。
- 使用版本化 JSONL 协议连接 Supervisor 与项目侧 TypeScript/ESM Cordis bridge，提供能力协商、单写控制租约、只读观察、代际隔离、权威快照、背压及崩溃恢复。
- AIO LLM Profile 是唯一模型配置入口。首版强制支持经过验证的 VCP/OpenAI-compatible Chat Completions 映射；其他 Provider 仅在字段和行为可无损映射且通过黑盒测试后启用。
- DSH 保持唯一 System Prompt 组装权；AIO 用户文本通过公开组装扩展点注入，`{{Nova}}` 等占位符保持字面值，并继续仅由现有 VCP 链解析。
- 发布 `win32-x64`、`linux-x64` 和 `darwin-arm64` 的独立离线 ZIP；`linux-arm64` 只发布预览产物。优先使用精确匹配且通过门禁的官方 wheel，否则从固定 DSH tag/commit 原生可复现构建并记录完整来源。
- 对 AIO 增加一个可上游化的 POSIX ZIP 安装兼容修复，以安全保留或恢复经 manifest 验证的 Sidecar 可执行位；不改变 Windows 行为。
- 不新增 AIO 全局 Capability Runtime，不改变 AIO LLM 对话运行时，不嵌入 DSH Web UI，不在本 change 实现 DSH 插件/Skill 市场或 AIO/VCP RAG 与 Knowledge 协同。

## Capabilities

### New Capabilities

- `dsh-runtime-lifecycle`: 校验、准备、按需启动、可选预热、空闲回收、停止、重启、诊断和升级隔离的 DSH 执行域，并声明各平台支持等级与沙箱状态。
- `dsh-execution-bridge`: 通过 AIO Sidecar API v3 与 DSH 公开扩展点桥接会话命令、事件、控制租约、取消、审批、用户交互和恢复。
- `dsh-model-and-prompt-sync`: 将 AIO LLM Profile、真实凭据与用户 System Prompt 映射到 Turn 级不可变 DSH 配置快照，同时保留 VCP 占位符原文并拒绝有损降级。

### Modified Capabilities

无。

## Impact

- 新增独立仓库 `E:\workspace\projects\aiohub-plugin-dsh-workspace`；AIO 中 `plugins/dsh-coding-workspace` 仅为开发联接，不提交插件源码或 runtime 二进制。
- 固定 DSH `dsh-v0.1.2-alpha.1` / `cd5ef8148158c3a752a658978873241fdf8e2bbc` 作为首个基线。当前无可固定的 `0.1.2a1` 官方 PyPI runtime/SDK wheel 或 GitHub Release 附件，因此首版允许从该官方源码基线进行项目构建；未来满足门禁的官方 wheel 自动优先。
- 普通用户不需要另装 Node.js、Python、WSL2 或 DSH；每个平台包都携带其完整、已校验的 runtime 闭包、许可证、SBOM、来源与校验和。
- `win32-x64`、glibc 2.28+ 的 `linux-x64`（AIO `.deb`/`.AppImage`）和 macOS 14+ `darwin-arm64` 为 Phase 1 支持目标；AIO Flatpak 为兼容性门禁通道，`linux-arm64` 为不宣称正式支持的预览通道。
- DSH 可在与 AIO LLM 对话相同的本地同用户信任级别接触真实密钥；密钥不得进入日志、事件、诊断、崩溃报告、会话正文或支持包。
- AIO 核心原则上不变；仅在可复现失败证明公开扩展点不足时，允许实施隔离、默认兼容、可测试且可移除的最小兼容补丁。
```

## openspec/changes/integrate-dsh-runtime-core/design.md

- Source: openspec/changes/integrate-dsh-runtime-core/design.md
- Lines: 1-123
- SHA256: b345290e51f8067a5f1caf422f255aa806a182f66686515fc61aa5d853014a2f

[TRUNCATED]

```md
## Context

AIO `dev` 已提供 Plugin API v3 Resident Sidecar、宿主上下文握手、进程 generation、原生插件 UI route、异步 job/cancel 契约，以及通过 `aiohub-sdk` 读取完整 LLM Profile 的能力。`plugins/README.md` 明确插件应独立仓库管理，`docs/guide/plugins/index.md` 则定义了 JS、Native、Sidecar 三类插件、统一 executor、配置 schema 迁移和平台清单。

DSH `dsh-v0.1.2-alpha.1`（`cd5ef8148158c3a752a658978873241fdf8e2bbc`）声明并在源码/CI 中实现 `win-x64`、`linux-x64`、`linux-arm64`、`macos-arm64` runtime 目标。当前公开持久渠道没有该精确版本的 SDK/runtime wheel 或 GitHub Release 二进制附件，因此“官方成品二进制直接打包”不能作为首版唯一来源。DSH 的 SDK stdio 又缺少取消、会话关闭和 runtime-to-host 审批等完整产品能力；启用 Web Remote API 会引入第二套 UI、HTTP/origin/auth 边界。故采用自有窄桥接，但不复制 DSH Agent 语义。

代码权威位置为独立仓库 `E:\workspace\projects\aiohub-plugin-dsh-workspace`。AIO `plugins/dsh-coding-workspace` 只作为开发 junction；生产以当前平台的独立 ZIP 安装到 AIO 插件目录。

## Goals / Non-Goals

**Goals:**

- 将 DSH 作为 AIO 托管、可销毁、可重建的完整 Coding 执行域，而非拆分成 AIO 工具。
- AIO 统一 UI、模型 Profile、工作区、设置与外层生命周期；DSH 独占 Agent Loop、持久会话、prompt、上下文/压缩、工具、安全策略、工作流与子 Agent。
- Phase 1 在 Windows x64、Linux x64 和 macOS arm64 提供离线确定性安装；Linux arm64 产出预览包。
- 以稳定协议、明确所有权、租约和快照恢复支持未来接入 AIO 全局 Capability Runtime。
- 避免 AIO/DSH 破坏兼容性变更；只有公共 seam 被可复现地证明不足时才使用最小补丁。

**Non-Goals:**

- 不嵌入、代理或复刻 DSH Web UI。
- 不改变 AIO RP-first LLM Chat 或建立全局 Capability Runtime。
- 不在 Phase 1A 提供最终 `Coding工作站` UI、DSH plugin/Skill 市场或双方插件互载。
- 不实现 VCP/AIO RAG、Knowledge、Recall 或本地文件端云同步。
- 不引入 Codex/pi runtime、Agent Loop、session store、prompt assembler、model router 或 sandbox；只吸收可独立实现的设计原则。

## Decisions

### 1. 插件本地 RuntimeFacade 与完整 DSH 执行域

`RuntimeFacade` 是 UI 唯一依赖的 TypeScript 契约，DTO 不含 Vue/Pinia 类型。它公开稳定 capability `execution-domain:dsh`，未来可注册到 AIO 全局 Capability Runtime；AIO 现有 `conversation-runtime:default` 不受影响。

DSH 使用项目拥有的 `aio-coding` profile：以官方 `dsh-base` bundle 为主体，`patchReload: startup`，最后挂载 `aio-dsh-bridge` 与部署覆盖。bridge 只做协议和 public service 映射，不装载 Web/SDK transport，不复制 Agent 逻辑。

### 2. 轻量 Rust Supervisor 与平台进程后端

AIO 启用插件后只常驻 Rust Supervisor。Supervisor 负责 AIO Sidecar v3、runtime lock 校验、受管 `DSH_HOME`、凭据原子写入、重型 DSH 启停、协议转发、generation fencing 与诊断。DSH 默认进入 Coding工作站或发起任务时启动；预热仅提前建立 readiness，不创建 session/model request。

进程后端按平台实现：

- Windows: Job Object、DACL、无额外控制台窗口。
- Linux/macOS: process group、TERM 宽限、KILL 收尾、目录 `0700`、秘密文件 `0600`。

最后 controller 释放、没有 pending job/interaction 且 DSH 权威状态静止后开始 10 分钟宽限，再依次 flush、Cordis dispose、回收进程树。预热持有到 AIO 退出。崩溃可自动恢复 runtime readiness，但绝不重放活动 Turn；用户只可在新 Turn 显式继续。

### 3. 单源版本化协议

Rust protocol crate 定义 JSONL envelope、命令/响应/notification/interaction request、JSON Schema 和 TS declarations。CI 校验生成文件及 contract hash。`initialize` 在任何 session 命令之前协商 protocol、runtime provenance、平台、sandbox 状态、stable/experimental capabilities。

每帧含 `protocolVersion`、`domainGenerationId`、连接 sequence 与领域 correlation ids。每个 DSH session 只有一个可变 controller lease，可有多个只读 observers；转移显式发生，所有写命令同时校验 generation 和 lease。

DSH durable log、start/completed facts 与 snapshot 是权威；delta 是可丢弃的展示数据。Ingress/egress queue 有界，慢消费者时合并 delta、保留终态并报告 overload。断线、gap 或 UI remount 走 snapshot-plus-cursor 恢复。interaction 结束始终发 `interaction/resolved` 清理迟到审批 UI。

### 4. Runtime 供应链与平台包

runtime lock 固定 DSH tag、commit、artifact source、toolchain、platform、hash、license、SBOM、contract/profile version。流水线先查询精确兼容的官方 wheel；只有其持久可获取且通过 release-shaped 黑盒门禁才采用。否则从固定官方源码在目标平台原生构建，明确标记 project-built。Actions 临时 artifact、源码 archive 或移动分支均不能直接作为 runtime。

每个平台发布一个 ZIP，plugin id/version/contract/profile 相同：

| Platform | Phase 1 状态 | 宿主约束 |
|---|---|---|
| `win32-x64` | Supported | Windows x64 |
| `linux-x64` | Supported | glibc 2.28+；AIO `.deb` / `.AppImage` |
| `darwin-arm64` | Supported | macOS 14+ |
| `linux-arm64` | Preview | 等待普通 AIO ARM64 桌面包与全套集成 |
| others | Unsupported | 启动前显式拒绝 |

AIO Flatpak 是 Phase 1 兼容性测试通道，不自动继承 Linux supported 标签。必须验证 executable、嵌套文件、shell、document portal、workspace 访问、bwrap/Landlock；失败则准确标为 preview/unsupported，不放宽 DSH 沙箱。

### 5. AIO POSIX 安装兼容补丁

现有 AIO ZIP installer 通过重新创建文件提取内容，没有恢复 Unix executable bits，导致 POSIX Sidecar 在启动前无法自修复。允许对 AIO 做一个通用、可上游化的最小补丁：保留安全普通文件 mode，或仅为 manifest 选择的当前平台 Native/Sidecar executable 和必要 helper 恢复执行位。原有 path traversal 校验必须保留，并拒绝 symlink/special file；Windows 行为不变。Linux/macOS 增加 install-and-launch 测试。

### 6. AIO Profile、凭据与 Turn 快照

`AioProfileAdapter` 采用 allowlist。Phase 1 强制完成 VCP/OpenAI-compatible Chat Completions 映射；其他 Provider 只有请求、stream、reasoning、tool call、错误、取消、headers 和扩展字段可无损映射且有黑盒测试时才启用。未知字段或行为直接拒绝，不靠名称猜测、不静默丢字段。

在当前 AIO 没有通用模型 broker/secret vault 的前提下，Supervisor 在插件 `DSH_HOME` 中通过官方 credential seam 维护最小凭据镜像。写入原子替换，Windows 用 owner DACL，POSIX 用 `0600`；切换或解绑清除 stale refs。普通事件只含 opaque refs，所有日志、stderr、环境、崩溃与支持包统一脱敏。未来 AIO broker/vault 可替换 `ModelTransport`/`CredentialProvider`，不改变 UI 或 DSH session。

每个 Turn 开始时冻结 route/model/non-secret parameters、用户 prompt contribution、workspace 和 permission/sandbox policy；该 generation 跨 step、retry、tool 和 compaction 不变。修改只影响同 session 的下一个 Turn。凭据值允许按模型 operation 轮换，但 route identity 不变。
```

Full source: openspec/changes/integrate-dsh-runtime-core/design.md

## openspec/changes/integrate-dsh-runtime-core/tasks.md

- Source: openspec/changes/integrate-dsh-runtime-core/tasks.md
- Lines: 1-59
- SHA256: ca5fcf0d2c13a80d9ded3fbf117aa26e9e4639eb79bc686456c64d220260e9fa

```md
## 1. Repository, contracts, and packaging foundation

- [ ] 1.1 Initialize `aiohub-plugin-dsh-workspace` as an independent repository with license, contribution guidance, pinned Rust/Node/Bun/DSH toolchains, and an AIO `AGENTS.md` derived from the plugin template.
- [ ] 1.2 Add idempotent scripts for creating/removing the development junction at `aio-hub/plugins/dsh-coding-workspace` without committing plugin files to AIO.
- [ ] 1.3 Define the Plugin API v3 Sidecar manifest, plugin-local `RuntimeFacade`, stable `execution-domain:dsh` capability descriptor, and platform-neutral DTO package.
- [ ] 1.4 Define the Rust protocol crate as the single contract source; generate JSON Schema and TypeScript declarations, calculate a contract hash, and add generated-file drift checks.

## 2. Reproducible DSH runtime supply chain

- [ ] 2.1 Pin DSH `dsh-v0.1.2-alpha.1` / `cd5ef8148158c3a752a658978873241fdf8e2bbc` in a versioned runtime lock with platform, provenance, toolchain, checksum, license, SBOM, profile, contract, and supported AIO ranges.
- [ ] 2.2 Implement official exact-wheel discovery and verification, with native reproducible source-build fallback that is explicitly labeled project-built.
- [ ] 2.3 Build fully offline per-platform ZIPs for `win32-x64`, glibc 2.28+ `linux-x64`, and macOS 14+ `darwin-arm64`; build a separately labeled `linux-arm64` preview ZIP.
- [ ] 2.4 Reject temporary CI artifacts, moving refs, wrong architecture, missing helpers, checksum mismatch, unsupported licenses, and runtime/profile/contract incompatibility before packaging or startup.
- [ ] 2.5 Add release-shaped black-box gates for each artifact using an installed runtime, clean plugin data directory, mock model Provider, provenance verification, and SBOM/license checks.

## 3. Minimal AIO POSIX installer compatibility patch

- [ ] 3.1 Add a failing Linux/macOS test demonstrating that ZIP-installed manifest-selected Sidecar binaries lose executable permission under the current installer.
- [ ] 3.2 Implement the narrow installer fix that preserves safe regular-file mode or restores executable permission only for validated current-platform Native/Sidecar executables and required helpers.
- [ ] 3.3 Retain path traversal validation, reject symlinks/special files, keep Windows behavior unchanged, and add install-and-launch regressions for Linux/macOS.

## 4. Cross-platform Supervisor lifecycle

- [ ] 4.1 Implement stdout-pure Sidecar v3 initialization, runtime validation, health/readiness, structured diagnostics, stable/experimental capability negotiation, and generation fencing.
- [ ] 4.2 Derive a plugin-owned DSH Home from `AIOHUB_PLUGIN_DATA_DIR`; create data, session, credential, runtime, log, and temp boundaries with Windows DACL and POSIX `0700`/`0600` modes.
- [ ] 4.3 Implement Windows Job Object/DACL and Linux/macOS process-group TERM/KILL backends with bounded shutdown, full descendant cleanup, non-ASCII/long path support, and no console leakage.
- [ ] 4.4 Implement stopped, starting, ready, busy, stopping, crashed, and unavailable states with idempotent operations and `domainGenerationId` isolation.
- [ ] 4.5 Implement on-demand start, optional prewarm without session/model activity, authoritative quiescence checks, controller/prewarm leases, 10-minute idle grace, flush/dispose, and process-tree teardown.
- [ ] 4.6 Implement crash-loop protection and interrupted-Turn recovery that may restore readiness but never automatically replays prompts, model calls, or tool effects.
- [ ] 4.7 Disable DSH telemetry by default and ensure support diagnostics redact credentials, authorization headers, query secrets, environment data, child output, crash records, and credential documents.

## 5. Full DSH execution-domain bridge

- [ ] 5.1 Add the managed `aio-coding` profile over `dsh-base` using public Cordis composition and project patch; load no Web UI or competing SDK stdio transport.
- [ ] 5.2 Implement JSONL initialize, command/response/notification/interaction frames with protocol version, contract hash, generation, sequence, and DSH-native correlation identifiers.
- [ ] 5.3 Implement one mutable controller lease per session, read-only observers, explicit transfer/release, and generation-plus-lease fencing for all mutations and interaction responses.
- [ ] 5.4 Bridge session create/resume/list/search/history/prompt/cancel/steer/fork/queue/rename/model/workspace operations through public DSH services.
- [ ] 5.5 Bridge lifecycle, message, reasoning, tool, workflow, sub-agent, context, compaction, error, approval, and user-question events while preserving DSH durable facts.
- [ ] 5.6 Implement authoritative snapshot-plus-cursor recovery, duplicate/gap handling, UI remount recovery, bounded queues, disposable delta coalescing, overload diagnostics, and reconnect backoff.
- [ ] 5.7 Implement interaction correlation and terminal `interaction/resolved` cleanup for allow, deny, answer, cancel, timeout, lease transfer, Turn cancellation, and domain restart.

## 6. AIO model, credential, prompt, and policy integration

- [ ] 6.1 Implement explicit versioned `AioProfileAdapter` validation and the mandatory VCP/OpenAI-compatible Chat Completions mapping, including Base URL, model, headers, stream/tool/error/cancel semantics, and unsupported-field diagnostics.
- [ ] 6.2 Add other Provider adapters only with complete mappings and black-box tests; forbid name-based routing, inferred endpoints, silent field dropping, and heuristic fallback.
- [ ] 6.3 Implement atomic minimal credential mirror writes through the official DSH seam, owner-only ACL/modes, per-operation key rotation, stale-reference cleanup, and user-triggered mirror clearing.
- [ ] 6.4 Implement Turn-start immutable snapshots for route/model/parameters, System Prompt contribution, workspace, permission, and sandbox policy; apply edits only to the next Turn in the same session.
- [ ] 6.5 Inject the user System Prompt contribution through DSH's public assembly waterfall while keeping DSH's identity, tool, runtime, repository, and Skill assembly authority intact.
- [ ] 6.6 Implement and byte-test the scoped literal-placeholder codec for `{{Nova}}` and edge cases only if required by the pinned DSH interpolator; prefer and migrate to an upstream literal escape when available.
- [ ] 6.7 Set default policy to `workspace-write + ask`, require explicit non-persistent full access, expose DSH sandbox `full`/`partial`, and fail closed when required platform sandbox support is unavailable.

## 7. Verification, compatibility, and release readiness

- [ ] 7.1 Add unit/property tests for contract generation, lifecycle transitions, leases, generation fencing, path isolation, ACL/modes, redaction, profile mapping, prompt codec, Turn snapshots, event sequencing, and backpressure.
- [ ] 7.2 Add deterministic fake-AIO/fake-DSH contract tests for cancellation, approvals, questions, controller transfer, reconnect, gaps, overload, crash, cold resume, and stale frames.
- [ ] 7.3 Add native end-to-end tests on Windows x64, Linux x64, and macOS arm64 covering clean ZIP install, offline cold start, mock-provider coding Turn, descendants, flush, crash interruption, resume, upgrade, rollback, uninstall, and data preservation.
- [ ] 7.4 Add AIO `.deb` and `.AppImage` tests on glibc 2.28+; run a distinct Flatpak matrix for executable, nested filesystem, shell, document portal, workspace access, bwrap/Landlock, and accurate support diagnostics.
- [ ] 7.5 Run Linux ARM64 preview artifact tests without promoting it to supported until a normal AIO ARM64 desktop host and complete native integration lane exist.
- [ ] 7.6 Document platform matrix, installation, development junction, runtime provenance, trust/sandbox boundaries, model compatibility, diagnostics, recovery, data retention, and the future Capability Runtime/model broker replacement interfaces.
```

## openspec/changes/integrate-dsh-runtime-core/specs/dsh-execution-bridge/spec.md

- Source: openspec/changes/integrate-dsh-runtime-core/specs/dsh-execution-bridge/spec.md
- Lines: 1-82
- SHA256: a2edede1dcbdb11c773f1f79047c9799d4f8a8f3d5740a10561afb3c24061871

[TRUNCATED]

```md
## ADDED Requirements

### Requirement: 公开扩展点上的完整无头执行域
桥接层 SHALL 作为项目侧 TypeScript/ESM DSH Cordis 插件运行，使用 DSH 公开的 Gateway、Session Controller、Workspace Controller、settings、credentials、prompt 和交互服务。桥接层 MUST NOT 修改或复制 Agent Loop、会话持久化、上下文压缩、工具策略、审批、沙箱、工作流、Skill、子 Agent，也不得启动 DSH Web UI。

#### Scenario: 桥接启动
- **WHEN** 受管 `aio-coding` Profile 完成 Cordis Loader settlement
- **THEN** 桥接才公布就绪状态、runtime provenance、sandbox 状态和版本化能力清单

#### Scenario: 公开服务缺失
- **WHEN** 固定 DSH 版本未提供任一必需公共服务或行为契约
- **THEN** 桥接拒绝就绪并列出缺失项，不导入私有模块或静默实现替代 Agent 行为

### Requirement: 单一契约源与初始化协商
Supervisor 与 DSH bridge SHALL 使用 JSONL 帧通信。Rust 协议 crate SHALL 是 schema 的单一编辑源，并生成 JSON Schema 与 TypeScript declarations；CI SHALL 验证生成物和 contract hash。接受会话命令前 MUST 完成 `initialize`，交换协议版本、runtime build/provenance、平台事实，以及默认启用的 stable 与需显式协商的 experimental capability。

#### Scenario: 兼容初始化
- **WHEN** 两端主版本、contract hash 和必需 stable capabilities 兼容
- **THEN** 系统返回协商后的能力集合并接受仅属于该集合的命令

#### Scenario: 契约不兼容
- **WHEN** 主版本、contract hash 或必需 capability 不兼容
- **THEN** 系统拒绝执行域就绪，保留最后可用 runtime，并返回结构化诊断

### Requirement: 控制租约与代际栅栏
每个 DSH session SHALL 同时最多有一个可变 controller lease，并 MAY 有多个只读 observer。控制权转移 MUST 显式执行。所有可变命令和交互响应 MUST 携带当前 `domainGenerationId` 与 `leaseId`；每条帧还 SHALL 携带协议版本、单调连接序号，以及可用的 DSH `sessionId`、Turn、step、tool call、job 或 sub-agent 标识。

#### Scenario: 第二个窗口打开同一会话
- **WHEN** 一个 session 已有 controller 而另一 AIO 视图打开它
- **THEN** 新视图只获得 observer 权限，除非当前 controller 显式转移或释放租约

#### Scenario: 迟到写操作
- **WHEN** 命令携带旧 `domainGenerationId` 或过期 `leaseId`
- **THEN** Supervisor 拒绝该命令且不触达 DSH

### Requirement: 完整会话控制契约
桥接 SHALL 提供创建、列出、搜索、恢复、读取历史、提交 Prompt、取消、steer、队列控制、分叉、重命名、模型选择和工作区关联能力；每项能力 SHALL 映射到 DSH 公共控制服务。DSH durable session 与日志是执行事实源，AIO 只保存引用和 UI 偏好。

#### Scenario: 恢复冷会话
- **WHEN** AIO 打开只存在于 DSH 持久化中的会话
- **THEN** 桥接使用 DSH 冷读取/恢复能力返回权威历史投影，不创建重复会话

#### Scenario: 分叉已完成 Turn
- **WHEN** 用户从已完成 Turn 分叉
- **THEN** DSH 创建携带正确 lineage 的新 session；AIO 仅保存新引用，且两个分支不共享可变 session

#### Scenario: 取消活动任务
- **WHEN** controller 取消活动 Turn
- **THEN** 桥接调用 DSH 官方取消能力并持续转发状态，直到权威终态或执行域断开

### Requirement: 权威快照、可丢弃增量与有界背压
DSH 的 durable events、开始/完成事实和 snapshots SHALL 是恢复依据；文本、reasoning 和进度 delta MAY 被合并或丢弃，且不得成为唯一事实。桥接 SHALL 使用有界 ingress/egress queue、过载诊断、重连退避及 snapshot-plus-cursor 恢复。检测到事件缺口、重复、代际变化或 UI remount 时，AIO MUST 以权威快照重建后再应用连续增量。

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
桥接 SHALL 将 DSH runtime-to-host approval 和 user-question request 作为带 correlation id 的 interaction 转发给 AIO，并 SHALL 将 controller 的 allow、deny、answer、cancel 或 timeout 结果只完成一次。DSH 始终保留最终策略裁决权；interaction 结束时必须发送 `interaction/resolved` 清除所有 UI 投影。

#### Scenario: 用户批准一次操作
- **WHEN** DSH 请求审批且当前 controller 选择单次允许
- **THEN** 桥接只完成匹配 generation、lease 和 correlation id 的等待请求一次，并由 DSH 决定操作是否继续

#### Scenario: 请求在响应前失效
- **WHEN** Turn 取消、租约转移、执行域重启或 DSH 撤回 interaction
- **THEN** 所有观察视图收到 resolved 通知，迟到响应被拒绝且不得作用到新请求

### Requirement: 可迁移的 RuntimeFacade
AIO UI SHALL 只依赖插件本地、无 Vue/Pinia 类型的 `RuntimeFacade` 和版本化 DTO。Facade SHALL 以稳定 capability id `execution-domain:dsh` 描述执行域，并保持可被未来 AIO 全局 Capability Runtime 注册或替换；它 MUST NOT 替换或冒充 AIO RP-first `conversation-runtime:default`。

#### Scenario: 未来接入全局 Capability Runtime
```

Full source: openspec/changes/integrate-dsh-runtime-core/specs/dsh-execution-bridge/spec.md

## openspec/changes/integrate-dsh-runtime-core/specs/dsh-model-and-prompt-sync/spec.md

- Source: openspec/changes/integrate-dsh-runtime-core/specs/dsh-model-and-prompt-sync/spec.md
- Lines: 1-75
- SHA256: 75015151770fa9785cbdd5093e63367a18d04aaaf55545988fecf91ef7d9bb8e

```md
## ADDED Requirements

### Requirement: AIO 是唯一模型配置入口
系统 SHALL 只允许用户从 AIO 已启用的 LLM Profile 中为 Coding工作站选择模型，并 SHALL 通过 `aiohub-sdk` 公共能力读取同步输入；不得暴露 DSH 自有模型设置 UI。`AioProfileAdapter` SHALL 使用显式、版本化、可验证的映射，Phase 1 的必需映射为 VCP/OpenAI-compatible Chat Completions。

#### Scenario: 选择 VCP/OpenAI-compatible Profile
- **WHEN** Profile 的 Base URL、Bearer 凭据、model、headers 和 Chat Completions 语义可完整映射
- **THEN** adapter 生成精确 DSH route、credential ref 与 capability 声明，并在启动前通过验证

#### Scenario: 其他 Provider 映射已完整验证
- **WHEN** Anthropic、Gemini、DeepSeek 或其他 Provider 的请求、流、错误、取消、tool call 和扩展字段均有明确映射及黑盒测试
- **THEN** 系统可通过独立 adapter 启用该 Provider，而不改变默认 VCP/OpenAI-compatible 路径

### Requirement: 不允许启发式或有损降级
系统 MUST 对无法无损映射的 Provider、认证方式、请求字段或响应语义明确拒绝。Provider 名称相似、未知字段、默认 endpoint 或静默丢字段均不得作为 fallback。

#### Scenario: Profile 含未支持字段
- **WHEN** 所选 Profile 包含会影响请求行为但 adapter 未声明支持的字段
- **THEN** 系统禁止启动该配置并列出字段级不兼容原因

#### Scenario: Provider 名称相似
- **WHEN** Profile 名称看似兼容但 protocol/auth semantics 不匹配
- **THEN** 系统不改用相似 adapter，也不将请求发送到猜测的 endpoint

### Requirement: 真实凭据的受控镜像
DSH MAY 在与 AIO LLM 对话相同的本地同用户信任级别接触所选 Profile 的真实凭据。Supervisor SHALL 通过 atomic replacement 在插件拥有的 DSH Home 中维护最小凭据镜像，POSIX 使用 owner-only mode，Windows 使用 owner DACL，并在 Profile 切换、解绑或用户清除时移除 stale reference。常规协议只携带 opaque Profile/credential reference；日志、事件、环境转储、child stdout/stderr、崩溃报告和支持包 MUST 全面脱敏。

#### Scenario: 启动需要真实密钥的 Profile
- **WHEN** 用户选择含真实 key 的兼容 Profile
- **THEN** Supervisor 原子写入仅当前 route 所需的 DSH 官方 credential record，并仅向 UI 返回 configured/引用/脱敏状态

#### Scenario: 活动 Turn 期间轮换 key 值
- **WHEN** 同一 route identity 的 key 被 AIO 更新
- **THEN** DSH 可按官方 per-operation credential seam 在下一次模型操作读取新值，而 Turn 的 route identity、model 与参数快照保持不变

#### Scenario: 凭据同步失败
- **WHEN** 安全写入、ACL/mode 设置或 DSH credential validation 失败
- **THEN** 系统停止启动并返回引用级诊断，错误内容不包含 key 值

### Requirement: DSH 独占 System Prompt 组装
DSH SHALL 保持 System Prompt 的唯一组装权。系统 MAY 通过 DSH 公共 `system-prompt/assemble` 扩展点追加 AIO 用户段，但 MUST NOT 复制、替换或重排 DSH identity、工具指导、runtime context 和项目指令。AIO 与 bridge MUST NOT 解释 VCP 模板语义。

#### Scenario: 注入 AIO 用户段
- **WHEN** 用户为 Coding工作站配置 System Prompt 文本
- **THEN** bridge 通过公共 seam 将其作为独立 contribution 交给 DSH，并由 DSH 生成最终 System Prompt

#### Scenario: 公共 seam 不足
- **WHEN** 可复现测试证明固定 DSH 版本无法通过公共 seam 保持所需文本或顺序
- **THEN** 团队先记录失败证据；仅允许采用隔离、默认兼容、带开关、可移除且可上游化的最小兼容补丁

### Requirement: VCP 占位符字面保真
用户注入段中的 `{{Nova}}` 等完整双花括号组 MUST 在交给模型 Provider 的最终文本中逐字节不变，并继续只由现有 VCP backend 解析。桥接 MUST NOT 新增 VCP Agent 解析器。若固定 DSH 插值器无法直接保留字面值，桥接 MAY 仅对 AIO 用户段使用确定、无冲突、可逆且不递归求值的内部编码；DSH 自有 prompt section 不得经过该编码。

#### Scenario: 使用 VCP Agent 占位符
- **WHEN** AIO 用户段包含 `{{Nova}}`
- **THEN** DSH 最终模型请求仍包含完全相同字节，且本地不读取 Nova 或展开其语义

#### Scenario: 畸形或重复花括号
- **WHEN** 输入包含重复、相邻或未闭合花括号
- **THEN** codec 仅处理完整组，其余文本保持 DSH 既有字面规则，并通过逐字节回归测试

#### Scenario: 上游提供正式 escape
- **WHEN** 后续固定 DSH 版本提供可验证的字面量 escape
- **THEN** adapter 优先迁移到官方能力并移除本地 codec，不改变用户输入或 VCP 行为

### Requirement: Turn 级不可变运行配置
每个新 Turn SHALL 在开始时冻结模型 route、model、非秘密参数、System Prompt contribution、workspace、权限与 sandbox policy 的版本化快照。该快照 SHALL 跨 steps、retry、tool execution 和 compaction 保持不变；用户对 Profile、Prompt、workspace 或权限的编辑只应用于同一 session 的下一个新 Turn。仅凭据值可按 operation 轮换，不得改变 route identity。

#### Scenario: 活动 Turn 期间修改 Prompt 或模型
- **WHEN** 用户在 Turn 执行中修改 AIO Profile 或 System Prompt
- **THEN** 当前 Turn 继续使用原 generation，新配置仅在下一个 Turn 生效且 UI 显示两者代际

#### Scenario: compaction 发生
- **WHEN** DSH 在活动 Turn 内压缩上下文
- **THEN** 压缩由 DSH 独立完成，且不会重新读取或替换该 Turn 的 AIO 配置快照
```

## openspec/changes/integrate-dsh-runtime-core/specs/dsh-runtime-lifecycle/spec.md

- Source: openspec/changes/integrate-dsh-runtime-core/specs/dsh-runtime-lifecycle/spec.md
- Lines: 1-87
- SHA256: 5e064a600ec0f44a4361a61fc067f73e7a7d46e3351edf4f00b1a4b2bb0cb304

[TRUNCATED]

```md
## ADDED Requirements

### Requirement: 可复现且离线的多平台运行时
系统 SHALL 为每个目标平台发布独立 ZIP，并携带固定 DSH 版本、commit、runtime 闭包、来源类型、构建工具链、SHA-256、许可证与 SBOM。构建流水线 SHALL 优先采用精确兼容且通过门禁的官方平台 wheel；不存在时 MAY 从固定官方 tag/commit 原生构建，并 MUST 将产物标记为项目构建而非上游发布。用户首次启动 MUST NOT 下载 runtime，也不得要求系统已安装 Node.js、Python、WSL2 或 DSH。

#### Scenario: 官方 wheel 可用
- **WHEN** 精确版本和平台的官方 wheel 可下载且通过来源、完整性、许可证与黑盒测试
- **THEN** 发布流水线选择该 wheel，并在 runtime lock 中记录不可变来源和哈希

#### Scenario: 官方 wheel 缺失
- **WHEN** 固定 DSH 基线没有可持久获取的目标平台官方 wheel
- **THEN** 发布流水线使用固定 tag/commit 和声明工具链原生构建，记录构建来源、工具链、哈希、SBOM 与许可证，并运行同一套 release-shaped 黑盒测试

#### Scenario: 运行时被篡改
- **WHEN** runtime 实际校验和、契约哈希或平台描述与 lock 不一致
- **THEN** Supervisor 拒绝执行，保持工作区和持久会话不变，并返回不含秘密的修复诊断

### Requirement: 明确的平台支持矩阵
Phase 1 SHALL 完整支持 `win32-x64`、glibc 2.28+ 的 `linux-x64` 和 macOS 14+ 的 `darwin-arm64`。`linux-arm64` MAY 发布预览 ZIP，但 MUST NOT 在普通 AIO Linux arm64 桌面宿主和全套集成测试存在前宣称正式支持。其他平台 SHALL 明确失败，不得选择名称相近的 runtime。

#### Scenario: AIO Linux 正式包启动
- **WHEN** 用户从 AIO `.deb` 或 `.AppImage` 在满足 glibc 基线的 `linux-x64` 主机启动 Coding工作站
- **THEN** 系统选择 `linux-x64` runtime 并通过与 Windows/macOS 相同的协议、生命周期和安全门禁

#### Scenario: Flatpak 环境
- **WHEN** Coding工作站运行于 AIO Flatpak
- **THEN** 系统先验证 Sidecar 执行、嵌套文件系统、shell、document portal、workspace 权限及 DSH sandbox；任一必需项失败时显示 unsupported/preview 诊断，不为获得支持标签而放宽沙箱

#### Scenario: Linux ARM64 预览包
- **WHEN** 用户检查 `linux-arm64` 构建产物
- **THEN** 产物标记为 preview，并说明尚无普通 AIO Linux ARM64 桌面发行与完整宿主集成保证

#### Scenario: 未支持平台
- **WHEN** 平台为 `darwin-x64`、`win32-arm64` 或其他未列入支持矩阵的组合
- **THEN** 系统在执行前明确拒绝，并报告可用平台，不尝试跨架构或降级运行

### Requirement: 轻量启动、可选预热与空闲回收
启用插件后，AIO SHALL 只常驻轻量 Supervisor。重型 DSH 子进程 SHALL 在用户进入 Coding工作站或发起任务时按需启动；启用预热时 MAY 使用最近一次有效配置启动，但不得创建会话或发起模型请求。最后一个控制租约释放且 DSH 报告权威静止后，系统 SHALL 等待 10 分钟空闲宽限，再依次 flush、Cordis dispose 和终止进程树；预热租约持续到 AIO 退出。

#### Scenario: 默认启动 AIO
- **WHEN** 用户未启用预热并启动 AIO
- **THEN** DSH 保持停止，AIO 日常启动不等待重型执行域初始化

#### Scenario: 预热配置有效
- **WHEN** 用户启用预热且最近配置仍兼容
- **THEN** Supervisor 后台启动 DSH 并报告 readiness，但不创建 Agent session 或模型调用

#### Scenario: 达到空闲回收条件
- **WHEN** 最后一个控制租约已释放、没有 pending interaction/job，且 DSH 权威状态持续静止 10 分钟
- **THEN** Supervisor 有界地刷新持久化、dispose Cordis 并回收完整进程树

### Requirement: 受管生命周期、崩溃语义与平台进程后端
Supervisor SHALL 管理 stopped、starting、ready、busy、stopping、crashed 和 unavailable 状态，并使用 `domainGenerationId` 隔离每次启动。Windows SHALL 使用 Job Object 与 DACL；Linux/macOS SHALL 使用进程组和有界 TERM/KILL。DSH 意外退出后 MAY 自动恢复 runtime readiness，但 MUST NOT 自动重放活动任务；受影响 Turn SHALL 标记为 interrupted，并由用户在新 Turn 中显式继续。

#### Scenario: 正常停止
- **WHEN** 用户停止执行域、禁用插件或退出 AIO
- **THEN** Supervisor 请求 flush/dispose，并在超时后使用平台后端回收全部后代进程

#### Scenario: 活动任务期间崩溃
- **WHEN** DSH 在 Turn 执行期间意外退出
- **THEN** 系统终结该代际所有 pending 操作、清除交互投影、标记 Turn 为 interrupted，且不自动重发 Prompt 或工具操作

#### Scenario: 旧代际迟到输出
- **WHEN** 已停止代际产生迟到帧或退出通知
- **THEN** Supervisor 按 `domainGenerationId` 丢弃该输出，不改变新代际会话或作业状态

### Requirement: 权威沙箱与显式安全状态
DSH SHALL 保持工具权限、审批和沙箱的唯一裁决权。Linux SHALL 优先使用 bwrap、再使用 Landlock；macOS SHALL 使用 Seatbelt；Windows SHALL 使用 ACL/受限 token 能力。必需沙箱不可用时执行 SHALL fail closed，UI SHALL 明确显示 `full` 或 `partial` 隔离状态，不得把 Sidecar 生命周期机制描述为安全沙箱。

#### Scenario: 必需沙箱不可用
- **WHEN** 当前平台无法建立所选权限模式要求的 DSH 沙箱
- **THEN** 执行域拒绝启动任务并提供平台诊断，不静默切换到 unrestricted

#### Scenario: 默认权限
- **WHEN** 用户首次启动任务且未选择更高权限
- **THEN** DSH 使用 `workspace-write + ask`；危险 full access 必须单次显式选择且不得记为默认值

### Requirement: 隔离数据、可回退升级与 POSIX 安装兼容
系统 SHALL 将 DSH Home、凭据镜像、桥接状态和临时文件放入插件拥有的隔离目录，并在升级失败时保留最后可用 runtime 与持久会话。POSIX 上 AIO ZIP 安装器 SHALL 安全保留普通文件的 Unix mode，或仅为 manifest 选中的当前平台 Native/Sidecar 二进制恢复可执行位；路径校验 MUST 保持不变并 MUST 拒绝 symlink 与特殊文件，Windows 行为不得改变。

```

Full source: openspec/changes/integrate-dsh-runtime-core/specs/dsh-runtime-lifecycle/spec.md

