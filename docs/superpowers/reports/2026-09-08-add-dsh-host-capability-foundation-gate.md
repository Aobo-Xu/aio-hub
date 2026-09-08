# DSH Host Capability Foundation 验证报告

- 日期：2026-09-08（收尾复验更新）
- 插件仓库：`E:/workspace/projects/aio-hub/.worktrees/aiohub-plugin-dsh-host-capability-foundation`
- 插件分支：`codex/add-dsh-host-capability-foundation`
当前提交：`bb08050`；v3 wire 接线与验证修订仍在未提交工作区（未获提交授权）

## 结论

补录计划遗漏后，当前 change 为 OpenSpec **49/51**。此前 11 行 missing 的共同根因已经在实现层补齐：类型化 Host 协议、RuntimeFacade query/12 态、Supervisor resident 语义路由、Host dispatch 与 capability/generation/lease/requestId fencing 均已落地。最终 ZIP `5ae81e81…` 的构建、打包、校验与 release-shaped Host probe 通过。

本 change **尚未完成**。Host 契约/实现门禁已经通过，但剩余 2 项验证/CI 工作：

- `10.3c`：扩展后的 AIO native spec 已覆盖逐行生产断言，但两次均在 spec 前因 WebView2 `HRESULT 0x80070057` 创建失败，按规则仅临时豁免、保持未勾选；
- `10.5`：GitHub 最新仍是 2026-09-04 的 #5 旧提交失败运行，当前实现未推送；`gatePassed=false`、`temporaryWaiver=true`、`formalReleaseBlocked=true`，保持未勾选。

因此 Coding Workstation 可继续下一个 change，但当前 change 不能归档，也不能正式发布。

## 已完成且有证据的范围

插件侧已完成并提交：

- `83a604c`：authoritative workspace/session control；
- `600e6b6`、`88037cd`：authoritative snapshot、事件归一化、缺口恢复与 stale fencing；
- `5b42b9b`、`baebd2e`：interaction、attachment、file/diff presenter 边界；
- `ad1cd45`：terminal、preset、Host-half dynamic package seam；
- `21610b5`：maintenance 与 External Tool Provider seam；
- `e867c95`：DSH-owned execution projection；
- `6cf735e`：官方 Adapter migration 与 opaque managed backup/restore 协调器。

迁移协调器只接受官方 `DshReleaseAdapter.migrate()`，备份句柄是不透明值，不解析 DSH JSONL，不访问 workspace/Git 树；官方迁移失败或返回 `not-migrated` 时恢复受管数据，恢复失败返回稳定的 `SESSION_MIGRATION_RECOVERY_FAILED`。

## 验证结果

已执行：

1. 插件 `bun run check`：通过（TypeScript、生成物、Rust fmt/clippy）；
2. 插件 `bun run test`：通过（33 个 TS 测试文件、171 个测试；Rust workspace 测试通过）；
3. runtime 官方 wheel 获取：通过，输入为 `v0.1.2-rc.1` 固定 lock；
4. `bun run package:platform`：通过；
5. `scripts/verify-release.ts`：通过，`supported:["win32-x64"]`、`preview:[]`、`failures:[]`；
6. ZIP SHA-256：初版为 `bb028051341a03e13e45f21e00ffa905bd463af0057864de76ac23c65db77e78`；补丁后为 `7874220eea9f88df42c4c7e2db717f001c1868e4ec24ffb873a55a3322f91c14`；
7. manifest-selected executable smoke：Rust stdio ABI、Supervisor lifecycle 和打包产物校验通过；
8. 本次迁移协调器增量验证：`session-migration.test.ts` 与维护/provider 测试共 **6/6** 通过，`bun run check:types` 通过，`git diff --check` 通过。

`bun run build` 的首次失败是预期的 release verifier 行为：manifest 指向的 `bin/win32-x64/aio-dsh-supervisor.exe` 缺失。将 `target/release` 产物临时放置到 manifest-selected 路径后构建通过，随后已移出；该失败说明构建门禁在缺少最终部署产物时正确 fail-closed，不是产品源码失败。

## 生产 native lane 根因修复与复验

第一次本机 native lane 为 5/8，通过了安装、Resident ready、lease fencing、崩溃恢复和部分生命周期场景；3 项失败都归因于同一产品/runtime 问题：`v0.1.2-rc.1` 官方 runtime 在 `headless` profile 启动时尝试加载可选 `session-title-llm`，但 wheel 内缺少 `@deepseek-ai/dsh-session-title-llm`。

修复提交 `9d8264b` 在 Supervisor 受管 DSH Home 内生成唯一的官方 Cordis patch，并以 `dsh --profile headless --patch <managed-patch>` 启动；patch 只关闭该可选标题 provider，不修改 DSH 源码、不解析私有格式、不绑定发行版版本。对应 Rust 回归测试通过。

重新打包 ZIP 后，隔离本机 Windows Tauri/WebDriver lane 第二次运行结果为 **8/8 通过**。该结果证明当前 release-shaped ZIP 和既有生产 Sidecar IPC 场景可运行；它仍不覆盖新 Host bridge 的 snapshot/interaction 端到端接线，因此不直接勾选 10.3/10.4。

## 2026-09-08 收尾复验（host-patch 提交后）

未提交的 host-patch 主题工作已整理提交为 `48f59a3`（`feat: complete dsh host capability foundation`：build:host 脚本、cordis-plugin 生产入口、interaction-broker、host_patch 物化、Supervisor HostBinding 参数组、clippy too-many-args 修复），提交前验证：`bun run check` 通过、全量 `bun run test` **180/180**（bsdtar PATH 前置）、release ZIP 重新打包 SHA-256 `1f9db8f9120480e87c2cdb1e2a4bba5314532d666e1a4a2b53b7632db810eed8`、`verify-release` failures:[]、manifest-selected supervisor initialize/shutdown smoke `ready→stopped` 通过。

生产 IPC 集成测试（10.3）已补齐并双 lane 复验（隔离 app-data/artifact/webdriver 端口、Edge 152 driver、preview 前端、最终 ZIP `1f9db8f9`）：

- `dsh-runtime-native`（既有 spec）：**8/8**。其中 corrupt-candidate 场景的失败时机随 host-bridge 架构前移——initialize 现在启动真实 DSH runtime，损坏 runtime 载荷在 initialize 即以 `host-initialize-failed`（OS error 216）fail-fast 拒绝，回滚与数据保留安全属性不变；spec 期望已随架构更新（接受该分类为合法拒绝），属测试期望修正而非产品回归。
- `dsh-host-capability`（新 spec `tests/tauri-e2e/specs/dsh-host-capability.spec.ts` + 同名 preset）：**6/6**——production install、resident ready、lease fencing、**权威 snapshot 真实 DSH facts**（turn/start + user/message 真实 UUID/rpcId + assistant/message 真实 model/provider provenance，明确拒绝 cursor-0/空 facts 占位形态）、**interaction.respond 生产链路 fail-closed**（unknown-interaction + stale-lease 结构化拒绝）、cancel、**冷恢复**（graceful shutdown → kill → respawn → 同一 session 持久化 facts 从 DSH persistence 重建）、进程树清理。

证据：`.dev-data/dsh-hostcap-r1b/artifacts/dsh-native-e2e-result.json`、`.dev-data/dsh-hostcap-r2b/artifacts/dsh-host-capability-result.json`。

## v3 生产接线与剩余门禁

### Host 契约/实现门禁（10.4 已完成）

协议单一事实源新增 Host read/mutation/result，RuntimeFacade 增加 `query()` 并扩展 RuntimeState，Supervisor resident `command` 统一转发到 Host bridge。最终 ZIP `5ae81e8143d356113ce1aea263a689fec64e408755d823961086aa6439441dcc` 的 verifier 为 `failures:[]`，release-shaped 官方 rc.1 Host probe 已通过 initialize、capability negotiation、workspace.list、attachment.limits、session turn/snapshot、context.summary、cancel 与 shutdown。Host Gate v3 更新为 **21 pass / 0 missing / 0 incompatible**，Coding Workstation 可继续后续 change。

### AIO native E2E / GitHub Actions（10.3c、10.5 未完成）

扩展后的 `dsh-host-capability` spec 增加 workspace/session/search/history/queue/terminal/preset/dynamic/attachment/summary 的生产断言。使用旧 debug binary 的隔离目录 `.dev-data/dsh-hostcap-r3` 与 `r3b`，以及当前源码重建 debug binary 的 `.dev-data/dsh-hostcap-r4` 三次运行，均在首个 spec 前失败：AIO 后端与 WebDriver 端口正常启动，但 Tauri WebView2 创建窗口返回 `HRESULT 0x80070057（参数错误）`，随后 tauri-service 的 `execute/sync` 超时或 channel closed。第三次已排除旧 binary 因素。该证据属于受控 pre-test 基础设施故障，不能作为产品 E2E 通过。

GitHub Actions 最新可见结果仍为 2026-09-04 的 DSH Runtime Native E2E #5（提交 `b7328ef`，failure）；当前实现未提交/推送，没有新 CI 运行。按既定策略记录：

```json
{
  "gatePassed": false,
  "temporaryWaiver": true,
  "formalReleaseBlocked": true
}
```

因此 **10.3c、10.5 均不勾选**；临时豁免只允许继续后续 change，不允许归档本 change或正式发布。

## 增补：本机双 lane 重跑与 10.3c 勾选（2026-09-09）

前文记录的 WebView2 `HRESULT 0x80070057` 确认为临时环境故障（后续多次运行未再复现）。修复 supervisor capability 映射缺陷（camelCase wire kind 泄漏进 capability gate 导致 `capability-not-negotiated`，并将 Mutate 分支 3 条致命参数路径转为 `invalid-host-params` 结构化 frame）后，重建发行链并在记录的离线策略下重跑本机隔离双 lane，全部通过：

- 最终 ZIP：`d23a70a34fd46107407c1ef0817c3190510c3e4882859c8742ece142ee3bb5ae`（verify-release `failures:[]`；release probe smoke ready，27 capabilities 含 `session.search`、`session.update-queue`）；
- `dsh-host-capability` 生产 IPC E2E：**7/7 通过**（mutation fence stale-lease 拒绝、权威快照真实 DSH facts、cold recovery、interaction fail-closed、cancel、进程树清理），证据 `.dev-data/dsh-hostcap-r6b/`；
- `dsh-runtime-native` 回归：**8/8 通过**，证据 `.dev-data/dsh-native-r6c/`；
- supervisor 套件全绿（stdio 16/16 含 host 错误/参数 fail-closed 结构化断言，clippy `-D warnings` 通过）；bin/ staging 已清理，build-gate 前提复原（2/2）。

OpenSpec 10.3c 已据此勾选（**50/51**）。10.5 仍未勾选：按既定策略本机 lane 不替代 GitHub 离线 CI 门禁；推送 `aobo-validation` 重跑 CI 待用户授权。`formalReleaseBlocked=true` 保持至 CI 门禁取得结果；本机 E2E 已真实通过，故对本机 lane 不再适用临时基础设施豁免表述。

## 发布状态

- Host 契约/实现门禁：**21/21 pass**；
- Windows native E2E：既有场景曾以旧 ZIP 14/14；v3 新断言未执行到测试代码，按基础设施故障临时豁免；
- 正式发布：`formalReleaseBlocked=true`；
- Coding Workstation UI：可继续后续 change，但其正式验收仍需等待 v3 native E2E 补跑。

后续工作只剩：① 获得提交授权后让 generated-vs-HEAD 门禁转绿；② 获得推送授权后在 Aobo-Xu 验证仓运行离线 GitHub Actions；③ 在可创建 WebView2 的环境补跑扩展 native lane，真实通过后勾选 10.3c/10.5 并归档。不得把临时豁免写成通过。
