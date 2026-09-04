---
change: integrate-dsh-runtime-core
design-doc: docs/superpowers/specs/2026-08-29-aio-dsh-local-coding-workspace-design.md
base-ref: 954857de201a2bd7abb8b88de6b7e6e3e8ea95b2
---

# AIO 托管 DSH Runtime Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 构建由 AIO Plugin API v3 托管、可销毁且可恢复的完整 DSH Coding 执行域，并以可复现离线包首发支持 Windows x64。Linux x64、macOS arm64、Linux arm64 预览与 Flatpak 兼容性由后续独立 change 承担。

**Architecture:** 代码权威位于独立仓库 `E:\workspace\projects\aiohub-plugin-dsh-workspace`，AIO 主仓仅通过开发 junction 联接插件，并承载一个通用的 POSIX ZIP executable-mode 修复。轻量 Rust Supervisor 作为 Resident Sidecar 管理 DSH 子进程、凭据与生命周期；TypeScript/ESM Cordis bridge 使用 DSH 公共服务承载 Agent 语义；Rust 协议 crate 生成 JSON Schema 与 TypeScript 声明，插件本地 `RuntimeFacade` 隔离后续 AIO 全局 Capability Runtime 替换。

**Tech Stack:** AIO Hub 0.7.0-alpha.4、Plugin API v3、Rust、Serde/JSON Schema、TypeScript ESM、Bun 1.3.11、Vitest 4、DSH `dsh-v0.1.2-rc.1` 官方 Windows x64 wheel（commit `a66e4702047846cdaa10c66c9d3df3951f5ea70d`）、Python 3.10 标准库 wheel 解压、GitHub Actions 原生 runners。

## Global Constraints

- 本 change 只交付 headless Runtime Core；`Coding工作站` 完整 UI、Phase 1B 插件/Skill 市场、RAG/Knowledge/Recall 与端云文件同步不在范围内。
- DSH 是 Coding Agent Loop、durable session/log、System Prompt assembly、context/compaction、工具策略、审批、沙箱、workflow、Skill 与 sub-agent 的唯一语义所有者。
- AIO 是 UI、LLM Profile、workspace picker、设置和外层 Sidecar 生命周期的唯一入口；不得启动或嵌入 DSH Web UI。
- 本 change 首发平台固定为 `win32-x64`；其他平台启动前明确拒绝。glibc 2.28+ 的 `linux-x64`、macOS 14+ 的 `darwin-arm64`、`linux-arm64` 预览与 Flatpak 兼容性必须由后续独立 change 完成，不得由 Windows 测试推断为已支持。
- 每个平台独立 ZIP，首次启动完全离线，不要求系统安装 Node.js、Python、WSL2 或 DSH，也不允许首次运行下载 runtime。
- Runtime 基线由稳定 `runtime-lock/dsh-runtime.json` 固定为 DSH `dsh-v0.1.2-rc.1` / `a66e4702047846cdaa10c66c9d3df3951f5ea70d` 官方 Windows wheel；所有消费者从 lock 派生版本，不允许源码构建回退。获取阶段验证 wheel 与文件 hash、SBOM、许可证/第三方声明；离线运行阶段不得联网。
- AIO Profile 唯一模型入口；Phase 1 必须支持 VCP/OpenAI-compatible Chat Completions，未知或有损字段 fail closed，不按 Provider 名称猜测、静默丢字段或回退 endpoint。
- DSH 保持唯一 System Prompt 组装权；`{{Nova}}` 等 VCP 双花括号占位符必须逐字节保留并只由既有 VCP backend 解析。
- Turn 开始时冻结 route/model/非秘密参数、prompt contribution、workspace、permission 与 sandbox policy，跨 retry、step、tool 与 compaction 不变。
- 每个 DSH session 只有一个 mutable controller lease，可有多个 observer；所有 mutation/interaction response 同时校验 `domainGenerationId` 与 `leaseId`。
- 默认权限为 `workspace-write + ask`；full access 仅单次显式选择且不持久化为默认；必需 sandbox 不可用时 fail closed。
- DSH 崩溃后可以恢复 readiness，但绝不自动重放活动 Prompt、模型调用或工具副作用；受影响 Turn 必须为 `interrupted`。
- 默认只使用 AIO Plugin API v3、`aiohub-sdk` 与 DSH public Cordis services；除已批准的 AIO POSIX mode 修复外，任何 core 补丁必须先有固定版本的失败 contract test，再回到设计审查。
- AIO ZIP 修复只允许安全普通文件或 manifest 选中的当前平台 Native/Sidecar executable/helper 获得执行位；保持路径校验、拒绝 symlink/special file、Windows 行为不变。

---

## Repository Map

### AIO 主仓库 `E:\workspace\projects\aio-hub`

- Modify: `src-tauri/src/commands/file_operations.rs` - 安全 ZIP 条目分类、manifest-selected executable 判定、POSIX mode 恢复及 Rust 回归测试。
- Modify: `.github/workflows/pr-check.yml` - 在 Linux 上执行 installer 安全测试。
- Create: `scripts/dev-link-dsh-plugin.ts` - 幂等创建、检查、移除 `plugins/dsh-coding-workspace` junction/symlink，且不写入插件内容。
- Modify: `package.json` - 暴露 `plugin:dsh:link`、`plugin:dsh:unlink`、`plugin:dsh:check-link`。

### 独立插件仓库 `E:\workspace\projects\aiohub-plugin-dsh-workspace`

- Create: `AGENTS.md`, `LICENSE`, `CONTRIBUTING.md`, `README.md`, `.gitignore`, `.node-version`, `rust-toolchain.toml`, `package.json`, `bun.lock`, `Cargo.toml` - 独立仓库和锁定工具链。
- Create: `manifest.json` - API v3 Resident Sidecar、四个平台、设置与 `execution-domain:dsh` contribution。
- Create: `crates/protocol/**` - 唯一手写协议源、JSON Schema/TS 生成、contract hash。
- Create: `crates/supervisor/**` - stdout-pure Sidecar、runtime 校验、进程后端、DSH Home、凭据、安全、生命周期与诊断。
- Create: `packages/runtime-facade/**` - UI 无关 DTO、`RuntimeFacade`、AIO transport adapter。
- Create: `packages/dsh-bridge/**` - `aio-coding` Cordis bridge、session/interaction/event/recovery、Profile/Prompt/Turn policy adapter。
- Create: `profiles/aio-coding/cordis.yml` - 在 `dsh-base` 上追加 bridge，不加载 Web/SDK stdio transport。
- Create: `runtime-lock/dsh-runtime.json` - 稳定版本指针及平台 artifact、provenance、wheel/file hash、license/notices、SBOM、contract/profile/AIO range。
- Create: `scripts/runtime/**`, `scripts/package-platform.ts`, `.github/workflows/ci.yml`, `.github/workflows/release-runtime.yml` - 固定官方 wheel 获取、离线 closure、每平台 ZIP 与门禁；实现与复用测试不绑定 DSH 版本。
- Create: `tests/contract/**`, `tests/e2e/**`, `tests/fixtures/**` - fake peers、mock Provider、最终 ZIP 原生验收、Flatpak 与 Linux ARM64 分级。
- Create: `docs/platform-support.md`, `docs/security-model.md`, `docs/runtime-provenance.md`, `docs/recovery.md`, `docs/capability-runtime-migration.md` - 用户与维护者文档。

## Stable Interfaces

后续任务必须复用以下名称，不得在实现中另造同义契约：

```typescript
export type PlatformKey = "win32-x64" | "linux-x64" | "darwin-arm64" | "linux-arm64";
export type RuntimeState = "stopped" | "starting" | "ready" | "busy" | "stopping" | "crashed" | "unavailable";
export type SandboxStatus = { level: "full" | "partial"; backend: "bwrap" | "landlock" | "seatbelt" | "restricted-token"; reason?: string };
export type RuntimeRef = { domainGenerationId: string; contractHash: string };
export type ControllerLease = RuntimeRef & { sessionId: string; leaseId: string; mode: "controller" | "observer" };
export type InitializeInput = { hostApiVersion: 3; platform: PlatformKey; pluginDataDir: string; prewarm: boolean };
export type InitializeResult = RuntimeRef & { state: RuntimeState; capabilities: readonly string[]; sandbox: SandboxStatus };
export type AcquireSessionInput = RuntimeRef & { sessionId: string; viewId: string; requestedMode: "controller" | "observer" };
export type TransferControllerInput = ControllerLease & { targetViewId: string };
export type RuntimeCommand = { kind: string; sessionId?: string; turnId?: string; input?: unknown };
export type RuntimeEvent = { kind: string; sessionId?: string; turnId?: string; data: unknown };
export type SessionSnapshot = RuntimeRef & { sessionId: string; cursor: string; seq: number; durableFacts: readonly RuntimeEvent[] };
export type InteractionRequest = RuntimeRef & { sessionId: string; correlationId: string; kind: "approval" | "question"; data: unknown };
export type InteractionResolved = RuntimeRef & { sessionId: string; correlationId: string; reason: "answered" | "cancelled" | "transferred" | "restarted" | "timeout" };
export type ProfileDiagnostic = { code: string; field?: string; message: string };
export type AioLlmProfile = { id: string; protocol: string; baseUrl: string; model: string; apiKey?: string; headers?: Record<string, string>; options?: Record<string, unknown> };
export type TurnConfigSnapshot = {
  snapshotVersion: 1;
  routeId: string;
  model: string;
  parameters: Readonly<Record<string, unknown>>;
  promptContribution: string;
  workspace: string;
  permission: "workspace-write" | "full-access";
  sandboxPolicy: "ask" | "deny";
};
export interface RuntimeFacade {
  initialize(input: InitializeInput): Promise<InitializeResult>;
  acquireSession(input: AcquireSessionInput): Promise<ControllerLease>;
  transferController(input: TransferControllerInput): Promise<ControllerLease>;
  command<T>(lease: ControllerLease, command: RuntimeCommand): Promise<T>;
  snapshot(sessionId: string, cursor?: string): Promise<SessionSnapshot>;
  subscribe(listener: (event: RuntimeEvent) => void): () => void;
  shutdown(reason: "plugin-disabled" | "aio-exit" | "user-stop"): Promise<void>;
}
```

Rust 协议 envelope 的唯一字段名固定为：

```rust
pub struct Envelope<T> {
    pub protocol_version: ProtocolVersion,
    pub contract_hash: String,
    pub domain_generation_id: String,
    pub seq: u64,
    pub message_id: String,
    pub correlation_id: Option<String>,
    pub payload: T,
}
```

### Task 1: 初始化独立仓库与开发联接（OpenSpec 1.1、1.2）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\package.json`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\Cargo.toml`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\rust-toolchain.toml`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\.node-version`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\AGENTS.md`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\LICENSE`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\CONTRIBUTING.md`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\.gitignore`
- Create: `scripts/dev-link-dsh-plugin.ts`
- Modify: `package.json`
- Test: `scripts/__tests__/dev-link-dsh-plugin.test.ts`

**Interfaces:**
- Consumes: AIO 忽略规则 `plugins/*` 与 `plugins/AGENTS.template.md`。
- Produces: `linkPlugin(command, pluginRepo, aioRepo): Promise<void>`；固定开发链接 `aio-hub/plugins/dsh-coding-workspace`。

- [x] **Step 1: 写开发联接失败测试**

```typescript
import { afterEach, expect, it } from "vitest";
import { mkdtemp, readlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { linkPlugin } from "../dev-link-dsh-plugin";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((p) => rm(p, { recursive: true, force: true }))));

it("creates, verifies, and removes only the dsh development link", async () => {
  const root = await mkdtemp(join(tmpdir(), "aio-dsh-link-")); roots.push(root);
  const plugin = join(root, "plugin"); const aio = join(root, "aio");
  await Bun.write(join(plugin, "manifest.json"), "{}");
  await Bun.write(join(aio, "plugins", ".keep"), "");
  await linkPlugin("link", plugin, aio);
  expect(await readlink(join(aio, "plugins", "dsh-coding-workspace"))).toBe(plugin);
  await linkPlugin("check", plugin, aio);
  await linkPlugin("unlink", plugin, aio);
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `bunx vitest run scripts/__tests__/dev-link-dsh-plugin.test.ts`

Expected: FAIL，报错 `Cannot find module '../dev-link-dsh-plugin'`。

- [x] **Step 3: 实现幂等联接脚本并建立仓库骨架**

```typescript
export async function linkPlugin(command: "link" | "unlink" | "check", pluginRepo: string, aioRepo: string): Promise<void> {
  const link = join(aioRepo, "plugins", "dsh-coding-workspace");
  const current = await lstat(link).catch(() => undefined);
  if (command === "unlink") { if (current?.isSymbolicLink()) await rm(link); return; }
  if (command === "check") { if (!current?.isSymbolicLink() || await readlink(link) !== pluginRepo) throw new Error("DSH development link mismatch"); return; }
  if (current && !current.isSymbolicLink()) throw new Error(`Refusing to replace non-link path: ${link}`);
  if (!current) await symlink(pluginRepo, link, process.platform === "win32" ? "junction" : "dir");
  await linkPlugin("check", pluginRepo, aioRepo);
}
```

在插件仓库初始化 Git，复制 `plugins/AGENTS.template.md` 内容到独立 `AGENTS.md`，写入 Apache-2.0 license、贡献说明和以下脚本：`check`、`test`、`build`、`generate:protocol`、`check:generated`、`runtime:resolve-current`、`runtime:acquire-wheel`、`package:platform`。`resolve-runtime.ts` 与 `package-platform.ts` 在省略 `--platform` 时必须从 `process.platform/process.arch` 严格解析当前支持键，不支持组合直接失败。`.node-version` 固定 `22.19.0`；`packageManager` 固定 `bun@1.3.11`；wheel 解压使用 Python 3.10 标准库。

- [x] **Step 4: 验证骨架和链接**

Run: `bunx vitest run scripts/__tests__/dev-link-dsh-plugin.test.ts && bun run plugin:dsh:link && bun run plugin:dsh:check-link && git check-ignore plugins/dsh-coding-workspace`

Expected: 测试 PASS；链接指向独立仓库；`git check-ignore` 输出 `plugins/dsh-coding-workspace`。

- [x] **Step 5: 分仓提交**

```bash
# aio-hub
git add package.json scripts/dev-link-dsh-plugin.ts scripts/__tests__/dev-link-dsh-plugin.test.ts
git commit -m "chore(plugins): add DSH development link helper"
# aiohub-plugin-dsh-workspace
git add AGENTS.md LICENSE CONTRIBUTING.md README.md .gitignore .node-version rust-toolchain.toml package.json bun.lock Cargo.toml
git commit -m "chore: initialize DSH workspace plugin"
```

### Task 2: Plugin API v3 Manifest 与 RuntimeFacade（OpenSpec 1.3）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\manifest.json`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\runtime-facade\package.json`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\runtime-facade\src\types.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\runtime-facade\src\runtime-facade.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\runtime-facade\src\aio-sidecar-transport.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\runtime-facade\tests\manifest-contract.test.ts`

**Interfaces:**
- Consumes: AIO `SidecarHostContext` API v3 handshake 与 Stable Interfaces。
- Produces: `RuntimeFacade`、`InitializeInput`、`InitializeResult`、`RuntimeCommand`、`RuntimeEvent` 和 capability id `execution-domain:dsh`。

- [x] **Step 1: 写 manifest/Facade 契约测试**

```typescript
it("declares a resident API v3 DSH execution domain on the Windows x64 first-release platform", async () => {
  const manifest = JSON.parse(await Bun.file(new URL("../../../manifest.json", import.meta.url)).text());
  expect(manifest).toMatchObject({ id: "dsh-coding-workspace", type: "sidecar", host: { apiVersion: 3 } });
  expect(Object.keys(manifest.sidecar.executable).sort()).toEqual(["win32-x64"]);
  expect(manifest.contributions).toContainEqual(expect.objectContaining({ type: "capability", id: "execution-domain:dsh" }));
});
```

- [x] **Step 2: 运行测试并确认缺少 manifest**

Run: `bunx vitest run packages/runtime-facade/tests/manifest-contract.test.ts`

Expected: FAIL，`manifest.json` 不存在。

- [x] **Step 3: 写 manifest、DTO 与 transport adapter**

manifest 中 `type` 为 `sidecar`、`host.apiVersion` 为 `3`，首发路径固定为 `bin/win32-x64/aio-dsh-supervisor.exe`；settings 只含 `prewarm: false` 与 `idleGraceSeconds: 600`；不声明 UI。Linux/macOS/ARM64 的 executable map 由后续平台扩展 change 增加。`AioSidecarTransport` 只负责 API v3 `spawn/send/kill/event` 与 DTO 转换，不引入 Vue/Pinia 类型。

```typescript
export type InitializeInput = { hostApiVersion: 3; platform: PlatformKey; pluginDataDir: string; prewarm: boolean };
export type InitializeResult = RuntimeRef & { state: RuntimeState; capabilities: readonly string[]; sandbox: SandboxStatus };
export interface SidecarTransport { request<T>(method: string, params: unknown): Promise<T>; onEvent(cb: (value: unknown) => void): () => void; kill(): Promise<void>; }
export const DSH_CAPABILITY = Object.freeze({ id: "execution-domain:dsh", version: 1, stability: "stable" as const });
```

- [x] **Step 4: 验证类型和 manifest**

Run: `bun run check && bunx vitest run packages/runtime-facade/tests/manifest-contract.test.ts`

Expected: TypeScript 无错误，manifest 测试 PASS，未出现 `vue` 或 `pinia` import。

- [x] **Step 5: 提交**

```bash
git add manifest.json packages/runtime-facade
git commit -m "feat: define DSH runtime facade"
```

### Task 3: 单源 JSONL 协议与生成门禁（OpenSpec 1.4、5.2、7.1）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\protocol\Cargo.toml`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\protocol\src\lib.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\protocol\src\messages.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\protocol\src\generate.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\generated\protocol.schema.json`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\generated\protocol.d.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\protocol\tests\contract.rs`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\contract\generated-drift.test.ts`

**Interfaces:**
- Consumes: Stable Interfaces field names。
- Produces: `Envelope<T>`、`CommandPayload`、`ResponsePayload`、`NotificationPayload`、`InteractionPayload`、`InitializeRequest/Result`、SHA-256 `contractHash`。

- [x] **Step 1: 写协议序列化和 drift 失败测试**

```rust
#[test]
fn envelope_is_camel_case_jsonl_and_round_trips() {
    let frame = Envelope::new("generation-1", 7, CommandPayload::Ping);
    let line = serde_json::to_string(&frame).unwrap();
    assert!(line.contains("\"domainGenerationId\":\"generation-1\""));
    assert!(!line.contains('\n'));
    assert_eq!(serde_json::from_str::<Envelope<CommandPayload>>(&line).unwrap(), frame);
}
```

- [x] **Step 2: 运行测试并确认协议 crate 尚不存在**

Run: `cargo test -p aio-dsh-protocol`

Expected: FAIL，workspace 中不存在 `aio-dsh-protocol`。

- [x] **Step 3: 实现协议源和确定性生成器**

使用 `#[serde(rename_all = "camelCase")]` 与 externally tagged payload；stable capabilities 缺失或 major/hash 不兼容时返回 `ProtocolError::IncompatibleContract`，experimental capability 只有双方显式声明才启用。生成器对 canonical JSON Schema 计算 SHA-256，并将相同常量写入 Rust 与 `.d.ts`。

```rust
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolVersion { pub major: u16, pub minor: u16 }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", content = "data", rename_all = "kebab-case")]
pub enum CommandPayload { Initialize(InitializeRequest), Ping, Shutdown(ShutdownRequest), Session(SessionCommand), Interaction(InteractionResponse) }
```

- [x] **Step 4: 验证生成物、hash 与跨语言解析**

Run: `cargo run -p aio-dsh-protocol --bin generate -- --check && cargo test -p aio-dsh-protocol && bunx vitest run tests/contract/generated-drift.test.ts`

Expected: 全部 PASS；重跑生成器时 Git diff 为空；Rust 与 TypeScript 读取同一 `CONTRACT_HASH`。

- [x] **Step 5: 提交**

```bash
git add crates/protocol generated tests/contract/generated-drift.test.ts Cargo.toml package.json
git commit -m "feat(protocol): add generated JSONL contract"
```

### Task 4: 修复 AIO POSIX 插件安装 executable mode（OpenSpec 3.1-3.3）

**Files:**
- Modify: `src-tauri/src/commands/file_operations.rs:61-257`
- Modify: `src-tauri/src/commands/file_operations.rs:2098-2301`
- Modify: `.github/workflows/pr-check.yml`
- Test: `src-tauri/src/commands/file_operations.rs` 内 `plugin_platform_tests`

**Interfaces:**
- Consumes: 现有 `PluginManifest`、`manifest_binary_path()`、`validate_plugin_archive_platform()`。
- Produces: `classify_archive_entry(entry) -> Result<ArchiveEntryKind, String>` 与 POSIX-only `apply_installed_plugin_mode(path, unix_mode)`。

- [x] **Step 1: 写失败的 mode 与危险条目测试**

```rust
#[cfg(unix)]
#[test]
fn grants_execute_only_to_manifest_selected_regular_binary() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let binary = dir.path().join("bin/supervisor");
    fs::create_dir_all(binary.parent().unwrap()).unwrap(); fs::write(&binary, b"bin").unwrap();
    apply_installed_plugin_mode(&binary, Some(0o100755)).unwrap();
    assert_eq!(fs::metadata(&binary).unwrap().permissions().mode() & 0o777, 0o700);
    let data = dir.path().join("payload.json"); fs::write(&data, b"{}").unwrap();
    apply_installed_plugin_mode(&data, Some(0o100666)).unwrap();
    assert_eq!(fs::metadata(&data).unwrap().permissions().mode() & 0o111, 0);
}
```

- [x] **Step 2: 运行定向 Rust 测试并确认失败**

Run: `cargo test --manifest-path src-tauri/Cargo.toml plugin_platform_tests -- --nocapture`

Expected: FAIL，找不到 `apply_installed_plugin_mode`。

- [x] **Step 3: 提取安全解压 helper 并接入安装循环**

`enclosed_name()` 作为路径边界事实源；拒绝 ZIP unix type 为 symlink (`0o120000`) 或非 regular/dir；文件落盘后在 Unix 只保留 ZIP 来源的 owner `rwx` 位并剥离 group/other 位，因此只有包中原本标为 executable 的 Supervisor/helper 保留 owner 执行位，普通数据文件不会新增执行位。manifest-selected 当前平台 binary 仍必须存在、为普通文件且拥有 owner 执行位，否则安装失败。Windows helper 编译为空操作，保持原行为。

```rust
#[cfg(unix)]
fn apply_installed_plugin_mode(path: &Path, unix_mode: Option<u32>) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let source = unix_mode.unwrap_or(0o100600);
    if source & 0o170000 != 0 && source & 0o170000 != 0o100000 { return Err("ZIP 条目不是普通文件".into()); }
    let mode = source & 0o700;
    fs::set_permissions(path, fs::Permissions::from_mode(mode)).map_err(|e| format!("设置插件文件权限失败: {e}"))
}
```

- [x] **Step 4: 运行安全回归和宿主检查**

Run: `cargo test --manifest-path src-tauri/Cargo.toml plugin_platform_tests -- --nocapture && bun run check:backend:lint`

Expected: manifest executable 可启动位 PASS；data 不升级；symlink/special/path traversal 被拒绝；Clippy 无 warning。将该测试保持在 Linux CI；macOS release lane 复用同一测试。

- [x] **Step 5: 独立提交 AIO 通用修复**

```bash
git add src-tauri/src/commands/file_operations.rs .github/workflows/pr-check.yml
git commit -m "fix(plugins): preserve safe POSIX executable mode"
```

### Task 5: 可复现 DSH Runtime Lock 与官方 Windows wheel（OpenSpec 2.2）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\runtime-lock\dsh-runtime.json`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\scripts\runtime\resolve-runtime.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\scripts\runtime\acquire-official-wheel.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\scripts\runtime\verify-runtime.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\scripts\runtime\generate-sbom.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\scripts\runtime\runtime-lock.test.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\e2e\runtime-artifact.test.ts`

**Interfaces:**
- Consumes: DSH fixed tag/commit 与 protocol contract hash。
- Produces: `RuntimeLockV1`；`resolveRuntime(platform): Promise<VerifiedRuntime>`；source 固定为 lock 驱动的 `official-wheel`，版本不进入实现常量。

- [x] **Step 1: 写固定官方 wheel 与版本解耦的失败测试**

```typescript
it("rejects a source checkout unless the pinned tag, commit, lock and Windows closure all match", async () => {
  const result = await buildFromSource({ sourceRoot, platform: "win32-x64", out });
  await expect(result).rejects.toMatchObject({ code: "RUNTIME_SOURCE_TAG_MISMATCH" });
});
```

- [x] **Step 2: 运行测试并确认 wheel hash/metadata 漂移 fail closed**

Run: `bunx vitest run scripts/runtime/runtime-lock.test.ts tests/e2e/runtime-artifact.test.ts`

Expected: FAIL，`RUNTIME_BUILD_NOT_IMPLEMENTED_ON_THIS_HOST`；不得把测试 fixture 或本地构建目录当作 release 输入。

- [x] **Step 3: 实现 lock 驱动的 official-wheel 获取与动态 metadata 发现**

从稳定 lock 下载官方 wheel 并先验证完整 SHA-256；动态发现 `deepseek_harness_runtime_bin-*.dist-info`，收集 Windows 主程序、`-rg.exe`、LICENSE 与 `THIRD_PARTY_NOTICES.md`，生成 SBOM 并逐项验证文件哈希。不得复制开发机 `dist-exe`、硬编码 wheel 内版本目录、接受其他平台、额外 sidecar、移动 ref 或 Actions 临时 artifact。

```typescript
export type RuntimeSource = { kind: "official-wheel"; url: string; sha256: string };
export type VerifiedRuntime = { version: string; platform: PlatformKey; root: string; source: RuntimeSource; files: readonly { path: string; sha256: string; executable: boolean }[] };
```

- [x] **Step 4: 验证构建闭包，再把它移交离线测试输入**

Run: `bun run runtime:acquire-wheel && bun scripts/runtime/verify-runtime.ts --lock runtime-lock/dsh-runtime.json --root .artifacts/runtime --offline && bunx vitest run scripts/runtime/runtime-lock.test.ts scripts/runtime/acquire-official-wheel.test.ts tests/e2e/runtime-artifact.test.ts`

Expected: runtime lock 只包含 Windows 主程序、`-rg.exe`、上游 license/notices 和 SBOM；来源、commit、wheel/file hash、license 和 closure 全部 PASS。该命令完成后，后续 E2E 不得再联网。

- [x] **Step 5: 提交**

```bash
git add runtime-lock scripts/runtime tests/e2e/runtime-artifact.test.ts
git commit -m "feat(runtime): add reproducible DSH supply chain"
```

### Task 6: Supervisor 初始化、DSH Home 与平台进程树（剩余 OpenSpec 4.1）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\Cargo.toml`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\main.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\host_context.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\runtime_validation.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\home.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\process.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\process\windows.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\process\unix.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\redaction.rs`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\tests\startup.rs`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\tests\process_tree.rs`

**Interfaces:**
- Consumes: `Envelope<T>`、`RuntimeLockV1`、AIO API v3 host context、`AIOHUB_PLUGIN_DATA_DIR`。
- Produces: `ProcessBackend`、`DshHomeLayout`、`RuntimeValidator`、stdout-pure `Supervisor`。

**Windows native ABI addendum:** `main.rs` 必须真正驱动现有 protocol/supervisor 代码，而非空退出。每一 stdout 行均为 JSON；`initialize` 只产生一个 `ready` 或结构化 `error`，`shutdown` 先产生 `stopped` 再以 0 退出。每次进程启动生成新的 `domainGenerationId`；lease grant/release/reject 事件必须可观测；未知/过期 generation 或 lease 命令结构化拒绝且不触达 DSH。仅 `AIO_DSH_E2E_CRASH_TOKEN` 与请求 token 完全匹配时启用 crash injection，活动 Turn 记为 `interrupted`、不重放副作用并非零退出。测试以真实 stdio 子进程断言上述 ABI。

- [x] **Step 1: 写初始化、权限、后代回收和脱敏失败测试**

```rust
#[tokio::test]
async fn initialization_is_transactional_and_stdout_contains_jsonl_only() {
    let fixture = SupervisorFixture::new("工作区 very-long-path").await;
    let result = fixture.initialize().await.unwrap();
    assert_eq!(result.state, RuntimeState::Ready);
    assert!(fixture.stdout_lines().iter().all(|line| serde_json::from_str::<serde_json::Value>(line).is_ok()));
    assert!(!fixture.all_diagnostics().contains("sk-test-secret"));
    fixture.shutdown().await.unwrap();
    assert!(fixture.descendant_pids().await.is_empty());
}
```

- [x] **Step 2: 运行 Supervisor 测试并确认 crate 缺失**

Run: `cargo test -p aio-dsh-supervisor --test startup --test process_tree`

Expected: FAIL，workspace 中不存在 `aio-dsh-supervisor`。

- [x] **Step 3: 实现安全启动事务和平台 backend**

```rust
#[async_trait]
pub trait ProcessBackend: Send + Sync {
    async fn spawn(&self, spec: SpawnSpec) -> Result<ManagedProcess, SupervisorError>;
    async fn terminate_tree(&self, process: &mut ManagedProcess, grace: Duration) -> Result<(), SupervisorError>;
}
pub struct DshHomeLayout { pub root: PathBuf, pub sessions: PathBuf, pub credentials: PathBuf, pub runtime: PathBuf, pub logs: PathBuf, pub temp: PathBuf }
```

Windows 将 DSH 根进程放入 kill-on-close Job Object，创建 owner-only DACL 并隐藏 console；Linux/macOS 建新 process group，先 TERM、超时后 KILL。Home 父目录/目录为 `0700`，秘密文件为 `0600`；所有环境、headers、URL query、stdout/stderr、crash/support bundle 经过统一 redactor。telemetry 默认关闭。初始化依次验证 host/platform/lock/hash/license/contract/profile、Home、credential readiness、child settlement、protocol initialize，失败按反序释放。

- [x] **Step 4: 运行平台定向验证**

Run: `cargo test -p aio-dsh-supervisor --all-features && cargo clippy -p aio-dsh-supervisor --all-targets -- -D warnings`

Expected: 当前平台的 descendant cleanup、长/非 ASCII path、stdout purity、权限和 redaction 全部 PASS；其他平台模块通过 cfg compile check。

- [x] **Step 5: 提交**

```bash
git add crates/supervisor Cargo.toml
git commit -m "feat(supervisor): manage DSH process boundaries"
```

### Task 7: 生命周期、预热、空闲回收与崩溃语义（OpenSpec 4.5、4.6）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\lifecycle.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\lease.rs`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\recovery.rs`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\tests\lifecycle.rs`

**Interfaces:**
- Consumes: `ProcessBackend`、DSH authoritative quiescence notification。
- Produces: `LifecycleMachine::apply(LifecycleEvent) -> Vec<LifecycleEffect>`；每次 start 生成新 `domainGenerationId`。

- [x] **Step 1: 写时间可控的状态机失败测试**

```rust
#[tokio::test(start_paused = true)]
async fn reclaims_only_after_authoritative_quiescence_and_ten_minutes() {
    let mut machine = LifecycleMachine::new(Duration::from_secs(600));
    machine.apply(LifecycleEvent::ControllerReleased);
    tokio::time::advance(Duration::from_secs(600)).await;
    assert!(!machine.effects().contains(&LifecycleEffect::Stop));
    machine.apply(LifecycleEvent::DshQuiescent { jobs: 0, interactions: 0 });
    tokio::time::advance(Duration::from_secs(600)).await;
    assert_eq!(machine.take_effects(), vec![LifecycleEffect::Flush, LifecycleEffect::Dispose, LifecycleEffect::Stop]);
}
```

- [x] **Step 2: 运行测试并确认状态机缺失**

Run: `cargo test -p aio-dsh-supervisor --test lifecycle`

Expected: FAIL，无法导入 `LifecycleMachine`。

- [x] **Step 3: 实现确定性生命周期**

状态仅为 `stopped/starting/ready/busy/stopping/crashed/unavailable`；操作幂等。默认 on-demand；prewarm 只持有 lifecycle lease、建立 readiness，不创建 session/model request，并持续到 AIO exit。crash-loop 使用有界指数退避恢复 readiness；活动 Turn 产出 durable `interrupted` 终态，清空该 generation interaction，不产生 submit/replay effect。

```rust
pub enum LifecycleEvent { DemandStart, PrewarmAcquired, ControllerReleased, DshBusy, DshQuiescent { jobs: usize, interactions: usize }, ChildExited { active_turn: Option<String> }, IdleGraceElapsed, Shutdown }
pub enum LifecycleEffect { Spawn, PublishReady, Flush, Dispose, Stop, MarkInterrupted { turn_id: String }, ScheduleRestart { after: Duration } }
```

- [x] **Step 4: 验证状态转移和无自动重放**

Run: `cargo test -p aio-dsh-supervisor lifecycle recovery -- --nocapture`

Expected: 所有 transition/idle/prewarm/crash-loop 测试 PASS；故障恢复 effect 列表不含 Prompt、model 或 tool replay。

- [x] **Step 5: 提交**

```bash
git add crates/supervisor/src/lifecycle.rs crates/supervisor/src/lease.rs crates/supervisor/src/recovery.rs crates/supervisor/tests/lifecycle.rs
git commit -m "feat(supervisor): add bounded DSH lifecycle"
```

### Task 8: `aio-coding` Profile 与公共 Cordis Bridge 启动（OpenSpec 5.1）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\profiles\aio-coding\cordis.yml`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\package.json`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\index.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\public-services.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\tests\boot.test.ts`

**Interfaces:**
- Consumes: `@deepseek-ai/dsh-base`、公开 `ctx.gateway`、`ctx.session`、`ctx.workspace`、`ctx.settings`、`ctx.credentials`、`ctx.systemPrompt` 与 `system-prompt/assemble` waterfall。
- Produces: `AioDshBridge` Cordis plugin；只有 Loader settlement 和必需 public services 全部存在后才发布 ready。

- [x] **Step 1: 写真实固定版本 boot contract 测试**

```typescript
it("settles dsh-base plus aio bridge without web or sdk transports", async () => {
  const runtime = await bootPinnedProfile("profiles/aio-coding/cordis.yml");
  expect(runtime.services()).toEqual(expect.arrayContaining(["gateway", "session", "workspace", "settings", "credentials", "systemPrompt"]));
  expect(runtime.plugins()).not.toEqual(expect.arrayContaining([expect.stringMatching(/web|sdk.*stdio/i)]));
  expect(runtime.ready()).toMatchObject({ profile: "aio-coding", provenance: expect.any(Object) });
  await runtime.dispose();
});
```

- [x] **Step 2: 运行 boot test 并确认 profile 缺失**

Run: `bunx vitest run packages/dsh-bridge/tests/boot.test.ts`

Expected: FAIL，`profiles/aio-coding/cordis.yml` 不存在。

- [x] **Step 3: 实现 additive profile 与公共服务审计**

Profile 以 DSH `dsh-base` bundle 为主体，`patchReload: startup`，最后追加 `@aiohub/dsh-bridge` 和部署覆盖。`assertPublicServices()` 返回明确缺失项并阻止 ready，禁止 private-file import 和 Agent Loop 复制。

```typescript
const REQUIRED_SERVICES = ["gateway", "session", "workspace", "settings", "credentials", "systemPrompt"] as const;
export function assertPublicServices(ctx: Record<string, unknown>): void {
  const missing = REQUIRED_SERVICES.filter((name) => ctx[name] === undefined);
  if (missing.length) throw new BridgeStartupError("MISSING_PUBLIC_SERVICES", { missing });
}
```

- [x] **Step 4: 验证真实 runtime boot/dispose**

Run: `bun run build && bunx vitest run packages/dsh-bridge/tests/boot.test.ts --testTimeout=60000`

Expected: 固定 DSH runtime 完成 Cordis settlement、公布 provenance/sandbox/capabilities、dispose 无残留；无 Web/SDK transport。

- [x] **Step 5: 提交**

```bash
git add profiles/aio-coding packages/dsh-bridge
git commit -m "feat(bridge): boot managed DSH profile"
```

### Task 9: 会话控制、controller lease 与交互闭环（OpenSpec 5.3、5.4、5.7）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\sessions.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\controller-leases.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\interactions.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\contract\session-control.test.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\contract\interaction.test.ts`

**Interfaces:**
- Consumes: DSH public session/workspace/gateway services、`ControllerLease`、generated protocol frames。
- Produces: create/list/search/resume/history/prompt/cancel/steer/queue/fork/rename/model/workspace command map；`InteractionRegistry.resolveOnce()`。

- [x] **Step 1: 写 fake-AIO/fake-DSH 控制与迟到响应测试**

```typescript
it("keeps one controller, allows observers, and fences stale interaction replies", async () => {
  const h = contractHarness();
  const first = await h.acquire("session-1", "view-a");
  expect((await h.acquire("session-1", "view-b")).mode).toBe("observer");
  const next = await h.transfer(first, "view-b");
  await expect(h.replyInteraction(first, "approval-1", "allow")).rejects.toMatchObject({ code: "STALE_LEASE" });
  await h.replyInteraction(next, "approval-1", "allow");
  await expect(h.replyInteraction(next, "approval-1", "allow")).rejects.toMatchObject({ code: "INTERACTION_RESOLVED" });
});
```

- [x] **Step 2: 运行合同测试并确认 handler 缺失**

Run: `bunx vitest run tests/contract/session-control.test.ts tests/contract/interaction.test.ts`

Expected: FAIL，session/lease/interaction 模块不存在。

- [x] **Step 3: 实现显式命令映射与 fencing**

每个 command handler 只调用对应 DSH 公共服务；AIO 只保存 `dshHomeId/sessionId/UI prefs`。fork 必须返回新 DSH session/lineage。每次 mutation 和 interaction response 在进入 DSH 前校验 generation+lease；allow/deny/answer/cancel/timeout、lease transfer、Turn cancel、domain restart 都保证 exactly-once terminal `interaction/resolved`。

```typescript
export type InteractionDecision = { kind: "allow-once" | "deny" | "answer" | "cancel" | "timeout"; answer?: string };
export interface InteractionRegistry {
  open(request: InteractionRequest): void;
  resolveOnce(ref: RuntimeRef & { leaseId: string; correlationId: string }, decision: InteractionDecision): Promise<void>;
  resolveGeneration(domainGenerationId: string, reason: "cancelled" | "transferred" | "restarted"): readonly InteractionResolved[];
}
```

- [x] **Step 4: 验证完整命令表与交互终态**

Run: `bunx vitest run tests/contract/session-control.test.ts tests/contract/interaction.test.ts`

Expected: 所有命令调用 public fake service 一次；observer mutation、旧 generation/lease 和迟到响应被拒；每个 interaction 只有一个 resolved。

- [x] **Step 5: 提交**

```bash
git add packages/dsh-bridge/src/sessions.ts packages/dsh-bridge/src/controller-leases.ts packages/dsh-bridge/src/interactions.ts tests/contract/session-control.test.ts tests/contract/interaction.test.ts
git commit -m "feat(bridge): control DSH sessions and interactions"
```

### Task 10: Durable 事件、快照恢复与有界背压（OpenSpec 5.5、5.6、7.2）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\events.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\snapshot-recovery.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\bounded-queue.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\contract\recovery.test.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\contract\backpressure.test.ts`

**Interfaces:**
- Consumes: DSH lifecycle/message/reasoning/tool/workflow/sub-agent/context/compaction/error/approval/question events。
- Produces: `Durability = "durable" | "disposable"`；`SnapshotCursor`；bounded queue overload/resync events。

- [x] **Step 1: 写 gap/duplicate/remount/overload 失败测试**

```typescript
it("pauses deltas on a gap and rebuilds from snapshot plus cursor", async () => {
  const projection = recoveryHarness({ maxQueue: 3 });
  projection.accept(event(1, "durable")); projection.accept(event(3, "disposable"));
  expect(projection.state()).toBe("resync-required");
  await projection.applySnapshot({ cursor: "cursor-8", seq: 8, durableFacts: [completedTool("call-1")] });
  projection.accept(event(9, "disposable"));
  expect(projection.tool("call-1").status).toBe("completed");
});
```

- [x] **Step 2: 运行测试并确认恢复模块缺失**

Run: `bunx vitest run tests/contract/recovery.test.ts tests/contract/backpressure.test.ts`

Expected: FAIL，无法导入 recovery/queue。

- [x] **Step 3: 实现事实/投影分层**

start/completed/tool result/approval resolution/error/interrupted 和 snapshot 永不因背压丢弃；token/reasoning/progress delta 可按 correlation id 合并。队列有界并报告 overload；sequence gap、duplicate、generation change、reconnect 或 UI remount 暂停增量，读取 DSH snapshot/history 加 cursor 后恢复；重连使用有界指数退避。

```typescript
export type QueuedRuntimeEvent = { seq: number; generation: string; durability: "durable" | "disposable"; correlationId?: string; payload: RuntimeEvent };
export interface RecoveryProjection { accept(event: QueuedRuntimeEvent): "applied" | "coalesced" | "resync-required"; applySnapshot(snapshot: SessionSnapshot): Promise<void>; }
```

- [x] **Step 4: 运行属性和合同测试**

Run: `bunx vitest run tests/contract/recovery.test.ts tests/contract/backpressure.test.ts --coverage=false`

Expected: duplicate 幂等、gap/resync、stale generation、cold resume、slow consumer 全部 PASS，终态在任意生成事件序列下不丢失。

- [x] **Step 5: 提交**

```bash
git add packages/dsh-bridge/src/events.ts packages/dsh-bridge/src/snapshot-recovery.ts packages/dsh-bridge/src/bounded-queue.ts tests/contract/recovery.test.ts tests/contract/backpressure.test.ts
git commit -m "feat(bridge): recover DSH projections under backpressure"
```

### Task 11: Profile Adapter 与受控凭据镜像（OpenSpec 6.1-6.3）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\profile-adapter.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\credential-provider.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\credentials.rs`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\tests\profile-adapter.test.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\tests\credentials.rs`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\e2e\openai-compatible-provider.test.ts`

**Interfaces:**
- Consumes: `aiohub-sdk` 的完整 AIO `LlmProfile` projection；DSH `ctx.credentials.set/unset/resolve/describe` 官方 seam。
- Produces: `AioProfileAdapterV1.validate/map`、opaque `CredentialRef`、atomic mirror operations。

- [x] **Step 1: 写 allowlist、有损字段和秘密泄漏失败测试**

```typescript
it("maps VCP/OpenAI Chat Completions and rejects behavior-changing unknown fields", () => {
  expect(adapter.map(vcpProfile())).toMatchObject({ protocol: "openai-chat-completions", baseUrl: "http://127.0.0.1:6005/v1", model: "deepseek-chat", credentialRef: expect.stringMatching(/^aio-profile:/) });
  expect(() => adapter.map(vcpProfile({ options: { unsupportedWireFlag: true } }))).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_PROFILE_FIELDS" }));
});
```

- [x] **Step 2: 运行 adapter/credential 测试并确认失败**

Run: `bunx vitest run packages/dsh-bridge/tests/profile-adapter.test.ts tests/e2e/openai-compatible-provider.test.ts && cargo test -p aio-dsh-supervisor --test credentials`

Expected: FAIL，adapter 与 credential mirror 尚不存在。

- [x] **Step 3: 实现版本化映射和最小凭据镜像**

adapter allowlist 显式覆盖 Base URL、model、Bearer、headers、parameters、stream、tool call、error、cancel；只启用 `openai-chat-completions` 基线。其他 Provider adapter 文件只有在完整黑盒 fixture 加入同一提交时才能注册。credential document 只含当前 route refs；临时文件 fsync 后 atomic replace；POSIX `0600`、Windows owner DACL；切换/解绑/用户 clear 清除 stale refs；协议与所有诊断只返回 opaque ref/configured。

```typescript
export type MappedRoute = { adapterVersion: 1; routeId: string; protocol: "openai-chat-completions"; baseUrl: string; model: string; headers: Readonly<Record<string, string>>; parameters: Readonly<Record<string, unknown>>; credentialRef: `aio-profile:${string}` };
export interface AioProfileAdapterV1 { validate(profile: AioLlmProfile): readonly ProfileDiagnostic[]; map(profile: AioLlmProfile): MappedRoute; }
```

- [x] **Step 4: 验证 mock Provider、key rotation 与全链路脱敏**

Run: `bunx vitest run packages/dsh-bridge/tests/profile-adapter.test.ts tests/e2e/openai-compatible-provider.test.ts && cargo test -p aio-dsh-supervisor --test credentials`

Expected: VCP/OpenAI request、stream/tool/error/cancel PASS；unknown field 明确拒绝；operation 间 key 可轮换但 routeId 不变；日志、stderr、crash/support bundle 搜索不到 fixture secret。

- [x] **Step 5: 提交**

```bash
git add packages/dsh-bridge/src/profile-adapter.ts packages/dsh-bridge/src/credential-provider.ts packages/dsh-bridge/tests/profile-adapter.test.ts crates/supervisor/src/credentials.rs crates/supervisor/tests/credentials.rs tests/e2e/openai-compatible-provider.test.ts
git commit -m "feat(model): adapt AIO profiles and credentials"
```

### Task 12: Prompt contribution、`{{Nova}}` 保真与 Turn Snapshot（OpenSpec 6.4-6.6）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\prompt-contribution.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\literal-placeholder-codec.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\turn-snapshot.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\tests\prompt-contribution.test.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\tests\turn-snapshot.test.ts`

**Interfaces:**
- Consumes: DSH public `system-prompt/assemble` waterfall、`MappedRoute`。
- Produces: `LiteralPlaceholderCodec.encode`、immutable `TurnConfigSnapshot` version 1。

- [x] **Step 1: 写逐字节和跨 step 不变性失败测试**

```typescript
it.each(["{{Nova}}", "a{{Nova}}{{Other}}b", "{{Nova", "{{{Nova}}}", "重复{{Nova}}重复{{Nova}}"])("preserves %s byte-for-byte", async (input) => {
  const final = await assembleThroughPinnedDsh(input);
  expect(new TextEncoder().encode(final)).toEqual(new TextEncoder().encode(input));
});
it("keeps a turn snapshot across retry, tool and compaction", () => {
  const snap = snapshots.begin(baseTurnConfig()); mutateAioSettings();
  expect(snapshots.forRetry(snap.id)).toBe(snap);
  expect(snapshots.forTool(snap.id)).toBe(snap);
  expect(snapshots.forCompaction(snap.id)).toBe(snap);
});
```

- [x] **Step 2: 运行测试并确认模块缺失**

Run: `bunx vitest run packages/dsh-bridge/tests/prompt-contribution.test.ts packages/dsh-bridge/tests/turn-snapshot.test.ts`

Expected: FAIL，prompt/snapshot 模块不存在。

- [x] **Step 3: 接入唯一 DSH assembler 并按探测结果选择 codec**

先用固定 DSH interpolator 黑盒测试直接字面保真；若直接通过，`LiteralPlaceholderCodec` 使用 identity 实现。若会拒绝完整双花括号组，只编码 AIO contribution 中 `/\{\{[^{}]+\}\}/g` 的完整组为不可碰撞的合法变量，value 为原字节，依靠 DSH replacement 不递归扫描恢复；DSH 自有 sections 不编码。官方 literal escape 一旦可验证，codec strategy 切换为 `upstream-escape` 并删除本地 token path。Turn snapshot 深冻结并按 session 单调 generation；编辑只用于下一 Turn。

```typescript
export interface LiteralPlaceholderCodec { readonly strategy: "identity" | "scoped-variable" | "upstream-escape"; encode(input: string): { text: string; variables: Readonly<Record<string, string>> }; }
export interface TurnSnapshotStore { begin(input: TurnConfigSnapshot): Readonly<TurnConfigSnapshot> & { id: string }; get(id: string): Readonly<TurnConfigSnapshot>; }
```

- [x] **Step 4: 验证真实 Provider 最终 payload**

Run: `bunx vitest run packages/dsh-bridge/tests/prompt-contribution.test.ts packages/dsh-bridge/tests/turn-snapshot.test.ts tests/e2e/openai-compatible-provider.test.ts`

Expected: mock Provider 收到逐字节相同的 `{{Nova}}`；DSH identity/tool/runtime/repository/Skill section 顺序未改变；活动 Turn 的 route/prompt/workspace/policy 不受 AIO 编辑或 compaction 影响。

- [x] **Step 5: 提交**

```bash
git add packages/dsh-bridge/src/prompt-contribution.ts packages/dsh-bridge/src/literal-placeholder-codec.ts packages/dsh-bridge/src/turn-snapshot.ts packages/dsh-bridge/tests/prompt-contribution.test.ts packages/dsh-bridge/tests/turn-snapshot.test.ts
git commit -m "feat(prompt): preserve AIO contribution per turn"
```

### Task 13: 权限与平台沙箱状态（OpenSpec 6.7、7.1）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\packages\dsh-bridge\src\policy.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\src\sandbox_status.rs`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\contract\sandbox-policy.test.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\crates\supervisor\tests\sandbox_status.rs`

**Interfaces:**
- Consumes: DSH Linux bwrap/Landlock、macOS Seatbelt、Windows ACL/restricted-token capability report。
- Produces: `PermissionPolicy` 与 `SandboxStatus`；AIO 只展示并转交 decision，DSH 最终裁决。

- [x] **Step 1: 写默认权限、full-access 非持久和 fail-closed 测试**

```typescript
it("defaults to workspace-write plus ask and never persists full access", async () => {
  const policy = new PolicyStore(memorySettings());
  expect(await policy.nextTurn()).toEqual({ permission: "workspace-write", sandboxPolicy: "ask" });
  await policy.grantOnce("full-access");
  expect(await policy.nextTurn()).toEqual({ permission: "full-access", sandboxPolicy: "ask" });
  expect(await policy.nextTurn()).toEqual({ permission: "workspace-write", sandboxPolicy: "ask" });
});
```

- [x] **Step 2: 运行测试并确认 policy/status 缺失**

Run: `bunx vitest run tests/contract/sandbox-policy.test.ts && cargo test -p aio-dsh-supervisor --test sandbox_status`

Expected: FAIL，policy/status 模块不存在。

- [x] **Step 3: 实现平台能力探测与任务前门禁**

Linux 报告 bwrap 优先、Landlock 次级；macOS 报告 Seatbelt；Windows 报告 restricted token 与 ACL。`full/partial` 只描述真实能力，不把 Sidecar 生命周期称为 sandbox。所选权限要求的 sandbox 缺失时拒绝任务且不切 unrestricted。

```typescript
export type PermissionPolicy = { permission: "workspace-write" | "full-access"; sandboxPolicy: "ask" | "deny" };
export function authorizeTask(policy: PermissionPolicy, sandbox: SandboxStatus): void {
  if (sandbox.level === "partial" && policy.permission === "full-access") throw new Error("REQUIRED_SANDBOX_UNAVAILABLE");
}
```

- [x] **Step 4: 验证三种 fake capability 和当前主机 smoke**

Run: `bunx vitest run tests/contract/sandbox-policy.test.ts && cargo test -p aio-dsh-supervisor --test sandbox_status`

Expected: 三个平台 capability fixture、默认/单次权限、缺失能力 fail-closed 全部 PASS。

- [x] **Step 5: 提交**

```bash
git add packages/dsh-bridge/src/policy.ts crates/supervisor/src/sandbox_status.rs tests/contract/sandbox-policy.test.ts crates/supervisor/tests/sandbox_status.rs
git commit -m "feat(security): enforce DSH sandbox policy"
```

### Task 14: Windows x64 ZIP 与生产原生 E2E（OpenSpec 2.3、7.3）

**Files:**
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\scripts\package-platform.ts`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\.github\workflows\ci.yml`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\.github\workflows\release-runtime.yml`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\e2e\installed-plugin.test.ts`
- Modify: `E:\workspace\projects\aio-hub\tests\tauri-e2e\**` - 仅复用既有 WebDriver/生产 IPC，增加 DSH release lane。
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\tests\fixtures\mock-provider.ts`

**Interfaces:**
- Consumes: verified runtime、manifest、Supervisor、bridge、AIO installer test harness。
- Produces: `dsh-coding-workspace-0.1.0-win32-x64.zip`、平台 scoped manifest/lock、持久化 SHA-256、SBOM、license bundle 与 support result JSON。

- [x] **Step 1: 写生产安装和 resident Sidecar 的失败 E2E**

```typescript
it("runs a release-shaped coding turn from a clean offline install", async () => {
  const app = await installFinalZipViaProductionIpc({ network: "disabled", cleanPluginData: true });
  const run = await app.runMockCodingTurn({ workspace: fixtureWorkspace("长路径") });
  expect(run).toMatchObject({ terminal: "completed", orphanPids: [], secretLeaks: [] });
  await app.crashRuntime();
  expect(await app.resume()).toMatchObject({ previousTurn: "interrupted", replayedEffects: 0 });
});
```

- [x] **Step 2: 运行 E2E 并确认不会被 ZIP fixture/layout 替代**

Run: `bunx vitest run tests/e2e/installed-plugin.test.ts --testTimeout=120000`

Expected: FAIL，直到最终 ZIP 被生产 installer 安装、manifest-selected Supervisor 启动并返回 JSONL ready；不得改用原生文件对话框、直接解压 ZIP 或 mock layout。

- [x] **Step 3: 实现最终 Windows ZIP、生产 IPC 安装与生命周期验证**

仅 Windows x64 进入当前 release matrix。包必须包含 manifest 选择的 Supervisor、单一 Windows binary map、完整 runtime closure、平台 scoped lock、持久化 SHA-256、SBOM、license bundle 与 support result JSON。测试必须经 AIO `install_plugin_from_zip` 生产 IPC 安装最终 ZIP，并以 resident Sidecar IPC 覆盖 offline cold start、真实 handshake、loopback mock-provider coding Turn、工具子进程树清理、取消、flush、退出、crash/interrupted、绝不重放副作用、cold resume、升级、失败回退、卸载和数据保留。

```yaml
matrix:
  include:
    - { os: windows-latest, platform: win32-x64, support: supported }
```

- [x] **Step 4: 运行 Windows 首发门禁并记录延后平台**

`linux-x64`（包括 `.deb`/`.AppImage`）、`darwin-arm64`、`linux-arm64` preview 与 Flatpak 不进入当前 matrix。release metadata 与文档必须将它们明确标为 deferred/unsupported；不得生成包或声称支持。

Run: `bun run package:platform && bunx vitest run tests/e2e/installed-plugin.test.ts`

Expected: Windows x64 的真实 release gate PASS；其他平台没有 supported 或 preview 发布声明。

- [x] **Step 5: 提交**

```bash
git add scripts/package-platform.ts .github/workflows tests/e2e tests/fixtures/mock-provider.ts
git commit -m "build: package and gate DSH Windows runtime"
```

### Task 15: Windows required CI lane（OpenSpec 7.4）

**Files:**
- Modify: `E:\workspace\projects\aiohub-plugin-dsh-workspace\.github\workflows\ci.yml`
- Modify: `E:\workspace\projects\aio-hub\.github\workflows\pr-check.yml` 或当前 Windows CI workflow
- Modify: `E:\workspace\projects\aio-hub\tests\tauri-e2e\run.ts`
- Test: Windows runner workflow validation plus the native E2E lane from Task 14.

**Interfaces:**
- Consumes: Task 5 verified runtime closure, Task 6 JSONL ABI, Task 14 final ZIP and production E2E preset.
- Produces: a Windows native E2E check whose test process has an explicit app binary, local frontend origin, isolated data root, ID suffix, artifact root and embedded WebDriver port, plus a narrow pre-test infrastructure classifier. A temporary waiver reports `gatePassed=false` and keeps formal release blocked.

- [x] **Step 1: Write the failing CI contract test or workflow assertion**

Assert the required lane has a separate online acquisition/build step, then uses `AIO_E2E_BINARY`, `AIO_E2E_FRONTEND_URL`, `AIO_E2E_DATA_DIR`, `AIO_E2E_ID_SUFFIX`, `AIO_E2E_ARTIFACT_DIR`, and `AIO_E2E_WEBDRIVER_PORT` while running the Task 14 production E2E.

- [x] **Step 2: Implement the split online/offline lane**

Use `bun run build:vite` and `cargo build --manifest-path src-tauri/Cargo.toml` to provide `src-tauri/target/debug/aiohub.exe`. Before E2E, install a uniquely named outbound Windows Firewall deny rule for Internet traffic while preserving `127.0.0.1`; set telemetry disabled; always remove the rule in a `finally`/post step before upload. Only redacted reports, checksums and test results may be uploaded. PR executes ZIP contract plus executable smoke. Only a recognized WebDriver/port/runner failure before any test starts may be temporarily waived after all hard artifact gates pass; product/unknown failures remain fatal, the report must say E2E did not pass, and formal release requires a later successful native E2E.

- [ ] **Step 3: Run focused workflow and native-lane checks**

Run: `bun run test:tauri:e2e -- --preset dsh-runtime-native` and the workflow's focused validation command.

Expected: all non-loopback traffic is blocked during test execution; no user app-data, secrets, ZIP contents or runtime binary are uploaded. Success is recorded separately from `infrastructure-blocked`; a waiver never satisfies the formal release gate.

### Task 16: 发布文档、兼容边界与全量门禁（OpenSpec 7.6）

**Files:**
- Modify: `E:\workspace\projects\aiohub-plugin-dsh-workspace\README.md`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\docs\platform-support.md`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\docs\security-model.md`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\docs\runtime-provenance.md`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\docs\recovery.md`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\docs\capability-runtime-migration.md`
- Create: `E:\workspace\projects\aiohub-plugin-dsh-workspace\scripts\verify-release.ts`
- Test: `E:\workspace\projects\aiohub-plugin-dsh-workspace\scripts\verify-release.test.ts`

**Interfaces:**
- Consumes: manifest、runtime lock、CI support results、contract hash。
- Produces: 可机器校验的 release checklist；未来 Capability Runtime 仅通过 adapter 注册现有 `RuntimeFacade`。

- [x] **Step 1: 写文档/发布一致性失败测试**

```typescript
it("documents exactly the machine-readable platform and trust matrix", async () => {
  const report = await verifyRelease(".");
  expect(report.supported).toEqual(["win32-x64"]);
  expect(report.preview).toEqual([]);
  expect(report.failures).toEqual([]);
});
```

- [x] **Step 2: 运行 release verifier 并确认文档缺失**

Run: `bunx vitest run scripts/verify-release.test.ts`

Expected: FAIL，缺少平台、安全、provenance、recovery 或迁移文档。

- [x] **Step 3: 编写用户与维护者文档**

文档必须说明：Windows x64 安装与开发 junction、其 runtime 来源/SBOM/license/hash、DSH alpha 与未审计 sandbox 边界、同用户凭据读取模型、诊断脱敏、崩溃 interrupted/不重放、数据保留/升级/回退/卸载、VCP/OpenAI-compatible 基线、unsupported Provider 错误、`{{Nova}}` 保真，以及后续 `CredentialProvider`/`ModelTransport`/global Capability Runtime 替换接口。必须明确 Linux x64、macOS arm64、Linux ARM64 与 Flatpak 已延后到独立 change；明确排除 UI、market 与 RAG/Knowledge。

```typescript
export type ReleaseReport = { supported: PlatformKey[]; preview: PlatformKey[]; failures: { code: string; artifact?: string }[] };
export async function verifyRelease(root: string): Promise<ReleaseReport> {
  const support = await Bun.file(`${root}/dist/support-results.json`).json() as ReleaseReport;
  const requiredDocs = ["platform-support.md", "security-model.md", "runtime-provenance.md", "recovery.md", "capability-runtime-migration.md"];
  for (const name of requiredDocs) if (!(await Bun.file(`${root}/docs/${name}`).exists())) support.failures.push({ code: "MISSING_RELEASE_DOC", artifact: name });
  return support;
}
```

- [x] **Step 4: 执行全量静态、单元、合同和当前平台 release gate**

Run: `bun run check && bun run test && cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace && bun scripts/verify-release.ts && bun run package:platform`

Expected: 所有命令退出 0；generated diff 为空；最终 ZIP manifest 路径存在并通过真实 executable smoke；release report 无 secret、orphan、provenance 或 contract failure。

- [x] **Step 5: 提交文档与 release verifier**

```bash
git add README.md docs scripts/verify-release.ts scripts/verify-release.test.ts
git commit -m "docs: publish DSH runtime operating model"
```

## Spec Coverage Matrix

| OpenSpec task | Plan task |
|---|---|
| 1.1-1.2 | Task 1 |
| 1.3 | Task 2 |
| 1.4 | Task 3 |
| 2.1-2.2、2.4-2.5 | Task 5 |
| 2.3 | Task 14 |
| 3.1-3.3 | Task 4 |
| 4.1-4.4、4.7 | Task 6 |
| 4.5-4.6 | Task 7 |
| 5.1 | Task 8 |
| 5.2 | Task 3 |
| 5.3-5.4、5.7 | Task 9 |
| 5.5-5.6 | Task 10 |
| 6.1-6.3 | Task 11 |
| 6.4-6.6 | Task 12 |
| 6.7 | Task 13 |
| 7.1 | Tasks 3、6、10-13 |
| 7.2 | Tasks 9-10 |
| 7.3 | Task 14 |
| 7.4 | Task 15 |
| 7.6 | Task 16 |

## Execution Notes

- Task 4 是唯一允许直接修改 AIO core 的实现批次，应先独立评审并可单独上游。
- Tasks 1-3 建立其他插件任务依赖的仓库、Facade 与协议；Task 5 产出固定来源 Windows runtime；Tasks 6-7 产出 Supervisor；Tasks 8-13 完成 bridge 和策略；Task 14 建立生产安装的 Windows x64 最终平台包与原生 E2E；Task 15 将其接入 required CI；Task 16 收口文档。Linux/macOS/ARM64/Flatpak 扩展不属于本计划，须在后续独立 change 中重新计划。
- 每个任务完成后记录定向验证与审查证据。用户未明确授权前，独立插件仓库与 AIO 主仓库都不得提交；恢复时以 progress checkpoint、可见 diff 与测试结果确认任务身份。
- 若固定 DSH 的任一必需 public service 测试失败，保留失败 fixture 与输出，停止后续 bridge 实现并回到 OpenSpec 设计审查；不得导入 DSH private module。
- 执行前使用 `superpowers:using-git-worktrees` 为 AIO 主仓建立隔离 worktree；独立插件仓库使用独立 feature branch。开发 junction 必须指向所选插件 worktree，而不是默认 checkout。
