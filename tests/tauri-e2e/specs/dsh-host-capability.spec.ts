import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { invokeTauriCommand } from "../support/tauri-command";

const releaseZip = process.env.AIO_E2E_DSH_PLUGIN_ZIP?.trim();
const releaseDescribe = releaseZip ? describe : describe.skip;

type InstalledPlugin = {
  pluginId: string;
  installPath: string;
};

type DurableFact = {
  kind?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
};

type ResidentResponse = {
  id: number;
  type: "result" | "error";
  data: {
    state?: string;
    domainGenerationId?: string;
    code?: string;
    lease?: { leaseId?: string; mode?: string };
    accepted?: boolean;
    rejection?: { code?: string };
    snapshot?: {
      cursor?: string;
      seq?: number;
      contractHash?: string;
      sessionId?: string;
      durableFacts?: DurableFact[];
    };
    // Pending host interactions surface as notification frames aggregated by
    // the supervisor into a sibling of `snapshot` — the snapshot DTO itself
    // never carries them. Absent when the session has no pending interaction.
    interactions?: Array<Record<string, unknown>>;
    interactionResolved?: Record<string, unknown>;
  };
};

const MARKER = "DSH HOST CAPABILITY E2E OK";
const SESSION_ID = "host-capability-session";

async function startMockProvider(): Promise<{
  server: Server;
  baseUrl: string;
  requests: Record<string, unknown>[];
}> {
  const requests: Record<string, unknown>[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
    });
    request.on("end", () => {
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
      });
      response.write(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: MARKER }, finish_reason: null }] })}\n\n`
      );
      response.write(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 5 } })}\n\n`
      );
      response.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
  };
}

function pluginDataDir(pluginId: string): string {
  const dataDir = process.env.AIO_DATA_DIR?.trim();
  if (!dataDir) {
    throw new Error("AIO_DATA_DIR is required to locate the plugin data root.");
  }
  return path.join(dataDir, "plugins-data", pluginId);
}

function assertResidentProcessTreeIsGone(): void {
  if (process.platform !== "win32") return;
  for (const imageName of [
    "aio-dsh-supervisor.exe",
    "deepseek-harness-sdk-runtime-win-x64.exe",
  ]) {
    const output = execFileSync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${imageName}`, "/FO", "CSV", "/NH"],
      { encoding: "utf8", windowsHide: true }
    );
    if (output.trimStart().startsWith('"')) {
      throw new Error(
        `resident process tree still contains ${imageName}: ${output}`
      );
    }
  }
}

async function sendResident(
  pluginId: string,
  method: string,
  params: Record<string, unknown>
): Promise<ResidentResponse> {
  return JSON.parse(
    await invokeTauriCommand<string>("sidecar_send_command", {
      pluginId,
      method,
      params,
    })
  ) as ResidentResponse;
}

function supervisorPath(pluginRoot: string): string {
  return path.join(pluginRoot, "bin", "win32-x64", "aio-dsh-supervisor.exe");
}

async function spawnResident(
  pluginId: string,
  pluginRoot: string
): Promise<void> {
  await invokeTauriCommand<string>("sidecar_spawn_resident", {
    pluginId,
    executablePath: supervisorPath(pluginRoot),
    args: [],
    installPath: pluginRoot,
  });
}

async function initializeResident(
  pluginId: string,
  provider: Awaited<ReturnType<typeof startMockProvider>>
): Promise<ResidentResponse> {
  return sendResident(pluginId, "initialize", {
    hostContext: { apiVersion: 3, sidecarProtocolVersion: 3 },
    provider: { baseUrl: provider.baseUrl, apiKey: "host-capability-secret" },
  });
}

async function waitForSnapshotFact(
  pluginId: string,
  sessionId: string,
  predicate: (facts: DurableFact[]) => boolean,
): Promise<ResidentResponse> {
  const deadline = Date.now() + 30_000;
  let last: ResidentResponse | undefined;
  while (Date.now() < deadline) {
    last = await sendResident(pluginId, "session.snapshot", { sessionId });
    const facts = last.data.snapshot?.durableFacts ?? [];
    if (last.type === "result" && predicate(facts)) return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `session snapshot did not satisfy the fact predicate: ${JSON.stringify(last)}`,
  );
}

function factText(fact: DurableFact): string {
  return JSON.stringify(fact.data ?? {});
}

releaseDescribe("DSH host capability bridge", () => {
  let pluginId: string | undefined;
  let installPath: string | undefined;
  let controllerLeaseId: string | undefined;
  let provider: Awaited<ReturnType<typeof startMockProvider>> | undefined;
  let suitePassed = true;

  before(async () => {
    provider = await startMockProvider();
  });

  afterEach(function () {
    if (this.currentTest?.state === "failed") suitePassed = false;
  });

  after(async () => {
    if (pluginId) {
      await invokeTauriCommand("sidecar_kill_resident", { pluginId }).catch(
        () => undefined
      );
    }
    provider?.server.close();
    const artifactDir = process.env.AIO_E2E_ARTIFACT_DIR?.trim();
    if (artifactDir) {
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(
        path.join(artifactDir, "dsh-host-capability-result.json"),
        JSON.stringify(
          {
            suite: "dsh-host-capability",
            status: suitePassed ? "passed" : "failed",
            evidence: [
              "production-ipc-install",
              "resident-ready",
              "lease-fencing",
              "authoritative-snapshot-real-facts",
              "cold-recovery-persisted-facts",
              "interaction-respond-wiring-fail-closed",
              "cancel",
              "process-tree-cleanup",
            ],
          },
          null,
          2
        ),
        "utf8"
      );
    }
  });

  it("installs the final ZIP through production IPC and reaches resident ready", async () => {
    if (
      !releaseZip ||
      !path.isAbsolute(releaseZip) ||
      !fs.existsSync(releaseZip)
    ) {
      throw new Error(
        "AIO_E2E_DSH_PLUGIN_ZIP must name an existing final ZIP."
      );
    }

    const installed = await invokeTauriCommand<InstalledPlugin>(
      "install_plugin_from_zip",
      { zipPath: releaseZip }
    );
    pluginId = installed.pluginId;
    installPath = installed.installPath;
    if (!fs.existsSync(supervisorPath(installed.installPath))) {
      throw new Error(
        `Installed manifest Sidecar is missing: ${supervisorPath(installed.installPath)}`
      );
    }

    await spawnResident(installed.pluginId, installed.installPath);
    const ready = await initializeResident(installed.pluginId, provider!);
    if (ready.type !== "result" || ready.data.state !== "ready") {
      throw new Error(
        `Resident initialize did not become ready: ${JSON.stringify(ready)}`
      );
    }
    if (!ready.data.domainGenerationId) {
      throw new Error("Resident initialize omitted domainGenerationId.");
    }
  });

  it("projects an authoritative snapshot with real DSH facts through the host bridge", async () => {
    if (!pluginId || !provider) {
      throw new Error("plugin must be installed before the host-bridge turn");
    }
    const acquire = await sendResident(pluginId, "session.acquire", {
      sessionId: SESSION_ID,
      viewId: "host-capability",
      mode: "controller",
    });
    if (acquire.type !== "result" || !acquire.data.lease?.leaseId) {
      throw new Error(
        `session.acquire did not grant a controller lease: ${JSON.stringify(acquire)}`
      );
    }
    controllerLeaseId = acquire.data.lease.leaseId;

    const duplicate = await sendResident(pluginId, "session.acquire", {
      sessionId: SESSION_ID,
      viewId: "second-view",
      mode: "controller",
    });
    if (
      duplicate.type !== "result" ||
      duplicate.data.accepted !== false ||
      duplicate.data.rejection?.code !== "lease-rejected"
    ) {
      throw new Error(
        `duplicate controller acquire must be fenced: ${JSON.stringify(duplicate)}`
      );
    }

    const submit = await sendResident(pluginId, "session.submitPrompt", {
      sessionId: SESSION_ID,
      leaseId: controllerLeaseId,
      turnId: "host-capability-turn-1",
      input: {
        prompt: "reply with the host capability marker",
        provider: {
          baseUrl: provider.baseUrl,
          apiKey: "host-capability-secret",
        },
        workspace: pluginDataDir(pluginId),
      },
    });
    if (submit.type !== "result" || submit.data.accepted !== true) {
      throw new Error(
        `session.submitPrompt was not accepted: ${JSON.stringify(submit)}`
      );
    }

    // The authoritative snapshot must carry real DSH session facts projected
    // through the host bridge — not the placeholder cursor-0/empty-facts shape
    // of the minimal runtime-core facade.
    const snapshot = await waitForSnapshotFact(
      pluginId,
      SESSION_ID,
      (facts) =>
        facts.some(
          (fact) => fact.kind === "user/message" && factText(fact).includes("host capability marker"),
        ) &&
        facts.some(
          (fact) => fact.kind === "assistant/message" && factText(fact).includes(MARKER),
        ),
    );
    const snap = snapshot.data.snapshot;
    if (!snap || snap.cursor === undefined || snap.seq === undefined) {
      throw new Error(`snapshot omitted cursor/seq: ${JSON.stringify(snapshot)}`);
    }
    if (snap.cursor === "cursor-0" && (snap.durableFacts ?? []).length === 0) {
      throw new Error(
        "snapshot still reports the placeholder runtime-core shape (cursor-0, empty facts)"
      );
    }
    if (!snap.sessionId || snap.sessionId !== SESSION_ID) {
      throw new Error(`snapshot sessionId mismatch: ${JSON.stringify(snap.sessionId)}`);
    }
    const kinds = (snap.durableFacts ?? []).map((fact) => fact.kind);
    for (const required of ["turn/start", "user/message", "assistant/message"]) {
      if (!kinds.includes(required)) {
        throw new Error(
          `snapshot facts missing ${required}: kinds=${JSON.stringify(kinds)}`
        );
      }
    }
    // Pending interactions surface as a sibling `interactions` array (host
    // notification frames aggregated by the supervisor), never inside the
    // snapshot DTO. A plain text turn produces no approvals, so the field is
    // legitimately absent; when present it must be an array.
    if (
      snapshot.data.interactions !== undefined &&
      !Array.isArray(snapshot.data.interactions)
    ) {
      throw new Error(
        `interactions field must be an array when present: ${JSON.stringify(snapshot.data.interactions)}`
      );
    }

    const codingRequests = provider.requests.filter((request) => {
      const messages = request.messages;
      return (
        Array.isArray(messages) &&
        messages.some(
          (message) =>
            typeof message === "object" &&
            message !== null &&
            (message as { role?: unknown }).role === "user" &&
            (message as { content?: unknown }).content ===
              "reply with the host capability marker"
        )
      );
    });
    if (codingRequests.length !== 1) {
      throw new Error(
        `DSH did not send exactly one coding prompt to the provider: count=${codingRequests.length}`
      );
    }
  });

  it("wires interaction.respond through the production chain and fails closed on unknown correlations", async () => {
    if (!pluginId || !controllerLeaseId) {
      throw new Error("plugin and lease must exist before the interaction probe");
    }
    // The full AIO IPC → supervisor → host broker chain must reject an
    // interaction response that was never issued, with the structured
    // unknown-interaction code rather than a transport error.
    const respond = await sendResident(pluginId, "interaction.respond", {
      sessionId: SESSION_ID,
      leaseId: controllerLeaseId,
      correlationId: "approval-does-not-exist",
      decision: "allow",
    });
    if (
      respond.type !== "result" ||
      respond.data.accepted !== false ||
      respond.data.rejection?.code !== "unknown-interaction"
    ) {
      throw new Error(
        `unknown interaction must be rejected fail-closed: ${JSON.stringify(respond)}`
      );
    }

    // A stale lease must not be able to answer interactions either.
    const stale = await sendResident(pluginId, "interaction.respond", {
      sessionId: SESSION_ID,
      leaseId: "lease-does-not-exist",
      correlationId: "approval-does-not-exist",
      decision: "allow",
    });
    if (stale.type !== "result" || stale.data.accepted !== false) {
      throw new Error(
        `stale-lease interaction must be rejected: ${JSON.stringify(stale)}`
      );
    }
  });

  it("cancels the active turn through the host bridge", async () => {
    if (!pluginId || !controllerLeaseId) {
      throw new Error("plugin and lease must exist before cancel");
    }
    const cancel = await sendResident(pluginId, "session.cancel", {
      sessionId: SESSION_ID,
      leaseId: controllerLeaseId,
      turnId: "host-capability-turn-1",
    });
    if (cancel.type !== "result" || cancel.data.accepted !== true) {
      throw new Error(
        `session.cancel was not accepted: ${JSON.stringify(cancel)}`
      );
    }
  });

  it("recovers persisted session facts cold after a resident restart", async () => {
    if (!pluginId || !installPath || !provider) {
      throw new Error("plugin must be installed before cold recovery");
    }
    // Graceful shutdown flushes DSH persistence; the restart then has no live
    // agent for the session, so the snapshot must be rebuilt from the durable
    // log through the host bridge (cold recovery, not a live projection).
    const shutdown = await sendResident(pluginId, "shutdown", {
      reason: "host-capability-cold-recovery",
    });
    if (shutdown.type !== "result" || shutdown.data.state !== "stopped") {
      throw new Error(
        `graceful shutdown did not stop the resident: ${JSON.stringify(shutdown)}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    assertResidentProcessTreeIsGone();

    await spawnResident(pluginId, installPath);
    const ready = await initializeResident(pluginId, provider);
    if (ready.type !== "result" || ready.data.state !== "ready") {
      throw new Error(
        `resident did not restart for cold recovery: ${JSON.stringify(ready)}`
      );
    }

    const recovered = await waitForSnapshotFact(
      pluginId,
      SESSION_ID,
      (facts) =>
        facts.some(
          (fact) => fact.kind === "user/message" && factText(fact).includes("host capability marker"),
        ),
    );
    const snap = recovered.data.snapshot;
    if (!snap || (snap.durableFacts ?? []).length === 0) {
      throw new Error(
        `cold recovery returned no persisted facts: ${JSON.stringify(recovered)}`
      );
    }
    const kinds = (snap.durableFacts ?? []).map((fact) => fact.kind);
    if (!kinds.includes("assistant/message")) {
      throw new Error(
        `cold recovery lost the assistant fact: kinds=${JSON.stringify(kinds)}`
      );
    }
  });

  it("flushes a graceful shutdown and removes the resident process tree", async () => {
    if (!pluginId) {
      throw new Error("plugin must be running before the final shutdown");
    }
    const shutdown = await sendResident(pluginId, "shutdown", {
      reason: "host-capability-complete",
    });
    if (shutdown.type !== "result" || shutdown.data.state !== "stopped") {
      throw new Error(
        `resident shutdown did not flush a stopped state: ${JSON.stringify(shutdown)}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    assertResidentProcessTreeIsGone();
  });
});
