# DSH Host Capability Foundation 验证报告

日期：2026-09-08  
插件仓库：`E:/workspace/projects/aio-hub/.worktrees/aiohub-plugin-dsh-host-capability-foundation`  
插件分支：`codex/add-dsh-host-capability-foundation`  
当前提交：`97e1d08`（后续仅整理测试模块位置，功能内容不变）

## 结论

当前 change 已完成 OpenSpec **44/48** 项。Host 能力基础层、双 Adapter、受管生命周期、会话控制、权威快照/事件恢复、交互与制品边界、终端/preset/dynamic runtime、维护/provider seam 均已落地并通过插件侧聚焦验证。

本 change **尚未完成**，也不能宣称 Coding Workstation Host Gate 已通过。剩余 4 项属于 Host 能力生产接线与门禁收尾：

- `10.3`：生产 AIO 插件安装与 resident Sidecar IPC 集成测试；
- `10.4`：重跑 Coding Workstation Host Gate；
- `10.5`：Windows native E2E 里程碑或受控基础设施豁免；
- `10.6`：将实际生产证据同步到 OpenSpec、Superpowers 和 provenance 报告。

Windows native lane 已在本机隔离环境成功执行一次，但尚未替代既定离线 CI 门禁结果。

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

## 尚未通过的门禁与原因

### 生产 AIO IPC Host Gate（10.3/10.4）

本机已通过既有 AIO 真实安装链路的 8/8 场景（安装、Resident、session turn、cancel、进程树清理、崩溃恢复、升级回退、卸载与数据保留）。但该套 spec 尚未覆盖新 Host bridge 的 snapshot 恢复和 interaction 端到端接线，因此完整 Host Gate 仍保持 `not-run / blocked`，不得更新为 passed。

### Windows native E2E（10.5）

此前 GitHub Actions 失败发生在 WebDriver session 创建前（`127.0.0.1:4459` 无法连接），属于测试基础设施分类候选，不是产品 E2E 通过证据。本次本机 lane 已成功，但未在 GitHub 离线策略下重跑。按既定策略，即使后续确认是 WebDriver/端口/Firewall 等基础设施故障，也只能记录：

```json
{
  "gatePassed": false,
  "temporaryWaiver": true,
  "formalReleaseBlocked": true
}
```

本机结果不是 CI 离线门禁结果，因此不执行豁免，也不把基础设施故障写成 E2E 通过。

## 发布状态

- Host Gate：`not-run / blocked`；
- Windows native E2E：本机既有 lane 8/8；GitHub 离线门禁仍未取得新结果；
- 正式发布：`formalReleaseBlocked=true`；
- Coding Workstation UI：继续保持阻塞，直到 10.3/10.4 的真实生产证据完成。

后续只需完成生产安装/Resident IPC 验证、一次 Windows native 门禁分类，并把真实 commit/provenance 与结果回写到 OpenSpec 和 Superpowers；不得重复已通过的插件全量回归，除非出现新的失败证据或影响范围扩大。
