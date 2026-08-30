## ADDED Requirements

### Requirement: 公开扩展点上的完整无头执行域
桥接层 SHALL 作为项目侧 TypeScript/ESM DSH Cordis 插件运行，使用 DSH 公开的 Gateway、Session Controller、Workspace Controller、settings、credentials、prompt 和交互服务。桥接层 MUST NOT 修改或复制 Agent Loop、会话持久化、上下文压缩、工具策略、审批、沙箱、工作流、Skill、子 Agent，也不得启动 DSH Web UI。

#### Scenario: 桥接启动
- **WHEN** 受管 `aio-coding` Profile 完成 Cordis Loader settlement
- **THEN** 桥接才公布就绪状态、runtime provenance、sandbox 状态和版本化能力清单

#### Scenario: 公开服务缺失
- **WHEN** 固定 DSH 版本未提供任一必需公共服务或行为契约
- **THEN** 桥接拒绝就绪并列出缺失项，不导入私有模块或静默实现替代 Agent 行为

### Requirement: 单一契约源与初始化协商
Supervisor 与 DSH bridge SHALL 使用 JSONL 帧通信。Rust 协议 crate SHALL 是 schema 的单一编辑源，并生成 JSON Schema 与 TypeScript declarations；CI SHALL 验证生成物和 contract hash。接受会话命令前 MUST 完成 `initialize`，交换协议版本、runtime build/provenance、平台事实，以及默认启用的 stable 与需显式协商的 experimental capability。

#### Scenario: 兼容初始化
- **WHEN** 两端主版本、contract hash 和必需 stable capabilities 兼容
- **THEN** 系统返回协商后的能力集合并接受仅属于该集合的命令

#### Scenario: 契约不兼容
- **WHEN** 主版本、contract hash 或必需 capability 不兼容
- **THEN** 系统拒绝执行域就绪，保留最后可用 runtime，并返回结构化诊断

### Requirement: 控制租约与代际栅栏
每个 DSH session SHALL 同时最多有一个可变 controller lease，并 MAY 有多个只读 observer。控制权转移 MUST 显式执行。所有可变命令和交互响应 MUST 携带当前 `domainGenerationId` 与 `leaseId`；每条帧还 SHALL 携带协议版本、单调连接序号，以及可用的 DSH `sessionId`、Turn、step、tool call、job 或 sub-agent 标识。

#### Scenario: 第二个窗口打开同一会话
- **WHEN** 一个 session 已有 controller 而另一 AIO 视图打开它
- **THEN** 新视图只获得 observer 权限，除非当前 controller 显式转移或释放租约

#### Scenario: 迟到写操作
- **WHEN** 命令携带旧 `domainGenerationId` 或过期 `leaseId`
- **THEN** Supervisor 拒绝该命令且不触达 DSH

### Requirement: 完整会话控制契约
桥接 SHALL 提供创建、列出、搜索、恢复、读取历史、提交 Prompt、取消、steer、队列控制、分叉、重命名、模型选择和工作区关联能力；每项能力 SHALL 映射到 DSH 公共控制服务。DSH durable session 与日志是执行事实源，AIO 只保存引用和 UI 偏好。

#### Scenario: 恢复冷会话
- **WHEN** AIO 打开只存在于 DSH 持久化中的会话
- **THEN** 桥接使用 DSH 冷读取/恢复能力返回权威历史投影，不创建重复会话

#### Scenario: 分叉已完成 Turn
- **WHEN** 用户从已完成 Turn 分叉
- **THEN** DSH 创建携带正确 lineage 的新 session；AIO 仅保存新引用，且两个分支不共享可变 session

#### Scenario: 取消活动任务
- **WHEN** controller 取消活动 Turn
- **THEN** 桥接调用 DSH 官方取消能力并持续转发状态，直到权威终态或执行域断开

### Requirement: 权威快照、可丢弃增量与有界背压
DSH 的 durable events、开始/完成事实和 snapshots SHALL 是恢复依据；文本、reasoning 和进度 delta MAY 被合并或丢弃，且不得成为唯一事实。桥接 SHALL 使用有界 ingress/egress queue、过载诊断、重连退避及 snapshot-plus-cursor 恢复。检测到事件缺口、重复、代际变化或 UI remount 时，AIO MUST 以权威快照重建后再应用连续增量。

#### Scenario: UI 重新挂载
- **WHEN** Coding工作站 UI 卸载后重挂载而 DSH 仍运行
- **THEN** 桥接先返回权威 snapshot，再从确认 cursor 继续增量，不依赖 UI 内存

#### Scenario: 慢消费者导致队列饱和
- **WHEN** presentation delta 的产生速度超过 AIO 消费速度
- **THEN** 桥接可合并或丢弃 disposable delta，但必须保留终态和可恢复事实，并报告 overload 诊断

#### Scenario: 发现事件缺口
- **WHEN** AIO 检测到 sequence 不连续或 generation 改变
- **THEN** 系统暂停增量投影并请求 snapshot/history 重建，禁止猜测缺失内容

### Requirement: 审批与用户问题往返
桥接 SHALL 将 DSH runtime-to-host approval 和 user-question request 作为带 correlation id 的 interaction 转发给 AIO，并 SHALL 将 controller 的 allow、deny、answer、cancel 或 timeout 结果只完成一次。DSH 始终保留最终策略裁决权；interaction 结束时必须发送 `interaction/resolved` 清除所有 UI 投影。

#### Scenario: 用户批准一次操作
- **WHEN** DSH 请求审批且当前 controller 选择单次允许
- **THEN** 桥接只完成匹配 generation、lease 和 correlation id 的等待请求一次，并由 DSH 决定操作是否继续

#### Scenario: 请求在响应前失效
- **WHEN** Turn 取消、租约转移、执行域重启或 DSH 撤回 interaction
- **THEN** 所有观察视图收到 resolved 通知，迟到响应被拒绝且不得作用到新请求

### Requirement: 可迁移的 RuntimeFacade
AIO UI SHALL 只依赖插件本地、无 Vue/Pinia 类型的 `RuntimeFacade` 和版本化 DTO。Facade SHALL 以稳定 capability id `execution-domain:dsh` 描述执行域，并保持可被未来 AIO 全局 Capability Runtime 注册或替换；它 MUST NOT 替换或冒充 AIO RP-first `conversation-runtime:default`。

#### Scenario: 未来接入全局 Capability Runtime
- **WHEN** AIO 后续提供全局 capability registry
- **THEN** 适配器可注册现有 Facade，而无需修改 Supervisor/bridge 协议、DSH session 事实或 UI DTO
