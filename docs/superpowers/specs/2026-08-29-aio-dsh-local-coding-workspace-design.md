---
comet_change: integrate-dsh-runtime-core
role: technical-design
canonical_spec: openspec
---

# AIO 托管 DSH 本地 Coding工作站 Runtime Core 技术设计

## 1. 文档定位

本文说明 `integrate-dsh-runtime-core` 的技术实现方式。需求、验收场景与范围以 `openspec/changes/integrate-dsh-runtime-core/` 中的 proposal、delta specs 和 tasks 为唯一事实源；本文不建立第二套规范。

本 change 只交付无头 runtime core。面向用户的同级工具命名为 `Coding工作站`，其完整 UI 由后续 `add-dsh-coding-workstation` change 承担；Phase 1B 插件/Skill 市场由 `add-dsh-ecosystem-manager` 承担。AIO/VCP RAG、Knowledge 与端云文件同步不在本计划内。

## 2. 结论与可行性

方案可行，推荐形态是：AIO 通过第一方 Resident Sidecar 插件托管 DSH，DSH 作为独立、可销毁、可重建、受策略约束的完整 Coding 执行域。AIO 不是 DSH 内部 Agent Loop 的根调度器，也不接管 DSH 会话语义；AIO 是产品入口和外层资源所有者。

首版可以在 Windows x64、Linux x64 和 macOS arm64 同步交付，前提是采用每平台原生构建、独立 ZIP 和真实主机门禁。Linux arm64 可同步产出预览包，但在 AIO 普通 ARM64 桌面发行与完整集成测试建立前不能宣称正式支持。Flatpak 不能因为 AIO 能打包就自动视为 DSH supported，必须单独验证嵌套执行与沙箱。

可达到的程度：

- 保留 DSH 完整 Agent Loop、工具策略、审批、沙箱、工作流、Skill、子 Agent、持久会话和压缩能力。
- AIO 统一工作区、模型 Profile、用户 Prompt contribution、设置和 Sidecar 生命周期入口。
- 在不引入 DSH Web UI 的情况下，向后续原生 UI 提供完整会话控制、流式事件、审批、恢复和诊断契约。
- 让没有独立 Python、Node.js、WSL2 或 DSH 安装的用户离线启动固定 runtime。
- 通过 Facade 和协议稳定层，为未来 AIO 全局 Capability Runtime、模型 broker 或 secret vault 保留替换位置。

不能在 Phase 1 保证的事项：

- DSH 上游明确仍是 alpha，sandbox/approval 尚不能被描述为经过安全审计或绝对隔离。
- 不保证 AIO 的每一种 Provider 都能无损映射；VCP/OpenAI-compatible Chat Completions 是必需基线，其他逐个准入。
- 不把 AIO 对话树与 DSH session 合并为一个数据库，也不承诺恢复进程内 shell 状态。
- 不在 Flatpak 真实门禁通过前承诺正式支持，不以放宽 sandbox 换取支持标签。

## 3. 设计依据

AIO 的插件目录规范要求插件独立仓库管理，开发时可挂载到 `plugins/`，生产从平台应用数据目录加载。插件指南定义 JS、Native、Sidecar 三种形态、Plugin API v3 host handshake、平台清单、统一 executor、job/cancel、配置 schema 与自动迁移。本设计据此选择独立 Sidecar 插件，而非向 AIO 主仓库嵌入 DSH 源码。

参考入口：

- [`plugins/README.md`](../../../plugins/README.md)
- [`docs/guide/plugins/index.md`](../../guide/plugins/index.md)
- [`docs/guide/plugins/sidecar-plugin.md`](../../guide/plugins/sidecar-plugin.md)
- [`docs/guide/plugins/async-tasks.md`](../../guide/plugins/async-tasks.md)
- [`docs/design/agent-harness-capability-runtime-proposal.md`](../../design/agent-harness-capability-runtime-proposal.md)
- AIO raw plugin index: <https://raw.githubusercontent.com/miaotouy/aio-hub/dev/docs/guide/plugins/index.md>
- AIO raw plugin directory guide: <https://raw.githubusercontent.com/miaotouy/aio-hub/dev/plugins/README.md>
- DSH fixed release: <https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1>

Codex 的 app-server/rollout 设计用于参考初始化协商、生成契约、Turn/item correlation、interaction resolution、bounded queue 与 durable fact/projection 分层。pi 用于参考小核心、可组合 provider、显式资源所有权和适配器边界。两者都不是依赖，不引入第三个 Agent 域，也不改变 AIO + DSH 主体。

## 4. 方案比较

### 方案 1：独立插件 + 托管 Sidecar（采用）

AIO 加载轻量 Rust Supervisor，Supervisor 按需启动完整 DSH runtime，DSH 内加载项目侧 Cordis bridge。优点是升级、崩溃、销毁和平台二进制都与 AIO 主进程隔离；AIO/DSH 上游变更集中在 adapter。成本是要维护 Supervisor、协议和多平台供应链。

### 方案 2：把 DSH 源码直接嵌入 AIO

进程间通信更少，但会把 Node/Python/runtime 生命周期、依赖图和崩溃面带入 Tauri 主体；升级必须和 AIO 同步，难以真正销毁执行域。与插件独立仓库和最小侵入目标冲突，不采用。

### 方案 3：先建设 AIO 全局 Capability Runtime

长期架构统一度最高，但会牵动 RP-first Conversation Runtime、工具、Recall、worldbook、会话树和模型链，远超当前范围。保留可替换接口：未来全局 registry 可把本地 Facade 注册为 `execution-domain:dsh`，无需修改 DSH 事实模型。

## 5. 系统边界与职责

| 领域 | AIO | Supervisor / Facade | DSH |
|---|---|---|---|
| 产品入口 | `Coding工作站`、设置、Profile/工作区选择 | 提供 UI DTO | 无 UI |
| 外层生命周期 | 启用、禁用、AIO exit、Sidecar generation | runtime 校验、启动、预热、空闲回收、进程树 | Cordis settle/dispose、内部服务 |
| Agent 语义 | 不执行 Coding tool loop | 不复制 Agent 逻辑 | 唯一 Agent Loop |
| 会话 | 保存引用和 UI 偏好 | lease、snapshot 转发 | durable session/log/lineage |
| 上下文 | 不叠加 LLM Chat pipeline | Turn 配置快照 | prompt、history、compaction |
| 模型 | Profile 唯一配置入口 | 显式 adapter、credential mirror | provider 请求和 operation |
| 安全 | 展示审批、收集用户决定 | ACL/mode、generation/lease fencing | policy、approval、sandbox 最终裁决 |
| 工作区 | 用户选择、显示 | 绝对路径快照与边界传递 | 工具执行和文件副作用 |

唯一根关系需要精确定义：AIO 是进程与产品层的根所有者；DSH 是 Coding Agent 语义的唯一根执行器。AIO 可以终止执行域、拒绝启动和撤销控制租约，但不在 DSH 外部重复解释一个 Turn 应调用什么工具。

## 6. 部署拓扑

```text
AIO Vue / Pinia UI（后续 change）
        |
        | Plugin API v3 execute, job, event, cancel
        v
plugin-local RuntimeFacade
        |
        v
Rust Supervisor（轻量常驻）
  - runtime lock / provenance
  - DSH_HOME / credentials
  - process backend / generation / lease
        |
        | JSONL protocol
        v
TypeScript/ESM aio-dsh-bridge
        |
        | public Cordis services and waterfalls
        v
DSH dsh-base execution domain
  Agent Loop / Session / Prompt / Tools / Approval
  Sandbox / Workflow / Skill / Sub-agent / Compaction
```

插件仓库建议布局：

```text
aiohub-plugin-dsh-workspace/
  manifest.json
  crates/
    protocol/
    supervisor/
  packages/
    runtime-facade/
    dsh-bridge/
  profiles/aio-coding/
  runtime-lock/
  scripts/
  tests/
  dist/<platform>/
```

开发脚本以幂等方式创建/移除 `aio-hub/plugins/dsh-coding-workspace` junction/symlink。生产 ZIP 不依赖该路径，也不在 AIO 主仓库提交 runtime 二进制。

## 7. 启动与销毁状态机

Supervisor 状态为 `stopped -> starting -> ready <-> busy -> stopping -> stopped`，任意启动或运行故障进入 `crashed`，平台/runtime 不满足进入 `unavailable`。每次 `starting` 生成新的 `domainGenerationId`，旧 generation 的帧、interaction 和退出通知全部失效。

激活事务顺序：

1. 校验 host context、平台与 plugin manifest。
2. 校验 runtime lock、hash、license、contract/profile compatibility。
3. 创建/校验 DSH Home、目录权限与 credential mirror。
4. 使用平台 process backend 启动 DSH。
5. 等待 Cordis Loader settlement。
6. 完成 JSONL `initialize` 与 capability negotiation。
7. 只有以上全部成功才发布 `ready`。

失败时按相反顺序 dispose。停止时先拒绝新 controller mutation，再解析/取消 pending interaction，要求 DSH flush 与 Cordis dispose，最后在有界超时后回收完整进程树。

默认不预热。启用预热只建立 `ready`，不得创建 session 或触发模型。无预热时，最后 controller release、无 job/interaction 且 DSH 权威 quiescent 后计时 10 分钟并回收。崩溃后的 readiness 可以自动恢复，活动 Turn 必须标为 `interrupted`，绝不自动重放 Prompt、模型请求或工具副作用。

## 8. 协议、租约与恢复

Rust protocol crate 是唯一手写契约源，生成 JSON Schema 和 TypeScript declarations。CI 对生成差异和 contract hash 失败关闭。协议区分：

- command / response：AIO 发起的有界请求。
- notification：DSH durable fact、snapshot、state 或 disposable delta。
- interaction request / response / resolved：审批与用户问题。
- control：initialize、ping、shutdown、overload、resync。

Envelope 至少包含 `protocolVersion`、`domainGenerationId`、connection `seq`、message/correlation id；领域 payload 使用 DSH 原生 `sessionId`、Turn、step、call、job、sub-agent id，不建立第二套 canonical Thread/Turn/Item 数据库。

每个 DSH session 只有一个 mutable controller lease，其他窗口是 observer。控制转移是显式命令，所有 mutation 和 interaction response 同时校验 generation + lease。该模型阻止多窗口、UI remount 或旧进程对同一 session 并发写入。

恢复基于 DSH snapshot/durable events：

- start/completed、tool result、approval resolution 等终态不可丢。
- token/reasoning/progress delta 可合并或丢弃。
- 队列有界；过载时报告诊断并保留恢复游标。
- gap、duplicate、generation change 或 UI remount 触发 snapshot-plus-cursor 重建。
- interaction 在取消、超时、租约转移或重启时发送 `interaction/resolved`，拒绝迟到响应。

## 9. 模型、凭据与 Prompt

### 9.1 Profile adapter

AIO Profile 是唯一用户配置入口。adapter 以 allowlist 显式映射 protocol、Base URL、model、headers、auth、parameters、stream、tool call、error 和 cancellation。Phase 1 必须支持 VCP/OpenAI-compatible Chat Completions。其他 Provider 不按品牌名猜测；只有完整映射和黑盒测试后才加入 capability matrix。

### 9.2 Credential provider

当前 AIO 公共 SDK 向同用户插件暴露完整 Profile，但没有通用模型 broker 或 secret vault。首版在插件 DSH Home 内建立最小 credential mirror：

- 原子替换，避免部分写入。
- Windows owner DACL；POSIX `0600`，父目录 `0700`。
- 只保留当前 route 需要的 named references。
- Profile 变更、解绑或用户清除时删除 stale refs。
- 协议、日志、stderr、crash/support bundle 只允许 opaque ref 和 configured 状态。

该边界与 AIO LLM Chat 当前同用户信任等级一致，不宣称能防止同用户恶意进程读取。未来 `CredentialProvider` 可替换为 AIO vault，`ModelTransport` 可替换为 AIO broker。

### 9.3 System Prompt

DSH 是唯一 assembler。AIO 用户文本作为独立 contribution 进入公开 `system-prompt/assemble` waterfall，不改变 DSH identity、tools、runtime context、repository instructions 或 Skills。

`{{Nova}}` 不在 AIO/bridge 解析。若锁定 DSH 插值器会把该形式当成自身变量并拒绝，bridge 只在 AIO contribution 内将完整双花括号组临时映射到唯一合法变量，变量值为原组；由于替换值不二次扫描，最终 Provider 请求恢复原字节。codec 必须逐字节测试，并在上游 literal escape 可用后删除。

### 9.4 Turn snapshot

Turn 开始时冻结 route/model/non-secret parameters、prompt contribution、workspace、permission 与 sandbox policy。该 generation 跨 retry、step、tool 和 compaction 不变。用户编辑只影响同一 session 的下一个 Turn；key 值可由 DSH per-operation seam 轮换，但 route identity 不变。

## 10. 会话与上下文

AIO LLM 对话和 DSH Coding 会话保持两个系统：

- AIO 保存导航引用、Profile/工作区选择和 UI 偏好。
- DSH 保存消息、工具、压缩、lineage、workflow 与 sub-agent 事实。
- Workspace/Git 保存实际文件副作用。

AIO 不把普通 LLM Chat 的 worldbook、Recall、regex、context compressor 或 Tool Loop 自动叠加到 DSH。UI 折叠仅改变展示，不改变 DSH 语义。继续复用原 DSH session；分叉创建新 DSH session；崩溃恢复依靠 durable log，但不伪装恢复丢失的 shell 内存状态。

这种分工避免双 Agent 同时消费 tool call、双重 compaction 和两个 prompt assembler 相互覆盖，同时让 AIO 可用一致的 session projection、审批 UI 和模型配置体验承载 DSH。

## 11. 沙箱与审批

默认权限为 `workspace-write + ask`。full access 必须显式、单次选择，不持久化为默认。DSH 的 policy/approval/sandbox 是最终裁决源，AIO 只展示请求和返回用户决定。

平台后端：

- Linux: bwrap 优先，Landlock 次级能力。
- macOS: Seatbelt。
- Windows: ACL/restricted token 能力。

必需 sandbox 无法建立时 fail closed。运行时向 UI 报告 `full` 或 `partial` 及原因。Supervisor 的进程回收、目录权限和租约 fencing 是纵深防御，不等同于工具 sandbox。

## 12. 运行时供应链

首个固定基线是 `dsh-v0.1.2-alpha.1` / `cd5ef8148158c3a752a658978873241fdf8e2bbc`。虽然源码和 CI 声明 Windows x64、Linux x64/arm64、macOS arm64 runtime，但当前 `0.1.2a1` PyPI SDK/runtime artifact 不存在，GitHub Release 也无可固定的二进制附件。

因此构建逻辑按以下优先级：

1. 查找精确版本、精确平台、持久可下载的官方 wheel。
2. 验证来源、hash、license、runtime closure、contract/profile 和黑盒行为。
3. 若不存在，从固定官方 tag/commit 在对应原生 runner 使用锁定工具链构建。
4. 标记 `source=official-wheel` 或 `source=project-built-from-official-source`。
5. 生成 SBOM、license bundle、runtime lock 与签名/校验和。
6. 只把通过 release-shaped 测试的 artifact 放入平台 ZIP。

不使用临时 Actions artifact、源码 archive 或移动 ref 充当 runtime。未来官方精确 wheel 出现后，仍必须通过同一门禁，不能因为“官方”而跳过兼容验证。

## 13. 跨平台交付

每个平台一个 ZIP，不构造超大 universal 包：

| 包 | 级别 | 关键测试 |
|---|---|---|
| `win32-x64` | Supported | Job Object、DACL、descendants、长/非 ASCII 路径、无控制台泄漏 |
| `linux-x64` | Supported | glibc 2.28+、`.deb`、`.AppImage`、mode、process group、bwrap/Landlock |
| `darwin-arm64` | Supported | macOS 14+、mode、process group、Seatbelt、app data/workspace |
| `linux-arm64` | Preview | native artifact smoke；等待 AIO ARM64 desktop E2E |

Flatpak 独立验证 executable、nested filesystem、shell、document portal、workspace access 和 bwrap/Landlock。如果失败，提供准确的 unsupported/preview 诊断，不追加宽泛 filesystem 权限来掩盖问题。

## 14. 必要的 AIO 兼容修复

AIO 当前 ZIP installer 重新创建文件但不恢复 Unix executable bits。POSIX Sidecar 在自身启动前无法 chmod 自己，因此必须修复宿主安装环节。

补丁限制：

- 只处理普通文件。
- 保留现有 path traversal 校验并拒绝 symlink/special files。
- 优先保留安全 mode；或只对 manifest 选中的当前平台 Sidecar/Native executable 和必要 helper 设置执行位。
- 不把 ZIP 任意 mode 直接提升为危险权限。
- Windows 路径和行为不变。
- Linux/macOS 必须有 install-and-launch 回归测试。

这是通用 POSIX 插件兼容修复，不写 DSH 特判，适合独立提交和上游合并。

## 15. 兼容性策略

默认只使用 AIO Plugin API v3、`aiohub-sdk` 和 DSH public Cordis services。若实现阶段发现不足，必须先给出固定版本、最小复现和失败的 contract test。只有 adapter/config/public seam 无法实现规范时，才允许兼容补丁；补丁必须 additive、default-preserving、isolated、feature-gated、tested、removable 和 upstreamable。

不能接受的做法包括导入 DSH private file、篡改 AIO LLM Chat 默认行为、用 Provider 名称猜路由、吞掉未知字段、自动改成 unrestricted、自动重放崩溃任务，或把 projection 当 durable truth。

## 16. 测试策略

### 单元与属性测试

- 协议生成、contract hash、frame validation。
- 状态机、generation、controller lease 与转移。
- queue/backpressure、snapshot/cursor、duplicate/gap。
- Profile allowlist、unknown field rejection、credential redaction。
- Prompt codec 对 `{{Nova}}`、相邻/重复/未闭合花括号的 byte equality。
- Turn snapshot 对 retry/tool/compaction 的不变性。
- 路径、ACL/mode、runtime lock 与 provenance。

### 合同测试

用 deterministic fake AIO 与 fake DSH 覆盖 initialize、取消、审批、问题、超时、controller transfer、重连、overload、crash、cold resume 和 stale generation。生成的 Rust/TS 契约必须互相验证。

### 原生端到端测试

Windows x64、Linux x64、macOS arm64 都从最终 ZIP 开始：全新安装、离线冷启动、mock-provider Turn、工具子进程、取消、flush、退出、崩溃、interrupted recovery、升级、回退、卸载与数据保留。验证无孤儿进程、无秘密输出、长路径/非 ASCII workspace 和 helper executable mode。

Linux 同时覆盖 `.deb` 与 `.AppImage`。Flatpak 使用独立兼容矩阵。Linux ARM64 只执行 preview artifact smoke 和可用的 native tests，不提升正式支持级别。

### 验收门禁

任何平台只有同时通过 artifact provenance、clean install、real runtime handshake、mock-provider coding Turn、process cleanup、credential redaction、persistence flush、crash fencing 和 cold resume 才能标记 supported。

## 17. 1+1 大于 2 的协同价值

AIO 提供 DSH 缺少的产品化统一入口、成熟 Profile/设置、工作区选择、会话导航、审批交互与跨平台插件安装；DSH 提供 AIO 工作站当前缺少的高完整度 coding loop、durable execution log、工具安全策略、workflow、Skill 与 sub-agent。通过 stable Facade 而非互相复制，两侧优势可以叠加：

- AIO 用户无需学习第二个 Web UI 或手动部署 runtime。
- DSH 获得可选预热、受管升级/回退、多窗口 observer 和统一诊断。
- AIO 不承担 coding context/compaction 的第二套实现，降低行为漂移。
- 后续可在不破坏 Phase 1 的前提下增加 AIO model broker/vault、全局 Capability Runtime、显式上下文移交、AIO 工具 MCP 投影与 DSH extension manager。

最重要的协同约束是：通信增加能力，不增加双重权威。会话、Prompt、Agent Loop 和 sandbox 各自只有一个语义所有者。

## 18. 发布与演进顺序

1. Runtime core：独立仓库、协议、Supervisor、runtime supply chain、bridge、Profile/Prompt/credential、三平台门禁。
2. `Coding工作站` UI：同级工具、工作区/Profile 选择、会话投影、审批、diff/terminal/test/sub-agent 呈现、lifecycle controls。
3. DSH 生态管理：参考 `dsh-plugin-hub` 的索引、保护清单、任务进度、版本检测、备份回退，但不嵌入其 Web UI，也不绕过 AIO 管理边界。
4. 可选融合：AIO global Capability Runtime adapter、model broker/vault、显式 Chat-to-Coding context snapshot、AIO tool MCP projection。
5. 独立规划 RAG/Knowledge 与本地文件发布到 VCP；默认仍是用户选择后发布，可另启目录白名单自动同步。

## 19. 最终建议

采用方案 1，并把方案 3 保持为替换接口。先把 DSH 的完整能力可靠地带进 AIO，而不是在首版重构双方内部。实现优先级依次是供应链可复现、协议与进程所有权、会话/interaction 恢复、模型与 Prompt 保真、安全门禁，最后才是丰富 UI 和生态扩展。

三平台同步首发是可行的，但“同日发布”不能替代“同等门禁”。Windows x64、Linux x64、macOS arm64 分别通过真实宿主测试后独立标记 supported；Linux ARM64 与 Flatpak 保持诚实的 preview/compatibility 状态。这样既能扩大首版覆盖，又不会以模糊兼容性牺牲 DSH 执行域的可靠性和安全边界。
