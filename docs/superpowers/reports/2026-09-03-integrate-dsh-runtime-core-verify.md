# 验证报告：integrate-dsh-runtime-core

- **Change**: integrate-dsh-runtime-core
- **日期**: 2026-09-04
- **阶段**: Verify（完整验证 verify_mode=full，review_mode=thorough）
- **产物语言**: zh-CN
- **基线**: DSH `dsh-v0.1.2-rc.1` / `a66e4702047846cdaa10c66c9d3df3951f5ea70d` 官方 Windows wheel；稳定事实源 `runtime-lock/dsh-runtime.json`；AIO base_ref `954857de`
- **结论**: FAIL（7.3 已闭合；7.4 仍缺 GitHub Windows runner 防火墙实跑证据）

## 2026-09-04 runtime 基线与临时豁免修订

DSH Windows runtime 已从旧的源码构建路线切换到 `v0.1.2-rc.1` 官方 `deepseek-harness-runtime-bin` wheel。插件稳定 lock 记录 tag/commit、PyPI 持久 URL、wheel SHA-256、两个 executable hash、上游 LICENSE/第三方声明和 SBOM；获取器先验 wheel 再动态发现版本化 metadata 目录。解析器、打包器、release verifier、Supervisor 和复用测试不包含 DSH 版本常量，未来版本 fixture 已证明无需重编译 Supervisor。插件验证提交为 `e8575534ccf7dfacfa86cda8bd3c0d4c40f70205`。

本地证据：官方 wheel 获取及逐文件校验通过；release ZIP 生成并由 verifier 返回零失败；供应链/安装定向 Vitest 13/13、Supervisor tests 44/44、插件 `bun run check` 全部通过。一次插件完整 Vitest 回归中，两个产物断言因运行前仍是旧 ZIP 而失败，重建 ZIP 后定向复验通过；另有既存 generated-contract 隔离测试超过其 5 秒上限，该超时与 runtime 变更无因果关系，未作为产品通过证据。

Windows workflow 新增严格分类器：只有 WebDriver 无法连接且没有任何测试结果产生时，才可在所有构建、打包、产物校验和 executable smoke 硬门禁通过后输出 `infrastructure-blocked`。该报告固定 `gatePassed=false`、`formalReleaseBlocked=true`；产品断言、IPC/Sidecar 或未知失败仍使 job 失败。临时豁免只允许 change 继续，不代表 E2E 通过，正式发布前仍必须取得 Windows native E2E 成功证据。

## 最新实机复核（2026-09-04）

通过固定 Edge 152 driver、`@wdio/tauri-service@1.1.0` 本地兼容补丁及显式 `AIO_E2E_*` 配置，当前最终 ZIP 已稳定通过生产 Tauri/WebDriver 会话。最新隔离运行目录为 `.dev-data/dsh-native-20260904-final-swap-green`，生产 IPC 原生 E2E 为 8/8 通过；ZIP SHA-256 为 `2c4a67a361c498a91e48119b2112f2a05c0ca4b1789f4a170543d59e081984d5`，其中 runtime SHA-256 为 `b4c535691aa05b523f08f4d9ba858a0b47ad0c662ae9251a974ebafb4fada871`。本节取代下方早期 WebDriver 失败结论。

本轮补齐了宿主两阶段升级事务：候选通过独立 resident probe 的 initialize、lease 和真实 loopback coding Turn 后，才从未执行过的同卷准备目录切换 payload；失败候选保留最后可用 runtime，持久插件数据不参与交换。E2E 已验证成功升级、损坏 runtime 回退、probe data 清理及 Windows 进程树退出。DSH preset 同时改为服务预构建前端，避免离线阶段启动 Vite development dependency scan。OpenSpec 7.3 因此闭合。公开插件仓 `Aobo-Xu/aiohub-plugin-dsh-workspace` 的固定提交仍为 `12612fc8954555cbb91d2f8401d43e3ab59fb477`；AIO workflow 已固定到该可获取来源。7.4 尚不能闭合：本机无提升权限，不能代替 GitHub runner 提供 Windows Firewall 实际断网证据，且 AIO workflow 尚未提交/推送供 Actions 执行。

## 审计更正（2026-09-03）

此前“原生 E2E 5/5 通过”的结论不能由当前工作区复现。以最终 Windows ZIP、`src-tauri/target/debug/aiohub.exe`、隔离 app-data 和离线运行配置执行 `bun run test:tauri:e2e -- --preset dsh-runtime-native` 时，`@wdio/tauri-service@1.1.0` 在 `onPrepare` 报告 `msedgedriver version mismatch. Edge: 152.0.4191.53, Driver: unknown`，随后 worker 对 `127.0.0.1:4459/session` 的连接被拒绝；诊断同时指出 `tauri-driver` 未找到。应用和 WebDriver 会话均未启动。

因此 OpenSpec 7.3 与 7.4，以及 Superpowers Task 14 Step 3--4 和 Task 15 Step 3 恢复为未完成。现有 E2E 还未覆盖规格列出的真实 mock-provider 完整 Turn、后代进程/flush、崩溃 interrupted 与绝不重放、冷恢复和失败回退。静态 ZIP/release verifier 与 CI YAML 合同测试仍可通过，但不能作为原生门禁成功的证据。

## 1. 任务完成度

`tasks.md` 为 37/38：7.3 已完成，只有 7.4 尚未完成；Superpowers Task 14 已闭合，Task 15 Step 3 仍等待 GitHub Windows runner 的真实离线门禁。

## 2. 规模评估

`comet state scale` 判定为 full：Tasks=38（>3）、delta specs=3 能力（>1）、变更文件=67（>8）。变更文件中绝大多数为 origin/dev 合并带入的无关上游提交；本 change 在 AIO 侧的真实改动为 E2E/CI/测试支撑文件，主体实现位于独立插件仓 `aiohub-plugin-dsh-workspace`。

## 3. 集成代码审查（thorough）

对含 Build 审查修复在内的最终 diff 做了一次集成审查，聚焦正确性、安全与边界。发现并处理：

- **[IMPORTANT｜已修复] 测试超时导致 `bun run test` 间歇失败**：`tests/contract/generated-drift.test.ts` 中调用 `cargo run` 的用例（冷缓存约 5.6s）超过 vitest 默认 5000ms 超时，使裸 `vitest run` 偶发失败，威胁测试门禁与必过 CI 稳定性。经 `verify-fail → build` 循环修复：在 `vitest.config.ts` 设 `testTimeout: 120_000`，与既有慢测试（`timeout: 120_000`）及验证命令一致。修复后 `bun run test` 稳定通过（20 文件 / 115 测试）。
- **[已在 Build 修复] interrupted-turn ledger 原子性**：改为临时文件+原子替换，损坏账本隔离为 `.corrupt` 而非阻塞冷恢复；补对应回归测试。
- **[已在 Build 修复] package-platform staging 清理**：`PACKAGE_SUPERVISOR_MISSING` 路径补充清理暂存目录。
- **[已修复] 陈旧 node_modules 双版本 `@codemirror/language`**：`bun run build`（vue-tsc）因 node_modules 与 lock 不同步出现跨版本 `LanguageSupport` 类型冲突；以 `bun install --force` 按 lock 重建后 `bun run build` 通过。未改动任何依赖版本。

无 CRITICAL 遗留；无硬编码密钥；无新增 unsafe；诊断/日志/支持包全链路脱敏由测试覆盖。

## 4. 规格场景覆盖（46 场景）

三个能力规格共 46 场景的大部分已有自动化覆盖；native E2E 已闭合，required CI 仍有明确证据缺口，不能声明全量通过：

- `dsh-runtime-lifecycle`（17 场景）：可复现离线 runtime、支持矩阵、生命周期/崩溃语义、沙箱状态、最小 Supervisor ABI、升级失败自动回退均已覆盖；仅 GitHub runner 防火墙离线门禁尚未取得通过证据。
- `dsh-execution-bridge`（15 场景）：单一契约源与初始化协商、控制租约与代际栅栏、完整会话控制、权威快照与有界背压、审批/用户问题往返、可迁移 RuntimeFacade。
- `dsh-model-and-prompt-sync`（14 场景）：AIO 唯一模型入口（VCP/OpenAI-compatible 必需映射）、拒绝启发式/有损降级、真实凭据受控镜像、DSH 独占 System Prompt 组装、`{{Nova}}` 字面保真、Turn 级不可变配置。

## 5. 设计与 Design Doc 一致性

RuntimeFacade、Supervisor、单源协议、供应链、租约快照、模型与凭据、沙箱、升级事务及 Windows 生产 IPC E2E 主链与 `design.md` 一致。唯一未闭合项是 required GitHub runner 的真实断网通过记录；本地 `AIO_E2E_OFFLINE_RUNTIME=1` 只禁止 runtime/driver 下载，不冒充操作系统级断网证据。

## 6. 新鲜验证证据（本会话）

| 命令                                                                               | 结果                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| 插件仓 `bun run test`                                                              | 20 文件 / 115 测试通过，exit 0                  |
| 插件仓 `cargo fmt --check` / `cargo clippy -D warnings` / `cargo test --workspace` | 全通过                                          |
| 插件仓 `bun scripts/verify-release.ts`                                             | supported=[win32-x64], preview=[], failures=[]  |
| 插件仓 `bun run package:platform`                                                  | 生成离线 ZIP + `.sha256`                        |
| AIO `bun run build`（vue-tsc + vite）                                              | exit 0                                          |
| AIO DSH 支撑测试（workflow 合同 + runner-options）                                 | 17/17 通过                                      |
| AIO 原生 E2E `--preset dsh-runtime-native`                                         | FAIL：WebDriver 版本识别失败，未创建 Tauri 会话 |
| AIO build guard（13 项）                                                           | 全过，phase 推进                                |

后续 build 修复循环的新鲜证据：

| 命令                                                                                                                     | 结果                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 插件仓 `bun run package:platform && bunx vitest run tests/e2e/installed-plugin.test.ts && bun scripts/verify-release.ts` | ZIP 合同 2/2；supported=[win32-x64]；failures=[]；exit 0                          |
| 插件仓 `bunx vitest run tests/e2e/installed-plugin.test.ts tests/e2e/runtime-artifact.test.ts`                           | 3/3 通过                                                                          |
| 插件仓 `cargo test -p aio-dsh-supervisor --test stdio_abi`                                                               | 11/11 通过                                                                        |
| AIO workflow focused validation                                                                                          | 7/7 通过；含每次运行随机 crash token、唯一 firewall rule、仅上传 checksum/result  |
| AIO 升级事务 Rust 定向测试                                                                                              | 3/3 通过；失败交换恢复、拒绝保留、成功交换与数据保留                              |
| AIO DSH preset frontend mode 测试                                                                                       | 12/12 通过；DSH 使用预构建 preview，其他 preset 保持 development                  |
| AIO 原生 E2E（升级事务与预构建前端）                                                                                    | 8/8 通过，exit 0；无残留 Supervisor/runtime 进程；未施加 OS firewall              |

## 7. 上游兼容评估（按 AGENTS.md）

- AIO 核心未改默认行为；唯一核心补丁为 POSIX ZIP 安装可执行位修复，满足设计第 9 节兼容补丁门槛（additive、默认保持、隔离、带回归、可移除、可上游化）。
- 插件为独立仓库 + 开发 junction，未向 AIO 提交插件源码或 runtime 二进制。
- 未复制 DSH Agent 语义；bridge 仅映射公开服务。未引入破坏兼容变更。

## 8. 明确延后 / 不在范围

- `linux-x64`（.deb/.AppImage）、`darwin-arm64`、`linux-arm64` 预览、Flatpak：延后至独立 change；runtime lock 相应平台为 not-built，系统明确拒绝。
- `Coding工作站` 完整 UI、DSH 插件/Skill 市场、AIO/VCP RAG 与 Knowledge 协同、端云同步：不在本 change。

## 9. 结论

37/38 任务完成。生产 IPC Windows 原生 E2E 已覆盖最终 ZIP 安装、真实 Turn、lease/cancel、flush/进程树清理、崩溃 interrupted/不重放、冷恢复、成功升级、失败回退、卸载与数据保留。7.4 的固定插件来源和 workflow 实现已有本地契约证据，但尚无 GitHub runner 防火墙离线成功记录，且 AIO workflow 未提交/推送。验证保持 **FAIL**，不能进入 archive。
