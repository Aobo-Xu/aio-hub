import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import JSZip from "jszip";

import { invokeTauriCommand } from "../support/tauri-command";

const releaseZip = process.env.AIO_E2E_DSH_PLUGIN_ZIP?.trim();
const releaseDescribe = releaseZip ? describe : describe.skip;

type InstalledPlugin = {
  pluginId: string;
  installPath: string;
};

type StagedPluginUpgrade = {
  transactionId: string;
  pluginId: string;
  candidatePath: string;
  currentPath: string;
  probePluginId: string;
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
    terminal?: string;
    output?: string;
    rejection?: { code?: string };
  };
};

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
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "AIO DSH NATIVE E2E OK" }, finish_reason: null }] })}\n\n`
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

async function initializeResident(pluginId: string): Promise<ResidentResponse> {
  return sendResident(pluginId, "initialize", {
    hostContext: { apiVersion: 3, sidecarProtocolVersion: 3 },
  });
}

async function smokeCandidateRuntime(
  staged: StagedPluginUpgrade,
  provider: Awaited<ReturnType<typeof startMockProvider>>
): Promise<ResidentResponse> {
  const sessionId = `upgrade-probe-${staged.transactionId}`;
  const acquire = await sendResident(staged.probePluginId, "session.acquire", {
    sessionId,
    viewId: "upgrade-probe",
    mode: "controller",
  });
  if (acquire.type !== "result" || !acquire.data.lease?.leaseId) {
    throw new Error(
      `upgrade probe did not acquire a lease: ${JSON.stringify(acquire)}`
    );
  }
  return sendResident(staged.probePluginId, "session.submitPrompt", {
    sessionId,
    leaseId: acquire.data.lease.leaseId,
    turnId: `upgrade-probe-turn-${staged.transactionId}`,
    input: {
      prompt: "reply with the upgrade candidate smoke marker",
      provider: {
        baseUrl: provider.baseUrl,
        apiKey: "upgrade-probe-secret",
      },
      workspace: pluginDataDir(staged.probePluginId),
    },
  });
}

async function createRuntimeCorruptUpgradeZip(
  sourceZip: string,
  outputZip: string
): Promise<void> {
  const archive = await JSZip.loadAsync(fs.readFileSync(sourceZip));
  const runtimePath = "bin/deepseek-harness-sdk-runtime-win-x64.exe";
  if (!archive.file(runtimePath)) {
    throw new Error(`release ZIP is missing runtime payload: ${runtimePath}`);
  }
  archive.file(runtimePath, Buffer.from("invalid runtime candidate", "utf8"));
  fs.writeFileSync(
    outputZip,
    await archive.generateAsync({ type: "nodebuffer", compression: "STORE" })
  );
}

releaseDescribe("DSH release plugin", () => {
  let pluginId: string | undefined;
  let installPath: string | undefined;
  let controllerLeaseId: string | undefined;
  let provider: Awaited<ReturnType<typeof startMockProvider>> | undefined;
  let corruptUpgradeZip: string | undefined;
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
    if (corruptUpgradeZip) {
      fs.rmSync(corruptUpgradeZip, { force: true });
    }
    const artifactDir = process.env.AIO_E2E_ARTIFACT_DIR?.trim();
    if (artifactDir) {
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(
        path.join(artifactDir, "dsh-native-e2e-result.json"),
        JSON.stringify(
          {
            suite: "dsh-plugin-release",
            status: suitePassed ? "passed" : "failed",
            evidence: [
              "production-ipc-install",
              "resident-ready",
              "lease-fencing",
              "coding-turn",
              "crash-interruption-no-replay",
              "descendant-cleanup",
              "upgrade-rollback",
              "uninstall-data-preservation",
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
    const executablePath = supervisorPath(installed.installPath);
    if (!fs.existsSync(executablePath)) {
      throw new Error(
        `Installed manifest Sidecar is missing: ${executablePath}`
      );
    }

    await spawnResident(installed.pluginId, installed.installPath);

    const response = JSON.parse(
      await invokeTauriCommand<string>("sidecar_send_command", {
        pluginId: installed.pluginId,
        method: "initialize",
        params: { hostContext: { apiVersion: 3, sidecarProtocolVersion: 3 } },
      })
    ) as ResidentResponse;
    if (response.type !== "result" || response.data.state !== "ready") {
      throw new Error(
        `Resident initialize did not become ready: ${JSON.stringify(response)}`
      );
    }
    if (!response.data.domainGenerationId) {
      throw new Error("Resident initialize omitted domainGenerationId.");
    }
  });

  it("runs a coding turn through the resident session channel", async () => {
    if (!pluginId) {
      throw new Error("plugin must be installed before the coding turn");
    }
    const acquire = await sendResident(pluginId, "session.acquire", {
      sessionId: "e2e-session",
      viewId: "coding-workstation",
      mode: "controller",
    });
    if (acquire.type !== "result" || !acquire.data.lease?.leaseId) {
      throw new Error(
        `session.acquire did not grant a controller lease: ${JSON.stringify(acquire)}`
      );
    }
    controllerLeaseId = acquire.data.lease.leaseId;

    const duplicate = await sendResident(pluginId, "session.acquire", {
      sessionId: "e2e-session",
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

    if (!provider) {
      throw new Error("mock provider must be listening before the coding turn");
    }
    const submit = await sendResident(pluginId, "session.submitPrompt", {
      sessionId: "e2e-session",
      leaseId: controllerLeaseId,
      turnId: "e2e-turn-1",
      input: {
        prompt: "reply with the native E2E marker",
        provider: {
          baseUrl: provider.baseUrl,
          apiKey: "native-e2e-secret",
        },
        workspace: pluginDataDir(pluginId),
      },
    });
    if (
      submit.type !== "result" ||
      submit.data.accepted !== true ||
      submit.data.terminal !== "completed" ||
      submit.data.output !== "AIO DSH NATIVE E2E OK"
    ) {
      throw new Error(
        `session.submitPrompt did not complete through DSH: ${JSON.stringify(submit)}`
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
              "reply with the native E2E marker"
        )
      );
    });
    if (codingRequests.length !== 1) {
      throw new Error(
        `DSH did not send the coding prompt to the mock provider: count=${provider.requests.length}, requests=${JSON.stringify(provider.requests)}`
      );
    }

    const cancel = await sendResident(pluginId, "session.cancel", {
      sessionId: "e2e-session",
      leaseId: controllerLeaseId,
      turnId: "e2e-turn-1",
    });
    if (cancel.type !== "result" || cancel.data.accepted !== true) {
      throw new Error(
        `session.cancel was not accepted: ${JSON.stringify(cancel)}`
      );
    }
  });

  it("flushes a graceful shutdown and removes the resident process tree", async () => {
    if (!pluginId || !installPath) {
      throw new Error("plugin must be running before the shutdown check");
    }
    const shutdown = await sendResident(pluginId, "shutdown", {
      reason: "native-e2e",
    });
    if (shutdown.type !== "result" || shutdown.data.state !== "stopped") {
      throw new Error(
        `resident shutdown did not flush a stopped state: ${JSON.stringify(shutdown)}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    assertResidentProcessTreeIsGone();

    await spawnResident(pluginId, installPath);
    const ready = await initializeResident(pluginId);
    if (ready.type !== "result" || ready.data.state !== "ready") {
      throw new Error(
        `resident did not restart after graceful shutdown: ${JSON.stringify(ready)}`
      );
    }
  });

  it("records crash interruption and never replays the interrupted turn", async () => {
    if (!pluginId || !installPath) {
      throw new Error("plugin must be installed before crash recovery");
    }
    const crashToken = process.env.AIO_DSH_E2E_CRASH_TOKEN?.trim();
    if (!crashToken) {
      throw new Error("AIO_DSH_E2E_CRASH_TOKEN is required for crash recovery");
    }
    const sessionId = "crash-recovery-session";
    const turnId = "crash-turn-1";
    const lease = await sendResident(pluginId, "session.acquire", {
      sessionId,
      viewId: "coding-workstation",
      mode: "controller",
    });
    if (lease.type !== "result" || !lease.data.lease?.leaseId) {
      throw new Error(
        `crash recovery lease was not granted: ${JSON.stringify(lease)}`
      );
    }

    await sendResident(pluginId, "session.submitPrompt", {
      sessionId,
      leaseId: lease.data.lease.leaseId,
      turnId,
      input: { crashToken },
    }).catch(() => undefined);

    await new Promise((resolve) => setTimeout(resolve, 250));
    await invokeTauriCommand("sidecar_kill_resident", { pluginId }).catch(
      () => undefined
    );
    await spawnResident(pluginId, installPath);
    const ready = await initializeResident(pluginId);
    if (ready.type !== "result" || ready.data.state !== "ready") {
      throw new Error(
        `crash recovery did not restore readiness: ${JSON.stringify(ready)}`
      );
    }
    const recoveredLease = await sendResident(pluginId, "session.acquire", {
      sessionId,
      viewId: "coding-workstation",
      mode: "controller",
    });
    if (
      recoveredLease.type !== "result" ||
      !recoveredLease.data.lease?.leaseId
    ) {
      throw new Error(
        `crash recovery lease was not re-established: ${JSON.stringify(recoveredLease)}`
      );
    }
    const retry = await sendResident(pluginId, "session.submitPrompt", {
      sessionId,
      leaseId: recoveredLease.data.lease.leaseId,
      turnId,
      input: { crashToken },
    });
    if (
      retry.type !== "result" ||
      retry.data.accepted !== false ||
      retry.data.rejection?.code !== "interrupted-turn"
    ) {
      throw new Error(
        `interrupted turn was replayed or not fenced: ${JSON.stringify(retry)}`
      );
    }
  });

  it("restarts the resident sidecar and resumes readiness", async () => {
    if (!pluginId || !installPath) {
      throw new Error("plugin must be installed before the restart check");
    }
    await invokeTauriCommand("sidecar_kill_resident", { pluginId });

    await spawnResident(pluginId, installPath);
    const response = await initializeResident(pluginId);
    if (response.type !== "result" || response.data.state !== "ready") {
      throw new Error(
        `resident restart did not become ready: ${JSON.stringify(response)}`
      );
    }
  });

  it("rejects a candidate whose runtime handshake fails and restores the last good runtime", async () => {
    if (!pluginId || !installPath || !releaseZip) {
      throw new Error("plugin must be installed before the rollback check");
    }
    const artifactDir = process.env.AIO_E2E_ARTIFACT_DIR?.trim();
    if (!artifactDir) {
      throw new Error("AIO_E2E_ARTIFACT_DIR is required for upgrade fixtures");
    }
    fs.mkdirSync(artifactDir, { recursive: true });
    corruptUpgradeZip = path.join(artifactDir, "runtime-corrupt-upgrade.zip");
    await createRuntimeCorruptUpgradeZip(releaseZip, corruptUpgradeZip);

    const staged = await invokeTauriCommand<StagedPluginUpgrade>(
      "stage_plugin_upgrade_from_zip",
      { zipPath: corruptUpgradeZip }
    );
    if (staged.currentPath !== installPath || staged.pluginId !== pluginId) {
      throw new Error(
        `upgrade staging targeted the wrong install: ${JSON.stringify(staged)}`
      );
    }

    if (!provider) {
      throw new Error("mock provider must be listening before upgrade smoke");
    }
    await invokeTauriCommand("sidecar_kill_resident", { pluginId });
    let probe: ResidentResponse | undefined;
    try {
      await spawnResident(staged.probePluginId, staged.candidatePath);
      const initialized = await initializeResident(staged.probePluginId);
      if (initialized.type !== "result" || initialized.data.state !== "ready") {
        throw new Error(
          `corrupt candidate did not reach the runtime smoke: ${JSON.stringify(initialized)}`
        );
      }
      probe = await smokeCandidateRuntime(staged, provider);
    } finally {
      await invokeTauriCommand("sidecar_kill_resident", {
        pluginId: staged.probePluginId,
      }).catch(() => undefined);
      await invokeTauriCommand("finalize_plugin_upgrade", {
        transactionId: staged.transactionId,
        accept: false,
      });
      if (fs.existsSync(pluginDataDir(staged.probePluginId))) {
        throw new Error("failed upgrade probe data was not cleaned");
      }
      await spawnResident(pluginId, installPath);
    }

    const recovered = await initializeResident(pluginId);
    if (
      probe?.type !== "error" ||
      !["runtime-turn-failed", "runtime-spawn-failed"].includes(
        probe.data.code ?? ""
      )
    ) {
      throw new Error(
        `corrupt candidate unexpectedly passed runtime smoke: ${JSON.stringify(probe)}`
      );
    }
    if (recovered.type !== "result" || recovered.data.state !== "ready") {
      throw new Error(
        `last good runtime was not restored after failed upgrade: ${JSON.stringify(recovered)}`
      );
    }
    if (!fs.existsSync(pluginDataDir(pluginId))) {
      throw new Error("plugin data must survive failed upgrade rollback");
    }
  });

  it("commits a verified staged upgrade and preserves plugin data", async () => {
    if (!pluginId || !releaseZip) {
      throw new Error("plugin must be installed before the upgrade check");
    }
    const dataRoot = pluginDataDir(pluginId);
    if (!fs.existsSync(dataRoot)) {
      throw new Error(
        `plugin data root is missing before upgrade: ${dataRoot}`
      );
    }

    const staged = await invokeTauriCommand<StagedPluginUpgrade>(
      "stage_plugin_upgrade_from_zip",
      { zipPath: releaseZip }
    );
    if (!provider) {
      throw new Error("mock provider must be listening before upgrade smoke");
    }
    await invokeTauriCommand("sidecar_kill_resident", { pluginId });
    await spawnResident(staged.probePluginId, staged.candidatePath);
    const probe = await initializeResident(staged.probePluginId);
    if (probe.type !== "result" || probe.data.state !== "ready") {
      throw new Error(
        `upgrade candidate did not pass resident probe: ${JSON.stringify(probe)}`
      );
    }
    const smoke = await smokeCandidateRuntime(staged, provider);
    if (
      smoke.type !== "result" ||
      smoke.data.accepted !== true ||
      smoke.data.terminal !== "completed" ||
      smoke.data.output !== "AIO DSH NATIVE E2E OK"
    ) {
      throw new Error(
        `upgrade candidate did not pass runtime smoke: ${JSON.stringify(smoke)}`
      );
    }
    await invokeTauriCommand("sidecar_kill_resident", {
      pluginId: staged.probePluginId,
    });
    const upgraded = await invokeTauriCommand<InstalledPlugin>(
      "finalize_plugin_upgrade",
      {
        transactionId: staged.transactionId,
        accept: true,
      }
    );
    installPath = upgraded.installPath;
    if (fs.existsSync(pluginDataDir(staged.probePluginId))) {
      throw new Error("accepted upgrade probe data was not cleaned");
    }

    await spawnResident(pluginId, upgraded.installPath);
    const response = await initializeResident(pluginId);
    if (response.type !== "result" || response.data.state !== "ready") {
      throw new Error(
        `committed upgraded install did not become ready: ${JSON.stringify(response)}`
      );
    }
    if (!fs.existsSync(dataRoot)) {
      throw new Error(
        `plugin data root must survive the upgrade path: ${dataRoot}`
      );
    }
  });

  it("uninstalls cleanly and preserves plugin data", async () => {
    if (!pluginId) {
      throw new Error("plugin must be installed before the uninstall check");
    }
    const dataRoot = pluginDataDir(pluginId);
    await invokeTauriCommand("sidecar_kill_resident", { pluginId });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assertResidentProcessTreeIsGone();
    await invokeTauriCommand("uninstall_plugin", { pluginId });

    const pluginsRoot = path.dirname(installPath ?? "");
    if (fs.existsSync(path.join(pluginsRoot, pluginId))) {
      throw new Error("plugin install directory must be removed on uninstall");
    }
    if (!fs.existsSync(dataRoot)) {
      throw new Error(
        `plugin data root must be preserved after uninstall: ${dataRoot}`
      );
    }
    pluginId = undefined;
  });
});
