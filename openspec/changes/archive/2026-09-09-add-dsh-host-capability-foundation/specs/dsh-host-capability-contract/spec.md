# dsh-host-capability-contract Specification

## Purpose
定义与版本解耦的 RuntimeFacade 契约，使 AIO 无需猜测兼容性或导入上游内部实现即可消费已支持的 DSH Host 发行版。

## ADDED Requirements

### Requirement: 基于能力与 Schema 协商的 Host 握手
Host SHALL 在初始化时声明 contract、Adapter、平台、runtime provenance 与支持的 schema revision。兼容性 SHALL 根据必需 capability 与 schema 证据判定，不得依赖硬编码 DSH 版本比较。首个可执行验收基线 SHALL 使用 `v0.1.2-rc.1` 官方 wheel；`v0.1.3-alpha.2` SHALL 通过只使用 DSH 公共控制面的官方源码 fixture 验证 API 兼容性，并在官方 wheel 缺失时明确保持 runtime 验证未完成而不阻断 Host 实现。

#### Scenario: 已支持发行版完成初始化
- **WHEN** Adapter 为其 runtime 提供全部必需 capability 与兼容 schema
- **THEN** Host 返回协商后的契约，且只启用该协商已证明的操作

#### Scenario: 未知发行版具有相似版本模式
- **WHEN** 没有 Adapter 能为某 runtime 证明必需 capability 与 schema 集合
- **THEN** Host 进入 `incompatible`、报告缺失证据，且不根据版本字符串推断兼容性

### Requirement: 操作级可用性与安全降级
RuntimeFacade SHALL 使用稳定 capability ID 和结构化 unavailable 原因发布操作级可用性。缺失的 mutation capability SHALL fail closed。仅当 Host 能证明其暴露的全部状态仍然权威，并明确标记每个不可用操作时，客户端 MAY 进入只读兼容模式。

#### Scenario: Archive 操作不可用
- **WHEN** 当前 Adapter 无法将 session archive 映射到官方 DSH 操作
- **THEN** archive 被声明为不可用并附稳定原因，尝试执行时在触达 DSH 前被拒绝

#### Scenario: 只读兼容条件满足
- **WHEN** snapshot 与 history schema 兼容，但必需 mutation capability 不完整
- **THEN** Host 可以暴露权威只读投影，同时禁用所有未经证明的 mutation

### Requirement: 类型化命令、事件与错误
Command 与 event SHALL 使用版本化可辨识 DTO，不得使用无类型 payload。每个 mutation SHALL 携带 request identity，并在适用时携带 domain generation 与 controller lease。Error SHALL 暴露稳定 code、retryability、受影响 capability 和脱敏诊断；重复或过期 mutation identity MUST NOT 导致操作再次执行。

#### Scenario: Mutation 响应丢失
- **WHEN** 客户端因响应丢失而重复同一 mutation request identity
- **THEN** Host 返回已记录结果或结构化 indeterminate 结果，不再次执行 mutation

#### Scenario: Adapter 返回未知事件
- **WHEN** Host 无法用协商后的 schema 验证上游事件
- **THEN** Host 报告脱敏兼容诊断，且不将该事件投影为已知 durable fact

### Requirement: 平台与发布验证状态
Host SHALL 分别报告平台支持、runtime 完整性、Adapter 验证状态和 native E2E 发布状态。`infrastructure-blocked` native E2E 结果 SHALL 保持 `gatePassed=false` 与 `formalReleaseBlocked=true`，MUST NOT 表述为产品验证通过。

#### Scenario: Windows runner 的 WebDriver 不可用
- **WHEN** build、package、artifact verification 与 executable smoke 均通过，但 native E2E 被分类为允许的测试前基础设施故障
- **THEN** change 可带明确临时豁免继续，而 Host 仍报告正式发布被阻塞
