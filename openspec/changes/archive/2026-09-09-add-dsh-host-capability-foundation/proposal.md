## Why

已归档的 runtime-core 只交付了 Supervisor、供应链、最小 RuntimeFacade 骨架和一次性 loopback 执行通道；Coding 工作站需要的真实 DSH Workspace、Session、事件、交互、工件、终端、preset 与动态 Host 扩展控制面仍不存在，导致 `add-dsh-coding-workstation` 的 Host Gate 有 17 行缺失并停止生产 UI 实施。现在需要一个独立、可验收的 Host capability change，通过 DSH 官方公开控制面补齐这些能力，同时以 `v0.1.2-rc.1` 为可执行实现基线，并隔离最新源码兼容性基线 `v0.1.3-alpha.2` 的破坏性差异。

## What Changes

- 将 runtime-core 的最小 RuntimeFacade 扩展为 capability/schema 驱动的完整 Host 控制面，提供 per-action availability、结构化原因、平台与正式发布状态，并允许只读兼容时安全降级。
- 在 AIO 管理的隔离 DSH Home/Profile 中，通过版本隔离 Adapter 组合 DSH 官方 Session Controller、Typert Remote、SessionPersistence、Cordis lifecycle 与 Terminal seam；不解析或迁移 DSH JSONL，不复制 DSH Web BFF。
- 交付真实 Workspace 和 Session 生命周期、全局搜索、分页历史、snapshot/cursor、连续事件、controller lease、submit/queue/steer/cancel/restart、审批与问题收敛。
- 交付消息、reasoning、工具、job、workflow、context、文件、Diff、Terminal 与 Subagent 的稳定 presenter 元数据、来源身份、可用操作和脱敏通用回退。
- 交付 Host 报告的 preset roster、模型/服务来源和 Turn 级不可变配置，并沿用 AIO LLM Profile 作为 AIO 发起会话的默认配置入口。
- 交付创造模式所需的 Host-half 临时动态扩展生命周期、Agent/Session/generation 隔离和诊断；browser half 明确 fail closed，崩溃后不自动重放或激活。
- 交付通用 maintenance 状态机，为 runtime 维护及后续生态管理提供 drain、显式取消、停止、重启、健康检查和 rollback hook，但不执行扩展下载、安装或更新。
- 为后续 AIO/VCP 工具共享预留强类型 External Tool Provider 边界，包括发现、catalog、调用、取消、事件、策略、错误和生命周期；本 change 不接入任何具体 Provider。
- 以官方 wheel 真实验证 `v0.1.2-rc.1` Adapter，并以官方 tag/commit 源码 fixture 验证 `v0.1.3-alpha.2` 公共 API 兼容性；alpha.2 无官方 wheel 不阻断实现，但不得写成可执行 runtime 已通过。未知 DSH 发行版仅在必需 capability 与 schema 完整协商后进入；不得用语义版本或名称猜测兼容。
- 重新执行 Coding 工作站 Host Gate：R1–R17、R19–R20 必须通过，R18 必须为明确 fail-closed，R8 必须返回真实快照而非占位数据。

## Capabilities

### New Capabilities

- `dsh-host-capability-contract`: 定义 RuntimeFacade 握手、schema/capability 协商、操作级 availability、结构化错误、平台/发布状态和版本 Adapter 边界。
- `dsh-host-workspace-session`: 定义受管 DSH Home 中 Workspace/Session 身份、生命周期、搜索、分页历史、真实快照、事件连续性和多客户端控制语义。
- `dsh-host-interactions-artifacts`: 定义审批、问题、附件、文件、Diff、Terminal、Job、Workflow、Subagent、presenter 元数据和脱敏边界。
- `dsh-host-dynamic-runtime`: 定义 preset generation、创造模式 Host-half 动态扩展、维护窗口及未来 External Tool Provider 扩展缝。

### Modified Capabilities

- `dsh-runtime-lifecycle`: 扩展运行态为 upgrading、recovering、maintenance 与 incompatible，定义受管 DSH Home、官方迁移、恢复点和正式发布阻塞传播。
- `dsh-execution-bridge`: 将一次性 loopback/占位快照基础升级为基于 DSH 官方 Controller/Remote 的长期驻留、多会话真实控制面。
- `dsh-model-and-prompt-sync`: 增加 Host 模型 catalog、preset roster、实际 model/service/preset provenance 和跨 Turn 配置切换规则。

## Impact

- 主要生产实现位于独立仓库 `aiohub-plugin-dsh-workspace` 的新 worktree，并基于已验收 runtime-core 提交 `14c76483bcf7a7bdab9d4b59fb93e1ddad8b4bb0`；原插件仓和已有 worktree 不迁移。
- AIO 仓库承载 OpenSpec、Host Gate、跨仓集成与 Windows production IPC E2E；仅在公开集成契约确有缺口时做最小、增量、默认行为不变的修改。
- `deepseek-harness-alpha5-build` 与 `deepseek-harness-audit` 仅用于只读审计和版本对照；生产构建继续消费 runtime lock 选择的官方 wheel，不依赖本机源码绝对路径。
- `add-dsh-coding-workstation` 在本 change 验收并重跑 Host Gate 前保持阻塞。现有 `add-dsh-ecosystem-manager` 作为第四个 change，承接持久扩展目录、安装、升级、卸载、供应链治理及具体 AIO/VCP 工具桥接。
- Windows x64 是本 change 的完整支持平台。CI 基础设施豁免只能记录为 `infrastructure-blocked`、`gatePassed=false`、`formalReleaseBlocked=true`，不得作为产品 E2E 通过或正式发布证据。
