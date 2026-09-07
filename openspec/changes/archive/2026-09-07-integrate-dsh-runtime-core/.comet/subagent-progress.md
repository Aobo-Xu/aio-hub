# Subagent progress — integrate-dsh-runtime-core

## Task 5 — runtime supply-chain history (superseded)

- Plan task: `Task 5: 可复现 DSH Runtime Lock 与 Windows 原生构建（剩余 OpenSpec 2.2）`
- OpenSpec mapping: 2.2
- Status: complete (final thorough review passed)
- Implementer model: `gpt-5.4` (high)
- Brief: `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-5-brief.md`
- Report: `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-5-report.md`
- Plugin worktree: `E:/workspace/projects/aiohub-plugin-dsh-workspace/.worktrees/integrate-dsh-runtime-core`
- Plugin base: `448f8533581932298f97bc13e6c15d06e871d299`
- Review mode: thorough; review-fix rounds: 1/2
- Required TDD evidence: RED must demonstrate `RUNTIME_BUILD_NOT_IMPLEMENTED_ON_THIS_HOST` (or a narrower missing-build behavior) before implementation; GREEN must run the focused runtime tests.
- Commit policy: no commit is authorized. Keep the task changes uncommitted and report visible files plus tests.
- Historical source-build implementers encountered quota failures and left partial source-builder work; this route was later completed and reviewed, then superseded by the official-wheel baseline below.
- The historical recovery report remains at `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-5-report.md`; it is not the current release route.
- Review result: FAIL. `pnpm.cmd` direct spawning is not Windows-safe (`spawn EINVAL`), pinned-source validation accepts dirty worktrees, and tests hard-code the local audit checkout / depend on host Node version. The full review is `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-5-review.md`. A fresh repair implementer must add failing regression tests and correct only these Task-5 defects before a second thorough review.
- Repair round 1 evidence: a new implementer added an upstream-style Windows pnpm JavaScript-entrypoint resolver, a dirty-worktree gate, and hermetic regression tests. RED covered all three review defects; focused GREEN passed 26 tests. See `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-5-fix-round1-report.md`. Final review is now required.
- Historical final review: PASS for the former source-build route. That evidence is retained at `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-5-final-review.md`, but the implementation has since been replaced by the official-wheel route and must not be used as current release evidence.

## Task 6 — Supervisor JSONL initialize/lifecycle ABI

- Plan task: `Task 6: Supervisor 初始化、DSH Home 与平台进程树（剩余 OpenSpec 4.1）`
- OpenSpec mapping: 4.1
- Status: complete (final thorough review passed)
- Implementer model: `gpt-5.4` (high)
- Brief: `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-6-brief.md`
- Report: `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-6-report.md`
- Plugin worktree: `E:/workspace/projects/aiohub-plugin-dsh-workspace/.worktrees/integrate-dsh-runtime-core`
- Plugin base: `448f8533581932298f97bc13e6c15d06e871d299`
- Review mode: thorough; review-fix rounds: 1/2
- Required TDD evidence: real stdio-subprocess ABI test must fail while `main.rs` exits without protocol output, then pass after implementation.
- Commit policy: no commit is authorized. Preserve Task 5 and Task 14 uncommitted work, and report only Task-6 files/tests.
- Initial implementation result: only the real-stdio `ready` then `stopped` test passed after resolving a test import compilation error. Lease event/rejection, stale-generation rejection, exact-token crash interruption/nonzero exit, full stdio test run, clippy, and report evidence are missing. The initial run did not obtain a behavior-level RED. Preserve its uncommitted changes in `crates/supervisor/src/main.rs`, `crates/supervisor/src/lifecycle.rs`, and `crates/supervisor/tests/stdio_abi.rs`; a fresh recovery implementer must complete and validate the task before review.
- Recovery dispatch note: the first recovery agent returned an unrelated runtime-version restatement and made no Task-6 implementation, test, or report contribution. It is treated as invalid; the next agent is dispatched with isolated context and this task-specific checkpoint only.
- Recovery implementation evidence: real stdio subprocess coverage now asserts exact JSONL frame counts, initialize failure, fresh generation, lease grant/reject/release, stale/unknown lease rejection without controller replacement, and exact-token-only crash injection. `cargo test -p aio-dsh-supervisor --test stdio_abi`, `cargo test -p aio-dsh-supervisor --all-features`, and `cargo clippy -p aio-dsh-supervisor --all-targets -- -D warnings` all passed. See `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-6-recovery2-report.md`. Thorough review is required before 4.1 can be checked off.
- Review result: FAIL. Invalid JSON/schema input exits via raw stderr rather than structured wire error; failed initialize leaves `LifecycleMachine` in `Starting` and can reuse its generation; crash coverage checks only a literal rather than interrupted/no-replay across recovery. See `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-6-review.md`. A fresh repair implementer must produce behavior-level RED/GREEN evidence for all three defects before final review.
- Repair round 1 evidence: malformed/schema-invalid input now emits structured `invalid-command-frame` JSONL and stays alive; failed initialize rolls state/generation back; crash persists interrupted turn and rejects its replay while allowing a new turn. All stdio ABI, crate, and strict clippy checks pass. See `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-6-fix-round1-report.md`. Final review is required.
- Final review: PASS. Fresh subprocess evidence covers malformed input recovery, transactional initialize retry with fresh generation, and exact-token crash persistence/replay rejection. `stdio_abi` (7), `lifecycle` (7), `supervisor_review_fixes` (8), and `supervisor_task6` (9) passed. See `E:/workspace/projects/aio-hub/.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-6-final-review.md`. OpenSpec 4.1 is checked off. No commit is authorized.

## Task 14 — Windows x64 ZIP and native E2E

- Plan: `docs/superpowers/plans/2026-08-30-aio-dsh-runtime-core.md`
- OpenSpec mappings: 2.3, 7.3
- Status: DESIGNING_WINDOWS_NATIVE_E2E_EXPANSION
- Reviewer: `/root/task14_thorough_review`
- Plugin worktree: `E:/workspace/projects/aiohub-plugin-dsh-workspace/.worktrees/integrate-dsh-runtime-core`
- Plugin HEAD: `448f8533581932298f97bc13e6c15d06e871d299`
- Evidence under review: committed packaging and E2E series `b126f96..563f4cb`, plus the later Windows-only scope change `448f853`.
- Review verdict: FAIL. The existing package foundations do not stage the manifest-selected supervisor, produce real final runtime artifacts, or run release-shaped host E2E. See `.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-14-review.md`.
- Scope decision: on 2026-09-02 the user confirmed that this change is a Windows x64-only first release. Linux x64, macOS arm64, Linux arm64 preview, and Flatpak compatibility were moved to a later independently approved change; the proposal, design, delta spec, task list, and build plan were synchronized.
- Implementer: `/root/task14_windows_implementer` (`gpt-5.6-terra`, high)
- Implementer result: BLOCKED after Windows package-contract implementation. Uncommitted plugin-worktree changes stage the supervisor, emit scoped metadata/checksum/license bundle, and constrain CI/release to Windows x64.
- RED: `bunx vitest run tests/e2e/installed-plugin.test.ts --testTimeout=120000` failed because the final ZIP omitted the manifest-selected supervisor.
- GREEN: the same command passed (2 tests); `bun run package:platform`, focused E2E, `bun run check:types`, and `cargo test -p aio-dsh-supervisor` passed. Full evidence is in `.superpowers/sdd/2026-08-30-aio-dsh-runtime-core/task-14-report.md`.
- Review mode: thorough; review-fix rounds: 0/2
- Commit policy: no commit is authorized; implementation and review evidence remain as uncommitted plugin-worktree changes until the user explicitly authorizes a commit.
- Current implementation evidence: the Supervisor now accepts the production resident JSON-RPC envelope from a release-shaped install directory using only `AIOHUB_PLUGIN_DATA_DIR`, resolves the scoped `runtime-lock.json` plus `bin/` closure, and returns a host-waitable `result` for `initialize` / `shutdown` while preserving the typed JSONL ABI. A new AIO Tauri E2E spec installs the final ZIP through `install_plugin_from_zip`, launches the manifest-selected resident Sidecar through production IPC, and requires `ready`; it contains no direct extraction, native file picker, or mock layout.
- Current blocker: AIO's debug host cannot be built on this machine because its `boring-sys2` dependency invokes `cmake`, which is absent from PATH and from the standard Visual Studio/CMake locations checked. The Wry patch prerequisite was restored by the repository's existing setup script, but the actual Cargo build fails with `program not found: is cmake not installed?`. Therefore the new real Tauri E2E cannot yet run. OpenSpec 2.3 and 7.3 remain unchecked; no completion claim is made.
- Scope decision: the user authorized a substantial in-change expansion for a Windows native E2E gate. The revised design uses existing Tauri WebDriver and production IPC without adding Coding工作站 UI; it specifies CI environment isolation/network separation, a minimal Supervisor JSONL ABI, production ZIP installation, required lifecycle evidence, CI tiers, and a lock-driven official-wheel baseline.

## 2026-09-04 official-wheel supersession

- DSH runtime is now sourced only from the `v0.1.2-rc.1` official Windows x64 wheel fixed in `runtime-lock/dsh-runtime.json`; the former source builder and patch were removed.
- Resolver, packager, release verifier, Supervisor and reusable tests derive runtime identity from the stable lock and accept a future-version fixture without code changes.
- Focused TypeScript tests passed 13/13, Supervisor tests passed 44/44, `bun run check` passed, real wheel acquisition/verification passed, and the release ZIP verifier reported no failures. Plugin commit `e8575534ccf7dfacfa86cda8bd3c0d4c40f70205` is pushed to the validation repository.
- The AIO workflow now classifies only a WebDriver-unreachable failure before test results as `infrastructure-blocked`. Such a waiver records `gatePassed=false` and `formalReleaseBlocked=true`; product or unknown failures remain fatal, and formal release still requires a successful Windows native E2E.
- Next: self-review the updated proposal/design/delta/tasks, then ask the user to review the written design before revising the implementation plan. Existing package-contract changes remain uncommitted and are not marked complete.
