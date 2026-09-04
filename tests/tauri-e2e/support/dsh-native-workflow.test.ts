import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  ".github",
  "workflows",
  "dsh-runtime-native.yml"
);

type WorkflowStep = {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
  if?: string;
};

type WorkflowJob = {
  "runs-on"?: string;
  needs?: string | string[];
  env?: Record<string, string>;
  steps?: WorkflowStep[];
};

type Workflow = {
  on?: Record<string, unknown>;
  jobs?: Record<string, WorkflowJob>;
};

function loadWorkflow(): Workflow {
  if (!fs.existsSync(WORKFLOW_PATH)) {
    throw new Error(`missing required workflow: ${WORKFLOW_PATH}`);
  }
  return yaml.load(fs.readFileSync(WORKFLOW_PATH, "utf8")) as Workflow;
}

function allRunSteps(job: WorkflowJob | undefined): string {
  return (job?.steps ?? []).map((step) => step.run ?? "").join("\n");
}

describe("dsh-runtime-native required workflow", () => {
  it("triggers on pull requests and protected branches", () => {
    const workflow = loadWorkflow();
    expect(workflow.on).toBeDefined();
    expect(workflow.on).toHaveProperty("pull_request");
    expect(workflow.on).toHaveProperty("push");
    expect(workflow.on).toHaveProperty("workflow_dispatch");
  });

  it("keeps online preparation and offline execution in one required Windows job", () => {
    const workflow = loadWorkflow();
    const jobs = workflow.jobs ?? {};
    const e2eJob = jobs["native-e2e"];

    expect(e2eJob, "native-e2e job must exist").toBeDefined();
    expect(e2eJob?.["runs-on"]).toBe("windows-latest");
    expect(
      jobs["package"],
      "release ZIP must stay on the required runner"
    ).toBeUndefined();

    const steps = e2eJob?.steps ?? [];
    const packageIndex = steps.findIndex((step) =>
      step.run?.includes("package:platform")
    );
    const verifyIndex = steps.findIndex((step) =>
      step.run?.includes("verify-release")
    );
    const smokeIndex = steps.findIndex((step) =>
      step.name?.includes("ZIP contract and executable smoke")
    );
    const denyIndex = steps.findIndex((step) =>
      step.run?.includes("New-NetFirewallRule")
    );
    const testIndex = steps.findIndex((step) =>
      step.run?.includes("--preset dsh-runtime-native")
    );

    expect(packageIndex).toBeGreaterThanOrEqual(0);
    expect(verifyIndex).toBeGreaterThan(packageIndex);
    expect(smokeIndex).toBeGreaterThan(verifyIndex);
    expect(smokeIndex).toBeLessThan(denyIndex);
    expect(denyIndex).toBeGreaterThan(verifyIndex);
    expect(testIndex).toBeGreaterThan(denyIndex);
  });

  it("pins the plugin checkout to a fixed ref", () => {
    const workflow = loadWorkflow();
    const e2eJob = workflow.jobs?.["native-e2e"];
    const checkout = (e2eJob?.steps ?? []).find(
      (step) =>
        step.uses?.startsWith("actions/checkout@") &&
        step.with?.repository === "Aobo-Xu/aiohub-plugin-dsh-workspace"
    );
    expect(checkout?.with?.repository).toBe(
      "Aobo-Xu/aiohub-plugin-dsh-workspace"
    );
    expect(String(checkout?.with?.ref)).toBe(
      "71e1cdc4a039fbbd78bfc23a513794f1743eab42"
    );
  });

  it("fetches DSH tag metadata while checking out the pinned source commit", () => {
    const workflow = loadWorkflow();
    const e2eJob = workflow.jobs?.["native-e2e"];
    const checkout = (e2eJob?.steps ?? []).find(
      (step) =>
        step.uses?.startsWith("actions/checkout@") &&
        step.with?.repository === "deepseek-ai/deepseek-harness"
    );

    expect(String(checkout?.with?.ref)).toBe(
      "db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5"
    );
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
  });

  it("runs the production E2E with isolated AIO_E2E_* wiring", () => {
    const workflow = loadWorkflow();
    const e2eJob = workflow.jobs?.["native-e2e"];
    const runs = allRunSteps(e2eJob);
    const envBlob = JSON.stringify(e2eJob ?? {});

    expect(runs).toContain("--preset dsh-runtime-native");
    for (const name of [
      "AIO_E2E_BINARY",
      "AIO_E2E_FRONTEND_URL",
      "AIO_E2E_DATA_DIR",
      "AIO_E2E_ID_SUFFIX",
      "AIO_E2E_ARTIFACT_DIR",
      "AIO_E2E_WEBDRIVER_PORT",
      "AIO_E2E_DSH_PLUGIN_ZIP",
    ]) {
      expect(envBlob, `${name} must be wired`).toContain(name);
    }
  });

  it("denies outbound traffic during tests and always restores the firewall", () => {
    const workflow = loadWorkflow();
    const e2eJob = workflow.jobs?.["native-e2e"];
    const steps = e2eJob?.steps ?? [];
    const runs = allRunSteps(e2eJob);

    expect(runs).toContain("New-NetFirewallRule");
    const denyIndex = steps.findIndex(
      (step) =>
        step.run?.includes("New-NetFirewallRule") &&
        step.run.includes("-Action Block") &&
        step.run.includes("-RemoteAddress Internet")
    );
    const restoreIndex = steps.findIndex(
      (step) =>
        step.run?.includes("Remove-NetFirewallRule") &&
        step.if?.includes("always()")
    );
    expect(denyIndex, "a deny rule step must exist").toBeGreaterThanOrEqual(0);
    expect(
      restoreIndex,
      "an always() restore step must exist"
    ).toBeGreaterThanOrEqual(0);
    expect(restoreIndex).toBeGreaterThan(denyIndex);
    const testIndex = steps.findIndex((step) =>
      step.run?.includes("--preset dsh-runtime-native")
    );
    expect(denyIndex).toBeLessThan(testIndex);
    expect(restoreIndex).toBeGreaterThan(testIndex);
  });

  it("generates a fresh crash-injection token before the offline test", () => {
    const workflow = loadWorkflow();
    const e2eJob = workflow.jobs?.["native-e2e"];
    const steps = e2eJob?.steps ?? [];
    const tokenIndex = steps.findIndex(
      (step) =>
        step.run?.includes("[guid]::NewGuid()") &&
        step.run.includes("AIO_DSH_E2E_CRASH_TOKEN") &&
        step.run.includes("GITHUB_ENV")
    );
    const denyIndex = steps.findIndex((step) =>
      step.run?.includes("New-NetFirewallRule")
    );
    const testIndex = steps.findIndex((step) =>
      step.run?.includes("--preset dsh-runtime-native")
    );

    expect(e2eJob?.env?.AIO_DSH_E2E_CRASH_TOKEN).toBeUndefined();
    expect(tokenIndex).toBeGreaterThanOrEqual(0);
    expect(tokenIndex).toBeLessThan(denyIndex);
    expect(tokenIndex).toBeLessThan(testIndex);
  });

  it("uploads only redacted artifacts", () => {
    const workflow = loadWorkflow();
    const uploads = Object.values(workflow.jobs ?? {}).flatMap((job) =>
      (job.steps ?? []).filter((step) =>
        step.uses?.startsWith("actions/upload-artifact@")
      )
    );
    expect(uploads.length).toBeGreaterThan(0);
    expect(uploads).toHaveLength(1);
    for (const upload of uploads) {
      const artifactPath = String(upload.with?.path ?? "");
      expect(artifactPath).not.toContain("AIO_E2E_DATA_DIR");
      expect(artifactPath).not.toContain("plugins-data");
      expect(artifactPath).not.toContain(".zip");
      expect(artifactPath).not.toContain("aiohub.exe");
      expect(
        artifactPath
          .trim()
          .split(/\r?\n/)
          .map((entry) => entry.trim())
      ).toEqual([
        ".e2e-artifacts/dsh-native/release-checksums.sha256",
        ".e2e-artifacts/dsh-native/dsh-native-e2e-result.json",
      ]);
    }
  });
});
