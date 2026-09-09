# dsh-runtime-lifecycle Specification Delta

## MODIFIED Requirements

### Requirement: 受管生命周期、崩溃语义与 Windows 进程后端
Supervisor SHALL 管理 stopped、starting、ready、busy、stopping、crashed、unavailable、upgrading、recovering、maintenance 和 incompatible 状态，并使用 `domainGenerationId` 隔离每次启动。首发 Windows SHALL 使用 Job Object 与 DACL。DSH 意外退出后 MAY 自动恢复 runtime readiness，但 MUST NOT 自动重放活动任务、Prompt、交互响应、工具、Terminal 或动态包；受影响 Turn 和临时执行句柄 SHALL 标记为 interrupted，并由用户在新操作中显式继续。维护状态 SHALL fence 新 mutation，并区分产品不兼容、运行时故障和正式发布阻塞。

#### Scenario: 正常停止
- **WHEN** 用户停止执行域、禁用插件或退出 AIO
- **THEN** Supervisor 请求 flush/dispose，并在超时后使用平台后端回收全部后代进程

#### Scenario: 活动任务期间崩溃
- **WHEN** DSH 在 Turn 执行期间意外退出
- **THEN** 系统终结该代际所有 pending 操作、清除交互投影、标记 Turn 为 interrupted，且不自动重发 Prompt 或任何副作用

#### Scenario: 旧代际迟到输出
- **WHEN** 已停止代际产生迟到帧或退出通知
- **THEN** Supervisor 按 `domainGenerationId` 丢弃该输出，不改变新代际会话或作业状态

#### Scenario: 进入维护窗口
- **WHEN** runtime 进入 migration、health-check 或 rollback 协调过程
- **THEN** Supervisor 报告明确的 maintenance 子状态、拒绝新 mutation，并保留可恢复的 DSH session facts

### Requirement: 隔离数据、可回退升级与 POSIX 安装兼容
系统 SHALL 将受管 DSH Home/Profile、凭据镜像、桥接状态和临时文件放入插件拥有的隔离目录，并在升级失败时保留最后可用 runtime 与持久会话。任何 DSH session 数据升级 SHALL 通过对应发行版的官方迁移或打开流程执行；AIO 和插件 MUST NOT 解析、重写或自行迁移 DSH JSONL。维护前备份 SHALL 只覆盖受管 Host 数据，不得复制、覆盖或回退 workspace 源码与 Git 状态。POSIX 上 AIO ZIP 安装器 SHALL 安全保留普通文件的 Unix mode，或仅为 manifest 选中的当前平台 Native/Sidecar 二进制恢复可执行位；路径校验 MUST 保持不变并 MUST 拒绝 symlink 与特殊文件，Windows 行为不得改变。

#### Scenario: 未来 POSIX 安装并启动 Sidecar
- **WHEN** 后续平台扩展 change 启用 Linux 或 macOS 插件 ZIP 安装
- **THEN** 经 manifest 验证的 Supervisor 和必要 helper 必须具备可执行权限，且未被选中的数据文件不会被任意提升权限；此条件不构成当前 Windows 首发的支持声明

#### Scenario: 升级握手失败
- **WHEN** 新 runtime 或 bridge 无法通过校验、契约握手或冒烟测试
- **THEN** 系统回退最后可用版本，不迁移或删除原会话，并显示失败原因

#### Scenario: DSH session schema 需要迁移
- **WHEN** 新 Adapter 检测到受管 Home 使用旧 session schema
- **THEN** 它仅调用该 DSH 发行版的官方迁移路径并在失败时恢复受管数据备份，不接触 workspace 源码或 Git 状态
