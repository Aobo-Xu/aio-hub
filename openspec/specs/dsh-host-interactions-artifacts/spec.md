# dsh-host-interactions-artifacts Specification

## Purpose
定义 Coding 工作站消费的 Host 侧交互、附件、工件、终端和执行 presenter 契约。

## Requirements

### Requirement: Exactly-once Approval 与 User Question
Host SHALL 将 DSH approval 与 user question 投影为带稳定 correlation、generation、session 和 Turn identity 的类型化 interaction。只有当前 controller MAY 响应。Allow、deny、answer、cancel、withdrawal 与 timeout SHALL 使 interaction 恰好收敛一次，且 DSH SHALL 保持最终策略权威。

#### Scenario: 迟到的 Approval 响应
- **WHEN** approval 已因撤回、超时、取消、控制权转移或重启而失效
- **THEN** 响应作为 stale 被拒绝，且不能影响后续 interaction

### Requirement: 由 Capability 广告的附件暂存
Host SHALL 广告附件数量、类型与大小限制。已接受附件 SHALL 暂存于 Host 自有临时存储，并带 content hash、所有权与生命周期元数据；来自 AIO 的 workspace 路径不得因此被视为可信。被拒绝或放弃的附件 SHALL 清理，且不修改用户源文件。

#### Scenario: 附件超出 Runtime 限制
- **WHEN** 候选附件违反已广告限制
- **THEN** staging 在提交 Prompt 前以结构化原因失败

### Requirement: 稳定 Presenter 元数据与脱敏回退
Host SHALL 将 message、reasoning、tool、job、workflow、context、file、diff、terminal 与 subagent 规范化为稳定 kind ID、source/model/preset provenance、生命周期状态和已广告操作。未知 kind SHALL 通过通用脱敏 presenter 保持可检查，MUST NOT 被错误标记为已知 kind。秘密和敏感路径 SHALL 在 event、log 或支持产物离开 Host 边界前完成脱敏。

#### Scenario: 遇到新的 DSH Event Kind
- **WHEN** 已支持 runtime 发出没有专用 presenter 的事件
- **THEN** Host 输出其稳定或 namespaced kind、脱敏结构化数据及零不安全操作，使 UI 可使用通用 presenter

### Requirement: 权威 File 与 Diff 工件
File 与 Diff 投影 SHALL 标识 workspace、path、revision/base 与 snapshot provenance。Preview、open、apply、revert 或 external-editor 操作 SHALL 独立广告并委派给官方 DSH 或 Host 受控操作；Host MUST NOT 因 UI 能渲染工件就宣称文件操作可用。

#### Scenario: Diff 可审阅但不可应用
- **WHEN** Host 有权威 Diff snapshot，但没有安全 apply capability
- **THEN** Host 暴露审阅数据，并以原因标记 apply 不可用

### Requirement: Terminal 生命周期与清理
Terminal 投影 SHALL 绑定 Agent、session、domain generation 与官方 terminal handle。Start、input、resize、interrupt 与 close SHALL 受 capability gate。Host 或 terminal 崩溃 SHALL 将 terminal 转为 interrupted 或 closed，并 SHALL 清理进程树且不重放命令。

#### Scenario: Domain Generation 结束
- **WHEN** Host generation 在 terminal 活动期间停止
- **THEN** 每个 terminal handle 变为不可写、报告最终状态，且其后代进程被回收

### Requirement: Job、Workflow 与 Subagent 保持 DSH 所有权
Host SHALL 暴露 DSH 自有 job、workflow 与 subagent identity、父子关系、进度、终态及受支持控制，不得建立平行的 AIO 执行所有权。缺失控制 SHALL 保持不可用，不得从 event 文本模拟。

#### Scenario: 观察到 Subagent
- **WHEN** DSH 在 Turn 下启动 subagent
- **THEN** Host 投影其权威父子关系与状态，且所有控制操作仅限 DSH 广告的 capability
