## Why

AIO 缺少面向代码任务的完整本地执行域，而 DeepSeek Harness（DSH）已提供 Agent Loop、持久会话、工具策略、审批、沙箱、工作流与子 Agent。需要以独立插件和公开扩展点将 DSH 纳入 AIO，使其成为可销毁、可重建、受策略约束的执行域，同时保持 AIO 日常启动轻量，并避免把 DSH 内部组件拆散后形成第二套不完整实现。

## What Changes

- 建立独立的 `aiohub-plugin-dsh-workspace` 仓库，开发期通过目录联接接入 AIO；Phase 1A 交付无头 runtime core，后续 change 再提供同级工具 `Coding工作站` 的完整 UI。
- AIO 只常驻轻量 Rust Supervisor，并按需或按预热设置启动 DSH 重型子进程。DSH 继续完整拥有 Agent Loop、会话日志、上下文压缩、工具、审批、沙箱、工作流、Skill 与子 Agent。
- 使用版本化 JSONL 协议连接 Supervisor 与项目侧 TypeScript/ESM Cordis bridge，提供能力协商、单写控制租约、只读观察、代际隔离、权威快照、背压及崩溃恢复。
- AIO LLM Profile 是唯一模型配置入口。首版强制支持经过验证的 VCP/OpenAI-compatible Chat Completions 映射；其他 Provider 仅在字段和行为可无损映射且通过黑盒测试后启用。
- DSH 保持唯一 System Prompt 组装权；AIO 用户文本通过公开组装扩展点注入，`{{Nova}}` 等占位符保持字面值，并继续仅由现有 VCP 链解析。
- 发布 `win32-x64`、`linux-x64` 和 `darwin-arm64` 的独立离线 ZIP；`linux-arm64` 只发布预览产物。优先使用精确匹配且通过门禁的官方 wheel，否则从固定 DSH tag/commit 原生可复现构建并记录完整来源。
- 对 AIO 增加一个可上游化的 POSIX ZIP 安装兼容修复，以安全保留或恢复经 manifest 验证的 Sidecar 可执行位；不改变 Windows 行为。
- 不新增 AIO 全局 Capability Runtime，不改变 AIO LLM 对话运行时，不嵌入 DSH Web UI，不在本 change 实现 DSH 插件/Skill 市场或 AIO/VCP RAG 与 Knowledge 协同。

## Capabilities

### New Capabilities

- `dsh-runtime-lifecycle`: 校验、准备、按需启动、可选预热、空闲回收、停止、重启、诊断和升级隔离的 DSH 执行域，并声明各平台支持等级与沙箱状态。
- `dsh-execution-bridge`: 通过 AIO Sidecar API v3 与 DSH 公开扩展点桥接会话命令、事件、控制租约、取消、审批、用户交互和恢复。
- `dsh-model-and-prompt-sync`: 将 AIO LLM Profile、真实凭据与用户 System Prompt 映射到 Turn 级不可变 DSH 配置快照，同时保留 VCP 占位符原文并拒绝有损降级。

### Modified Capabilities

无。

## Impact

- 新增独立仓库 `E:\workspace\projects\aiohub-plugin-dsh-workspace`；AIO 中 `plugins/dsh-coding-workspace` 仅为开发联接，不提交插件源码或 runtime 二进制。
- 固定 DSH `dsh-v0.1.2-alpha.1` / `cd5ef8148158c3a752a658978873241fdf8e2bbc` 作为首个基线。当前无可固定的 `0.1.2a1` 官方 PyPI runtime/SDK wheel 或 GitHub Release 附件，因此首版允许从该官方源码基线进行项目构建；未来满足门禁的官方 wheel 自动优先。
- 普通用户不需要另装 Node.js、Python、WSL2 或 DSH；每个平台包都携带其完整、已校验的 runtime 闭包、许可证、SBOM、来源与校验和。
- `win32-x64`、glibc 2.28+ 的 `linux-x64`（AIO `.deb`/`.AppImage`）和 macOS 14+ `darwin-arm64` 为 Phase 1 支持目标；AIO Flatpak 为兼容性门禁通道，`linux-arm64` 为不宣称正式支持的预览通道。
- DSH 可在与 AIO LLM 对话相同的本地同用户信任级别接触真实密钥；密钥不得进入日志、事件、诊断、崩溃报告、会话正文或支持包。
- AIO 核心原则上不变；仅在可复现失败证明公开扩展点不足时，允许实施隔离、默认兼容、可测试且可移除的最小兼容补丁。
