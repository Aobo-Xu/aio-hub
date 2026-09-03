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
  return (job?.steps ?? [])
    .map((step) => step.run ?? "")
    .join("\n");
}

describe("dsh-runtime-native required workflow", () => {
  it("triggers on pull requests and protected branches", () => {
    const workflow = loadWorkflow();
    expect(workflow.on).toBeDefined();
    expect(workflow.on).toHaveProperty("pull_request");
    expect(workflow.on).toHaveProperty("push");
  });

  it("splits online packaging from the offline native E2E lane", () => {
    const workflow = loadWorkflow();
    const jobs = workflow.jobs ?? {};
    const packageJob = jobs["package"];
    const e2eJob = jobs["native-e2e"];

    expect(packageJob, "package job must exist").toBeDefined();
    expect(e2eJob, "native-e2e job must exist").toBeDefined();
    expect(e2eJob?.["runs-on"]).toBe("windows-latest");

    const needs = Array.isArray(e2eJob?.needs)
      ? e2eJob?.needs
      : [e2eJob?.needs];
    expect(needs).toContain("package");

    const packageRuns = allRunSteps(packageJob);
    expect(packageRuns).toContain("package:platform");
    expect(packageRuns).toContain("verify-release");
  });

  it("pins the plugin checkout to a fixed ref", () => {
    const workflow = loadWorkflow();
    const packageJob = workflow.jobs?.["package"];
    const checkout = (packageJob?.steps ?? []).find((step) =>
      step.uses?.startsWith("actions/checkout@")
    );
    expect(checkout?.with?.repository).toBeDefined();
    expect(String(checkout?.with?.ref)).toMatch(/^[0-9a-f]{40}$/);
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

    expect(runs).toContain("netsh");
    const denyIndex = steps.findIndex(
      (step) => step.run?.includes("netsh") && step.run.includes("block")
    );
    const restoreIndex = steps.findIndex(
      (step) =>
        step.run?.includes("netsh") &&
        step.run.includes("delete") &&
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

  it("uploads only redacted artifacts", () => {
    const workflow = loadWorkflow();
    const e2eJob = workflow.jobs?.["native-e2e"];
    const uploads = (e2eJob?.steps ?? []).filter((step) =>
      step.uses?.startsWith("actions/upload-artifact@")
    );
    expect(uploads.length).toBeGreaterThan(0);
    for (const upload of uploads) {
      const artifactPath = String(upload.with?.path ?? "");
      expect(artifactPath).not.toContain("AIO_E2E_DATA_DIR");
      expect(artifactPath).not.toContain("plugins-data");
      expect(artifactPath).not.toContain(".zip");
      expect(artifactPath).not.toContain("aiohub.exe");
    }
  });
});
