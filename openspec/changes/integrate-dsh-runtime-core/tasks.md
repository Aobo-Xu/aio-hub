## 1. Repository, contracts, and packaging foundation

- [ ] 1.1 Initialize `aiohub-plugin-dsh-workspace` as an independent repository with license, contribution guidance, pinned Rust/Node/Bun/DSH toolchains, and an AIO `AGENTS.md` derived from the plugin template.
- [ ] 1.2 Add idempotent scripts for creating/removing the development junction at `aio-hub/plugins/dsh-coding-workspace` without committing plugin files to AIO.
- [ ] 1.3 Define the Plugin API v3 Sidecar manifest, plugin-local `RuntimeFacade`, stable `execution-domain:dsh` capability descriptor, and platform-neutral DTO package.
- [ ] 1.4 Define the Rust protocol crate as the single contract source; generate JSON Schema and TypeScript declarations, calculate a contract hash, and add generated-file drift checks.

## 2. Reproducible DSH runtime supply chain

- [ ] 2.1 Pin DSH `dsh-v0.1.2-alpha.1` / `cd5ef8148158c3a752a658978873241fdf8e2bbc` in a versioned runtime lock with platform, provenance, toolchain, checksum, license, SBOM, profile, contract, and supported AIO ranges.
- [ ] 2.2 Implement official exact-wheel discovery and verification, with native reproducible source-build fallback that is explicitly labeled project-built.
- [ ] 2.3 Build fully offline per-platform ZIPs for `win32-x64`, glibc 2.28+ `linux-x64`, and macOS 14+ `darwin-arm64`; build a separately labeled `linux-arm64` preview ZIP.
- [ ] 2.4 Reject temporary CI artifacts, moving refs, wrong architecture, missing helpers, checksum mismatch, unsupported licenses, and runtime/profile/contract incompatibility before packaging or startup.
- [ ] 2.5 Add release-shaped black-box gates for each artifact using an installed runtime, clean plugin data directory, mock model Provider, provenance verification, and SBOM/license checks.

## 3. Minimal AIO POSIX installer compatibility patch

- [ ] 3.1 Add a failing Linux/macOS test demonstrating that ZIP-installed manifest-selected Sidecar binaries lose executable permission under the current installer.
- [ ] 3.2 Implement the narrow installer fix that preserves safe regular-file mode or restores executable permission only for validated current-platform Native/Sidecar executables and required helpers.
- [ ] 3.3 Retain path traversal validation, reject symlinks/special files, keep Windows behavior unchanged, and add install-and-launch regressions for Linux/macOS.

## 4. Cross-platform Supervisor lifecycle

- [ ] 4.1 Implement stdout-pure Sidecar v3 initialization, runtime validation, health/readiness, structured diagnostics, stable/experimental capability negotiation, and generation fencing.
- [ ] 4.2 Derive a plugin-owned DSH Home from `AIOHUB_PLUGIN_DATA_DIR`; create data, session, credential, runtime, log, and temp boundaries with Windows DACL and POSIX `0700`/`0600` modes.
- [ ] 4.3 Implement Windows Job Object/DACL and Linux/macOS process-group TERM/KILL backends with bounded shutdown, full descendant cleanup, non-ASCII/long path support, and no console leakage.
- [ ] 4.4 Implement stopped, starting, ready, busy, stopping, crashed, and unavailable states with idempotent operations and `domainGenerationId` isolation.
- [ ] 4.5 Implement on-demand start, optional prewarm without session/model activity, authoritative quiescence checks, controller/prewarm leases, 10-minute idle grace, flush/dispose, and process-tree teardown.
- [ ] 4.6 Implement crash-loop protection and interrupted-Turn recovery that may restore readiness but never automatically replays prompts, model calls, or tool effects.
- [ ] 4.7 Disable DSH telemetry by default and ensure support diagnostics redact credentials, authorization headers, query secrets, environment data, child output, crash records, and credential documents.

## 5. Full DSH execution-domain bridge

- [ ] 5.1 Add the managed `aio-coding` profile over `dsh-base` using public Cordis composition and project patch; load no Web UI or competing SDK stdio transport.
- [ ] 5.2 Implement JSONL initialize, command/response/notification/interaction frames with protocol version, contract hash, generation, sequence, and DSH-native correlation identifiers.
- [ ] 5.3 Implement one mutable controller lease per session, read-only observers, explicit transfer/release, and generation-plus-lease fencing for all mutations and interaction responses.
- [ ] 5.4 Bridge session create/resume/list/search/history/prompt/cancel/steer/fork/queue/rename/model/workspace operations through public DSH services.
- [ ] 5.5 Bridge lifecycle, message, reasoning, tool, workflow, sub-agent, context, compaction, error, approval, and user-question events while preserving DSH durable facts.
- [ ] 5.6 Implement authoritative snapshot-plus-cursor recovery, duplicate/gap handling, UI remount recovery, bounded queues, disposable delta coalescing, overload diagnostics, and reconnect backoff.
- [ ] 5.7 Implement interaction correlation and terminal `interaction/resolved` cleanup for allow, deny, answer, cancel, timeout, lease transfer, Turn cancellation, and domain restart.

## 6. AIO model, credential, prompt, and policy integration

- [ ] 6.1 Implement explicit versioned `AioProfileAdapter` validation and the mandatory VCP/OpenAI-compatible Chat Completions mapping, including Base URL, model, headers, stream/tool/error/cancel semantics, and unsupported-field diagnostics.
- [ ] 6.2 Add other Provider adapters only with complete mappings and black-box tests; forbid name-based routing, inferred endpoints, silent field dropping, and heuristic fallback.
- [ ] 6.3 Implement atomic minimal credential mirror writes through the official DSH seam, owner-only ACL/modes, per-operation key rotation, stale-reference cleanup, and user-triggered mirror clearing.
- [ ] 6.4 Implement Turn-start immutable snapshots for route/model/parameters, System Prompt contribution, workspace, permission, and sandbox policy; apply edits only to the next Turn in the same session.
- [ ] 6.5 Inject the user System Prompt contribution through DSH's public assembly waterfall while keeping DSH's identity, tool, runtime, repository, and Skill assembly authority intact.
- [ ] 6.6 Implement and byte-test the scoped literal-placeholder codec for `{{Nova}}` and edge cases only if required by the pinned DSH interpolator; prefer and migrate to an upstream literal escape when available.
- [ ] 6.7 Set default policy to `workspace-write + ask`, require explicit non-persistent full access, expose DSH sandbox `full`/`partial`, and fail closed when required platform sandbox support is unavailable.

## 7. Verification, compatibility, and release readiness

- [ ] 7.1 Add unit/property tests for contract generation, lifecycle transitions, leases, generation fencing, path isolation, ACL/modes, redaction, profile mapping, prompt codec, Turn snapshots, event sequencing, and backpressure.
- [ ] 7.2 Add deterministic fake-AIO/fake-DSH contract tests for cancellation, approvals, questions, controller transfer, reconnect, gaps, overload, crash, cold resume, and stale frames.
- [ ] 7.3 Add native end-to-end tests on Windows x64, Linux x64, and macOS arm64 covering clean ZIP install, offline cold start, mock-provider coding Turn, descendants, flush, crash interruption, resume, upgrade, rollback, uninstall, and data preservation.
- [ ] 7.4 Add AIO `.deb` and `.AppImage` tests on glibc 2.28+; run a distinct Flatpak matrix for executable, nested filesystem, shell, document portal, workspace access, bwrap/Landlock, and accurate support diagnostics.
- [ ] 7.5 Run Linux ARM64 preview artifact tests without promoting it to supported until a normal AIO ARM64 desktop host and complete native integration lane exist.
- [ ] 7.6 Document platform matrix, installation, development junction, runtime provenance, trust/sandbox boundaries, model compatibility, diagnostics, recovery, data retention, and the future Capability Runtime/model broker replacement interfaces.
