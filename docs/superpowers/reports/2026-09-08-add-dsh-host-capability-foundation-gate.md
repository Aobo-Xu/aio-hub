# DSH Host Capability Foundation 验证报告

- 日期：2026-09-08（收尾复验更新）
- 插件仓库：`E:/workspace/projects/aio-hub/.worktrees/aiohub-plugin-dsh-host-capability-foundation`
- 插件分支：`codex/add-dsh-host-capability-foundation`
当前提交：`48f59a3`（host-patch 生产接线收尾；此前 `97e1d08`）

## 结论

当前 change 已完成 OpenSpec **46/48** 项。Host 能力基础层、双 Adapter、受管生命周期、会话控制、权威快照/事件恢复、交互与制品边界、终端/preset/dynamic runtime、维护/provider seam 均已落地并通过插件侧聚焦验证（180/180）；生产 IPC 集成测试（10.3）已以双 native lane 补验（8/8 + 6/6，ZIP `1f9db8f9`），文档/任务/provenance 同步（10.6）已完成。

本 change **尚未完成**，也不能宣称 Coding Workstation Host Gate 已通过。剩余 2 项：

- `10.4`：Host Gate 矩阵已重跑为 **10 pass / 11 missing / 0 incompatible**（见 `2026-09-07-add-dsh-coding-workstation-host-gate.md` v2）——未达"R1–R17、R19–R20 全 pass"的勾选条件，保持未勾选；剩余缺口为生产 wire 接线（协议命令 + supervisor 路由 + facade DTO），bridge 实现已就绪；
- `10.5`：本机双 lane 14/14 通过，但 GitHub 离线 CI lane 未在推送授权下重跑，`formalReleaseBlocked=true` 维持，保持未勾选。

Windows native lane 已在本机隔离环境成功执行（双 preset），但不替代既定离线 CI 门禁结果。

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

## 尚未通过的门禁与原因

### 生产 AIO IPC Host Gate（10.3 已完成 / 10.4 重跑未全过）

10.3 的集成测试已按任务枚举场景跑通（见上）。10.4 的 Host Gate 矩阵已重跑（`docs/superpowers/reports/2026-09-07-add-dsh-coding-workstation-host-gate.md` v2）：**10 pass / 11 missing / 0 incompatible**。R8 已从占位升级为真实 DSH facts（lane 验证），R11 interaction 已全链路接线，R2/R3/R13/R14/R18 新增 pass；但 R1（facade RuntimeState 未扩展 upgrading/recovering/incompatible）、R4–R7（workspace 管理/session 生命周期/搜索/历史分页）、R12（queue/restart 无协议命令）、R15–R17（preset/creative/dynamic）、R19–R20（attachment limits/summary）仍 missing——共同根因是 bridge 服务层已交付但 **supervisor resident 路由（仅 9 方法）与协议 SessionCommand（仅 6 变体）未接线**，UI 生产不可达。按 10.4 判定规则（R1–R17、R19–R20 全 pass 才更新为通过），**10.4 不勾选，Host Gate 保持部分通过，Coding Workstation UI 实现继续冻结**。

### Windows native E2E（10.5）

此前 GitHub Actions 失败发生在 WebDriver session 创建前（`127.0.0.1:4459` 无法连接），属于测试基础设施分类候选，不是产品 E2E 通过证据。本次本机双 lane 已成功（14/14），但未在 GitHub 离线策略下重跑（向 Aobo-Xu fork 推送未授权，上游禁推）。按既定策略，即使后续确认是 WebDriver/端口/Firewall 等基础设施故障，也只能记录：

```json
{
  "gatePassed": false,
  "temporaryWaiver": true,
  "formalReleaseBlocked": true
}
```

本机结果不是 CI 离线门禁结果，因此不执行豁免，也不把基础设施故障写成 E2E 通过。**10.5 不勾选**。

## 发布状态

- Host Gate：重跑完成，**部分通过（10/21）**；剩余 11 行缺口为生产 wire 接线（协议命令 + supervisor 路由 + facade DTO），无 incompatible 行，恢复路径明确；
- Windows native E2E：本机双 lane 14/14（ZIP `1f9db8f9`）；GitHub 离线门禁待推送授权后重跑；
- 正式发布：`formalReleaseBlocked=true`；
- Coding Workstation UI：继续保持阻塞，直到 Host Gate 矩阵 R1–R17、R19–R20 全 pass。

后续工作（按优先级）：① 协议/路由/DTO 生产接线（11 行 missing 的唯一根因，bridge 实现已就绪）；② 接线后以生产 IPC 测试逐行复验并重跑 gate 矩阵；③ 推送授权后在 GitHub 离线策略下跑一次 native lane 取得 CI 分类结果；④ 全 pass 后勾选 10.4/10.5 并解除 UI change 冻结。不得重复已通过的插件全量回归，除非出现新的失败证据或影响范围扩大。
