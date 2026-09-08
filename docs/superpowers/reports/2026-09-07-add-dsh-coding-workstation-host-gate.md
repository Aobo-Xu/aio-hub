# Host 能力前置门禁报告：add-dsh-coding-workstation Task 1（重跑 v2）

- **Change**: add-dsh-coding-workstation（aio-hub，dev 分支）
- **首跑日期**: 2026-09-07（结论 `BLOCKED: no accepted Host capability change`，4 pass / 17 missing）
- **重跑日期**: 2026-09-08（add-dsh-host-capability-foundation Task 1–13 交付后）
- **任务**: OpenSpec task 10.4（host-capability change）/ 本 change OpenSpec task 1.1
- **产物语言**: zh-CN
- **结论**: **部分通过（10 pass / 11 missing / 0 incompatible）——Host Gate 未完全满足，Coding 工作站 UI 实现保持阻塞**。剩余缺口形态精确：bridge 服务层已交付并集成测试，但生产 IPC 接线（supervisor 路由 + 协议命令 + facade DTO）未覆盖 11 行。

## 1. 重跑背景与证据来源

首跑后，独立 change `add-dsh-host-capability-foundation`（full workflow）在同一插件仓链接 worktree（`.worktrees/aiohub-plugin-dsh-host-capability-foundation`，分支 `codex/add-dsh-host-capability-foundation`，基于已验收提交 `14c7648`）交付了 Task 1–13：

- 插件仓提交链：`9661fb7`（双基线）→ `c8b9117` → `91c207f`（类型化协议）→ `dc9edc7`+`662399b`（availability + MutationLedger）→ `4dca567`+`293f030`（Adapter seam + 边界守卫）→ `f6721fa`（rc.1 Adapter）→ `25a572d`（alpha.2 Adapter）→ `1d00a0a`（长期 Host）→ `83a604c`/`600e6b6`/`88037cd`（session 控制面/权威 snapshot/事件围栏）→ `5b42b9b`/`baebd2e`（interaction/attachment/diff）→ `ad1cd45`（terminal/preset/creative）→ `21610b5`（maintenance/provider seam）→ `e867c95`（执行投影）→ `6cf735e`（迁移协调）→ `97e1d08`（title provider patch）→ `48f59a3`（host bridge 生产接线收尾：build:host、cordis-plugin、interaction-broker、host_patch）
- 最终 release ZIP：`dsh-coding-workspace-0.1.0-win32-x64.zip`，SHA-256 `1f9db8f9120480e87c2cdb1e2a4bba5314532d666e1a4a2b53b7632db810eed8`；`verify-release` supported:["win32-x64"]、failures:[]
- 插件全量验证：`bun run check`（tsc + generated drift + fmt + clippy）通过；`bun run test` 180/180（37 TS 文件）+ Rust workspace 测试通过
- 生产 IPC native lane（本机隔离环境，Edge 152 driver，preview 前端，debug Tauri 二进制）：
  - `dsh-runtime-native` preset：**8/8**（production install、resident ready、lease fencing、真实 coding turn、crash interrupted 不重放、进程树清理、upgrade rollback、uninstall+数据保留）
  - `dsh-host-capability` preset（本次新增 spec）：**6/6**（production install、resident ready、lease fencing、**权威 snapshot 真实 DSH facts**、**interaction.respond 生产链路 fail-closed**、cancel、**冷恢复持久化 facts**、进程树清理）
- 证据产物：`.dev-data/dsh-hostcap-r1b/artifacts/dsh-native-e2e-result.json`、`.dev-data/dsh-hostcap-r2b/artifacts/dsh-host-capability-result.json`

## 2. 生产可达面核实（判定基准）

UI 唯一生产消费路径：AIO WebView → `sidecar_send_command` → supervisor resident 路由 → host bridge（cordis-plugin dispatch）→ rc1/alpha2 Adapter → 官方 DSH 服务。

- **supervisor resident 路由**（main.rs）：`initialize`、`shutdown`、`session.acquire`、`session.submitPrompt`、`session.steer`、`session.cancel`、`session.transferController`、`session.snapshot`、`interaction.respond`；其余方法返回 `unsupported-host-method`。
- **协议 `SessionCommand`**：Acquire / TransferController / SubmitPrompt / Cancel / Steer / Snapshot（6 变体）；通知：State / Session(Event,Snapshot) / Interaction / InteractionResolved / Overload / Resync。
- **host bridge dispatch**（cordis-plugin.ts）：initialize、capabilities、workspace.list/create、session.list/create/open、session.snapshot、session.submitPrompt、session.cancel、interaction.respond、shutdown——其中 workspace.*/session.list/open 仅 bridge 内部可达，supervisor 不转发。
- **bridge 服务层**（index.ts 公开导出、集成测试覆盖）：workspace-service、session-service、search-service、terminal-service、preset-service、dynamic-package-service、maintenance-service、session-migration、attachments（AttachmentLimits）、diffs、context-summary、presenters（normalize/execution-projection/mask）、event-normalizer、snapshot projection、interaction-broker、runtime-host（9 态生命周期）。
- **facade DTO**（types.ts）：CapabilityDescriptor / OperationAvailability / UnavailableReason / CapabilityHostError / capabilities() / availability()；SessionSnapshot 含 source:"dsh"、provenance{adapterId,releaseCommit}、workspaceId、lineage；RuntimeState 仍为 7 态。

## 3. 重跑门禁矩阵

判定值：`pass`（契约存在且生产可达或有权威证据）/ `missing`（无契约，或 bridge 层已交付但生产 IPC 不可达）/ `incompatible`。

| # | 契约行 | 首跑 | 重跑证据 | 判定 |
|---|---|---|---|---|
| R1 | Runtime 10 态（含 loading/upgrading/recovering/incompatible） | missing | bridge `runtime-host.ts` RuntimeHostState 9 态（stopped/starting/ready/maintenance/upgrading/recovering/crashed/incompatible）+ 状态机测试；但协议/facade `RuntimeState` 仍 7 态，upgrading/recovering/incompatible 不上 wire，UI 不可消费 | missing（bridge 内部已交付，wire 契约未扩展） |
| R2 | 平台支持矩阵与 per-capability 可用性 | missing | `OperationAvailability{available,reason}`（含 ENVIRONMENT_UNSUPPORTED）+ `availability()` 经 facade/supervisor 接线；InitializeResult 携 PlatformFacts；manifest host.platforms + verify-release supported 矩阵 | pass |
| R3 | 能力清单与 per-action availability | missing | `CapabilityDescriptor{capabilityId,schemaRevision,stability,mode}` + `capabilities()`；supervisor 按 capability 门禁命令，未协商 → `CAPABILITY_NOT_NEGOTIATED` fail-closed（lane 2 验证 unknown-interaction/stale-lease 拒绝） | pass |
| R4 | Workspace 列出/切换/管理投影 | missing | workspace-service + rc1 adapter workspaces.create/follow + bridge dispatch workspace.list/create 已交付并有集成测试；**supervisor 不路由 workspace.\***，UI 不可达 | missing（bridge 已交付，未接线） |
| R5 | 会话生命周期 create/rename/archive/restore/delete/fork | missing | session-service capability-gated 实现（task 5.2）+ bridge dispatch session.create/list/open；**supervisor 仅内部调用 session.create**（acquire 路径），管理操作无 resident 路由 | missing（bridge 已交付，未接线） |
| R6 | 全局会话搜索（可取消、generation 约束） | missing | search-service（task 5.3：可取消 + generation 约束 + 分页）集成测试通过；无协议命令、无 resident 路由 | missing（bridge 已交付，未接线） |
| R7 | 会话历史分页（冷水合） | missing | rc1 adapter sessions.history→官方 `sessionController.page`（rc1-adapter.test.ts 真实 rc.1 runtime 验证分页/throughSeq 边界）；bridge dispatch 与 supervisor 均不暴露 history 方法 | missing（adapter 已交付，未接线） |
| R8 | Snapshot/cursor/seq/durable facts + 缺口检测 | pass（DTO；数据占位） | **占位已替换为真实 DSH facts**：lane 2 验证 durableFacts 含 turn/start、user/message（真实 UUID+source.rpcId）、assistant/message（真实 model/provider provenance）、真实 cursor（cursor-N）/seq；冷恢复（kill→respawn）从 DSH persistence 重建同一 session facts；协议 Resync/Overload + event-normalizer 去重排序 + snapshot-plus-cursor 恢复（task 6.1/6.4 测试） | **pass（真实 DSH facts，lane 验证）** |
| R9 | 事件流（subscribe/有序/去重/generation） | pass | 维持：subscribe + RuntimeEvent + State/Resync 通知；lane 1+2 真实 turn 事件流验证；88037cd 事件围栏 | pass |
| R10 | Controller/observer 租约与代际栅栏 | pass | 维持：lane 1+2 lease fencing（duplicate acquire → lease-rejected；stale lease 拒绝）；MutationLedger exactly-once（同 requestId 重发回放、跨 generation 只拒绝） | pass |
| R11 | 审批/问题 interaction 往返 | missing | **已接线**：supervisor `interaction.respond` → host broker → 官方 ApprovalService（ctx.on waterfall + turn 包裹）；正向往返经真实 DSH 服务集成验证（rc1-adapter.test.ts：approval/asked+decided 审计对）；生产 IPC fail-closed 验证（lane 2：unknown-interaction、stale-lease 拒绝）；pending/resolved 收敛 + 防重复（stdio_abi）。限制：E2E 未触发真实 DSH 审批（headless 配置下 pwsh 直接执行，见 ledger Ruling） | pass（接线+集成正向+生产 fail-closed；E2E 正向触发限制已记录） |
| R12 | Turn 控件 submit/queue/steer/cancel/restart | missing | submit/steer/cancel 为独立协议命令且 lane 验证（真实 DSH turn + cancel accepted）；**queue/restart 无协议命令**（bridge session-service 有 queue/restart 实现但未上 wire） | missing（部分：submit/steer/cancel pass；queue/restart 未接线） |
| R13 | Presenter hints（10 类 + 通用兜底） | missing | 规范化事件 envelope 携带 workspace/session/Turn/step/tool/job/subagent identity（task 6.2，双 Adapter 确定性测试）；lane 2 facts 证实 kind+结构化 data+provenance 上 wire；normalize-presenter/mask 处理未知 kind 脱敏兜底 | pass（事件 kind+identity+脱敏兜底已接线） |
| R14 | 模型/provenance 元数据 | missing | lane 2 durableFacts：assistant/message 携 source{kind:"model",model,provider}，历史 Turn provenance 由 DSH 权威事实保留；TurnConfigSnapshot 仍为内部 DTO | pass（事件级 provenance lane 验证） |
| R15 | Preset roster 与切换规则 | missing | preset-service（task 11）bridge 层交付 + rc1 adapter presets port fail-closed（无 settled capability 不模拟）；无协议命令/facade DTO/resident 路由 | missing（bridge 已交付，未接线） |
| R16 | Creative mode 隔离代际转换 | missing | creative Host-half 经 dynamic-package-service 交付（ad1cd45）；无 wire 契约 | missing（bridge 已交付，未接线） |
| R17 | Host-half dynamic extensions 生命周期 | missing | dynamic-package-service（定义/运行/更新/停止/移除/诊断）bridge 层交付 + 集成测试；无协议命令/resident 路由 | missing（bridge 已交付，未接线） |
| R18 | 浏览器半包隔离 bridge（缺省 fail-closed） | missing（预期缺省） | 无 isolated client bridge 能力广告 → 按规范缺省即 fail-closed；dynamic-package-service 对 browser-half 无 bridge 时明确拒绝（task 11 测试）；无任何模型代码注入 renderer 路径 | **pass（明确 fail-closed）** |
| R19 | 附件限制运行时广告 | missing | attachments.ts AttachmentLimits + hash staging/cleanup（task 7.2：无效类型/数量/大小提交前失败）；限制广告无 resident 读方法，UI 不可查询 | missing（bridge 已交付，未接线） |
| R20 | 会话/工作区有界 summary | missing | context-summary.ts（provenance/遗漏/stale 元数据，不占用主上下文，task 6.5 测试）；无协议命令/resident 路由 | missing（bridge 已交付，未接线） |
| R21 | Native E2E release state | pass（分类契约） | 分类契约维持（dsh-native-gate 三态 + waiver 固定 gatePassed=false/formalReleaseBlocked=true，契约测试 33/33）；本机双 lane 14/14 通过；**GitHub 离线 CI lane 未重跑**（推送未授权），正式发布保持阻塞 | pass（分类契约）；正式发布仍阻塞 |

### 矩阵小结

- **pass：10 行**（R2、R3、R8、R9、R10、R11、R13、R14、R18、R21）——其中 R8 从"DTO 占位"升级为**真实 DSH facts 且经生产 IPC lane 验证**，R11 从"显式拒绝"升级为**全链路接线**。
- **missing：11 行**（R1、R4、R5、R6、R7、R12、R15、R16、R17、R19、R20）。
- **incompatible：0 行**。

## 4. 剩余缺口的精确形态（恢复条件）

11 个 missing 行共享同一根因，且**不是 bridge 实现缺失**：

1. **协议命令面**：`SessionCommand` 缺 workspace 管理、session 管理（rename/archive/restore/delete/fork）、search、history 分页、queue、restart、terminal、preset、dynamic-extension、attachment-limits、summary 的命令/通知变体。
2. **supervisor resident 路由**：仅 9 方法；上述操作即使 host bridge dispatch 已支持（workspace.list/create、session.list/open）也不被转发。
3. **facade wire DTO**：`RuntimeState` 未扩展 upgrading/recovering/incompatible（R1）；queue/restart、presenter 元数据、attachment limits、summary 无 facade 类型。

bridge 服务层（Tasks 5–12 交付、180/180 测试覆盖）已为接线准备好实现；缺口是**一层 wire 契约 + 路由**，属 host-capability change 计划未排期的生产接线工作（其 tasks.md 10.3 的"生产接线"范围）。

**恢复条件**：完成上述协议/路由/DTO 接线并以生产 IPC 测试逐行验证后，重跑本矩阵；R1–R17、R19–R20 全 pass 且 R18 fail-closed 时，方可勾选 host-capability 的 10.4 并解除本 change（Coding 工作站 UI）的实现冻结。

## 5. Native E2E 分类状态（R21 / 10.5）

- 本机隔离 lane（非 CI）：`dsh-runtime-native` 8/8 + `dsh-host-capability` 6/6，使用最终 ZIP `1f9db8f9…`、Edge 152 driver、隔离 app-data/artifact/webdriver 端口。
- corrupt candidate 场景在新 host-bridge 架构下失败时机前移（initialize 即启动真实 runtime → `host-initialize-failed` fail-fast），回滚/数据保留安全属性不变；spec 期望已随架构更新（接受 host-initialize-failed 为合法拒绝分类）。
- GitHub Actions 离线 lane 未重跑（向 Aobo-Xu fork 推送未授权，上游禁推）；按既定分类策略，即使基础设施豁免也保持 `gatePassed=false`、`temporaryWaiver=true`、`formalReleaseBlocked=true`。
- **正式发布保持阻塞**；本机 lane 通过不冒充 CI 门禁结果。

## 6. 证据路径汇总

- 插件仓 worktree：`E:/workspace/projects/aio-hub/.worktrees/aiohub-plugin-dsh-host-capability-foundation`（分支 `codex/add-dsh-host-capability-foundation`，HEAD `48f59a3`）
- 最终 ZIP + sha256：同 worktree `dist/dsh-coding-workspace-0.1.0-win32-x64.zip{,.sha256}`
- lane 证据：`.dev-data/dsh-hostcap-r1b/artifacts/`、`.dev-data/dsh-hostcap-r2b/artifacts/`
- 新 spec：`tests/tauri-e2e/specs/dsh-host-capability.spec.ts` + preset `dsh-host-capability`（`tests/tauri-e2e/support/presets.ts`）
- host-capability 验证报告：`docs/superpowers/reports/2026-09-08-add-dsh-host-capability-foundation-gate.md`
- 协议/facade/bridge：worktree 内 `crates/protocol/src/messages.rs`、`crates/supervisor/src/main.rs`、`packages/runtime-facade/src/types.ts`、`packages/dsh-bridge/src/**`
- 首跑报告：本文件 git 历史（ae17fbae）

## 7. 结论

Host capability change 已交付首跑时完全不存在的能力层：**10 行 pass（含 R8 真实 DSH facts 与 R11 interaction 全链路的生产 IPC lane 证据）**，较首跑 4 pass 显著推进。但 **11 行仍 missing，形态一致：bridge 服务已交付、生产 wire 接线未排期**。按本 change 计划 Task 1 Step 4 与 host-capability tasks.md 10.4 的判定规则：**Host Gate 未完全满足，本 change（Coding 工作站 UI）的实现冻结维持，OpenSpec 任务 1.1 不勾选**。缺口中无任何 incompatible 行，恢复路径明确（§4），不需要重新设计。
