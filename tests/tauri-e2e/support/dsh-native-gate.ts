import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

export type DshNativeGateResult = {
  schemaVersion: 1;
  status: "passed" | "failed" | "infrastructure-blocked";
  gatePassed: boolean;
  temporaryWaiver: boolean;
  reasonCode: string;
  formalReleaseBlocked: boolean;
};

const WEBDRIVER_UNREACHABLE =
  /Unable to connect to ["']http:\/\/(?:127\.0\.0\.1|localhost):\d+\/["'].*browser driver is running/is;
const TEST_RESULT = /\b\d+\s+(?:passing|failing|passed|failed)\b/i;

export function classifyDshNativeE2e(input: {
  exitCode: number;
  output: string;
}): DshNativeGateResult {
  if (input.exitCode === 0) {
    return {
      schemaVersion: 1,
      status: "passed",
      gatePassed: true,
      temporaryWaiver: false,
      reasonCode: "E2E_PASSED",
      formalReleaseBlocked: false,
    };
  }
  if (
    WEBDRIVER_UNREACHABLE.test(input.output) &&
    !TEST_RESULT.test(input.output)
  ) {
    return {
      schemaVersion: 1,
      status: "infrastructure-blocked",
      gatePassed: false,
      temporaryWaiver: true,
      reasonCode: "WEBDRIVER_UNREACHABLE_BEFORE_TESTS",
      formalReleaseBlocked: true,
    };
  }
  return {
    schemaVersion: 1,
    status: "failed",
    gatePassed: false,
    temporaryWaiver: false,
    reasonCode: "E2E_PRODUCT_OR_UNKNOWN_FAILURE",
    formalReleaseBlocked: true,
  };
}

if (import.meta.main) {
  const values = parseArgs({
    args: process.argv.slice(2),
    options: {
      "exit-code": { type: "string" },
      log: { type: "string" },
      out: { type: "string" },
    },
  }).values;
  const exitCode = Number(values["exit-code"]);
  if (!Number.isInteger(exitCode) || !values.log || !values.out) {
    console.error("usage: bun dsh-native-gate.ts --exit-code <n> --log <path> --out <path>");
    process.exitCode = 1;
  } else {
    const result = classifyDshNativeE2e({
      exitCode,
      output: fs.readFileSync(values.log, "utf8"),
    });
    fs.mkdirSync(path.dirname(values.out), { recursive: true });
    fs.writeFileSync(values.out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(result));
    if (result.temporaryWaiver) {
      console.warn(
        "::warning::Offline native E2E was not executed because WebDriver was unreachable before tests; formal release remains blocked.",
      );
    }
    if (result.status === "failed") process.exitCode = 1;
  }
}
