## 1. Repository, contracts, and packaging foundation

- [x] 1.1 Initialize `aiohub-plugin-dsh-workspace` as an independent repository with license, contribution guidance, pinned Rust/Node/Bun/DSH toolchains, and an AIO `AGENTS.md` derived from the plugin template.
- [x] 1.2 Add idempotent scripts for creating/removing the development junction at `aio-hub/plugins/dsh-coding-workspace` without committing plugin files to AIO.
- [x] 1.3 Define the Plugin API v3 Sidecar manifest, plugin-local `RuntimeFacade`, stable `execution-domain:dsh` capability descriptor, and platform-neutral DTO package.
- [x] 1.4 Define the Rust protocol crate as the single contract source; generate JSON Schema and TypeScript declarations, calculate a contract hash, and add generated-file drift checks.

## 2. Reproducible DSH runtime supply chain

- [x] 2.1 Pin DSH `dsh-v0.1.2-rc.1` / `a66e4702047846cdaa10c66c9d3df3951f5ea70d` and its official Windows x64 wheel in stable `runtime-lock/dsh-runtime.json`, including platform, provenance, wheel/file checksums, upstream license/notices, SBOM, profile, contract, and supported AIO ranges; version consumers MUST derive identity from the lock rather than hard-code it.
- [x] 2.2 Implement exact official-wheel acquisition and fail-closed verification. The acquisition stage MAY use the network only for the lock-pinned wheel, MUST verify the wheel before dynamically discovering its versioned metadata directory, and MUST produce only the audited main executable, `-rg.exe`, upstream license/notices and SBOM before the separately offline test stage; no source-build fallback is allowed.
- [x] 2.3 Build a fully offline `win32-x64` ZIP containing the manifest-selected Supervisor, verified runtime closure, platform-scoped lock, persisted SHA-256, SBOM, license bundle, provenance, and support-result JSON.
- [x] 2.4 Reject temporary CI artifacts, moving refs, wrong architecture, missing helpers, checksum mismatch, unsupported licenses, and runtime/profile/contract incompatibility before packaging or startup.
- [x] 2.5 Add release-shaped black-box gates for each artifact using an installed runtime, clean plugin data directory, mock model Provider, provenance verification, and SBOM/license checks.

## 3. Minimal AIO POSIX installer compatibility patch

- [x] 3.1 Add a failing Linux/macOS test demonstrating that ZIP-installed manifest-selected Sidecar binaries lose executable permission under the current installer.
- [x] 3.2 Implement the narrow installer fix that preserves safe regular-file mode or restores executable permission only for validated current-platform Native/Sidecar executables and required helpers.
- [x] 3.3 Retain path traversal validation, reject symlinks/special files, keep Windows behavior unchanged, and add install-and-launch regressions for Linux/macOS.

## 4. Cross-platform Supervisor lifecycle

- [x] 4.1 Implement stdout-pure Sidecar v3 initialization, runtime validation, health/readiness, structured diagnostics, stable/experimental capability negotiation, generation fencing, and the Windows-native E2E JSONL ABI.
- [x] 4.2 Derive a plugin-owned DSH Home from `AIOHUB_PLUGIN_DATA_DIR`; create data, session, credential, runtime, log, and temp boundaries with Windows DACL and POSIX `0700`/`0600` modes.
- [x] 4.3 Implement Windows Job Object/DACL and Linux/macOS process-group TERM/KILL backends with bounded shutdown, full descendant cleanup, non-ASCII/long path support, and no console leakage.
- [x] 4.4 Implement stopped, starting, ready, busy, stopping, crashed, and unavailable states with idempotent operations and `domainGenerationId` isolation.
- [x] 4.5 Implement on-demand start, optional prewarm without session/model activity, authoritative quiescence checks, controller/prewarm leases, 10-minute idle grace, flush/dispose, and process-tree teardown.
- [x] 4.6 Implement crash-loop protection and interrupted-Turn recovery that may restore readiness but never automatically replays prompts, model calls, or tool effects.
- [x] 4.7 Disable DSH telemetry by default and ensure support diagnostics redact credentials, authorization headers, query secrets, environment data, child output, crash records, and credential documents.

## 5. Full DSH execution-domain bridge

- [x] 5.1 Add the managed `aio-coding` profile over `dsh-base` using public Cordis composition and project patch; load no Web UI or competing SDK stdio transport.
- [x] 5.2 Implement JSONL initialize, command/response/notification/interaction frames with protocol version, contract hash, generation, sequence, and DSH-native correlation identifiers.
- [x] 5.3 Implement one mutable controller lease per session, read-only observers, explicit transfer/release, and generation-plus-lease fencing for all mutations and interaction responses.
- [x] 5.4 Bridge session create/resume/list/search/history/prompt/cancel/steer/fork/queue/rename/model/workspace operations through public DSH services.
- [x] 5.5 Bridge lifecycle, message, reasoning, tool, workflow, sub-agent, context, compaction, error, approval, and user-question events while preserving DSH durable facts.
- [x] 5.6 Implement authoritative snapshot-plus-cursor recovery, duplicate/gap handling, UI remount recovery, bounded queues, disposable delta coalescing, overload diagnostics, and reconnect backoff.
- [x] 5.7 Implement interaction correlation and terminal `interaction/resolved` cleanup for allow, deny, answer, cancel, timeout, lease transfer, Turn cancellation, and domain restart.

## 6. AIO model, credential, prompt, and policy integration

- [x] 6.1 Implement explicit versioned `AioProfileAdapter` validation and the mandatory VCP/OpenAI-compatible Chat Completions mapping, including Base URL, model, headers, stream/tool/error/cancel semantics, and unsupported-field diagnostics.
- [x] 6.2 Add other Provider adapters only with complete mappings and black-box tests; forbid name-based routing, inferred endpoints, silent field dropping, and heuristic fallback.
- [x] 6.3 Implement atomic minimal credential mirror writes through the official DSH seam, owner-only ACL/modes, per-operation key rotation, stale-reference cleanup, and user-triggered mirror clearing.
- [x] 6.4 Implement Turn-start immutable snapshots for route/model/parameters, System Prompt contribution, workspace, permission, and sandbox policy; apply edits only to the next Turn in the same session.
- [x] 6.5 Inject the user System Prompt contribution through DSH's public assembly waterfall while keeping DSH's identity, tool, runtime, repository, and Skill assembly authority intact.
- [x] 6.6 Implement and byte-test the scoped literal-placeholder codec for `{{Nova}}` and edge cases only if required by the pinned DSH interpolator; prefer and migrate to an upstream literal escape when available.
- [x] 6.7 Set default policy to `workspace-write + ask`, require explicit non-persistent full access, expose DSH sandbox `full`/`partial`, and fail closed when required platform sandbox support is unavailable.

## 7. Verification, compatibility, and release readiness

- [x] 7.1 Add unit/property tests for contract generation, lifecycle transitions, leases, generation fencing, path isolation, ACL/modes, redaction, profile mapping, prompt codec, Turn snapshots, event sequencing, and backpressure.
- [x] 7.2 Add deterministic fake-AIO/fake-DSH contract tests for cancellation, approvals, questions, controller transfer, reconnect, gaps, overload, crash, cold resume, and stale frames.
- [x] 7.3 Add native Windows x64 end-to-end tests covering clean ZIP installation through the AIO installer, offline cold start, real handshake, mock-provider coding Turn, descendants, flush, crash interruption, resume, upgrade, rollback, uninstall, and data preservation.
- [ ] 7.4 Add a required Windows GitHub Actions lane that builds the AIO debug binary, supplies the Tauri frontend origin, isolated app-data root and WebDriver port, then runs the production-IPC native E2E with network disabled during the runtime test stage and uploads only redacted reports, checksums, and test results.
- [x] 7.6 Document platform matrix, installation, development junction, runtime provenance, trust/sandbox boundaries, model compatibility, diagnostics, recovery, data retention, and the future Capability Runtime/model broker replacement interfaces.

### Deferred platform scope

`linux-x64` (including AIO `.deb`/`.AppImage`), `darwin-arm64`, `linux-arm64` preview, and Flatpak compatibility were intentionally removed from this change's release acceptance on 2026-09-02. A later, separately approved change must supply their artifacts and native gates; until then they remain unsupported and are not represented by completed tasks here.
