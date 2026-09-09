# dsh-execution-bridge Specification Delta

## MODIFIED Requirements

### Requirement: 公开扩展点上的完整无头执行域
桥接层 SHALL 作为项目侧 TypeScript/ESM DSH Cordis 插件运行，并由发行版隔离 Adapter 组合 DSH 公开的 Session Controller、Typert Remote、Workspace Controller、SessionPersistence、settings、credentials、prompt、terminal 和交互服务。桥接层 MUST NOT 修改或复制 Agent Loop、DSH Web BFF、会话持久化、上下文压缩、工具策略、审批、沙箱、工作流、Skill、子 Agent，也不得启动 DSH Web UI、导入私有注册表或解析 JSONL。DSH SHALL 始终是执行与会话的唯一权威。

#### Scenario: 桥接启动
- **WHEN** 受管 `aio-coding` Profile 完成 Cordis Loader settlement 且 Adapter 验证必需公开服务
- **THEN** 桥接才公布就绪状态、runtime provenance、sandbox 状态、Adapter identity 和版本化能力清单

#### Scenario: 公开服务缺失
- **WHEN** 当前 DSH runtime 未提供任一必需公共服务或行为契约
- **THEN** 桥接拒绝就绪或仅进入明确的权威只读模式，并列出缺失项，不导入私有模块或静默实现替代 Agent 行为

### Requirement: 完整会话控制契约
桥接 SHALL 维持一个可承载多个 Workspace 与 Session 的长期 DSH Host，并通过版本化、类型化命令提供创建、列出、全局搜索、打开、恢复、分页历史、提交 Prompt、取消、steer、队列新增/编辑/移除、重启、分叉、重命名、归档、恢复归档、删除、模型选择和工作区关联能力；每项能力 SHALL 映射到 DSH 公共控制服务并独立协商。DSH durable session 与日志是执行事实源，AIO 只保存引用、draft 和 UI 偏好。

#### Scenario: 恢复冷会话
- **WHEN** AIO 打开只存在于 DSH 持久化中的会话
- **THEN** 桥接使用 DSH 冷读取/恢复能力返回权威历史投影，不创建重复会话

#### Scenario: 分叉已完成 Turn
- **WHEN** 用户从已完成 Turn 分叉且 Host 广告 fork 能力
- **THEN** DSH 创建携带正确 lineage 的新 session；AIO 仅保存新引用，且两个分支不共享可变 session

#### Scenario: 取消活动任务
- **WHEN** controller 取消活动 Turn
- **THEN** 桥接调用 DSH 官方取消能力并持续转发状态，直到权威终态或执行域断开

#### Scenario: 操作未被当前 Adapter 证明
- **WHEN** 客户端请求一个未协商的 session mutation
- **THEN** 桥接结构化拒绝且不以相似命令或本地数据操作模拟该行为

### Requirement: 权威快照、可丢弃增量与有界背压
DSH 的 durable events、开始/完成事实和由官方控制面读取的真实 snapshots SHALL 是恢复依据；占位 cursor、合成空 facts 或 UI 缓存 MUST NOT 作为产品快照。文本、reasoning 和进度 delta MAY 被合并或丢弃，且不得成为唯一事实。桥接 SHALL 使用有界 ingress/egress queue、过载诊断、重连退避及 snapshot-plus-cursor 恢复。检测到事件缺口、重复、代际变化或 UI remount 时，AIO MUST 以权威快照重建后再应用连续增量。

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
桥接 SHALL 将 DSH runtime-to-host approval 和 user-question request 作为带稳定 interaction id、generation、session 与 Turn identity 的类型化 interaction 转发给 AIO，并 SHALL 将当前 controller 的 allow、deny、answer、cancel 或 timeout 结果只完成一次。DSH 始终保留最终策略裁决权；interaction 结束时必须发送 `interaction/resolved` 清除所有 UI 投影。重复、迟到或代际不匹配的响应 MUST NOT 触达 DSH。

#### Scenario: 用户批准一次操作
- **WHEN** DSH 请求审批且当前 controller 选择单次允许
- **THEN** 桥接只完成匹配 generation、lease 和 interaction id 的等待请求一次，并由 DSH 决定操作是否继续

#### Scenario: 请求在响应前失效
- **WHEN** Turn 取消、租约转移、执行域重启或 DSH 撤回 interaction
- **THEN** 所有观察视图收到 resolved 通知，迟到响应被拒绝且不得作用到新请求
