# Host 能力前置门禁报告：add-dsh-coding-workstation Task 1

- **Change**: add-dsh-coding-workstation（aio-hub，dev 分支）
- **日期**: 2026-09-07
- **任务**: OpenSpec task 1.1 / 计划 Task 1（Enforce the Host capability prerequisite）
- **产物语言**: zh-CN
- **结论**: `BLOCKED: no accepted Host capability change`——OpenSpec 任务 1.1 不勾选，不创建插件 UI 生产代码

## 1. 做了什么

1. 从 `openspec/changes/add-dsh-coding-workstation/tasks.md`（42 个任务）与 4 个 delta spec（`coding-workstation-shell`、`coding-session-experience`、`coding-interaction-controls`、`coding-temporary-side-chat`）提取 Task 2–10 消费的 Host 契约行，建立下述 gate 矩阵。
2. 核实"已验收的单独 Host capability change"是否存在：检查 `openspec/changes/`（活跃 + archive）、aio-hub git log、插件仓 `aiohub-plugin-dsh-workspace` 当前分支与已验收提交 `14c76483bcf7a7bdab9d4b59fb93e1ddad8b4bb0` 的 `packages/runtime-facade/src/types.ts`。
3. 复核 runtime-core 最新验证报告（含工作树未提交的 CONDITIONAL 修订）与 AIO 侧 E2E 分类器代码，确认 `passed` / `failed`(product) / `infrastructure-blocked` 三态区分及 waiver 语义。
4. 按矩阵逐行判定，记录 blocker；本任务零代码改动（仅本报告文件）。

## 2. Step 2 核实结果：不存在已验收的单独 Host capability change

- `openspec/changes/` 活跃目录仅有：`add-dsh-coding-workstation`、`add-dsh-ecosystem-manager`（Phase 1B，明文声明依赖本 change 先行，非 Host 能力 change）。
- `openspec/changes/archive/` 仅有 `2026-09-07-integrate-dsh-runtime-core`（38/38 条件完成；其规格是 `dsh-runtime-lifecycle`、`dsh-execution-bridge`、`dsh-model-and-prompt-sync`，验收结论明文将"完整 Coding工作站 UI"列入"不在范围"）。
- aio-hub git log 中无任何名为或等价于 Host capability 的 change。
- 插件仓主仓 dev 分支只有一个空 baseline 提交 `85a1820`（空树）；runtime-core 全部实现位于 `feature/20260831/integrate-dsh-runtime-core` 分支（HEAD 即已验收提交 `14c7648`）。该提交的 `packages/runtime-facade/src/types.ts` 与 `.worktrees/integrate-dsh-runtime-core/` 工作树逐字节一致。

因此 Step 2 按 brief 判定：`BLOCKED: no accepted Host capability change`。

### 当前最小 RuntimeFacade 实际公开面（证据）

`packages/runtime-facade/src/types.ts`（@ `14c7648`）公开的接口与 DTO：

- `RuntimeFacade` 方法：`initialize` / `acquireSession` / `transferController` / `command`（通用透传）/ `snapshot` / `subscribe` / `shutdown`。
- DTO：`PlatformKey`、`RuntimeState`（stopped/starting/ready/busy/stopping/crashed/unavailable）、`SandboxStatus`、`RuntimeRef`、`ControllerLease`、`InitializeInput/Result`（含 `capabilities: readonly string[]`）、`AcquireSessionInput`、`TransferControllerInput`、`RuntimeCommand`（`kind: string; input?: unknown`）、`RuntimeEvent`（`kind: string; data: unknown`）、`SessionSnapshot`（cursor/seq/durableFacts）、`InteractionRequest/Resolved`、`ProfileDiagnostic`、`AioLlmProfile`、`TurnConfigSnapshot`、`DSH_CAPABILITY = { id: "execution-domain:dsh", version: 1 }`。

Rust 侧（`crates/protocol/src/messages.rs`、`crates/supervisor/src/`）：

- `SessionCommand` 枚举仅有 `Acquire` / `TransferController` / `SubmitPrompt` / `Cancel` / `Steer` / `Snapshot` 六种。
- `CommandPayload::Interaction` 在 supervisor main 中被显式拒绝：`"unsupported-interaction", "interaction responses are not available before the bridge is wired"`（main.rs L490-497）——审批/问题往返只有 DTO 类型，没有运行时实现。
- Supervisor 广告的 stable capabilities 仅 `["session", "snapshot"]`（supervisor.rs L16）；`required_stable_capabilities` 为空，即初始化协商没有强制任何 UI 级能力。
- `snapshot` 响应由 supervisor 以占位数据合成（`cursor: "cursor-0"`、空 `durableFacts`，main.rs L664-679）；SubmitPrompt 经由 loopback provider 一次性 `--profile headless` 进程执行，不是真实 DSH 会话控制面。

`packages/dsh-bridge/src/sessions.ts` 虽定义了 create/list/search/resume/history/prompt/cancel/steer/queue/fork/rename/model/workspace 的 command kind 白名单，但这是桥接层内部的服务映射框架，未接入 Supervisor 协议（协议 `SessionCommand` 枚举不含这些 kind），也没有出现在 runtime-facade 的公开 DTO 或能力协商中。preset、dynamic extension、terminal、subagent、presenter 契约在整个插件仓中无任何定义（关键词检索无命中）。

## 3. Step 1/2 门禁矩阵

判定值：`pass`（契约存在且已由已验收 change 提供）/ `missing`（无契约或无实现）/ `incompatible`（存在但语义冲突）。规范出处均为 `openspec/changes/add-dsh-coding-workstation/specs/<capability>/spec.md` 的 Requirement；能力/模式身份列引用当前唯一公开声明 `DSH_CAPABILITY.id = "execution-domain:dsh"` 与实际 DTO/协议面。

| # | 契约行 | 消费方任务 | 要求的能力/契约身份 | 规范出处（Requirement） | Host 侧证据 | 判定 |
|---|---|---|---|---|---|---|
| R1 | Runtime 运行态与过渡状态（loading/starting/upgrading/recovering/ready/busy/stopping/crashed/unavailable/incompatible） | 2.3, 3.x | RuntimeState + 状态通知契约，须含 upgrading/recovering/incompatible 语义 | coding-workstation-shell / Capability-driven compatibility and startup states | `types.ts` RuntimeState 仅 7 态，无 upgrading/recovering/incompatible；supervisor 有 lifecycle 状态机但未作为 UI 契约公开 | missing |
| R2 | 平台支持矩阵与可用性（不广告则 UI 不宣称执行支持） | 2.3, 10.4 | 平台/可用性 DTO + initialize 协商 | coding-workstation-shell / Capability-driven compatibility and startup states | `InitializeResult` 含 platform+state+capabilities；但 `PlatformFacts` 仅为沙箱/架构事实，无 per-capability 可用性清单 | missing |
| R3 | 能力清单与 per-action availability（操作级开关+理由） | 2.3, 3.4, 5.4 | capability inventory 与每操作 advertised 布尔 | coding-workstation-shell / Native plugin entry and ownership boundary；design.md §3 | capabilities 是 `readonly string[]`，无操作级粒度；supervisor 仅广告 `["session","snapshot"]` | missing |
| R4 | Workspace 列出/切换/管理投影 | 3.2, 3.4 | workspace DTO + workspace 关联能力 | coding-workstation-shell / Hybrid workspace and task navigation | dsh-bridge 白名单有 `workspace` kind，协议枚举与 facade DTO 均无 workspace 结构 | missing |
| R5 | 会话生命周期：create/rename/archive/restore/delete/fork | 3.4, 10.x | 会话控制契约含上述操作 | coding-session-experience / Session lifecycle actions | 协议 SessionCommand 无 create/rename/archive/restore/delete/fork；桥接白名单有 create/fork/rename 但无实现 | missing |
| R6 | 全局会话搜索（可取消、generation 标记） | 3.3 | search 能力 + 搜索分页/取消契约 | coding-workstation-shell / Search and session navigation | 桥接白名单有 `search` kind；协议、facade、能力清单均无 | missing |
| R7 | 会话历史分页（paged history 冷水合） | 4.1, 9.3 | history 分页契约 | coding-session-experience / Runtime-authoritative session projection | 桥接白名单有 `history`；协议仅 Snapshot 返回合成占位（cursor-0、空 facts），无分页 | missing |
| R8 | Snapshot/cursor/seq/durable facts 投影与缺口检测 | 4.1 | SessionSnapshot + resync 契约 | coding-session-experience / Runtime-authoritative session projection | `SessionSnapshot` DTO 存在；`NotificationPayload::Resync`、Overload 存在（runtime-core 验收覆盖）。supervisor 快照目前为占位数据 | pass（DTO 契约；运行时数据为占位，见 §5 说明） |
| R9 | 事件流（subscribe、有序、重复抑制、generation 变化） | 4.1, 4.2 | RuntimeEvent 订阅 + 代际通知 | coding-session-experience / Runtime-authoritative session projection | `subscribe` + `RuntimeEvent` + `RuntimeStateNotification`/`Resync` 存在且经 native E2E 验证（8/8） | pass |
| R10 | Controller/observer 租约、显式转移、代际栅栏 | 6.3 | ControllerLease + transferController + stale-generation 拒绝 | coding-interaction-controls / Explicit controller lease | `ControllerLease`、`transferController`、stale-generation/lease-rejected 拒绝路径均在 supervisor 实现并有测试 | pass |
| R11 | 审批/问题 interaction 往返（含 resolved 收敛、防重复响应） | 6.4 | InteractionRequest/Resolved 通道 + 响应提交 | coding-interaction-controls / Host-defined approvals and questions | DTO 与协议类型存在，但 supervisor 显式拒绝 interaction 响应（bridge 未接线）；无运行时往返 | missing |
| R12 | Turn 控件：idle submit / queue / steer / cancel / restart | 6.2 | submit/queue/steer/cancel/restart 操作契约 | coding-interaction-controls / Distinct submit, queue and steer semantics; Turn-scoped cancellation and restart | 协议有 SubmitPrompt/Cancel/Steer（无 queue/restart）；submit 经 loopback 一次性进程，非真实会话控制 | missing |
| R13 | Presenter hints：messages/reasoning/tools/jobs/workflows/context/files/diffs/terminals/subagents | 4.3, 5.x | 事件 kind 分类与 presenter 元数据 | coding-session-experience / Extensible event presenters | RuntimeEvent.data 为 `unknown`，无任何 kind 注册表、分类或 presenter 契约 | missing |
| R14 | 模型/provenance 元数据（历史 model/source/preset 保留） | 4.x, 7.1 | TurnConfigSnapshot + 事件级 provenance | coding-session-experience / Source and model provenance | `TurnConfigSnapshot`/`AioLlmProfile` 为模型同步内部 DTO，不经 facade 公开为 UI 消费契约 | missing |
| R15 | Preset roster 与切换规则（switchability/scope/transition） | 7.1, 7.2 | preset 列表 + 切换能力 DTO | coding-interaction-controls / Capability-driven preset switching | 全仓无 preset 契约（检索无命中）；设计明文要求由 Host 提供 | missing |
| R16 | Creative mode 隔离代际转换状态 | 7.2 | Host-reported isolated-generation transition | coding-interaction-controls / Creative mode is an explicit high-risk session choice | 无任何 creative/隔离代际契约 | missing |
| R17 | Host-half dynamic extensions（定义/运行/更新/停止/移除/诊断） | 7.3, 7.5 | dynamic package lifecycle 契约 | coding-interaction-controls / Host-half dynamic packages | 无任何 dynamic extension 契约 | missing |
| R18 | 浏览器半包隔离 client bridge（缺省 fail-closed） | 7.4 | 显式广告的 isolated bridge 能力 | coding-interaction-controls / Browser-half packages fail closed | 无 bridge 能力广告——按规范该缺省即 fail-closed，属预期基线而非缺陷 | missing（预期缺省） |
| R19 | 附件限制（类型/大小/数量）运行时广告 | 6.1 | attachment limits 能力 DTO | coding-interaction-controls / Session-scoped composer drafts | 无附件契约 | missing |
| R20 | 会话/工作区 summary（side-chat capsule 输入） | 8.2 | session summary 能力 | coding-temporary-side-chat / Read-only context capsule | 无 summary 契约；spec 已定义降级路径（披露 reduced context），但 Host 侧无来源 | missing |
| R21 | Native E2E release state（formalReleaseBlocked 保持） | 1.3, 10.2 | E2E 分类契约 | coding-workstation-shell / Capability-driven compatibility and startup states（Formal release remains blocked 场景） | 见 §4：分类器存在且 waiver 保持 gatePassed=false、formalReleaseBlocked=true；runner E2E 实际为 infrastructure-blocked | pass（分类契约）；正式发布仍阻塞 |

### 矩阵小结

- `pass`: 4 行（R8 DTO 层、R9、R10、R21 分类契约）。
- `missing`: 17 行（其中 R18 属规范预期的 fail-closed 缺省）。
- `incompatible`: 0 行。
- 所有 missing 行的共同根因：**不存在已验收的单独 Host capability change**。runtime-core 只交付了最小 facade 骨架 + 生命周期/沙箱/供应链 + loopback 验证通道，其验证报告 §8 明文将完整 Coding 工作站 UI 留待后续 change。

## 4. Step 3：runtime-core E2E 分类复核

来源：`docs/superpowers/reports/2026-09-03-integrate-dsh-runtime-core-verify.md`（工作树含未提交 CONDITIONAL 修订，本报告以工作树最新内容为准）+ AIO 侧分类器实现 `tests/tauri-e2e/support/dsh-native-gate.ts` + `.github/workflows/dsh-runtime-native.yml`。

摘录结论：

- 报告区分三类结果：本地生产 IPC 原生 E2E 8/8 通过（passed）；GitHub Actions run #10 中 native E2E 在创建 WebDriver session 前不可达，分类器记录为 `infrastructure-blocked` 临时豁免（绝非产品通过）；产品断言、IPC/Sidecar 或未知失败仍使 job 失败（failed）。
- 分类器代码证实：`infrastructure-blocked` 路径固定 `gatePassed: false`、`temporaryWaiver: true`、`formalReleaseBlocked: true`；仅 `exitCode === 0` 才输出 `status: "passed", formalReleaseBlocked: false`。workflow 在 `if: always()` 步骤写入 `dsh-native-e2e-result.json` 产物并输出 `::warning::…formal release remains blocked`。
- 报告结论原文："临时豁免只允许 change 继续，不代表 E2E 通过，正式发布前仍必须取得 Windows native E2E 成功证据"；38/38 任务为**条件完成**，"本 change 不应进入最终发布归档"。

Step 3 判定：**满足**——三态区分清晰，infrastructure waiver 未被伪装为成功，`formalReleaseBlocked` 语义在报告与代码两层均保持 true。UI 后续（Task 1.3 / 10.x）必须原样透传该状态，不得将 waiver 渲染为产品测试通过。

## 5. Step 4：门禁失败处置

**mandatory 行存在非 pass（17 行 missing），按 Step 4 与计划 Global Constraints 执行：**

- 不创建插件 UI 生产代码（Task 2 及以后全部冻结，直至 Host capability change 被接受）。
- 不勾选 OpenSpec 任务 1.1——其验收对象是"单独被接受的 Host capability change 暴露最小契约"，该对象尚不存在。
- 缺失行清单（全部 17 行）：R1–R7、R11–R20（R8/R9/R10/R21 pass；R18 为规范预期缺省）。
- 恢复条件：Open、实现并验收单独的 Host capability change（覆盖 R1–R7、R11–R20 所列契约），随后重跑本矩阵，全部 mandatory 行 pass 后再开始 UI 实现。届时按 brief Step 5 重新提交通过的 gate 报告。

说明：R8 判 pass 限定为"DTO 契约存在并经 runtime-core 验收"；其 supervisor 实现目前返回占位快照（`cursor-0`、空 facts），真实快照数据同样依赖 Host capability change 接线 dsh-bridge 后才可用。这不改变本行判定，但 Task 4+ 实施时不得将当前占位行为当作产品事实源。

## 6. 证据路径汇总

- 需求：`openspec/changes/add-dsh-coding-workstation/{tasks.md, proposal.md, design.md, specs/*/spec.md}`
- 活跃/归档 change 清单：`openspec/changes/`、`openspec/changes/archive/2026-09-07-integrate-dsh-runtime-core/`
- 已验收 runtime-core 规格：`openspec/specs/{dsh-execution-bridge, dsh-runtime-lifecycle, dsh-model-and-prompt-sync}/spec.md`
- runtime-core 验证报告（工作树最新）：`docs/superpowers/reports/2026-09-03-integrate-dsh-runtime-core-verify.md`
- E2E 分类器：`tests/tauri-e2e/support/dsh-native-gate.ts`（+ `dsh-native-gate.test.ts`）、`.github/workflows/dsh-runtime-native.yml`
- 插件仓 facade（已验收提交 `14c7648`，与 worktree 逐字节一致）：`E:/workspace/projects/aiohub-plugin-dsh-workspace/.worktrees/integrate-dsh-runtime-core/packages/runtime-facade/src/{types.ts, runtime-facade.ts}`
- 协议/Supervisor：同 worktree `crates/protocol/src/messages.rs`、`crates/supervisor/src/{supervisor.rs, main.rs}`
- 桥接层服务框架：同 worktree `packages/dsh-bridge/src/sessions.ts`（白名单存在但未接入协议）

## 7. 结论

`BLOCKED: no accepted Host capability change`。这是本任务的合法且预期产出：门禁矩阵已建立并逐行取证，Host 能力缺口被精确记录为 blocker 而非在本 change 内实现。UI 生产实现（Task 2+）与 OpenSpec 1.1 勾选冻结，直至单独的 Host capability change 被验收后重跑本矩阵。零代码改动，符合上游兼容规范（仅新增本报告文件）。
