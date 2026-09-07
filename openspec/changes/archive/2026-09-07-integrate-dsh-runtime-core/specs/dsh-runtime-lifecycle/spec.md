## ADDED Requirements

### Requirement: 可复现且离线的 Windows x64 运行时
系统 SHALL 为 `win32-x64` 发布独立 ZIP，并携带固定 DSH 版本、commit、manifest-selected Supervisor、完整 runtime 闭包、来源类型、构建工具链、持久化 SHA-256、许可证与 SBOM。构建流水线 SHALL 优先采用精确兼容且通过门禁的官方平台 wheel；不存在时 MAY 从固定官方 tag/commit 原生构建，并 MUST 将产物标记为项目构建而非上游发布。用户首次启动 MUST NOT 下载 runtime，也不得要求系统已安装 Node.js、Python、WSL2 或 DSH。

#### Scenario: 官方 wheel 可用
- **WHEN** 精确版本和平台的官方 wheel 可下载且通过来源、完整性、许可证与黑盒测试
- **THEN** 发布流水线选择该 wheel，并在 runtime lock 中记录不可变来源和哈希

#### Scenario: 官方 wheel 缺失
- **WHEN** 固定 DSH 基线没有可持久获取的目标平台官方 wheel
- **THEN** 发布流水线使用固定 tag/commit 和声明工具链原生构建，记录构建来源、工具链、哈希、SBOM 与许可证，并运行同一套 release-shaped 黑盒测试

#### Scenario: 运行时被篡改
- **WHEN** runtime 实际校验和、契约哈希或平台描述与 lock 不一致
- **THEN** Supervisor 拒绝执行，保持工作区和持久会话不变，并返回不含秘密的修复诊断

### Requirement: 明确的 Windows x64 首发支持矩阵
本 change SHALL 只完整支持 `win32-x64`。glibc 2.28+ 的 `linux-x64`、macOS 14+ 的 `darwin-arm64`、`linux-arm64` 预览和 AIO Flatpak 兼容性 MUST 由后续独立 change 实现与验证；本 change 不得将 Windows 证据或通用代码路径表述为这些平台的支持。其他平台 SHALL 明确失败，不得选择名称相近的 runtime。

#### Scenario: 延后平台启动
- **WHEN** 用户在 `linux-x64`、`darwin-arm64`、`linux-arm64` 或 Flatpak 环境启动 Coding工作站
- **THEN** 系统明确报告该平台尚未由此首发支持，不尝试跨架构或降级运行，也不放宽 sandbox

#### Scenario: 未支持平台
- **WHEN** 平台为 `darwin-x64`、`win32-arm64` 或其他未列入支持矩阵的组合
- **THEN** 系统在执行前明确拒绝，并报告可用平台，不尝试跨架构或降级运行

### Requirement: 轻量启动、可选预热与空闲回收
启用插件后，AIO SHALL 只常驻轻量 Supervisor。重型 DSH 子进程 SHALL 在用户进入 Coding工作站或发起任务时按需启动；启用预热时 MAY 使用最近一次有效配置启动，但不得创建会话或发起模型请求。最后一个控制租约释放且 DSH 报告权威静止后，系统 SHALL 等待 10 分钟空闲宽限，再依次 flush、Cordis dispose 和终止进程树；预热租约持续到 AIO 退出。

#### Scenario: 默认启动 AIO
- **WHEN** 用户未启用预热并启动 AIO
- **THEN** DSH 保持停止，AIO 日常启动不等待重型执行域初始化

#### Scenario: 预热配置有效
- **WHEN** 用户启用预热且最近配置仍兼容
- **THEN** Supervisor 后台启动 DSH 并报告 readiness，但不创建 Agent session 或模型调用

#### Scenario: 达到空闲回收条件
- **WHEN** 最后一个控制租约已释放、没有 pending interaction/job，且 DSH 权威状态持续静止 10 分钟
- **THEN** Supervisor 有界地刷新持久化、dispose Cordis 并回收完整进程树

### Requirement: 受管生命周期、崩溃语义与 Windows 进程后端
Supervisor SHALL 管理 stopped、starting、ready、busy、stopping、crashed 和 unavailable 状态，并使用 `domainGenerationId` 隔离每次启动。首发 Windows SHALL 使用 Job Object 与 DACL。DSH 意外退出后 MAY 自动恢复 runtime readiness，但 MUST NOT 自动重放活动任务；受影响 Turn SHALL 标记为 interrupted，并由用户在新 Turn 中显式继续。

#### Scenario: 正常停止
- **WHEN** 用户停止执行域、禁用插件或退出 AIO
- **THEN** Supervisor 请求 flush/dispose，并在超时后使用平台后端回收全部后代进程

#### Scenario: 活动任务期间崩溃
- **WHEN** DSH 在 Turn 执行期间意外退出
- **THEN** 系统终结该代际所有 pending 操作、清除交互投影、标记 Turn 为 interrupted，且不自动重发 Prompt 或工具操作

#### Scenario: 旧代际迟到输出
- **WHEN** 已停止代际产生迟到帧或退出通知
- **THEN** Supervisor 按 `domainGenerationId` 丢弃该输出，不改变新代际会话或作业状态

### Requirement: 权威沙箱与显式安全状态
DSH SHALL 保持工具权限、审批和沙箱的唯一裁决权。首发 Windows SHALL 使用 ACL/受限 token 能力。必需沙箱不可用时执行 SHALL fail closed，UI SHALL 明确显示 `full` 或 `partial` 隔离状态，不得把 Sidecar 生命周期机制描述为安全沙箱。Linux 的 bwrap/Landlock 与 macOS Seatbelt 验证由后续平台扩展 change 承担。

#### Scenario: 必需沙箱不可用
- **WHEN** 当前平台无法建立所选权限模式要求的 DSH 沙箱
- **THEN** 执行域拒绝启动任务并提供平台诊断，不静默切换到 unrestricted

#### Scenario: 默认权限
- **WHEN** 用户首次启动任务且未选择更高权限
- **THEN** DSH 使用 `workspace-write + ask`；危险 full access 必须单次显式选择且不得记为默认值

### Requirement: 隔离数据、可回退升级与 POSIX 安装兼容
系统 SHALL 将 DSH Home、凭据镜像、桥接状态和临时文件放入插件拥有的隔离目录，并在升级失败时保留最后可用 runtime 与持久会话。POSIX 上 AIO ZIP 安装器 SHALL 安全保留普通文件的 Unix mode，或仅为 manifest 选中的当前平台 Native/Sidecar 二进制恢复可执行位；路径校验 MUST 保持不变并 MUST 拒绝 symlink 与特殊文件，Windows 行为不得改变。

#### Scenario: 未来 POSIX 安装并启动 Sidecar
- **WHEN** 后续平台扩展 change 启用 Linux 或 macOS 插件 ZIP 安装
- **THEN** 经 manifest 验证的 Supervisor 和必要 helper 必须具备可执行权限，且未被选中的数据文件不会被任意提升权限；此条件不构成当前 Windows 首发的支持声明

#### Scenario: 升级握手失败
- **WHEN** 新 runtime 或 bridge 无法通过校验、契约握手或冒烟测试
- **THEN** 系统回退最后可用版本，不迁移或删除原会话，并显示失败原因

### Requirement: Windows 原生 E2E 必过门禁与最小 Supervisor ABI
GitHub Actions SHALL 在 Windows lane 中从稳定 runtime lock 获取固定 DSH 官方 Windows wheel并验证 runtime closure，再构建 AIO debug binary。受控获取阶段 SHALL 校验 tag、commit、wheel 与文件 hash、SBOM、license/notices，且是唯一允许联网获取 wheel、工具链或依赖的阶段；解析器、打包器、release verifier、Supervisor 与复用测试 MUST NOT 硬编码 DSH 版本。离线运行阶段 SHALL 仅使用已验证输入，并以唯一 Windows Firewall outbound deny 规则阻止 Internet、保留 `127.0.0.1`。运行测试时 SHALL 设置明确的 `AIO_E2E_BINARY`、`AIO_E2E_FRONTEND_URL`、`AIO_E2E_DATA_DIR`、`AIO_E2E_ID_SUFFIX`、`AIO_E2E_ARTIFACT_DIR` 和 `AIO_E2E_WEBDRIVER_PORT`，并 MUST 禁止网络 runtime/依赖/模型下载。测试 SHALL 使用既有 Tauri WebDriver 和生产 `install_plugin_from_zip`、resident Sidecar IPC；不得新增 Coding工作站 UI、使用原生文件选择器、直接解压 ZIP 或以 layout fixture 替代安装。

若 WebDriver、端口或 runner 环境在测试用例执行前发生受控分类的基础设施故障，且同一 job 的构建、打包、产物校验及 executable smoke 已通过，CI MAY 生成脱敏的 `infrastructure-blocked` 结果并临时豁免该次 E2E，以便 change 继续后续流程。该结果 MUST 标记 `gatePassed=false` 与 `formalReleaseBlocked=true`，MUST NOT 表述为产品测试通过；测试断言、生产 IPC/Sidecar 失败或未知错误不得豁免，正式发布前 MUST 补跑并通过 Windows native E2E。

Supervisor SHALL 在 JSONL 上至少支持 `initialize`、`ready`、`error`、`shutdown`、generation 与 lease 事件。每次启动 MUST 发布新 `domainGenerationId`；未知或过期 generation/lease 命令 MUST 结构化拒绝且不触达 DSH。`shutdown` MUST 先发 `stopped` 再以 0 退出。仅当 E2E 环境提供随机 crash token 时，crash injection MAY 可用；它 MUST 将活动 Turn 记为 `interrupted`、不得重放副作用，并以非零退出。

#### Scenario: Windows 离线 native lane
- **WHEN** GitHub Actions 执行 Windows native E2E
- **THEN** 测试通过生产 IPC 安装最终 ZIP、启动 resident Sidecar，并在断网状态验证真实 handshake、mock-provider Turn、取消/flush、进程树清理、crash interrupted、冷恢复、升级/回退、卸载与数据保留

#### Scenario: PR 快速层与产物保密
- **WHEN** pull request CI 运行快速层
- **THEN** 它只验证 ZIP 合同和 manifest-selected executable smoke；Windows native E2E 仍为必过门禁，且 CI 只上传脱敏报告、校验和和测试结果
