## ADDED Requirements

### Requirement: AIO 是唯一模型配置入口
系统 SHALL 只允许用户从 AIO 已启用的 LLM Profile 中为 Coding工作站选择模型，并 SHALL 通过 `aiohub-sdk` 公共能力读取同步输入；不得暴露 DSH 自有模型设置 UI。`AioProfileAdapter` SHALL 使用显式、版本化、可验证的映射，Phase 1 的必需映射为 VCP/OpenAI-compatible Chat Completions。

#### Scenario: 选择 VCP/OpenAI-compatible Profile
- **WHEN** Profile 的 Base URL、Bearer 凭据、model、headers 和 Chat Completions 语义可完整映射
- **THEN** adapter 生成精确 DSH route、credential ref 与 capability 声明，并在启动前通过验证

#### Scenario: 其他 Provider 映射已完整验证
- **WHEN** Anthropic、Gemini、DeepSeek 或其他 Provider 的请求、流、错误、取消、tool call 和扩展字段均有明确映射及黑盒测试
- **THEN** 系统可通过独立 adapter 启用该 Provider，而不改变默认 VCP/OpenAI-compatible 路径

### Requirement: 不允许启发式或有损降级
系统 MUST 对无法无损映射的 Provider、认证方式、请求字段或响应语义明确拒绝。Provider 名称相似、未知字段、默认 endpoint 或静默丢字段均不得作为 fallback。

#### Scenario: Profile 含未支持字段
- **WHEN** 所选 Profile 包含会影响请求行为但 adapter 未声明支持的字段
- **THEN** 系统禁止启动该配置并列出字段级不兼容原因

#### Scenario: Provider 名称相似
- **WHEN** Profile 名称看似兼容但 protocol/auth semantics 不匹配
- **THEN** 系统不改用相似 adapter，也不将请求发送到猜测的 endpoint

### Requirement: 真实凭据的受控镜像
DSH MAY 在与 AIO LLM 对话相同的本地同用户信任级别接触所选 Profile 的真实凭据。Supervisor SHALL 通过 atomic replacement 在插件拥有的 DSH Home 中维护最小凭据镜像，POSIX 使用 owner-only mode，Windows 使用 owner DACL，并在 Profile 切换、解绑或用户清除时移除 stale reference。常规协议只携带 opaque Profile/credential reference；日志、事件、环境转储、child stdout/stderr、崩溃报告和支持包 MUST 全面脱敏。

#### Scenario: 启动需要真实密钥的 Profile
- **WHEN** 用户选择含真实 key 的兼容 Profile
- **THEN** Supervisor 原子写入仅当前 route 所需的 DSH 官方 credential record，并仅向 UI 返回 configured/引用/脱敏状态

#### Scenario: 活动 Turn 期间轮换 key 值
- **WHEN** 同一 route identity 的 key 被 AIO 更新
- **THEN** DSH 可按官方 per-operation credential seam 在下一次模型操作读取新值，而 Turn 的 route identity、model 与参数快照保持不变

#### Scenario: 凭据同步失败
- **WHEN** 安全写入、ACL/mode 设置或 DSH credential validation 失败
- **THEN** 系统停止启动并返回引用级诊断，错误内容不包含 key 值

### Requirement: DSH 独占 System Prompt 组装
DSH SHALL 保持 System Prompt 的唯一组装权。系统 MAY 通过 DSH 公共 `system-prompt/assemble` 扩展点追加 AIO 用户段，但 MUST NOT 复制、替换或重排 DSH identity、工具指导、runtime context 和项目指令。AIO 与 bridge MUST NOT 解释 VCP 模板语义。

#### Scenario: 注入 AIO 用户段
- **WHEN** 用户为 Coding工作站配置 System Prompt 文本
- **THEN** bridge 通过公共 seam 将其作为独立 contribution 交给 DSH，并由 DSH 生成最终 System Prompt

#### Scenario: 公共 seam 不足
- **WHEN** 可复现测试证明固定 DSH 版本无法通过公共 seam 保持所需文本或顺序
- **THEN** 团队先记录失败证据；仅允许采用隔离、默认兼容、带开关、可移除且可上游化的最小兼容补丁

### Requirement: VCP 占位符字面保真
用户注入段中的 `{{Nova}}` 等完整双花括号组 MUST 在交给模型 Provider 的最终文本中逐字节不变，并继续只由现有 VCP backend 解析。桥接 MUST NOT 新增 VCP Agent 解析器。若固定 DSH 插值器无法直接保留字面值，桥接 MAY 仅对 AIO 用户段使用确定、无冲突、可逆且不递归求值的内部编码；DSH 自有 prompt section 不得经过该编码。

#### Scenario: 使用 VCP Agent 占位符
- **WHEN** AIO 用户段包含 `{{Nova}}`
- **THEN** DSH 最终模型请求仍包含完全相同字节，且本地不读取 Nova 或展开其语义

#### Scenario: 畸形或重复花括号
- **WHEN** 输入包含重复、相邻或未闭合花括号
- **THEN** codec 仅处理完整组，其余文本保持 DSH 既有字面规则，并通过逐字节回归测试

#### Scenario: 上游提供正式 escape
- **WHEN** 后续固定 DSH 版本提供可验证的字面量 escape
- **THEN** adapter 优先迁移到官方能力并移除本地 codec，不改变用户输入或 VCP 行为

### Requirement: Turn 级不可变运行配置
每个新 Turn SHALL 在开始时冻结模型 route、model、非秘密参数、System Prompt contribution、workspace、权限与 sandbox policy 的版本化快照。该快照 SHALL 跨 steps、retry、tool execution 和 compaction 保持不变；用户对 Profile、Prompt、workspace 或权限的编辑只应用于同一 session 的下一个新 Turn。仅凭据值可按 operation 轮换，不得改变 route identity。

#### Scenario: 活动 Turn 期间修改 Prompt 或模型
- **WHEN** 用户在 Turn 执行中修改 AIO Profile 或 System Prompt
- **THEN** 当前 Turn 继续使用原 generation，新配置仅在下一个 Turn 生效且 UI 显示两者代际

#### Scenario: compaction 发生
- **WHEN** DSH 在活动 Turn 内压缩上下文
- **THEN** 压缩由 DSH 独立完成，且不会重新读取或替换该 Turn 的 AIO 配置快照
