import fs from "node:fs";
import path from "node:path";

import { invokeTauriCommand } from "../support/tauri-command";

const releaseZip = process.env.AIO_E2E_DSH_PLUGIN_ZIP?.trim();
const releaseDescribe = releaseZip ? describe : describe.skip;

type InstalledPlugin = {
  pluginId: string;
  installPath: string;
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
  };
};

function pluginDataDir(pluginId: string): string {
  const dataDir = process.env.AIO_DATA_DIR?.trim();
  if (!dataDir) {
    throw new Error("AIO_DATA_DIR is required to locate the plugin data root.");
  }
  return path.join(dataDir, "plugins-data", pluginId);
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

releaseDescribe("DSH release plugin", () => {
  let pluginId: string | undefined;
  let installPath: string | undefined;
  let controllerLeaseId: string | undefined;

  after(async () => {
    if (pluginId) {
      await invokeTauriCommand("sidecar_kill_resident", { pluginId }).catch(
        () => undefined
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
    const executablePath = path.join(
      installed.installPath,
      "bin",
      "win32-x64",
      "aio-dsh-supervisor.exe"
    );
    if (!fs.existsSync(executablePath)) {
      throw new Error(
        `Installed manifest Sidecar is missing: ${executablePath}`
      );
    }

    await invokeTauriCommand<string>("sidecar_spawn_resident", {
      pluginId: installed.pluginId,
      executablePath,
      args: [],
      installPath: installed.installPath,
    });

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

    const submit = await sendResident(pluginId, "session.submitPrompt", {
      sessionId: "e2e-session",
      leaseId: controllerLeaseId,
      turnId: "e2e-turn-1",
      input: { prompt: "add a hello-world function" },
    });
    if (submit.type !== "result" || submit.data.accepted !== true) {
      throw new Error(
        `session.submitPrompt was not accepted: ${JSON.stringify(submit)}`
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

  it("restarts the resident sidecar and resumes readiness", async () => {
    if (!pluginId || !installPath) {
      throw new Error("plugin must be installed before the restart check");
    }
    await invokeTauriCommand("sidecar_kill_resident", { pluginId });

    const executablePath = path.join(
      installPath,
      "bin",
      "win32-x64",
      "aio-dsh-supervisor.exe"
    );
    await invokeTauriCommand<string>("sidecar_spawn_resident", {
      pluginId,
      executablePath,
      args: [],
      installPath,
    });
    const response = await sendResident(pluginId, "initialize", {
      hostContext: { apiVersion: 3, sidecarProtocolVersion: 3 },
    });
    if (response.type !== "result" || response.data.state !== "ready") {
      throw new Error(
        `resident restart did not become ready: ${JSON.stringify(response)}`
      );
    }
  });

  it("reinstalls through the upgrade path and preserves plugin data", async () => {
    if (!pluginId || !releaseZip) {
      throw new Error("plugin must be installed before the upgrade check");
    }
    const dataRoot = pluginDataDir(pluginId);
    if (!fs.existsSync(dataRoot)) {
      throw new Error(
        `plugin data root is missing before upgrade: ${dataRoot}`
      );
    }

    await invokeTauriCommand("sidecar_kill_resident", { pluginId });
    await invokeTauriCommand("uninstall_plugin", { pluginId });

    if (!fs.existsSync(dataRoot)) {
      throw new Error(
        `plugin data root must survive uninstall for upgrade: ${dataRoot}`
      );
    }

    const upgraded = await invokeTauriCommand<InstalledPlugin>(
      "install_plugin_from_zip",
      { zipPath: releaseZip }
    );
    installPath = upgraded.installPath;

    const executablePath = path.join(
      upgraded.installPath,
      "bin",
      "win32-x64",
      "aio-dsh-supervisor.exe"
    );
    await invokeTauriCommand<string>("sidecar_spawn_resident", {
      pluginId: upgraded.pluginId,
      executablePath,
      args: [],
      installPath: upgraded.installPath,
    });
    const response = await sendResident(upgraded.pluginId, "initialize", {
      hostContext: { apiVersion: 3, sidecarProtocolVersion: 3 },
    });
    if (response.type !== "result" || response.data.state !== "ready") {
      throw new Error(
        `upgraded install did not become ready: ${JSON.stringify(response)}`
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
