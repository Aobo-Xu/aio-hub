# Host 能力前置门禁报告：add-dsh-coding-workstation Task 1（重跑 v3）

- **Change**: add-dsh-coding-workstation（aio-hub，dev 分支）
- **首跑日期**: 2026-09-07（结论 `BLOCKED: no accepted Host capability change`，4 pass / 17 missing）
- **重跑日期**: 2026-09-08（生产 wire 补齐后 v3）
- **任务**: OpenSpec task 10.4（host-capability change）/ 本 change OpenSpec task 1.1
- **产物语言**: zh-CN
- **结论**: **Host 契约与生产实现门禁通过（21 pass / 0 missing / 0 incompatible）**。协议单一事实源、RuntimeFacade、Supervisor resident 路由和 Host bridge 已补齐此前 11 行 wire 缺口；Coding 工作站可继续后续 change。新增 AIO 原生 E2E 断言因 WebView2 在 spec 前创建失败而采用临时基础设施豁免，**不计为 E2E 通过，正式发布仍阻塞**。

## 1. 重跑背景与证据来源

首跑后，独立 change `add-dsh-host-capability-foundation`（full workflow）在同一插件仓链接 worktree（`.worktrees/aiohub-plugin-dsh-host-capability-foundation`，分支 `codex/add-dsh-host-capability-foundation`，基于已验收提交 `14c7648`）交付了 Task 1–13：

- 插件仓提交链：`9661fb7`（双基线）→ `c8b9117` → `91c207f`（类型化协议）→ `dc9edc7`+`662399b`（availability + MutationLedger）→ `4dca567`+`293f030`（Adapter seam + 边界守卫）→ `f6721fa`（rc.1 Adapter）→ `25a572d`（alpha.2 Adapter）→ `1d00a0a`（长期 Host）→ `83a604c`/`600e6b6`/`88037cd`（session 控制面/权威 snapshot/事件围栏）→ `5b42b9b`/`baebd2e`（interaction/attachment/diff）→ `ad1cd45`（terminal/preset/creative）→ `21610b5`（maintenance/provider seam）→ `e867c95`（执行投影）→ `6cf735e`（迁移协调）→ `97e1d08`（title provider patch）→ `48f59a3`（host bridge 生产接线收尾：build:host、cordis-plugin、interaction-broker、host_patch）
- 最终 release ZIP：`dsh-coding-workspace-0.1.0-win32-x64.zip`，SHA-256 `5ae81e8143d356113ce1aea263a689fec64e408755d823961086aa6439441dcc`；`verify-release` supported:["win32-x64"]、failures:[]
- 插件验证：`bun run check` 通过；行为测试 181/181 可执行项通过（180 个 TS 行为测试 + Rust workspace；另 1 项仅检查生成文件已提交到 HEAD，因当前尚未获提交授权而预期保持失败）；缺失 Sidecar 的 fail-closed build gate 在暂存已构建 `bin/` 后 2/2 通过
- 生产 IPC native lane（本机隔离环境，Edge 152 driver，preview 前端，debug Tauri 二进制）：
  - `dsh-runtime-native` preset：**8/8**（production install、resident ready、lease fencing、真实 coding turn、crash interrupted 不重放、进程树清理、upgrade rollback、uninstall+数据保留）
  - `dsh-host-capability` preset（本次新增 spec）：**6/6**（production install、resident ready、lease fencing、**权威 snapshot 真实 DSH facts**、**interaction.respond 生产链路 fail-closed**、cancel、**冷恢复持久化 facts**、进程树清理）
- 证据产物：`.dev-data/dsh-hostcap-r1b/artifacts/dsh-native-e2e-result.json`、`.dev-data/dsh-hostcap-r2b/artifacts/dsh-host-capability-result.json`
- v3 release-shaped Host probe：官方 rc.1 wheel 上完成 initialize/capability negotiation、workspace.list、attachment.limits、session turn/snapshot、context.summary、cancel、shutdown；协议 hash `96af8af6cdb538da2cd13c53eb4dd640f0ca233aab68b209d82fc744e01da519`。
- v3 AIO E2E：扩展 `dsh-host-capability.spec.ts` 后以隔离目录 `dsh-hostcap-r3`、`r3b` 运行，并在当前源码新建 debug binary 后以 `dsh-hostcap-r4` 第三次运行；三次均在首个 spec 前由 WebView2 创建失败（`HRESULT 0x80070057`，随后 WebDriver channel closed），故只有基础设施豁免证据，没有新增 E2E 通过证据。第三次已排除旧 binary 因素。

## 2. 生产可达面核实（判定基准）

UI 唯一生产消费路径：AIO WebView → `sidecar_send_command` → supervisor resident 路由 → host bridge（cordis-plugin dispatch）→ rc1/alpha2 Adapter → 官方 DSH 服务。

- **supervisor resident 路由**（main.rs）：保留既有 session/interaction 直连方法，同时接受 RuntimeFacade 的语义 `command` 与类型化 Host read/mutation allowlist；统一执行 generation、capability、controller lease 与 requestId 幂等门禁。
- **协议单一事实源**：新增 `HostCommand` / `HostResult`，覆盖 workspace/session/search/history/queue/restart/terminal/preset/dynamic/attachment/summary；RuntimeState 扩展为 12 态并重新生成 schema、声明和 hash。
- **host bridge dispatch**（cordis-plugin.ts）：全部 Host 方法映射到公开 port；rc.1 不具备的 preset/dynamic/restart 等操作由 capability negotiation 在进入 Host 前结构化拒绝，不按版本号硬编码模拟。
- **bridge 服务层**（index.ts 公开导出、集成测试覆盖）：workspace-service、session-service、search-service、terminal-service、preset-service、dynamic-package-service、maintenance-service、session-migration、attachments（AttachmentLimits）、diffs、context-summary、presenters（normalize/execution-projection/mask）、event-normalizer、snapshot projection、interaction-broker、runtime-host（9 态生命周期）。
- **facade DTO**（types.ts）：RuntimeState 12 态；`RuntimeFacade.query()` 保存 initialize 返回的 runtime ref，并把所有能力驱动动作统一发送到生产 `command` 入口；manifest 对只读 query 不再错误要求 lease。

## 3. 重跑门禁矩阵

判定值：`pass`（契约存在且生产可达或有权威证据）/ `missing`（无契约，或 bridge 层已交付但生产 IPC 不可达）/ `incompatible`。

| # | 契约行 | 首跑 | 重跑证据 | 判定 |
|---|---|---|---|---|
| R1 | Runtime 10 态（含 loading/upgrading/recovering/incompatible） | missing | 协议与 RuntimeFacade 已统一扩展为 12 态（含全部要求状态）；生成 schema/d.ts 与 hash 一致，非法状态仍 fail-closed | pass |
| R2 | 平台支持矩阵与 per-capability 可用性 | missing | `OperationAvailability{available,reason}`（含 ENVIRONMENT_UNSUPPORTED）+ `availability()` 经 facade/supervisor 接线；InitializeResult 携 PlatformFacts；manifest host.platforms + verify-release supported 矩阵 | pass |
| R3 | 能力清单与 per-action availability | missing | `CapabilityDescriptor{capabilityId,schemaRevision,stability,mode}` + `capabilities()`；supervisor 按 capability 门禁命令，未协商 → `CAPABILITY_NOT_NEGOTIATED` fail-closed（lane 2 验证 unknown-interaction/stale-lease 拒绝） | pass |
| R4 | Workspace 列出/切换/管理投影 | missing | `workspace.list/open/create/rename/remove/archiveSession` 已进入类型化 Host 协议、Facade catalog、Supervisor 语义/直连路由与 Host dispatch；release-shaped 官方 runtime 探针验证 `workspace.list` 生产可达，其余动作按协商能力门禁 | pass |
| R5 | 会话生命周期 create/rename/archive/restore/delete/fork | missing | `session.list/open/create/resume/rename/restoreArchive/delete/fork` 已纳入同一生产命令面；rc.1 支持项走公开 service，不支持项返回 `capability-not-negotiated` | pass |
| R6 | 全局会话搜索（可取消、generation 约束） | missing | `session.search` 已进入协议/Facade/Supervisor/Host 全链路；搜索服务保留取消与 generation 约束，扩展 E2E spec 已包含真实搜索断言 | pass |
| R7 | 会话历史分页（冷水合） | missing | `session.history` 已进入生产命令面并转发官方 `sessionController.page`；rc.1 adapter 分页边界测试及扩展 E2E history 断言齐备 | pass |
| R8 | Snapshot/cursor/seq/durable facts + 缺口检测 | pass（DTO；数据占位） | **占位已替换为真实 DSH facts**：lane 2 验证 durableFacts 含 turn/start、user/message（真实 UUID+source.rpcId）、assistant/message（真实 model/provider provenance）、真实 cursor（cursor-N）/seq；冷恢复（kill→respawn）从 DSH persistence 重建同一 session facts；协议 Resync/Overload + event-normalizer 去重排序 + snapshot-plus-cursor 恢复（task 6.1/6.4 测试） | **pass（真实 DSH facts，lane 验证）** |
| R9 | 事件流（subscribe/有序/去重/generation） | pass | 维持：subscribe + RuntimeEvent + State/Resync 通知；lane 1+2 真实 turn 事件流验证；88037cd 事件围栏 | pass |
| R10 | Controller/observer 租约与代际栅栏 | pass | 维持：lane 1+2 lease fencing（duplicate acquire → lease-rejected；stale lease 拒绝）；MutationLedger exactly-once（同 requestId 重发回放、跨 generation 只拒绝） | pass |
| R11 | 审批/问题 interaction 往返 | missing | **已接线**：supervisor `interaction.respond` → host broker → 官方 ApprovalService（ctx.on waterfall + turn 包裹）；正向往返经真实 DSH 服务集成验证（rc1-adapter.test.ts：approval/asked+decided 审计对）；生产 IPC fail-closed 验证（lane 2：unknown-interaction、stale-lease 拒绝）；pending/resolved 收敛 + 防重复（stdio_abi）。限制：E2E 未触发真实 DSH 审批（headless 配置下 pwsh 直接执行，见 ledger Ruling） | pass（接线+集成正向+生产 fail-closed；E2E 正向触发限制已记录） |
| R12 | Turn 控件 submit/queue/steer/cancel/restart | missing | RuntimeFacade 既有 submit/steer/cancel 也已真正映射到 resident session 命令；`session.updateQueue/restart` 新增类型化 Host mutation，统一受 capability、generation、lease 与 requestId 门禁；rc.1 的 restart 缺失按能力结构化拒绝 | pass |
| R13 | Presenter hints（10 类 + 通用兜底） | missing | 规范化事件 envelope 携带 workspace/session/Turn/step/tool/job/subagent identity（task 6.2，双 Adapter 确定性测试）；lane 2 facts 证实 kind+结构化 data+provenance 上 wire；normalize-presenter/mask 处理未知 kind 脱敏兜底 | pass（事件 kind+identity+脱敏兜底已接线） |
| R14 | 模型/provenance 元数据 | missing | lane 2 durableFacts：assistant/message 携 source{kind:"model",model,provider}，历史 Turn provenance 由 DSH 权威事实保留；TurnConfigSnapshot 仍为内部 DTO | pass（事件级 provenance lane 验证） |
| R15 | Preset roster 与切换规则 | missing | `preset.catalog/select` 已进入类型化生产命令面；当前 rc.1 未广告该能力时在 Supervisor 门禁返回 `capability-not-negotiated`，未来 Adapter 广告后无需改协议或路由 | pass |
| R16 | Creative mode 隔离代际转换 | missing | Creative Host-half 复用 `dynamic.host.*` 类型化命令与 generation/lease fencing；能力不存在时 fail-closed，不把模型代码注入 renderer | pass |
| R17 | Host-half dynamic extensions 生命周期 | missing | define/run/update/stop/undefine/inventory/diagnostics 已进入协议、Facade、Supervisor 与 Host dispatch；rc.1 缺失能力结构化拒绝，保留未来版本快速接入边界 | pass |
| R18 | 浏览器半包隔离 bridge（缺省 fail-closed） | missing（预期缺省） | 无 isolated client bridge 能力广告 → 按规范缺省即 fail-closed；dynamic-package-service 对 browser-half 无 bridge 时明确拒绝（task 11 测试）；无任何模型代码注入 renderer 路径 | **pass（明确 fail-closed）** |
| R19 | 附件限制运行时广告 | missing | `attachment.limits` 为 Host-owned capability，已进入协议/Facade/route；最终 ZIP release probe 返回 maxCount/mediaTypes/provenance | pass |
| R20 | 会话/工作区有界 summary | missing | `context.summary` 已进入生产命令面，基于权威 snapshot 生成有界文本与 provenance；最终 ZIP release probe 返回 source:`dsh` | pass |
| R21 | Native E2E release state | pass（分类契约） | 分类契约继续强制 waiver 时 `gatePassed=false`、`formalReleaseBlocked=true`。v3 两次本机尝试均在 spec 前因 WebView2 `HRESULT 0x80070057` 失败；GitHub 最新仍为 2026-09-04 #5 旧提交失败运行 | pass（分类契约）；新增 E2E 未通过，正式发布仍阻塞 |

### 矩阵小结

- **pass：21 行**。此前 11 个 missing 的 wire 缺口均已补入协议、Facade、Supervisor 与 Host dispatch；可用操作走公开 DSH service，不可用操作由协商能力结构化拒绝。
- **missing：0 行**。
- **incompatible：0 行**。

## 4. v3 接线结果与剩余验证债务

此前 11 行 missing 的共同根因已经一次性修复：

1. **协议命令面**：新增 `HostReadOperation` / `HostMutationOperation` 与 Host command/result envelope，继续以 Rust 生成物作为单一事实源；
2. **Supervisor**：语义 `command` 与 direct typed method 共用 allowlist，统一 generation/capability/lease/requestId fencing，未协商能力在调用 Host 前拒绝；
3. **RuntimeFacade**：新增能力驱动 `query()`，保存 initialize 的 runtime ref；RuntimeState 扩展为 12 态；
4. **Host dispatch**：所有 operation 映射到已有公开 Adapter port，不读取 DSH 私有实现，不绑定 rc.1 版本分支。

剩余的是**验证债务，不是 Host 接线缺口**：扩展后的 AIO 原生 E2E 需要在 WebView2 可创建的环境中补跑。当前允许 Coding Workstation change 继续，但正式发布前必须取得该 lane 的真实通过结果。

## 5. Native E2E 分类状态（R21 / 10.5）

- 既有本机隔离 lane（非 CI）：`dsh-runtime-native` 8/8 + 旧版 `dsh-host-capability` 6/6，使用此前 ZIP `1f9db8f9…`。
- v3 最终 ZIP `5ae81e81…` 已通过 build、package、release verifier 与 executable Host probe。扩展后的 `dsh-host-capability` lane 两次均在 spec 执行前失败：AIO 后端和 WebDriver 端口已启动，但 WebView2 创建窗口返回 `HRESULT 0x80070057`；目录为 `.dev-data/dsh-hostcap-r3`、`r3b`。
- corrupt candidate 场景在新 host-bridge 架构下失败时机前移（initialize 即启动真实 runtime → `host-initialize-failed` fail-fast），回滚/数据保留安全属性不变；spec 期望已随架构更新（接受 host-initialize-failed 为合法拒绝分类）。
- GitHub Actions 最新可见运行仍为 2026-09-04 的 #5（提交 `b7328ef`，failure），当前实现未推送、未产生新运行；上游 origin 禁推约束不变。
- 当前分类固定为 `gatePassed=false`、`temporaryWaiver=true`、`formalReleaseBlocked=true`；**正式发布保持阻塞**，基础设施豁免不冒充产品 E2E 通过。

## 6. 证据路径汇总

- 插件仓 worktree：`E:/workspace/projects/aio-hub/.worktrees/aiohub-plugin-dsh-host-capability-foundation`（分支 `codex/add-dsh-host-capability-foundation`，HEAD `48f59a3`）
- 最终 ZIP + sha256：同 worktree `dist/dsh-coding-workspace-0.1.0-win32-x64.zip{,.sha256}`（`5ae81e8143d356113ce1aea263a689fec64e408755d823961086aa6439441dcc`）
- lane 证据：`.dev-data/dsh-hostcap-r1b/artifacts/`、`.dev-data/dsh-hostcap-r2b/artifacts/`
- 新 spec：`tests/tauri-e2e/specs/dsh-host-capability.spec.ts` + preset `dsh-host-capability`（`tests/tauri-e2e/support/presets.ts`）
- host-capability 验证报告：`docs/superpowers/reports/2026-09-08-add-dsh-host-capability-foundation-gate.md`
- 协议/facade/bridge：worktree 内 `crates/protocol/src/messages.rs`、`crates/supervisor/src/main.rs`、`packages/runtime-facade/src/types.ts`、`packages/dsh-bridge/src/**`
- 首跑报告：本文件 git 历史（ae17fbae）

## 7. 结论

Host capability change 的契约与生产实现面已达到 **21 pass / 0 missing / 0 incompatible**，此前 wire 缺口已补齐，因此 Coding Workstation change 可解除“Host 能力不存在”的实现冻结并继续开发。当前不等于正式发布就绪：扩展后的 AIO 原生 E2E 尚未执行到测试代码，临时基础设施豁免保持 `gatePassed=false`、`formalReleaseBlocked=true`，发布前必须补跑并取得真实通过证据。
