# dsh-host-dynamic-runtime Specification

## Purpose
定义能力驱动的 preset、创造模式 Host-half 动态包、维护协调和未来 External Tool Provider 扩展缝，但不实现生态管理。

## ADDED Requirements

### Requirement: 能力驱动的 Preset Roster 与 Generation
Host SHALL 发布 DSH preset roster、语义模式、来源、generation、switch scope 与转换要求。Minimal、standard、PTC 与未来模式 SHALL 从 Host capability 数据发现，不得硬编码版本表。Preset 切换 SHALL 遵循 DSH 语义，且 SHALL NOT 改变活动 Turn 的不可变配置。

#### Scenario: Runtime 新增 Preset
- **WHEN** Adapter 验证新广告的 preset schema
- **THEN** Host 暴露其声明语义，无需新增版本名称判断

### Requirement: 显式的创造模式 Host-half 动态包生命周期
当 DSH 支持创造模式时，Host-half 动态包 SHALL 按 Agent/session 与 domain generation 隔离，并 SHALL 暴露类型化 define、run、update、stop、undefine、inventory 与 diagnostic 操作。进入更高风险的 creative generation SHALL 要求显式用户确认转换的证据。崩溃或重启 SHALL 让之前的临时包保持 inactive，MUST NOT 自动重建或重新运行。

#### Scenario: Creative Package 活动时崩溃
- **WHEN** Host generation 意外退出
- **THEN** package 在恢复后被报告为 interrupted 或 inactive，且需要用户显式操作才能重新 define 或 run

### Requirement: Browser-half Package Fail Closed
除非后续 capability 提供隔离、认证且 schema-validated 的 browser bridge，否则 Host SHALL NOT 在 AIO 内加载或执行 DSH browser/UI package。缺少该 capability SHALL 报告 unavailable，且 MUST NOT 影响 Host-half package 稳定性。

#### Scenario: Package 需要 Browser 执行
- **WHEN** 动态包声明 browser half，但未协商 browser bridge capability
- **THEN** Host 以结构化兼容原因拒绝该部分，同时保持 Host 安全运行

### Requirement: Maintenance 协调状态机
Host SHALL 为 drain、显式 cancel、stop、migration、health check、restart 与 rollback hook 暴露计划维护状态和操作。Maintenance SHALL fence 新 mutation 并保留 DSH 自有 session。本 change SHALL NOT 下载、安装、更新或删除 runtime 或生态 package。

#### Scenario: 存在活动工作时进入 Maintenance
- **WHEN** 调用方在 session 存在活动 Turn 或 interaction 时请求维护
- **THEN** Host 报告 blocker，并在停止 domain 前要求显式选择 drain 或 cancel

### Requirement: 版本化 External Tool Provider 扩展缝
Host SHALL 定义 provider-neutral 扩展边界，包含 provider identity、协商 capability、版本化 catalog snapshot、invocation ID、有序 event、cancel、policy/approval 元数据、typed error 与 connect/refresh/drain/disconnect 生命周期。本 change SHALL NOT 启用具体 AIO 或 VCP Provider，且该 seam MUST NOT 绕过 DSH 工具策略。

#### Scenario: 未配置 External Provider
- **WHEN** Host 初始化时没有 provider 实现
- **THEN** DSH 原生工具继续正常工作，external-provider capability 明确不可用
