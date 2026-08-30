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

### 7. DSH 唯一 System Prompt 组装权

bridge 仅通过公共 `system-prompt/assemble` waterfall 追加 AIO 用户 contribution。DSH identity、persona、工具指导、runtime context、仓库指令和 Skill 顺序仍由 DSH 决定。

AIO 与 bridge 不解释 VCP 占位符。固定 DSH 插值器若会拒绝 `{{Nova}}`，bridge 只对 AIO 用户段做确定、无冲突、可逆、不递归求值的内部 codec，使最终 Provider 请求逐字节恢复原文；DSH 自有 section 不编码。上游一旦提供正式 literal escape，优先迁移并删除 codec。

### 8. 双会话系统与安全边界

DSH session/log 是 coding execution 的事实源；AIO 只保存 `dshHomeId`、`sessionId`、UI 偏好和瞬态 projection。AIO session tree 与 DSH session 不合库；分叉产生新的 DSH session，避免两条分支共享可变状态。Workspace/Git 仍是文件副作用事实源。

DSH 独占权限、审批与 sandbox 裁决。默认 `workspace-write + ask`，full access 必须显式选择且不记为默认。Linux 使用 bwrap 再 Landlock，macOS 使用 Seatbelt，Windows 使用 ACL/restricted token；缺少必需 sandbox 时 fail closed，并向 UI 报告 `full`/`partial`。AIO Sidecar lifecycle 不被宣传为隔离保证。

### 9. 兼容性补丁门槛

默认不改 AIO/DSH core。只有锁定版本的可复现测试证明 public seam、配置或 adapter 无法满足已确认契约时，才能提出兼容补丁；补丁必须 additive、default-preserving、隔离、feature-gated、带回归测试、可移除并适合上游。AIO POSIX executable mode 修复已满足该门槛。其他补丁需在 build 阶段记录失败证据并回到设计审查，不得现场扩大范围。

## Risks / Trade-offs

- DSH alpha 公共契约会变化：固定版本、contract hash、capability negotiation、黑盒门禁和最后可用版本回退。
- 三平台首发扩大构建与测试成本：每平台独立 ZIP、同一契约源、原生 CI runner 和分层支持标签。
- 本地持久凭据副本扩大同用户读取面：最小镜像、ACL/mode、stale cleanup、全链路脱敏；更强 broker/vault 后置为可替换 provider。
- 自有 Cordis bridge 比 SDK transport 工作量大：只映射必要 public services，禁止复制 Agent 语义，并以 fake peers 和真实 runtime 双层测试。
- Prompt codec 对上游插值细节敏感：锁定版本、逐字节用例与官方 escape 迁移路径。
- Flatpak 权限与 DSH 嵌套沙箱可能冲突：作为独立门禁真实测试，不能以取消安全约束换取名义支持。

## Migration Plan

1. 建立独立插件仓库、工具链、协议 crate、版本/许可清单与 AIO 开发 junction。
2. 修复并验证 AIO POSIX ZIP executable mode，保证 Linux/macOS Sidecar 可启动。
3. 建立四个平台 artifact pipeline，完成固定 DSH 基线的官方 wheel 优先/源码构建回退与 provenance。
4. 实现 Supervisor 平台后端、runtime validation、lifecycle、lease 和 readiness。
5. 完成 `aio-coding` profile、Cordis bridge、协议、session/interaction/recovery。
6. 接入 Profile adapter、credential mirror、Turn snapshot、prompt contribution/codec 和 DSH sandbox 状态。
7. 在 Windows x64、Linux x64、macOS arm64 完成安装到任务执行的 release-shaped 门禁；Flatpak 和 Linux ARM64 单独定级。
8. runtime core 稳定后，由后续 `add-dsh-coding-workstation` change 实现完整 `Coding工作站` UI，再由 Phase 1B change 实现插件/Skill 生态。

## Resolved Questions

- 首个基线固定为 DSH `dsh-v0.1.2-alpha.1` / `cd5ef8148158c3a752a658978873241fdf8e2bbc`；当前使用可复现源码构建回退，官方精确 wheel 可用后优先。
- 正式首发覆盖 Windows x64、Linux x64、macOS arm64；Linux arm64 仅预览，Flatpak 单独通过兼容门禁后才声明支持。
- Phase 1 必需模型 adapter 为 VCP/OpenAI-compatible Chat Completions；其他 Provider 逐个以完整映射和黑盒测试准入。
- AIO 全局 Capability Runtime、broker/vault、DSH marketplace 和 RAG/Knowledge 均保留替换接口但不纳入本 change。
