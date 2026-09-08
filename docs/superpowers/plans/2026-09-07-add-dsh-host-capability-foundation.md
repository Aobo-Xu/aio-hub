---
change: add-dsh-host-capability-foundation
design-doc: docs/superpowers/specs/2026-09-07-dsh-host-capability-foundation-design.md
base-ref: ae17fbaee7f991e1f013d63ab9e1e28871b7f86d
---

# DSH Host Capability Foundation 实施计划

> **供 Agent 执行：**必须使用 `subagent-driven-development`（推荐）或 `executing-plans` 按任务实施。所有步骤使用复选框追踪。

**目标：**把已验收的 DSH runtime-core 深化为长期驻留、能力驱动、版本解耦且可供 Coding 工作站直接消费的真实 Host 控制面。

**架构：**Rust Supervisor 继续负责进程、安全、生命周期、generation/lease 和 JSONL envelope；TypeScript DSH Host 通过发行版隔离 Adapter 消费官方 DSH Controller/Remote/Persistence/Cordis 服务，并向无 Vue/Pinia 依赖的 RuntimeFacade 暴露稳定 DTO。AIO 只承担生产插件安装、resident Sidecar IPC、Host Gate 和 Windows native E2E。

**技术栈：**Rust、Serde、Schemars、TypeScript 5.6、Bun、Vitest、DSH Python SDK wheel、Cordis、Tauri 2、WebdriverIO。

**规格：**`docs/superpowers/specs/2026-09-07-dsh-host-capability-foundation-design.md`

## 全局约束

- 生产插件实现根为 `E:\workspace\projects\aio-hub\.worktrees\aiohub-plugin-dsh-host-capability-foundation`，但该目录必须是独立插件仓库的链接 Git worktree，不是复制目录。
- Build 从插件已验收提交 `14c76483bcf7a7bdab9d4b59fb93e1ddad8b4bb0` 开始；AIO 计划基线为 `ae17fbaee7f991e1f013d63ab9e1e28871b7f86d`。
- DSH `v0.1.2-rc.1` 是官方 wheel 可执行实现基线，`v0.1.3-alpha.2` 是官方 tag/commit 源码兼容性基线；通用代码不得按版本名称或语义版本推断 capability。
- 只使用 DSH 官方公共扩展面；不得复制 Web BFF、导入私有 registry、解析或修改 JSONL、建立第二会话事实源。
- AIO 与插件不得覆盖或整理现有脏改动；AIO 上游默认行为保持不变。
- Windows x64 是本 change 的完整支持平台；构建与运行不得依赖本机 DSH 源码绝对路径。
- Mutation 必须受 generation/lease/request identity 栅栏，崩溃或不确定状态后不得重放副作用。
- 测试执行遵循局部优先、完整回归后置；同一根因集中修复后再统一验证。
- 提交步骤只有在用户明确授权创建 Git 提交后才执行；未获授权时保留经过验证的工作树改动并报告提交边界。

---

### Task 1：创建链接 Worktree 并固化双发行版测试输入 ✅

**文件：**
- 创建：`E:\workspace\projects\aio-hub\.worktrees\aiohub-plugin-dsh-host-capability-foundation\docs\implementation-boundary.md`
- 修改：`E:\workspace\projects\aio-hub\.worktrees\aiohub-plugin-dsh-host-capability-foundation\runtime-lock\dsh-runtime.json`
- 修改：`E:\workspace\projects\aio-hub\.worktrees\aiohub-plugin-dsh-host-capability-foundation\scripts\runtime\resolve-runtime.ts`
- 测试：`E:\workspace\projects\aio-hub\.worktrees\aiohub-plugin-dsh-host-capability-foundation\scripts\runtime\runtime-lock.test.ts`

**接口：**
- 消费：插件提交 `14c7648` 的 runtime lock、wheel acquisition 和 release verifier。
- 产出：链接 worktree、不可变 rc.1 wheel identity、alpha.2 源码 fixture identity 与 acquisition-pending 状态，以及后续 Adapter 测试读取的 `RuntimeLockEntry`。

- [x] **Step 1：验证目标路径并创建链接 worktree**

  从插件仓库运行 `git worktree list --porcelain`，确认目标路径未注册且基线提交存在；创建 `codex/add-dsh-host-capability-foundation` 分支的 worktree。再次运行 `git rev-parse --show-toplevel`、`git rev-parse HEAD` 和 `git worktree list --porcelain`，期望目标根正确且 HEAD 为 `14c7648`。

- [x] **Step 2：写入双基线失败测试**

  在 `runtime-lock.test.ts` 增加表驱动断言：解析器可以读取两个独立 fixture entry；rc.1 保留 wheel/hash/license/SBOM/platform，alpha.2 保留官方 tag/commit 与 acquisition-pending 状态；并证明通用选择器输入只有 capability/schema evidence，不接受 `startsWith("0.1.3")` 一类版本猜测。

- [x] **Step 3：运行 RED**

  运行：`bunx vitest run scripts/runtime/runtime-lock.test.ts`

  期望：因尚无 `RuntimeLockEntry[]` 双基线 fixture 或 evidence selector 而失败。

- [x] **Step 4：实现最小双基线输入与边界文档**

  使用现有 runtime lock 结构增加测试/获取期的不可变 release entry；不要把两套 runtime 同时打入正式插件 ZIP。`resolve-runtime.ts` 只按 manifest/lock 和协商证据解析当前输入。记录 AIO、插件、DSH 源码只读边界和禁止绝对路径规则。

- [x] **Step 5：运行 GREEN**

  运行：`bunx vitest run scripts/runtime/runtime-lock.test.ts scripts/runtime/acquire-official-wheel.test.ts`

  期望：全部通过，且产物中不出现本机 DSH checkout 路径。

- [x] **Step 6：经授权后提交**

  提交信息：`build: add dsh host adapter baselines`

### Task 2：将协议升级为类型化能力与错误契约 ✅

**文件：**
- 修改：`crates/protocol/src/messages.rs`
- 修改：`crates/protocol/src/generate.rs`
- 修改：`generated/protocol.schema.json`
- 修改：`generated/protocol.d.ts`
- 修改：`generated/protocol.sha256`
- 测试：`crates/protocol/tests/contract.rs`
- 测试：`tests/contract/generated-drift.test.ts`

**接口：**
- 消费：现有 `Envelope<T>`、`InitializeRequest`、`SessionCommand`。
- 产出：`CapabilityDescriptor`、`OperationAvailability`、`HostError`、类型化 command/event/snapshot payload 和可选 domain identity。

- [x] **Step 1：写入协议 RED 测试**

  测试要求生成 schema 中存在以下可辨识结构：

  ```rust
  pub struct OperationAvailability {
      pub capability_id: String,
      pub schema_revision: u16,
      pub available: bool,
      pub mode: OperationMode,
      pub reason: Option<UnavailableReason>,
  }

  pub struct HostError {
      pub code: String,
      pub capability_id: Option<String>,
      pub retryable: bool,
      pub indeterminate: bool,
      pub detail: Option<serde_json::Value>,
  }
  ```

  同时断言 mutation command 必须有 `requestId`，未知字段和缺失 discriminator 被拒绝。

- [x] **Step 2：运行 RED**

  运行：`cargo test -p aio-dsh-protocol --test contract`

  期望：缺少新 schema 类型或 mutation identity 而失败。

- [x] **Step 3：实现类型化 schema**

  扩展 Rust 单一事实源；保留 envelope major-version 协商，payload 独立携带 schema revision。将现有 `ProtocolError` 扩展为 `HostError` 响应，不从 message 文本派生错误类型。

- [x] **Step 4：生成并核验 GREEN**

  运行：`bun run generate:protocol && cargo test -p aio-dsh-protocol --test contract && bunx vitest run tests/contract/generated-drift.test.ts`

  期望：Rust、JSON Schema、TypeScript declaration 与 hash 一致。

- [x] **Step 5：经授权后提交**

  提交信息：`feat: define typed dsh host protocol`

### Task 3：深化 RuntimeFacade、Availability 与 Exactly-once Ledger ✅

**文件：**
- 修改：`packages/runtime-facade/src/types.ts`
- 修改：`packages/runtime-facade/src/runtime-facade.ts`
- 创建：`packages/runtime-facade/src/availability.ts`
- 创建：`crates/supervisor/src/idempotency.rs`
- 修改：`crates/supervisor/src/lib.rs`
- 修改：`crates/supervisor/src/main.rs`
- 测试：`packages/runtime-facade/tests/runtime-facade.test.ts`
- 测试：`crates/supervisor/tests/stdio_abi.rs`

**接口：**
- 消费：Task 2 生成的 DTO。
- 产出：`RuntimeFacade.capabilities()`、类型化 `command()`、`MutationLedger::begin/complete/interrupt`。

- [x] **Step 1：写入 Availability 与去重 RED 测试**

  ```ts
  expect(facade.availability("session.archive")).toEqual({
    available: false,
    reason: { code: "CAPABILITY_NOT_NEGOTIATED" },
  });
  await expect(facade.command(lease, archiveCommand)).rejects.toMatchObject({
    code: "CAPABILITY_NOT_NEGOTIATED",
  });
  ```

  Rust 测试对相同 `requestId` 连续发送两次 mutation，断言下游调用计数仍为 1；旧 generation/lease 调用计数为 0。

- [x] **Step 2：运行 RED**

  运行：`bunx vitest run packages/runtime-facade/tests/runtime-facade.test.ts && cargo test -p aio-dsh-supervisor --test stdio_abi`

  期望：缺少 availability API、typed command 或 ledger 而失败。

- [x] **Step 3：实现稳定 Facade 与 Ledger**

  RuntimeFacade 保持无 Vue/Pinia 依赖。`MutationLedger` 使用有界内存状态 `pending | completed | indeterminate`；跨 generation 只用于拒绝，不允许重放。所有 mutation 在 Supervisor 校验 capability、generation、lease 和 request identity 后才发送给 Host。

- [x] **Step 4：运行 GREEN**

  运行：`bunx vitest run packages/runtime-facade/tests/runtime-facade.test.ts && cargo test -p aio-dsh-supervisor --test stdio_abi`

- [x] **Step 5：经授权后提交**

  提交信息：`feat: enforce host capabilities and idempotency`

### Task 4：建立 DSH Adapter Seam 与公共 API Guard ✅

**文件：**
- 创建：`packages/dsh-bridge/src/adapters/types.ts`
- 创建：`packages/dsh-bridge/src/adapters/registry.ts`
- 创建：`packages/dsh-bridge/src/host/create-host.ts`
- 修改：`packages/dsh-bridge/src/index.ts`
- 创建：`packages/dsh-bridge/tests/adapter-contract.test.ts`
- 创建：`tests/contract/public-api-boundary.test.ts`

**接口：**
- 消费：Task 2/3 的 stable DTO 与 availability。
- 产出：

  ```ts
  export interface DshReleaseAdapter {
    readonly identity: AdapterIdentity;
    probe(): Promise<AdapterProbe>;
    settle(): Promise<NegotiatedCapabilities>;
    workspaces: WorkspacePort;
    sessions: SessionPort;
    projections: ProjectionPort;
    interactions: InteractionPort;
    artifacts: ArtifactPort;
    terminals: TerminalPort;
    presets: PresetPort;
    dynamicRuntime: DynamicRuntimePort;
    migrate(input: MigrationInput): Promise<MigrationResult>;
    dispose(): Promise<void>;
  }
  ```

- [x] **Step 1：写入 seam 与边界 RED 测试**

  用 fake Adapter 验证 Host 只依赖上述 port。边界测试扫描生产 import/bundle，拒绝 DSH private path、Web BFF module、JSONL parser/mutator 和机器绝对路径。

- [x] **Step 2：运行 RED**

  运行：`bunx vitest run packages/dsh-bridge/tests/adapter-contract.test.ts tests/contract/public-api-boundary.test.ts`

- [x] **Step 3：实现 registry 与 composition root**

  Registry 根据 `probe()` 返回的公开 service/schema evidence 选择 Adapter factory；版本字段仅记录 provenance。无完整 Adapter 时返回 `incompatible` 或经过证明的 read-only capability set。

- [x] **Step 4：运行 GREEN 与类型检查**

  运行：`bunx vitest run packages/dsh-bridge/tests/adapter-contract.test.ts tests/contract/public-api-boundary.test.ts && bun run check:types`

- [x] **Step 5：经授权后提交**

  提交信息：`feat: add public dsh release adapter seam`

### Task 5：实现 `v0.1.2-rc.1` 官方控制面 Adapter ✅

**文件：**
- 创建：`packages/dsh-bridge/src/adapters/rc1.ts`
- 创建：`packages/dsh-bridge/src/adapters/shared/public-services.ts`
- 修改：`packages/dsh-bridge/src/public-services.ts`
- 测试：`packages/dsh-bridge/tests/rc1-adapter.test.ts`
- 测试：`packages/dsh-bridge/tests/fixtures/rc1-runtime.ts`

**接口：**
- 消费：`DshReleaseAdapter`。
- 产出：通过官方 Session Controller、Typert Remote、SessionPersistence、Cordis、interaction 与 terminal service 实现的 rc.1 port。

- [x] **Step 1：为真实 rc.1 runtime 写 RED 契约测试**

  覆盖 service settlement、workspace/session create/open/history、真实 snapshot、controller lease、submit/cancel、interaction、terminal handle 和 dispose；不 mock Adapter 自身逻辑。

- [x] **Step 2：运行 RED**

  运行：`bunx vitest run packages/dsh-bridge/tests/rc1-adapter.test.ts`

  期望：Adapter 未注册或缺少真实 service mapping。

- [x] **Step 3：实现最小 rc.1 Adapter**

  将 release-specific import 和 event mapping 限制在 `adapters/rc1.ts`。不存在的操作返回 capability unavailable，不在 bridge 层模拟。

- [x] **Step 4：运行 GREEN**

  运行：`bunx vitest run packages/dsh-bridge/tests/rc1-adapter.test.ts packages/dsh-bridge/tests/boot.test.ts`

- [x] **Step 5：经授权后提交**

  提交信息：`feat: add dsh rc1 host adapter`

### Task 6：实现 `v0.1.3-alpha.2` Adapter 与破坏性变化映射 ✅

**文件：**
- 创建：`packages/dsh-bridge/src/adapters/alpha2.ts`
- 创建：`packages/dsh-bridge/tests/alpha2-adapter.test.ts`
- 创建：`packages/dsh-bridge/tests/fixtures/alpha2-runtime.ts`
- 修改：`packages/dsh-bridge/src/adapters/registry.ts`

**接口：**
- 消费：Task 4 的相同 `DshReleaseAdapter`。
- 产出：alpha.2 persistence/wire、persona prefix/suffix、queued-message sending、continuable subagent、PTC command output 与 no-pid subprocess handle 映射。

- [x] **Step 1：写入 alpha.2 差异 RED 测试**

  ```ts
  expect(snapshot.turnConfig.persona).toEqual({ prefixSource, suffixSource });
  expect(queueItem.state).toBe("sending");
  expect(subagent.actions).toEqual(expect.arrayContaining(["queue", "edit", "remove", "steer", "stop"]));
  expect(processHandle).not.toHaveProperty("pid");
  expect(ptcPresenter.detail).toMatchObject({ command: expect.any(String), output: expect.anything() });
  ```

  rc.1 继续承担真实 wheel 启动/停止与 Windows 进程清理基线。alpha.2 当前无官方 wheel，仅记录待补验证，不为源码 fixture 伪造进程级通过结论。

- [x] **Step 2：运行 RED**

  运行：`bunx vitest run packages/dsh-bridge/tests/alpha2-adapter.test.ts`

- [x] **Step 3：实现 alpha.2 Adapter**

  只在该 Adapter 内处理字段/事件差异；进程 identity 使用官方 handle，pid 为可选诊断。不要保留针对已修复 Windows SDK 崩溃的猜测性补丁。

- [x] **Step 4：运行同一跨版本契约套件**

  运行：`bunx vitest run packages/dsh-bridge/tests/adapter-contract.test.ts packages/dsh-bridge/tests/rc1-adapter.test.ts packages/dsh-bridge/tests/alpha2-adapter.test.ts`

  期望：rc.1 真实 runtime 与 alpha.2 官方源码/API fixture 都满足同一 stable contract；能力差异只反映在 availability，alpha.2 executable smoke 保持 pending。

- [x] **Step 5：经授权后提交**

  提交信息：`feat: add dsh alpha2 host adapter`

### Task 7：接入长期 Host、Managed Home 与完整生命周期 ✅

**文件：**
- 创建：`packages/dsh-bridge/src/host/runtime-host.ts`
- 修改：`packages/dsh-bridge/src/index.ts`
- 修改：`crates/supervisor/src/lifecycle.rs`
- 修改：`crates/supervisor/src/home.rs`
- 修改：`crates/supervisor/src/process.rs`
- 测试：`crates/supervisor/tests/lifecycle.rs`
- 测试：`crates/supervisor/tests/supervisor_host.rs`
- 测试：`packages/dsh-bridge/tests/runtime-host.test.ts`

**接口：**
- 消费：Adapter registry 与既有 Windows process backend。
- 产出：每 execution domain 一个长期 `RuntimeHost`，状态含 `upgrading/recovering/maintenance/incompatible`。

- [x] **Step 1：写长期进程与状态 RED 测试**

  依次创建两个 session，断言只启动一个 Host 子进程；进入 maintenance 后新 mutation 被拒绝；crash 后所有 handle interrupted 且没有收到第二次 submit。

- [x] **Step 2：运行 RED**

  运行：`cargo test -p aio-dsh-supervisor --test lifecycle --test supervisor_host`

- [x] **Step 3：实现长期 Host 与 Managed Home**

  Supervisor 以受管 environment 启动 Host，等待 Cordis settlement 后 ready。Home 备份仅覆盖插件受管数据；shutdown 先 flush/dispose，超时后 Job Object 回收。

- [x] **Step 4：运行 GREEN**

  运行：`cargo test -p aio-dsh-supervisor --test lifecycle --test supervisor_host --test credentials`

- [x] **Step 5：经授权后提交**

  提交信息：`feat: run a managed long-lived dsh host`

  验证：Supervisor 同一 execution domain 复用一个 Job Object 受管子进程；`DSH_HOME`/telemetry 隔离环境（含 Unicode 路径）真实传入子进程；Managed Home 备份拒绝嵌套目标且不包含 workspace 源码；RuntimeHost 在 Cordis/Adapter settlement 后承载多个 session 引用，maintenance/upgrading/recovering/incompatible 均 fence mutation，正常关闭按 flush→dispose，崩溃中断 generation-bound handle，显式恢复不重放 mutation。DSH durable snapshot/fact 重建仍由 Task 9 完成，因此 OpenSpec 4.4 暂不勾选。

### Task 8：实现 Workspace、Session、Queue 与 Controller 控制面 ✅

**文件：**
- 创建：`packages/dsh-bridge/src/workspaces/workspace-service.ts`
- 重构：`packages/dsh-bridge/src/sessions.ts`
- 创建：`packages/dsh-bridge/src/sessions/session-service.ts`
- 创建：`packages/dsh-bridge/src/sessions/search-service.ts`
- 修改：`packages/dsh-bridge/src/controller-leases.ts`
- 测试：`packages/dsh-bridge/tests/workspace-session.test.ts`
- 测试：`tests/contract/session-control.test.ts`

**接口：**
- 消费：Adapter workspace/session ports。
- 产出：稳定 workspace identity、完整 session lifecycle、可取消 search/history 和 capability-gated queue controls。

- [x] **Step 1：写 Workspace/Session RED 契约测试**

  覆盖显式注册、路径 identity、默认安全移除、cold resume、rename/archive/restore/delete/fork、分页/取消、observer 打开不夺权、queue edit/remove/steer/cancel/restart。

- [x] **Step 2：运行 RED**

  运行：`bunx vitest run packages/dsh-bridge/tests/workspace-session.test.ts tests/contract/session-control.test.ts`

- [x] **Step 3：实现控制面**

  每项 mutation 单独检查 availability 和 lease。Search/history 结果携带 request generation/cursor；迟到结果被丢弃。缺失操作返回稳定 unavailable code，不建立本地替代状态。

- [x] **Step 4：运行 GREEN**

  运行：`bunx vitest run packages/dsh-bridge/tests/workspace-session.test.ts tests/contract/session-control.test.ts`

- [x] **Step 5：经授权后提交**

  提交信息：`feat: expose authoritative dsh sessions`

### Task 9：实现真实 Snapshot、Event Pipeline、恢复与 Summary

**文件：**
- 重构：`packages/dsh-bridge/src/snapshot-recovery.ts`
- 创建：`packages/dsh-bridge/src/projections/snapshot.ts`
- 创建：`packages/dsh-bridge/src/projections/event-normalizer.ts`
- 创建：`packages/dsh-bridge/src/projections/context-summary.ts`
- 修改：`packages/dsh-bridge/src/bounded-queue.ts`
- 测试：`packages/dsh-bridge/tests/snapshot-recovery.test.ts`
- 测试：`tests/contract/backpressure.test.ts`
- 测试：`tests/contract/recovery.test.ts`

**接口：**
- 消费：Adapter projection port 与 Task 2 event envelope。
- 产出：`SessionSnapshot`、`NormalizedHostEvent`、`ContextSummary`。

- [ ] **Step 1：写拒绝占位 Snapshot 的 RED 测试**

  ```ts
  expect(snapshot.cursor).not.toBe("cursor-0");
  expect(snapshot.durableFacts.length).toBeGreaterThan(0);
  expect(snapshot.source).toBe("dsh");
  ```

  增加 gap、duplicate、generation change、slow consumer 和 summary budget/provenance 场景。

- [ ] **Step 2：运行 RED**

  运行：`bunx vitest run packages/dsh-bridge/tests/snapshot-recovery.test.ts tests/contract/backpressure.test.ts tests/contract/recovery.test.ts`

- [ ] **Step 3：实现真实投影与恢复**

  Pipeline 顺序固定为 Adapter validate → normalize → mask → classify durability → bounded queue。Gap 后停止 delta，完成 snapshot-plus-cursor 才恢复。Summary 从权威事实构建，报告 omission/stale，不写回 session。

- [ ] **Step 4：运行 GREEN 与确定性回放**

  重复运行相同 event fixture，断言 snapshot/hash 一致；然后运行 Step 2 的测试命令并期望全部通过。

- [ ] **Step 5：经授权后提交**

  提交信息：`feat: recover dsh state from real snapshots`

### Task 10：完成 Interaction、Attachment、Artifact 与 Presenter

**文件：**
- 重构：`packages/dsh-bridge/src/interactions.ts`
- 创建：`packages/dsh-bridge/src/artifacts/attachments.ts`
- 创建：`packages/dsh-bridge/src/artifacts/files.ts`
- 创建：`packages/dsh-bridge/src/artifacts/diffs.ts`
- 创建：`packages/dsh-bridge/src/presenters/normalize-presenter.ts`
- 创建：`packages/dsh-bridge/src/presenters/mask.ts`
- 测试：`packages/dsh-bridge/tests/interactions-artifacts.test.ts`
- 测试：`tests/contract/interaction.test.ts`

**接口：**
- 消费：Adapter interaction/artifact port、availability、ledger。
- 产出：exactly-once interaction、hashed staging、file/diff provenance、masked presenter record。

- [ ] **Step 1：写 RED 场景**

  覆盖 approval/question resolve-once、迟到响应、attachment count/type/size、取消清理、Diff review-only、unknown presenter 和秘密/path masking。

- [ ] **Step 2：运行 RED**

  运行：`bunx vitest run packages/dsh-bridge/tests/interactions-artifacts.test.ts tests/contract/interaction.test.ts`

- [ ] **Step 3：实现交互与工件边界**

  `interactionId` 绑定 generation/session/Turn/lease/upstream handle。Attachment 复制到受管 staging 后计算 SHA-256。Presenter actions 完全来自 operation availability；mask 在事件出 Host 前执行。

- [ ] **Step 4：运行 GREEN**

  运行 Step 2 命令，另检查失败日志不包含测试 secret 或完整用户路径。

- [ ] **Step 5：经授权后提交**

  提交信息：`feat: bridge dsh interactions and artifacts`

### Task 11：完成 Terminal、执行投影、Model/Preset 与 Creative Host-half

**文件：**
- 创建：`packages/dsh-bridge/src/terminals/terminal-service.ts`
- 创建：`packages/dsh-bridge/src/presets/preset-service.ts`
- 修改：`packages/dsh-bridge/src/turn-snapshot.ts`
- 创建：`packages/dsh-bridge/src/dynamic-runtime/dynamic-package-service.ts`
- 测试：`packages/dsh-bridge/tests/terminal-preset-dynamic.test.ts`
- 测试：`packages/dsh-bridge/tests/turn-snapshot.test.ts`

**接口：**
- 消费：Adapter terminal/preset/dynamic ports。
- 产出：官方 terminal handle lifecycle、job/workflow/subagent presenter、immutable Turn config、Host-half dynamic package lifecycle。

- [ ] **Step 1：写 RED 测试**

  覆盖 terminal start/input/resize/interrupt/close、generation 后不可写与进程清理；model/service/source/preset 历史 provenance；minimal/standard/PTC roster；creative explicit-confirmation；崩溃后 dynamic package inactive；browser half unavailable。

- [ ] **Step 2：运行 RED**

  运行：`bunx vitest run packages/dsh-bridge/tests/terminal-preset-dynamic.test.ts packages/dsh-bridge/tests/turn-snapshot.test.ts`

- [ ] **Step 3：实现稳定服务**

  Terminal identity 只使用官方 handle，不依赖 pid。Turn snapshot 冻结完整配置，persona prefix/suffix 只通过 Adapter 官方 seam 组装。Dynamic package 按 Agent/session/generation 隔离，恢复时不重建。Browser half 始终 fail closed。

- [ ] **Step 4：运行 GREEN**

  运行 Step 2 命令，并用 alpha.2 fixture 断言 queued subagent actions 与 PTC command/output 保持结构化。

- [ ] **Step 5：经授权后提交**

  提交信息：`feat: expose dsh terminals presets and creative host`

### Task 12：增加 Maintenance 与 External Tool Provider 扩展缝

**文件：**
- 创建：`packages/dsh-bridge/src/maintenance/maintenance-service.ts`
- 创建：`packages/dsh-bridge/src/external-tools/provider.ts`
- 修改：`crates/supervisor/src/lifecycle.rs`
- 测试：`packages/dsh-bridge/tests/maintenance-provider-seam.test.ts`

**接口：**
- 消费：Host lifecycle、Adapter migrate/health/dispose。
- 产出：maintenance coordination 和未连接实现的 `ExternalToolProvider`。

- [ ] **Step 1：写 RED 契约测试**

  ```ts
  export interface ExternalToolProvider {
    connect(): Promise<ProviderDescriptor>;
    catalog(cursor?: string): Promise<CatalogSnapshot>;
    invoke(request: ToolInvocationRequest): AsyncIterable<ToolInvocationEvent>;
    cancel(invocationId: string): Promise<void>;
    refresh(): Promise<CatalogSnapshot>;
    drain(): Promise<void>;
    disconnect(): Promise<void>;
  }
  ```

  断言 maintenance 有 blocker → drain/cancel → stop → migrate → health → restart → commit/rollback 顺序；未配置 provider 时 external capability unavailable，DSH 原生工具不变。

- [ ] **Step 2：运行 RED**

  运行：`bunx vitest run packages/dsh-bridge/tests/maintenance-provider-seam.test.ts`

- [ ] **Step 3：实现状态机与空 Provider seam**

  Maintenance fence 新 mutation，但不下载安装包。Provider policy/approval 只能委派给 DSH，不能绕过；本 change 不写 VCP/AIO adapter。

- [ ] **Step 4：运行 GREEN**

  运行 Step 2 命令并期望全部通过。

- [ ] **Step 5：经授权后提交**

  提交信息：`feat: add host maintenance and provider seams`

### Task 13：完成插件聚焦回归、Release-shaped 产物与 Host Gate

**文件：**
- 修改：`scripts/verify-release.ts`
- 修改：`scripts/package-platform.ts`
- 修改：`README.md`
- 修改：`docs/recovery.md`
- 修改：`tests/tauri-e2e/specs/dsh-plugin-release.spec.ts`
- 创建：`tests/tauri-e2e/specs/dsh-host-capability.spec.ts`
- 修改：`tests/tauri-e2e/support/presets.ts`
- 更新：`docs/superpowers/reports/2026-09-07-add-dsh-coding-workstation-host-gate.md`

**接口：**
- 消费：Tasks 1–12 的生产 RuntimeFacade、Supervisor、Host 和双 Adapter。
- 产出：release-shaped ZIP、生产 IPC 证据、更新后的 Host Gate 与发布阻塞状态。

- [ ] **Step 1：先运行插件聚焦完整检查**

  运行：`bun run check && bun run test && bun run build`

  期望：TypeScript、generated drift、Rust fmt/clippy/test 和 runtime verifier 全部通过。失败时只进入对应根因组修复，不重复其他已通过命令。

- [ ] **Step 2：构建并验证最终 Windows ZIP**

  运行：`bun run package:platform`，随后对 manifest-selected `bin/win32-x64/aio-dsh-supervisor.exe` 运行 initialize/shutdown smoke，并运行 `scripts/verify-release.ts`。

  期望：hash、license、SBOM、runtime closure、wheel provenance 与 executable smoke 通过；无 Cargo target 或本机源码绝对路径。

- [ ] **Step 3：扩展生产 IPC E2E 的 Host Gate 场景**

  新 spec 必须通过 `install_plugin_from_zip` 和 resident Sidecar IPC 验证真实 workspace/session、snapshot、interaction、cancel、crash interrupted、cold recovery、process cleanup、maintenance upgrade/rollback hook、uninstall 和数据保留。不得用直接解压、mock layout 或原生文件选择器替代安装。

- [ ] **Step 4：运行局部 AIO 契约测试**

  运行：`bun run test:run tests/tauri-e2e/support/dsh-native-gate.test.ts tests/tauri-e2e/support/dsh-native-workflow.test.ts`

  期望：workflow 与三态分类契约通过。

- [ ] **Step 5：运行一次 Windows native E2E 里程碑**

  使用隔离 `AIO_E2E_DATA_DIR`、`AIO_E2E_ARTIFACT_DIR`、`AIO_E2E_WEBDRIVER_PORT` 和最终 ZIP 执行 DSH native preset。只有测试前 WebDriver/端口/runner 基础设施故障且 Step 1/2/4 成功时才可记录临时豁免；结果仍必须是 `gatePassed=false`、`formalReleaseBlocked=true`。

- [ ] **Step 6：重跑并更新 Host Gate**

  报告逐行证明 R1–R17、R19–R20 pass、R18 fail closed、R8 为真实 DSH facts。任何未满足行保持 blocker，不得开始 Coding 工作站 UI。

- [ ] **Step 7：同步文档与任务状态**

  更新插件 README/recovery、OpenSpec tasks、Superpowers 验证报告、实际跨仓 commit/provenance 和正式发布阻塞状态。运行 `comet classic openspec -- validate add-dsh-host-capability-foundation --strict` 与 `git diff --check`。

- [ ] **Step 8：经授权后分别提交两个仓库**

  插件提交信息：`feat: complete dsh host capability foundation`

  AIO 提交信息：`test: verify dsh host capability gate`
