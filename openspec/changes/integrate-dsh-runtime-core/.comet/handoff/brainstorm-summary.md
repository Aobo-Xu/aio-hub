# Brainstorm Summary

- Change: `integrate-dsh-runtime-core`
- Date: 2026-08-29
- Status: brainstorming in progress

## Confirmed Facts

- AIO `dev` exposes Plugin API v3 Resident Sidecar, plugin-owned data directories, native plugin UI routes, and `useLlmProfiles()` through the public SDK.
- DSH remains a complete, disposable execution domain. AIO does not transplant the DSH Agent Loop, session log, tool policy, approval, workflow, sandbox, or sub-agent internals.
- The integration lives in the independent `aiohub-plugin-dsh-workspace` repository and uses a development junction into AIO; no AIO or DSH core source change is planned.
- Windows x64 is the first supported platform. Ordinary users must not need a separate Node.js, Python, WSL2, or DSH installation.
- A lightweight Supervisor is the AIO Resident Sidecar and launches the pinned official DSH runtime as a child execution domain in a Windows Job Object.
- AIO is the only model Profile selection/configuration entry. DSH may access the same real credentials available to AIO LLM chat, with strict output redaction.
- DSH retains sole System Prompt assembly authority. The bridge injects the user section through a public waterfall and preserves literal VCP placeholders such as `{{Nova}}` without interpreting them.
- The runtime core is headless and does not expose, proxy, iframe, or embed the DSH official Web UI.

## Prior Design Reconciliation

The user-supplied prior report is stored at `E:\workspace\projects\VCP\docs\superpowers\specs\2026-08-29-aio-dsh-local-coding-workspace-design.md`. It is an input feasibility report, not the final Design Doc for this OpenSpec change. Later user decisions and current source evidence supersede several of its assumptions.

Still applicable:

- DSH remains the sole Coding Agent Loop, System Prompt assembler, session/context/compaction owner, tool/workflow/Skill/sub-agent runtime, sandbox, and approval authority.
- AIO provides the unified native product surface, Profile selection, workspace selection, session projection, approval UI, lifecycle control, and an entry peer to LLM Chat.
- `{{Nova}}` remains literal through AIO/DSH and is interpreted only by the existing VCP backend path.
- AIO Coding navigation, DSH durable session facts, and workspace/Git effects are distinct truths joined by identifiers; AIO does not copy the full DSH log.
- Phase 1B DSH plugin/Skill management follows only after the runtime integration is stable.
- Integration uses an independent AIO Resident Sidecar plugin and public DSH composition/plugin seams, with no AIO, DSH, or VCP core rewrite by default.

Superseded by later confirmed decisions:

- Product naming is `Coding工作站`, not `Coding Workspace`.
- Phase 1 does not require an AIO Model Broker. The selected AIO Profile is the only user-facing configuration entry, while a generated DSH credential mirror may carry the real key at AIO LLM Chat's existing same-user trust level. A host model broker/secret vault remains a replaceable future provider.
- Windows x64 is the first native acceptance platform, using an embedded runtime reproducibly built from a pinned official DSH tag while upstream has no suitable published binary. WSL2 is not the default runtime architecture.
- The production ZIP embeds the verified runtime and starts offline. First-use download is deferred behind `RuntimeSource`, not shipped as the Phase 1 path.
- A lightweight Rust Supervisor owns the DSH child process tree; DSH is not launched directly by a generic JavaScript bridge or embedded into AIO's Tauri process.
- The runtime bridge uses a custom `aio-coding` DSH profile over the official `dsh-base` bundle and public patches, rather than the SDK/ACP/Web profile as the primary control plane.

The final Design Doc must state these replacements explicitly and must not repeat the prior report's WSL2, Model Broker, naming, or online-install assumptions as Phase 1 requirements.

## Candidate Decisions

### Runtime delivery

- Candidate A (confirmed): CI/build-time acquisition. The release pipeline downloads the exact official DSH wheel/runtime, verifies the pinned hash and license, runs smoke tests, and embeds the runtime in the final plugin ZIP. End-user startup is offline and deterministic.
- Candidate B: first-use acquisition. The plugin ZIP carries only the Supervisor and lock manifest; the Supervisor downloads and verifies the runtime when Coding工作站 first starts, then caches it atomically. The initial package is smaller but first use depends on network and a remote artifact remaining available.
- Candidate C: hybrid release variants. Publish a full offline ZIP and a thin online installer package from the same lock manifest. This improves distribution flexibility but doubles release and support paths in Phase 1.

Confirmed extension seam: the runtime lock and installer use a versioned `RuntimeSource` contract. Phase 1 ships only the embedded, offline source. A future thin package may add a verified remote source without changing lifecycle, activation, rollback, or UI contracts.

### Runtime provenance and platforms

- Confirmed: DSH `dsh-v0.1.2-alpha.1` implements an official Windows x64 Python SDK runtime target. Its `platforms.json`, `node24-win-x64`/`windows-2025` workflow leg, `win_amd64` wheel builder, clean-venv installation, and installed-wheel black-box tests make this a real upstream-supported build path rather than a release-note-only prototype.
- Confirmed: as of 2026-08-30, the immutable GitHub Release has zero attached assets, and official PyPI returns 404 for both `deepseek-harness-runtime-bin==0.1.2a1` and `deepseek-harness-sdk==0.1.2a1`. PyPI's latest runtime carrier is `0.1.1rc1` and publishes only Linux x64/arm64 and macOS arm64 wheels. Therefore no durable public upstream Windows artifact for alpha.1 can currently be pinned or hashed.
- Confirmed: the runtime closure includes the DSH CLI, `llm-pi-ai`, sessions, persistence, sandbox, approvals, workflows, sub-agents, profile/patch loaders, and public external-plugin support. A future official `0.1.2a1` (or compatible later) `win_amd64` wheel can be extracted at plugin build time and used without Python on the end-user machine, subject to the same managed-profile/bridge and release-shaped gates.
- Confirmed: until that exact official wheel exists, project CI builds the Windows x64 runtime from the pinned official DSH tag/commit using the upstream-declared toolchain and official build script. The resulting artifact is labeled project-built from official source, never upstream-published. Runtime lock generation checks the official package channel first and selects a matching upstream wheel when available; otherwise it records the source-build fallback and full provenance.
- Confirmed: Windows x64 remains the Phase 1 release and acceptance platform. `RuntimeSource`, platform descriptors, package layout, protocol, lifecycle state, and UI capability reporting are platform-neutral from Phase 1.
- Confirmed future direction: add upstream-provided Linux x64/arm64 and macOS arm64 runtimes as independently gated platform entries without changing the AIO UI or bridge protocol. Unsupported platforms remain explicit and fail closed until their own release gates pass.

### Supervisor implementation

- Candidate A (confirmed): Rust Supervisor using Tokio/Serde and target-specific process backends. It matches AIO's official Rust Sidecar example and host implementation, produces a small native executable, supports Windows Job Objects directly, and can add Unix process groups/signals behind the same trait for Linux/macOS.
- Candidate B: Go Supervisor. It offers straightforward static cross-compilation and process handling, but introduces a separate toolchain and local conventions not otherwise used by AIO or the DSH bridge, and still needs custom Windows Job Object bindings.
- Candidate C: TypeScript Supervisor packaged as another single executable. It shares language with the DSH bridge but duplicates a JavaScript runtime beside DSH, raises idle memory and package size, and makes the supposedly lightweight always-resident layer depend on another executable packager.
- Independent of the Supervisor choice, the in-process DSH Cordis bridge remains a TypeScript/ESM plugin compiled against public DSH package contracts. The NDJSON boundary keeps native lifecycle ownership separate from DSH service/event adaptation.

### Managed DSH Profile composition

- Candidate A (confirmed): create a plugin-owned `aio-coding` profile with `patchReload: startup`, list only the upstream `@deepseek-ai/dsh-base` bundle, and add a project patch that mounts the external bridge plus explicit deployment overrides. `dsh-base` already owns the full Agent Loop, sessions, settings/credentials, sandbox, approvals, tools, skills, compaction, workflows, and sub-agents. The bridge owns stdin/stdout readiness and app shutdown, so no SDK or Web transport is mounted.
- Candidate B: start the shipped `sdk` profile, target-disable its JSON-RPC server row, and insert the bridge. This reuses SDK process-surface behavior but couples the integration to upstream row ids and creates avoidable stdin/stdout ownership risk.
- Candidate C: start the shipped `web` profile without exposing its UI and consume its loopback Remote API. This retains an official transport but still starts the Web host/client composition, adds HTTP/origin/auth lifecycle, and contradicts the chosen headless execution boundary.
- The managed profile is generated transactionally from a versioned template under the plugin-owned DSH home. Phase 1 does not hot-reload it or let users edit its package manifest. Phase 1B may mutate its extension set only through the planned maintenance transaction and rollback path.

### Relationship to AIO's prior Capability Runtime proposal

The prior `docs/design/agent-harness-capability-runtime-proposal.md` is an AIO-wide, RP-first long-term proposal. It treats character, user identity, greetings, worldbook, Recall, variables, context assembly, model, and session tree as the primary Conversation Runtime, with coding loops as optional action providers. The current DSH integration does not implement or pre-empt that migration.

Applicable principles for this independent plugin:

- UI depends on a typed runtime facade rather than process or Cordis implementation details.
- Startup uses an activation transaction: validate runtime/profile/bridge, acquire resources, publish readiness only after settlement, and dispose everything in reverse order on failure.
- Every running domain, stream subscription, pending interaction, job, and temporary artifact has an explicit owner/lease and deterministic disposal.
- Capability negotiation is declarative and versioned; missing required capabilities fail closed with diagnostics instead of relying on load order or hidden fallbacks.
- The DSH execution domain remains replaceable behind the bridge contract, and the future AIO Capability Runtime can wrap that facade without changing DSH sessions or wire events.

Explicit exclusions for this change:

- Do not add `CapabilityRegistry`, `DependencyGraph`, or global Resource Scope machinery to AIO core.
- Do not migrate AIO LLM chat, RP sessions, ToolRegistry, context pipeline, worldbook, Recall, or user profiles.
- Do not present DSH as an action extension inside the existing LLM conversation. Coding工作站 is a peer tool with DSH-owned coding sessions.

Candidate A (recommended): implement the above principles as a plugin-local `RuntimeFacade` and native Supervisor ownership model, with an adapter-ready capability descriptor. Candidate B is to implement the AIO-wide Capability Runtime first, which greatly expands scope and upstream conflict. Candidate C is to inject DSH into LLM chat as a coding action provider, which conflicts with the confirmed session and System Prompt boundaries.

Confirmed: Phase 1 uses Candidate A. The facade is deliberately migration-ready: stable capability identifiers, versioned DTOs, explicit ownership/leases, no Vue/Pinia types in contracts, and adapters at the AIO SDK and Sidecar edges. A future AIO-wide Capability Runtime can register the facade as a provider or replace the plugin-local resolver without changing the Supervisor/bridge protocol or DSH session facts.

OpenAI Codex may be used as an additional architecture reference for protocol modeling, turn/item/event vocabulary, approval correlation, process ownership, task status, and recovery. It is not a runtime dependency or a third agent domain. No Codex Agent Loop, session store, prompt assembly, model router, or sandbox is introduced; AIO + DSH remains the complete product architecture.

### Codex-informed protocol boundary

The inspected Codex `app-server` source uses a bidirectional request/response/notification protocol with a mandatory initialization handshake, client capability negotiation, generated TypeScript and JSON Schema contracts, hierarchical thread/turn/item correlation, explicit server-request resolution, bounded queues, cursor pagination, and stable-versus-experimental API filtering. Its rollout layer keeps canonical append-only JSONL facts separate from client projections.

DSH already provides the corresponding execution facts in its own vocabulary: stable `sessionId`, strictly increasing event `seq`, `turn/start` and `turn/end`, step boundaries, assistant chunks/messages, tool call/result pairs, JSONL persistence, compaction, approval, workflow, and sub-agent events. Replacing these with Codex persistence or Thread/Turn/Item objects would duplicate and potentially weaken DSH invariants.

Patterns suitable for adoption at the AIO/DSH boundary:

- A mandatory `initialize` exchange carrying protocol version, runtime build/provenance, platform facts, and stable/experimental capability ids before session commands are accepted.
- Distinct commands, responses, notifications, and runtime-to-host interaction requests, with correlation ids and a terminal `interaction/resolved` notification that clears stale approval or user-input UI.
- A bridge envelope containing `protocolVersion`, `domainGenerationId`, monotonic connection sequence, and the available DSH-native `sessionId`, turn, step, call, job, or sub-agent identifiers.
- Authoritative start/completed facts and snapshots; streaming deltas remain disposable presentation data and cannot be the sole source for recovery.
- Bounded ingress/egress queues, explicit overload diagnostics, reconnect backoff, and snapshot-plus-cursor recovery after dropped notifications or a UI remount.
- A single checked-in contract source that produces runtime validation artifacts and Rust/TypeScript bindings; generated files are verified in CI and never hand-edited.
- Stable capabilities enabled by default and experimental capabilities requiring explicit negotiation, so a future AIO Capability Runtime can wrap the same facade without inheriting private bridge details.

Patterns explicitly rejected:

- No Codex process, crate, npm package, source vendoring, or runtime dependency.
- No replacement of DSH sessions, event logs, Agent Loop, model requests, prompt assembly, approvals, sandbox, tools, skills, workflows, or sub-agents.
- No wholesale copy of Codex App Server methods or Thread/Turn/Item persistence vocabulary into AIO.
- No claim that Codex code is incorporated merely because an architectural idea is independently implemented; any future source reuse would require a separately recorded license/provenance review and a concrete need.

Candidate A (recommended): preserve the DSH-native domain model and add a Codex-informed versioned envelope and lifecycle protocol. This keeps fidelity, minimizes upstream coupling, and creates the strongest migration boundary.

Candidate B: normalize DSH facts into a generic Thread/Turn/Item protocol. This looks closer to a future global runtime but creates a second canonical model, lossy translations, and more compatibility work.

Candidate C: forward raw DSH events through a minimal transport wrapper. This is smallest initially, but leaks upstream internals into the UI, makes approvals and recovery fragile, and leaves no stable capability contract.

Confirmed: use Candidate A. DSH session events remain canonical. The facade and transport add negotiation, correlation, lifecycle cleanup, recovery, and migration metadata without translating the durable log into another conversation model.

### Model credential delivery

AIO currently exposes complete `LlmProfile` objects, including `apiKeys`, through the public plugin SDK and persists them in `llm-service/profiles.json`. It does not currently provide a general host-side secret vault or a Sidecar model-request broker. Therefore Phase 1 can reuse AIO's selected Profile as the only user-facing configuration source, but cannot delegate model calls back through AIO without an AIO core extension.

DSH's official credential seam resolves named references per operation and its official local provider hot-reloads a versioned `.credentials.yaml` using atomic writes. The upstream documentation explicitly states that this file protects against other OS users, not same-user Agent tool processes; DSH's workspace-write sandbox limits mutations rather than reads. Passing keys through process environment is no stronger and risks inheritance by tool subprocesses.

Candidate A (recommended for Phase 1): maintain a plugin-owned, generated DSH credential mirror under the managed DSH home. The AIO plugin selects one effective Profile/key, writes only the required named reference through an atomic Supervisor transaction, applies owner-only ACLs where the platform supports them, never includes the value in protocol responses or logs, and removes stale references on profile change or unlink. DSH continues using its official per-operation credential seam and hot reload. This adds a duplicate on disk but stays within AIO's existing local trust level and avoids AIO/DSH core changes.

Candidate B: pass the key only in the DSH process environment. It avoids a second file but makes rotation restart-bound and may expose the key to inherited tool subprocesses, diagnostics, or environment inspection. It is not recommended.

Candidate C: add an AIO host model-request broker or system secret-vault provider so DSH never receives a durable raw key. This is the strongest future boundary, but requires new AIO core APIs, streaming/cancellation/tool-call compatibility, key rotation semantics, and cross-platform secret storage. Reserve it behind the model transport/credential provider interface; do not make it a Phase 1 dependency.

Regardless of the candidate, the bridge uses opaque Profile and credential-reference identifiers in ordinary events. Diagnostic redaction covers known secret values plus authorization headers, URL query credentials, DSH credential records, environment dumps, child stdout/stderr, crash reports, and support bundles. A security boundary stronger than AIO LLM chat's current same-user trust is explicitly out of Phase 1 scope.

Confirmed: use Candidate A in Phase 1 and keep Candidate C behind replaceable model-transport and credential-provider interfaces. The generated mirror is an implementation detail of the provider; no UI or session contract exposes its path or format.

### Domain crash and task recovery

AIO's Resident Sidecar API already assigns a new `generationId` per spawn, rejects late output from older generations, reruns the startup method after timeout recovery, and models long operations as jobs with explicit terminal events. DSH persistence can reload a session with continuous sequence numbers and crash-repair an open turn as `interrupted`; it deliberately does not prove that an unfinished model/tool action is safe to replay.

Candidate A (recommended): automatically restore runtime readiness, never automatically replay an active task. If the DSH child exits, the Supervisor terminates every job and interaction owned by that domain generation, emits one structured interrupted/failed terminal fact, starts a fresh domain subject to bounded exponential backoff and a crash-loop circuit breaker, and reconciles session snapshots from DSH persistence. The prior session remains available; the user explicitly continues it in a new turn. Idle sessions are resumed lazily. A Supervisor-process replacement follows the same generation and snapshot reconciliation rules through AIO's existing Sidecar recovery.

Candidate B: automatically resume and resubmit the unfinished user turn after restart. This feels seamless but can duplicate file writes, shell commands, network calls, approvals, sub-agent work, or model billing because no general exactly-once boundary exists across those effects.

Candidate C: mark the runtime unavailable after any unexpected exit and require a manual restart. This is easiest to reason about but makes prewarm and ordinary transient recovery unnecessarily brittle.

All candidates preserve the durable DSH session log as canonical. Partial stream deltas are discarded on generation loss; persisted completed messages, tool results, and repaired interruption facts survive. No pending approval or user-input request survives its owning generation, and the UI clears each one through terminal interaction resolution.

Confirmed: use Candidate A. Runtime readiness may recover automatically; task execution never does. A user continuation creates a new DSH turn over the repaired session instead of replaying an uncertain operation.

### Pi-informed ownership and projection

The inspected `earendil-works/pi` source at commit `853a80d26c90a14c1886f0ebb8ffaae133ca2185` is MIT-licensed. Its current architecture separates a runtime-neutral protocol, transport-neutral client, experimental server, session backends, Agent core, and coding UI. DSH already depends on Pi's model-provider layer through `@earendil-works/pi-ai`, but remains the owning execution domain for this integration.

Pi patterns suitable for adoption:

- Separate lightweight durable `SessionMetadata` used for lists from acquired live session snapshots. Coding工作站 can list many DSH sessions without eagerly constructing Agent runtimes.
- Return an explicit disposable session lease from `RuntimeFacade.acquireSession()`. A lease owns subscriptions and command authority; releasing the last lease detaches UI projection without deleting the durable DSH session.
- Treat snapshots and successful command-result snapshots as authoritative. Streaming progress and deltas update presentation only and are discarded/reconciled from a fresh snapshot after reconnect.
- Reject commands immediately after lease release starts, invalidate all generation-owned leases after disconnect or domain replacement, and require explicit reacquisition.
- Keep operation start and terminal facts correlated. A generation/fence token prevents an older process, writer, callback, or delayed completion from mutating current projected state.
- Make transport authentication/trust establish before business protocol messages. For the local AIO Sidecar boundary this maps to host startup validation and generation ownership, not a new network login.
- Resolve credentials per model operation through a provider seam rather than caching a secret in session state, matching the chosen hot-updatable DSH credential mirror.

Pi patterns explicitly rejected or deferred:

- Do not use Pi's experimental length-prefixed CBOR protocol; AIO Resident Sidecar v3 requires JSONL, and the inner Supervisor/DSH link benefits from the same diagnosable framing.
- Do not transplant Pi Agent, coding-agent, session tree, branch summaries, compaction, extension/Skill system, model registry, or TUI. DSH owns the equivalents selected for Coding工作站.
- Do not adopt Pi's permission posture. Pi states it has no built-in permission system; DSH sandbox, approval, project trust, and tool policy remain mandatory.
- Do not replace DSH JSONL persistence with Pi SQLite lanes, global facts, or writer leases. Borrow only the ownership/fencing invariant at the bridge and facade boundary unless DSH later exposes a supported multi-writer store.
- Do not copy Pi source in Phase 1. Architectural ideas are independently expressed in AIO/DSH contracts; any future code reuse requires an explicit file-level need, retained MIT notice, provenance record, and compatibility review.

Candidate A (recommended): one exclusive controller lease per live DSH session plus any number of read-only projection subscriptions. The active Coding工作站 view owns mutations; secondary windows/components may observe snapshots but must acquire control before prompt, steer, abort, approve, change model, or alter session runtime settings. Control is fenced by domain generation and lease id.

Candidate B: allow multiple mutable controllers and serialize commands at the bridge. This supports collaborative control but makes prompt ordering, approval ownership, abort, and model changes ambiguous, with no current product requirement.

Candidate C: hold one exclusive lease for the entire DSH domain. This is simple but prevents independent idle session browsing/attachment and is too coarse for future Capability Runtime migration.

Confirmed: use Candidate A. A controller lease and observer subscriptions are separate resources. Controller transfer is explicit, fenced, and visible; it never silently steals authority from an active window.

### Workspace, sandbox, and approval defaults

The official DSH base profile defaults new sessions to the `workspace-write` permission preset: workspace and private temporary-directory mutations are allowed, wider file mutations require an `ask` approval, reads and network are not generally confined, and `danger-full-access` disables file restrictions and approval prompts. DSH includes a Windows restricted-token/ACL backend and corresponding Linux/macOS backends behind its sandbox seam.

Candidate A (recommended): preserve the official `workspace-write + ask` default. AIO opens its existing native directory picker and passes the selected absolute path as the requested workspace. The DSH sandbox is authoritative for canonicalization, write confinement, escalation validity, approval creation, and final policy. AIO renders the current DSH permission preset and approval requests but does not infer, weaken, or duplicate policy. `read-only` and `danger-full-access` remain explicit per-session choices; full access requires a deliberate user action and is never remembered as the default merely because it was used once.

Candidate B: default every session to `read-only + ask`. This is safer for inspection but adds approval friction to ordinary coding and diverges from upstream's tested default.

Candidate C: inherit an unrestricted AIO tool permission into DSH or default to `danger-full-access`. This makes first use frictionless but collapses the selected execution-domain safety boundary and bypasses DSH's mature denial/escalation flow.

The workspace binding is stored as a session fact by DSH, while AIO keeps only a recent-workspace convenience list. On resume, missing, moved, non-directory, or unsupported paths fail closed with a reselect action. Junctions, symlinks, UNC paths, case normalization, and ancestor traversal are judged by the DSH platform sandbox; the facade forwards only normalized display and diagnostic facts. Changing the workspace or permission preset while a task is active is rejected; an idle change appends the official DSH session event and takes effect through DSH's own policy seam.

Confirmed: use Candidate A. The official DSH preset names and semantics remain intact. The AIO surface may localize labels and warnings but cannot invent a more permissive interpretation.

### AIO model Profile compatibility

AIO `LlmProfile` is broader than DSH's model route contract. It can describe multiple keys, custom endpoints and headers, network/TLS behavior, provider-specific options, aggregate routing, media endpoints, and model-specific request rules. DSH `llm-pi-ai` supports its installed Pi provider catalog plus explicitly declared text-model routes with modeled wire API, base URL, headers, credential reference, model capacity, modalities, compatibility switches, and reasoning-effort mapping. Some AIO fields therefore cannot be forwarded safely or losslessly.

Candidate A (recommended): a capability-driven `AioProfileAdapter` validates each selected Profile/model and emits either a complete DSH route descriptor or a structured incompatibility reason. Phase 1 release gates require VCP/OpenAI-compatible Chat Completions and the exact literal System Prompt placeholder path. Additional native text protocols such as OpenAI Responses, Anthropic Messages, Gemini GenerateContent, and catalog-backed DeepSeek may be enabled only when field-by-field mappings and black-box streaming/tool-call tests pass. Unsupported, aggregate, media-only, ambiguous, relaxed-TLS, or unmodeled provider options remain visible but disabled for Coding工作站 with a reason; there is no best-effort fallback to another wire protocol.

Candidate B: claim support for every enabled AIO text Profile and map unknown fields heuristically. This maximizes the picker list but can silently change authentication, endpoint paths, reasoning syntax, tool calls, or VCP placeholder handling.

Candidate C: route every DSH model operation through a new AIO model broker. This provides exact parity with AIO adapters and hides credentials from DSH, but it is the already reserved future model-transport provider and requires AIO core streaming/cancellation/tool-call APIs.

The selected AIO Profile id and model id are public references; the DSH route descriptor is generated plugin state. Ordinary DSH session events persist effective provider/model identity and request facts, never the AIO secret. Key rotation updates the credential provider per operation. Endpoint, protocol, model, custom-header, or reasoning-map changes are staged and applied only while the session is idle; a running task keeps its start-of-turn route snapshot. Removing or disabling the selected Profile makes the next turn fail closed with a reselect action and does not rewrite prior session history.

Confirmed: use Candidate A. Phase 1 must pass release gates for VCP/OpenAI-compatible Chat Completions and preserve the literal `{{Nova}}` placeholder through the AIO-to-DSH prompt path. Every additional protocol is disabled until its complete mapping and black-box streaming/tool-call behavior are verified. There is no heuristic protocol fallback or silent field dropping.

### Upstream extension-point audit

- DSH: the official architecture makes Cordis plugins, ordered profiles, profile patches, and reversible plugin effects the supported extension path. The `aio-coding` bridge is therefore loaded as an external ESM plugin through a managed profile patch; DSH core, Agent Loop, persistence, sandbox, approvals, and prompt assembly remain unmodified.
- AIO: the independent ZIP plugin, Resident Sidecar v3, startup host-context validation, plugin settings schema/config migration, tool registration, and existing tool-shell patterns are the initial public seams. Phase 1 runtime-core adds no AIO-wide Capability Registry and does not modify AIO core unless a later, separately reviewed Coding工作站 UI contribution gap proves unavoidable.
- VCP: the existing request path already resolves agent variables through `chatCompletionHandler -> messageProcessor.replaceAgentVariables -> AgentManager`. The integration preserves `{{Nova}}` literally until that verified VCP path receives the request; neither AIO nor the DSH bridge introduces a competing placeholder resolver.
- Compatibility rule: every dependency on an upstream seam is pinned, capability-negotiated where possible, covered by a release-shaped compatibility test, and fails closed with a structured diagnostic when incompatible. Private internals are not treated as stable contracts.

Necessary compatibility changes are permitted on either AIO or DSH, but only behind a compatibility-patch gate. A patch requires a reproducible failing acceptance case showing that configuration, a public API, plugin/adapter/wrapper composition, and project-side compatibility code cannot satisfy the requirement. The selected change must be additive or behavior-preserving by default, avoid removing or renaming public interfaces, remain isolated in a small auditable commit/module, carry capability detection and regression tests, and document its upstream version range and removal condition. Prefer an upstreamable contribution; keep a project-side patch only until an equivalent upstream seam exists. Any change that would alter unrelated AIO LLM/RP behavior or DSH defaults returns to design review rather than being treated as routine compatibility work.

### Future AIO Capability Runtime reconciliation

The current AIO proposal `docs/design/agent-harness-capability-runtime-proposal.md` is explicitly a non-implementation, RP-first direction. Its default `ConversationRuntime` owns AIO's character/user identity, greetings, worldbook, Recall, variables, context assembly, model request, and non-destructive session tree. It positions coding/tool loops as optional behavior modules inside that conversation model. That ownership model must not be silently reinterpreted by this integration.

Phase 1 therefore does not register DSH as AIO's default `conversation-runtime:default`, does not inject DSH as an ordinary action loop into LLM对话, and does not translate DSH sessions into AIO's RP session tree. Coding工作站 is a peer surface backed by a separate complete execution domain whose Agent Loop, context, compaction, tools, persistence, approvals, workflows, and sub-agents remain DSH-owned.

The plugin-local `RuntimeFacade` is nevertheless migration-ready because its boundary follows the proposal's durable ideas: UI depends on a facade rather than a container, acquisitions return disposable/fenced leases, capabilities and dependencies are explicit, activation is transactional, provider loss is diagnosable, and every subscription/background resource belongs to a scope. Its Phase 1 identity is conceptually `execution-domain:dsh`, not `conversation-runtime:default` or `action:optional`.

If AIO later implements a global Capability Runtime, a thin adapter may publish the existing facade under a versioned external-execution-domain capability and declare dependencies on AIO's model-profile source, directory picker, settings, and UI contribution services. The adapter replaces plugin-local discovery/activation only; it does not change the Supervisor protocol, DSH bridge, session identifiers, ownership tables, snapshots, or Coding工作站 UI contract. AIO's RP runtime remains free to expose a separately designed handoff or invocation link later, but cross-runtime history/context merging is not part of Phase 1.

This separation is also the compatibility safeguard: failure, disablement, upgrade, or removal of the DSH plugin cannot change LLM对话 defaults, AIO session persistence, RP context assembly, existing plugin activation, or ToolRegistry behavior. No AIO core Capability Registry is introduced merely to host one integration.

### Coding工作站 UI contribution audit

AIO's current public plugin UI path is sufficient for the later peer tool surface. A Sidecar plugin may declare `manifest.ui.component`; `plugin-manager.registerPluginUi()` converts it into an ordinary `ToolConfig`, adds it to the shared `toolsStore`, and the dynamic router and sidebar consume it exactly like built-in tools. The documented contract also provides detached-window support. The production component is a prebuilt ESM Vue component and can import public `aiohub-sdk`/`aiohub-ui` capabilities through the host import map.

Therefore the later `add-dsh-coding-workstation` change can name the tool `Coding工作站`, contribute a native AIO Vue surface from the independent ZIP, use the same tool routing/window model as LLM对话, and call the plugin Sidecar through the public SDK. It does not need a source file under AIO `src/tools`, a static router entry, a change to `DEFAULT_TOOLS_ORDER`, an iframe, or the DSH Web UI. Existing user tool ordering determines placement; the plugin may appear in the existing plugin-tool category without losing peer routing semantics.

The current `integrate-dsh-runtime-core` change remains deliberately headless: it delivers the manifest/backend method surface, Supervisor, bridge, generated contracts, settings model, and `RuntimeFacade` tests, but no final Coding工作站 screen. This prevents UI iteration from weakening runtime acceptance and lets the later UI change consume a tested facade. If a later UX requirement demands a navigation behavior not exposed by `manifest.ui`, that gap must be proposed as a separate minimal additive AIO contribution API rather than patched into runtime-core.

### Protocol contract source

The repository audit found that AIO's Rust/Tauri boundary already uses `serde` and `serde_json` pervasively and its resolved Rust dependency graph contains the `schemars` ecosystem. DSH uses TypeScript-native schema and code-generation patterns, including Zod/JSON Schema projections and freshness verification for generated artifacts. This makes a generated cross-language contract consistent with both upstream toolchains without modifying either upstream core.

Candidate A (recommended): a small independent Rust protocol crate owns the Serde wire enums and records. It derives JSON Schema and generates read-only TypeScript declarations consumed by the DSH bridge; the TypeScript side validates untrusted JSONL at runtime against the generated schema. CI regenerates both artifacts, fails on a dirty diff, validates golden fixtures in Rust and TypeScript, and checks a deterministic contract hash during initialization. The Supervisor gets exhaustive compile-time handling, while the generated schema and TypeScript types form the migration boundary for a future AIO Capability Runtime.

Candidate B: author language-neutral JSON Schema and generate both Rust and TypeScript. This has the cleanest nominal language neutrality, but generated Rust enums and error types are less ergonomic, schema-to-code behavior adds another compatibility surface, and protocol invariants often escape into handwritten code.

Candidate C: author TypeScript runtime schemas and generate or mirror Rust types. This matches the bridge implementation, but weakens the Supervisor's owning process boundary and makes Rust drift detection depend on a less mature reverse-generation path.

All candidates keep the wire format JSONL, use explicit tagged messages, reject malformed or unnegotiated commands before domain dispatch, and version semantic compatibility independently from the plugin package version.

Confirmed: use Candidate A. The Rust protocol crate is the only hand-edited wire-contract source. JSON Schema, TypeScript declarations, contract fixtures, and their hashes are generated artifacts; CI rejects stale generation or cross-language validation disagreement.

### Prewarm and configuration snapshots

The AIO source confirms that enabling any Resident Sidecar immediately spawns its declared executable, and every replacement process reruns `startupMethod`. The startup call receives host protocol context but does not automatically receive live plugin settings. Therefore a truly zero-process enabled plugin would require an AIO host lifecycle change, while a lightweight always-resident Supervisor with a separately disposable DSH child fits the existing public contract.

DSH's documented lifecycle writes `turn/start`, claims input, runs `agent/pre-step`, and assembles the System Prompt before every model step. A mutable prompt or model route read directly during assembly could therefore change between steps of one Turn. The integration must capture one immutable execution configuration at the Turn boundary and serve it throughout every step, retry, tool continuation, and compaction operation owned by that Turn.

Candidate A (recommended): when the plugin is enabled, AIO starts only the small Rust Supervisor. DSH remains cold by default and starts on the first `ensureDomainReady`/session acquisition. The AIO plugin setting is the source of truth for optional prewarm; after ordinary plugin initialization it sends a versioned non-secret runtime configuration and, when enabled, asks the Supervisor to create a ready but taskless DSH domain. The Supervisor stores only a derived non-secret prewarm/runtime descriptor under plugin data so AIO's automatic Supervisor recovery can re-establish readiness after `startupMethod`; the plugin reconciles that mirror whenever settings load or change. No session, Turn, approval, or model request is created by prewarm.

Candidate B: make the DSH executable itself the AIO Resident Sidecar and always start it with the plugin. This uses fewer processes but makes daily AIO startup heavy, couples AIO lifecycle to DSH boot details, and weakens the replaceable-runtime boundary.

Candidate C: keep the entire plugin disabled until Coding工作站 opens. This achieves zero background process cost but requires host/UI code to mutate plugin enablement as navigation state, conflates installation policy with runtime demand, and makes recovery/event subscription brittle.

For Candidate A, a Turn-start transaction validates the selected AIO Profile/model, refreshes the credential reference, captures the route descriptor, user System Prompt contribution, literal-placeholder codec state, workspace, and DSH permission preset, then opens the DSH Turn. All steps in that Turn use the same snapshot. Settings edits made while running are staged and become eligible only for the next Turn; credential value rotation may update the per-operation provider but never changes the public route identity. If snapshot creation fails, no `turn/start` is dispatched. DSH remains the only System Prompt assembler and VCP remains the only `{{Nova}}` resolver.

Confirmed: use the Turn-start snapshot boundary. System Prompt, route identity and parameters, workspace, and permission preset remain immutable across every step, retry, tool continuation, sub-operation, and compaction owned by one Turn. Changes made while active are staged for the next Turn in the same durable DSH session; no new session or whole-domain restart is required. A credential value may rotate through the per-operation credential provider without changing the captured public route identity.

Three idle policies remain viable after the last controller lease and active job disappear:

- Grace-period disposal (recommended): keep the DSH domain warm briefly for view switching, then terminate the entire DSH process tree. Optional prewarm disables idle disposal for the app lifetime.
- Immediate disposal: minimizes idle memory but repeatedly pays Loader/session-reacquisition cost during ordinary navigation.
- App-lifetime retention: simplest and fastest after first use, but default on-demand mode no longer meaningfully reduces daily resource use.

Idle eligibility is an authoritative runtime condition, not a UI visibility heuristic. The grace timer may start only when there is no controller lease, command, active root or sub-agent Turn, queued continuation, job, tool execution, approval/user-question interaction, compaction, workflow, schedule dispatch, or pending persistence flush. Read-only observers do not keep the DSH domain alive; a new acquisition or runtime command atomically cancels the timer. A root `agent/status: idle` signal alone is insufficient because DSH continuable children and separately owned work may still exist.

Graceful disposal first rejects new mutable acquisitions, resolves or cancels generation-owned interactions, requests Agent quiescence, flushes every dirty DSH Session, and awaits recursive Cordis `fiber.dispose()` cleanup. The Supervisor then closes the child protocol and waits for process exit. A bounded timeout escalates to generation invalidation and whole-process-tree termination; the Windows implementation uses its Job Object, while future Unix implementations use the reserved process-group backend. Durable sessions remain cold-resumable after disposal. AIO application exit and plugin disable use the same sequence with a shorter bounded grace, then rely on the host's final Sidecar kill as the outer safety net.

Confirmed: use grace-period disposal. After authoritative quiescence and release of the last controller lease, the DSH domain remains warm for 10 minutes and is then disposed through the graceful/forced sequence. Any new acquisition or work cancels the timer atomically. Enabling prewarm retains the ready DSH domain for the AIO application lifetime; disabling prewarm returns it to the normal grace-period policy once it becomes eligible.

### Cross-platform first release scope

The `dsh-v0.1.2-alpha.1` source and native CI define four SDK runtime targets: `win-x64`, `linux-x64`, `linux-arm64`, and `macos-arm64`. AIO's Plugin API already has matching `win32-x64`, `linux-x64`, `linux-arm64`, and `darwin-arm64` platform keys, resolves a Resident Sidecar executable by the current key, validates that the selected binary exists in the archive, and models marketplace downloads per platform. AIO's own desktop release matrix currently publishes Windows x64, Linux x64, macOS arm64, and macOS x64; it does not publish Linux arm64. DSH has no macOS x64 SDK runtime.

Candidate A (recommended): ship three fully supported Phase 1 host targets and one preview artifact from the same source and protocol:

- `win32-x64`: supported on the documented AIO Windows baseline.
- `linux-x64`: supported on glibc 2.28 or newer for AIO's `.deb` and `.AppImage` installations after the Linux execution tests pass. AIO also officially builds and publishes `.flatpak`, but the DSH execution domain remains preview/unavailable there until its nested filesystem, executable, shell, document-portal, and sandbox interactions pass a separate Flatpak acceptance suite; this is a DSH-plugin compatibility gate, not a claim that AIO lacks Flatpak support.
- `darwin-arm64`: supported on macOS 14 or newer, matching DSH's wheel tag and native helper. AIO may run on older macOS, so runtime readiness must diagnose the stricter plugin requirement before launch.
- `linux-arm64`: build and publish a preview plugin artifact, but do not call it generally supported until an AIO Linux arm64 host build and the full platform-native integration suite are available. It may be tested against a source-built/custom AIO host in the meantime.
- `darwin-x64`, `win32-arm64`, and every other target fail explicitly as unsupported. Running the arm64 DSH binary behind an x64 AIO/Rosetta identity is not a supported workaround.

Candidate B: call all four DSH runtime targets equally supported in Phase 1. This overstates the product because AIO has no official Linux arm64 desktop artifact and therefore no ordinary install path on which to prove plugin lifecycle, UI, upgrade, or cleanup. It also encourages family-level wording that hides the unsupported macOS x64 case.

Candidate C: retain Windows x64 as the sole Phase 1 target and only reserve the other descriptors. This has the smallest matrix but no longer takes advantage of DSH's already implemented POSIX runtimes or AIO's existing per-platform plugin distribution model.

Production distribution uses one ZIP per platform, all with the same plugin identity, semantic version, protocol contract hash, and managed profile version. Each ZIP contains only its Supervisor, matching DSH executable, required `-rg` sidecar, and the macOS `-spawn-helper` where applicable. AIO's market index already supports per-platform download URLs, so a universal archive containing every roughly 50-60 MB compressed runtime is unnecessary. Runtime locks and SBOM/provenance records remain platform-specific.

The audit found one necessary minimal AIO compatibility patch for POSIX Sidecars: the current ZIP installer creates extracted files but does not restore ZIP Unix modes or otherwise mark the manifest-selected executable as executable. A Sidecar cannot repair its own execute bit before it starts. The host patch should preserve safe regular-file mode bits or, more narrowly, set the validated current-platform Native/Sidecar binary executable after extraction; it must retain path validation, reject symlinks/special files, leave Windows behavior unchanged, and add Linux/macOS archive-install-and-launch tests. This is an additive default-preserving upstreamable fix for every POSIX plugin, not DSH-specific activation logic.

The Supervisor keeps one shared state machine and protocol but uses platform backends: Windows Job Object and owner DACL handling; Linux/macOS process groups plus bounded TERM/KILL escalation and `0700`/`0600` private data modes. Every native lane must prove descendant cleanup, executable/helper modes, non-ASCII and long paths, no visible console/terminal leakage, credential redaction, graceful persistence flush, crash fencing, and cold resume. DSH's own sandbox provider remains authoritative: Linux selects bwrap then Landlock, macOS uses Seatbelt, and Windows uses the ACL restricted-token backend; unavailable confinement fails closed. The integration surfaces DSH's `full` versus `partial` enforcement fact and repeats upstream's warning that the sandbox/approval system is not a security boundary or audited isolation guarantee.

Candidate A expands Phase 1A runtime-core packaging and native CI but does not pull the Coding工作站 UI, plugin/Skill market, RAG, Knowledge, or AIO global Capability Runtime into this change. The supported-platform claim is gated per target: one platform can remain preview or unavailable without weakening or delaying already passing targets, while protocol and profile compatibility must stay identical across all artifacts.

Confirmed: use Candidate A. Phase 1 targets supported Windows x64, Linux x64 `.deb`/`.AppImage`, and macOS arm64 execution domains; it includes a Flatpak compatibility lane whose support claim requires the dedicated acceptance suite, and publishes Linux arm64 as preview until an ordinary AIO Linux arm64 host release and the full native integration suite exist. The POSIX executable-mode host fix is an approved necessary compatibility change subject to the minimal upstreamable patch rules above.

## Trade-offs and Risks

- Bundling increases the plugin archive size, but removes first-run network, proxy, artifact-retention, and partial-download failure modes.
- First-use download reduces initial package size, but adds runtime network permissions and makes an otherwise local execution feature unavailable offline on first use.
- A hybrid approach is technically feasible but conflicts with the Phase 1 preference for one deterministic support path.
- The official `dsh-v0.1.2-alpha.1` prerelease/tag exists at commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`. Its source and CI define a Windows `win_amd64` runtime wheel, but the GitHub Release currently has no attached assets and official PyPI has no `0.1.2a1` SDK/runtime release. Existing `deepseek-harness-runtime-bin` releases stop at `0.1.1rc1` and contain no Windows wheel. A Phase 1 binary therefore cannot honestly be described as the alpha.1 upstream-published artifact unless publication changes before the runtime lock is cut.
- Building from the official tag with upstream's pinned toolchain and `build-exe-for-python-sdk.ts` preserves source and build-path provenance, but the resulting binary is project-built rather than upstream-published. It requires a reproducible build record, SBOM/license bundle, source commit, toolchain versions, output hashes, and black-box release gates.
- The packaged runtime publicly supports profile patches and external file plugin rows. The bridge can be built as a real ESM artifact under the managed profile and loaded by a relative row; DSH's packaged module fallback proxies allow its external imports to share the runtime's bundled Cordis and public package instances. Runtime execution then needs no system pnpm. `dsh plugin` remains a Phase 1B maintenance path, not the Phase 1 boot path.

## Test Strategy

Testing is layered so a narrow unit check cannot stand in for an execution-domain guarantee:

1. Contract generation and codec tests: regenerate Rust/JSON Schema/TypeScript artifacts and fail on a dirty diff; validate every golden command/event fixture in both languages; fuzz malformed frames, unknown tags, size limits, sequence gaps, incompatible versions, and literal-placeholder round trips including repeated, adjacent, Unicode, nested-looking, and malformed brace text.
2. Supervisor state-machine tests: model every legal state transition, concurrent idempotent start/stop, generation fencing, controller transfer, queue limits, timer cancellation, crash-loop opening/reset, and stale completion rejection with deterministic clocks and fake processes.
3. Windows process integration: run the packaged Supervisor and a fixture child tree under a Job Object; prove graceful flush/disposal ordering, forced timeout escalation, descendant cleanup, AIO disable/exit cleanup, no visible console, path handling, long paths, non-ASCII workspaces, and owner ACL behavior on an ordinary non-admin account.
4. Release-shaped DSH bridge tests: boot the exact embedded project-built executable with the managed `aio-coding` profile and external ESM bridge; prove Loader settlement, one shared Cordis identity, initialize/capability handshake, session create/cold resume, authoritative snapshot, ordered events, cancellation, approval, user question, workflow, compaction, and continuable sub-agent projection without DSH Web UI or a system Node/pnpm dependency.
5. Turn snapshot/model adapter tests: a local capture server implements verified VCP/OpenAI-compatible streaming and tool-call cases. Mutate Prompt, endpoint, headers, reasoning settings, workspace, permission preset, and key during an active multi-step Turn; prove public route/prompt/policy remain fixed for that Turn, key rotation follows the documented per-operation rule, the next Turn adopts staged configuration, and `{{Nova}}` reaches the VCP-compatible request byte-for-byte.
6. Recovery and exactly-once-boundary tests: kill DSH during model streaming, an approved filesystem write, a shell command, an unanswered approval, and sub-agent work. Prove generation-owned requests terminate, transient deltas/interactions clear, persisted facts reconcile, an open Turn becomes interrupted, no user prompt or side effect is automatically replayed, and explicit continuation opens a new Turn.
7. Security and redaction tests: seed unique canary secrets in Profile keys, custom headers, URLs, credential documents, and environment variables; scan stdout/stderr, structured logs, Sidecar events, snapshots, crash reports, support bundles, session exports, and error paths. Verify atomic credential replacement, stale-reference removal, restricted ACLs, and zero secret material in ordinary protocol fixtures.
8. Packaging and provenance gates: reproduce the runtime from the pinned official source/tag and toolchain, record SBOM/licenses/source commit/build recipe/hash, verify the hash before packaging and before every launch, and exercise clean offline install, tamper rejection, staged upgrade, compatibility failure, atomic rollback, uninstall, retained user data, and explicit credential/data clearing.
9. AIO compatibility gates: install the production ZIP and use the development junction against the pinned AIO `dev` baseline; verify Plugin API v3 startup context, settings migrations, enable/disable/recovery, and Coding工作站 facade access without modifying AIO core. A source-diff allowlist fails CI if an unexpected patch appears under either AIO or DSH upstream trees.
10. Future-platform contract gates: lint Linux/macOS runtime descriptors, path/process backend interfaces, and artifact slots on every build, while making no runtime-support claim until platform-native sandbox, process-tree, packaging, and black-box suites pass on those operating systems.

## Spec Patch

- Correct the proposal, high-level design, lifecycle spec, and supply-chain tasks that currently assume an alpha.1 upstream-published Windows executable or wheel is already downloadable. Runtime lock generation first looks for an exact compatible official `win_amd64` wheel; while it remains absent, Phase 1 embeds a reproducible project build from pinned official tag `dsh-v0.1.2-alpha.1`/commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`, labels it accurately, and ships build provenance, hashes, SBOM, licenses, and release-shaped black-box evidence. Prefer a later official wheel only when it passes the same gates.
- Make the production ZIP fully offline and deterministic. Remove end-user first-use download/extraction from Phase 1 tasks; retain a `RuntimeSource` provider contract only as an unexposed future thin-package replacement seam.
- Add a platform-neutral runtime descriptor and future Linux x64/arm64 and macOS arm64 source slots while retaining Windows x64 as the only Phase 1 release and acceptance target.
- Expand the lifecycle spec with the lightweight-Supervisor/heavy-domain split, persisted non-secret prewarm mirror, authoritative idle eligibility, bounded graceful flush/Cordis disposal, process-tree escalation, crash-loop circuit breaker, and the rule that runtime readiness may recover automatically but an uncertain active task is never replayed automatically.
- Expand the bridge spec with the Rust-owned generated protocol contract, initialize/capability handshake, domain generation and sequence fences, one exclusive controller lease plus read-only observers, explicit controller transfer, bounded queues/backpressure, terminal `interaction/resolved`, snapshot authority, and disposable delta semantics.
- Correct model compatibility acceptance so Phase 1 requires only verified VCP/OpenAI-compatible Chat Completions. Other native text protocols are enabled individually only after complete field mappings and streaming/tool-call black-box tests; unsupported fields fail closed without heuristic fallback.
- Replace the current Profile/Prompt requirement that forces a new session or entire-domain restart. A Turn-start transaction captures an immutable route, prompt contribution, workspace, and permission snapshot; edits while active are staged for the next Turn, while credential value rotation remains per-operation. Existing durable history is not rewritten.
- Specify the atomic plugin-owned credential mirror, owner-only ACL where supported, reference-only diagnostics, stale-reference cleanup, and the reserved replaceable future model-broker/secret-provider interfaces.
- Clarify that VCP's existing `chatCompletionHandler -> messageProcessor.replaceAgentVariables -> AgentManager` path is the only `{{Nova}}` resolver; AIO and DSH only preserve the literal text.
- Update tasks and verification coverage for cross-language generated-contract freshness, lease fencing, interaction cleanup, Turn snapshot consistency, idle-disposal races, no-auto-replay recovery, packaged external Cordis plugin loading, and upstream compatibility gates.

## Pending Question

- None. The whole design and the subsequent Candidate A cross-platform scope expansion are approved. Proceed to the Comet Design Doc checkpoint, Spec Patch, and design guard after the required pre-Design-Doc context compaction.
