# dsh-model-and-prompt-sync Specification Delta

## MODIFIED Requirements

### Requirement: AIO 是默认模型配置入口
系统 SHALL 默认允许用户从 AIO 已启用的 LLM Profile 中为 Coding工作站选择模型，并 SHALL 通过 `aiohub-sdk` 公共能力读取同步输入；工作站不得复制 AIO 已有的 AI 服务或模型元数据设置。`AioProfileAdapter` SHALL 使用显式、版本化、可验证的映射，首发必需映射为 VCP/OpenAI-compatible Chat Completions。若 DSH 官方能力要求 AIO 尚未覆盖的设置，Host MAY 在受管 DSH Profile 中保存该最小补充；兼容 DSH-native Profile 仅可作为显式高级选择，且不得成为静默 fallback。

#### Scenario: 选择 VCP/OpenAI-compatible Profile
- **WHEN** Profile 的 Base URL、Bearer 凭据、model、headers 和 Chat Completions 语义可完整映射
- **THEN** adapter 生成精确 DSH route、credential ref 与 capability 声明，并在启动前通过验证

#### Scenario: 其他 Provider 映射已完整验证
- **WHEN** Anthropic、Gemini、DeepSeek 或其他 Provider 的请求、流、错误、取消、tool call 和扩展字段均有明确映射及黑盒测试
- **THEN** 系统可通过独立 adapter 启用该 Provider，而不改变默认 VCP/OpenAI-compatible 路径

#### Scenario: 使用兼容的 DSH-native Profile
- **WHEN** 用户显式选择 Host 验证过的 DSH-native Profile 且所需能力不属于 AIO 现有设置面
- **THEN** Host 在隔离受管 Profile 中应用该配置、标明来源，并保持 AIO 默认 Profile 路径不变

### Requirement: Turn 级不可变运行配置
每个新 Turn SHALL 在开始时冻结模型 route、实际 model、service/source、preset、非秘密参数、System Prompt contribution、workspace、权限与 sandbox policy 的版本化快照。该快照 SHALL 跨 steps、retry、tool execution 和 compaction 保持不变并随历史事件保留 provenance；用户对 Profile、Prompt、preset、workspace 或权限的编辑只应用于同一 session 的下一个新 Turn。仅凭据值可按 operation 轮换，不得改变 route identity。

#### Scenario: 活动 Turn 期间修改 Prompt 或模型
- **WHEN** 用户在 Turn 执行中修改 AIO Profile、System Prompt 或 DSH preset
- **THEN** 当前 Turn 继续使用原 generation 和完整配置快照，新配置仅在下一个 Turn 生效且 Host 同时报告当前值与待应用值

#### Scenario: compaction 发生
- **WHEN** DSH 在活动 Turn 内压缩上下文
- **THEN** 压缩由 DSH 独立完成，且不会重新读取或替换该 Turn 的 AIO 配置快照

#### Scenario: 查看历史 Turn
- **WHEN** 当前 catalog 或 Profile 已发生变化
- **THEN** 历史 Turn 仍显示执行时记录的 model、service/source 和 preset，而不是用当前配置重写

## RENAMED Requirements

- FROM: `### Requirement: AIO 是唯一模型配置入口`
- TO: `### Requirement: AIO 是默认模型配置入口`
