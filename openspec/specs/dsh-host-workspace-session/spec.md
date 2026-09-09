# dsh-host-workspace-session Specification

## Purpose
定义长期驻留 DSH Host 的权威工作区、会话、历史、事件、控制与恢复行为，确保多工作区与多会话在跨客户端、重启和事件恢复过程中维持稳定身份、明确所有权与一致投影。

## Requirements

### Requirement: 受管 DSH Home 与稳定 Workspace Identity
Host SHALL 使用 AIO 自有的隔离 DSH Home/Profile，同时 DSH 保持 session 与执行事实的唯一所有者。Workspace 注册 SHALL 是用户显式操作，并 SHALL 分配不依赖显示名称或路径拼写的稳定 Host workspace ID。移除 workspace SHALL 默认只移除 Host 注册，除非用户独立确认了已广告的破坏性操作。

#### Scenario: 用户注册目录
- **WHEN** 用户显式添加有效目录
- **THEN** Host 创建或复用其稳定 workspace identity，且不复制或取得 workspace 源码与 Git 状态的所有权

#### Scenario: 用户移除 Workspace
- **WHEN** 用户从 AIO 移除 workspace
- **THEN** Host 保留目录与 DSH session 数据，除非用户另行请求并确认受支持的破坏性操作

### Requirement: 权威 Session 生命周期与发现
Host SHALL 通过官方 DSH 控制 API 暴露 capability-gated 的创建、列表、全局搜索、打开、恢复、重命名、归档、恢复归档、删除与分叉。搜索和历史 SHALL 支持分页、取消并受当前 domain generation 约束。AIO SHALL 只存储引用、draft 与 UI 偏好，不得建立第二份持久 session 记录。

#### Scenario: 打开冷 Session
- **WHEN** session 只存在于 DSH persistence 中
- **THEN** Host 通过发行版 Adapter 打开或恢复它，并返回相同的权威 identity 与 lineage

#### Scenario: 搜索被新请求替代
- **WHEN** 新的全局搜索替代仍在执行的旧搜索
- **THEN** 旧请求被取消，或其受 generation 约束的结果被丢弃，且不改变任何 session

### Requirement: 真实 Snapshot 与连续事件恢复
Host SHALL 提供来自真实 DSH 的 session snapshot，其中包含 durable facts、history cursor、event sequence、活动 interaction 与执行状态。规范化 event SHALL 携带 domain generation、单调有序 sequence，以及可用的 workspace、session、Turn、step、tool、job 与 subagent identity。重复事件 SHALL 幂等；出现缺口或 generation 变化 SHALL 强制通过 snapshot-plus-cursor 重建。

#### Scenario: 客户端发现 Sequence 缺口
- **WHEN** 下一事件 sequence 不连续
- **THEN** 客户端停止应用 delta，Host 在继续推送事件前提供新的权威 snapshot

#### Scenario: 运行中 Turn 的 UI 重新挂载
- **WHEN** workstation view 在 Host 仍存活时重新挂载
- **THEN** 它从 Host snapshot 与 cursor 重建，不依赖之前的 UI 内存

### Requirement: 显式 Controller Lease 与 Observer 互操作
每个 DSH session SHALL 最多有一个 mutation controller，并 MAY 在兼容的 AIO、DSH Web 与 DSH CLI 客户端间存在多个 observer。控制权获取和转移 SHALL 显式执行、受 generation fence，并通过 DSH 官方语义实现。聚焦或查看 session MUST NOT 静默取得控制权。

#### Scenario: 其他客户端持有控制权
- **WHEN** AIO 打开由兼容 DSH 客户端控制的 session
- **THEN** AIO 获得 observer 投影，只有显式转移成功后才能 mutation

### Requirement: Turn 提交、排队与中断语义
仅当发行版 Adapter 能证明对应 DSH 行为时，Host SHALL 暴露 submit、queue、steer、队列项编辑/移除、cancel 与 restart。取消 SHALL 持续到 DSH 报告权威终态。Restart 或 recovery MUST 创建新的显式操作，MUST NOT 重放之前的 Prompt 或副作用。

#### Scenario: Host 在 Turn 期间崩溃
- **WHEN** 进程 generation 在 Turn 到达 durable 终态前退出
- **THEN** Host 将 Turn 标记为 interrupted、清除受 generation 约束的控制与 interaction、重启后重建 durable state，且不重新提交工作

### Requirement: 面向只读消费者的有界 Context Summary
Host SHALL 暴露适用于临时只读提问的脱敏、有界 session/workspace summary 与 provenance。Summary SHALL 来自 DSH 权威事实，SHALL 标识遗漏或 stale 状态，并 SHALL NOT 修改或占用主 session 上下文。

#### Scenario: 完整 Summary 超出预算
- **WHEN** 权威上下文超过请求的 capsule budget
- **THEN** Host 返回带明确遗漏与来源 identity 的压缩有界 summary，不静默截断 provenance
