# Brainstorm Summary

- Change: add-dsh-host-capability-foundation
- Date: 2026-09-07

## 已确认的技术事实与边界

- 本 change 是独立 Host capability 设计轴，不包含 Coding 工作站 UI、生态安装管理或具体 AIO/VCP 工具桥接。
- DSH 保持 session、执行、策略与持久化的唯一权威；AIO 只保存引用、draft 与 UI 偏好。
- 生产实现位于独立 `aiohub-plugin-dsh-workspace` 仓库；Build 阶段在 AIO `.worktrees` 内创建链接 worktree，不迁移原仓库。
- 只依赖 DSH 官方 Session Controller、Typert Remote、SessionPersistence、Cordis、interaction 与 terminal 公共面，不复制 Web BFF、不导入私有 registry、不解析 JSONL。
- 通用 Host 以 capability/schema 协商兼容性，发行版差异收敛在 Adapter；`v0.1.2-rc.1` 和最新 `v0.1.3-alpha.2` 只是首批真实验证基线。
- 需要通过真实 snapshot、generation/lease fencing、exactly-once mutation 和 no-replay 恢复语义完成 Host Gate。
- 创造模式只实现 Host-half 动态包；browser half fail closed。External Tool Provider 只定义扩展缝，具体 AIO/VCP provider 留到第四个 change。

## 确认的技术方案

### 方案 A：稳定 Host Core + 发行版隔离 Adapter（已采用）

由 Supervisor 管理长期 DSH Host；稳定协议使用类型化 envelope、操作级 availability、真实 snapshot/event recovery 与结构化错误。每个 DSH 发行版只通过官方公开面 Adapter 接入。优点是上游侵入最小、兼容边界清晰、可独立验证；成本是需要维护发行版 Adapter 契约测试。

### 已排除方案 B：复用每个发行版的 DSH Web BFF

可更快取得接近 Web UI 的控制面，但会绑定 BFF 内部路由、wire 与 UI 假设，`v0.1.3-alpha.2` 的变化会直接扩散到 AIO，且难以保证无 UI 与最小上游侵入，故不推荐。

### 已排除方案 C：由 AIO/Rust Supervisor 重建 Session 与 Persistence 控制面

可获得完全稳定的本地协议，但会产生第二事实源、复制 DSH Agent/session/migration 语义，并违反不得解析 JSONL及上游优先原则，故排除。

## 关键取舍与风险

- 接受 Adapter 维护成本，以换取通用核心无版本硬编码和持续跟随上游能力。
- 接受未支持操作显示 unavailable，不通过本地模拟追求表面功能完整。
- 接受长期 Host 的并发状态复杂度，通过单 controller lease、generation fencing、有界队列和 snapshot-plus-cursor 收敛。
- 创造模式扩大 Host 安全面，只支持 generation 隔离、显式确认且崩溃后不重放的 Host half。
- 跨仓集成通过链接 worktree 改善 Agent 控制范围，但仍保留插件独立提交与发布生命周期。

## 测试策略

1. 先补 Host Gate 缺失能力的失败契约测试。
2. 分组运行 protocol/schema、RuntimeFacade、state machine 与 exactly-once 聚焦测试。
3. 对两个 DSH 真实发行版运行同一 Adapter 契约套件，并审计生产 bundle 不含私有/BFF/JSONL 依赖。
4. 运行 Supervisor 进程、真实 snapshot/recovery、interaction、terminal 与 no-replay 集成测试。
5. 阶段里程碑再运行 release-shaped ZIP、生产安装/resident IPC、Host Gate 和一次 Windows native E2E。
6. WebDriver/端口/runner 测试前基础设施故障只能按既有规则临时豁免，仍保持正式发布阻塞。

## Spec Patch

已将第二个真实验证基线从 `v0.1.3-alpha.1` 更新为 `v0.1.3-alpha.2`；同步补充 Windows Python SDK 启动/进程清理、persona 前后缀、队列与可继续子代理状态、PTC 命令输出以及普通 subprocess handle 无 pid 的 Adapter 验证边界。能力仍按 schema/capability 协商，不新增版本硬编码。
