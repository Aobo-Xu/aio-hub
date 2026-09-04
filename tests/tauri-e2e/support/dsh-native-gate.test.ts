import { describe, expect, it } from "vitest";

import { classifyDshNativeE2e } from "./dsh-native-gate";

describe("DSH native E2E temporary infrastructure waiver", () => {
  it("records an auditable pre-test WebDriver infrastructure failure", () => {
    expect(
      classifyDshNativeE2e({
        exitCode: 1,
        output:
          'Unable to connect to "http://127.0.0.1:4459/", make sure browser driver is running on that address.',
      }),
    ).toEqual({
      schemaVersion: 1,
      status: "infrastructure-blocked",
      gatePassed: false,
      temporaryWaiver: true,
      reasonCode: "WEBDRIVER_UNREACHABLE_BEFORE_TESTS",
      formalReleaseBlocked: true,
    });
  });

  it("recognizes WDIO's zero-spec summary as pre-test infrastructure failure", () => {
    expect(
      classifyDshNativeE2e({
        exitCode: 1,
        output:
          'Unable to connect to "http://127.0.0.1:4459/", make sure browser driver is running on that address.\n\nSpec Files:\t 0 passed, 1 failed, 1 total',
      }),
    ).toMatchObject({
      status: "infrastructure-blocked",
      gatePassed: false,
      temporaryWaiver: true,
      formalReleaseBlocked: true,
    });
  });

  it("never waives a product test failure", () => {
    expect(
      classifyDshNativeE2e({
        exitCode: 1,
        output: "1 failing\nDSH lifecycle › marks crashed work interrupted",
      }),
    ).toMatchObject({ status: "failed", temporaryWaiver: false });
  });

  it("never waives an unknown runner failure", () => {
    expect(
      classifyDshNativeE2e({ exitCode: 1, output: "process exited unexpectedly" }),
    ).toMatchObject({ status: "failed", temporaryWaiver: false });
  });

  it("reports a real successful E2E separately from a waiver", () => {
    expect(
      classifyDshNativeE2e({ exitCode: 0, output: "8 passing" }),
    ).toMatchObject({
      status: "passed",
      gatePassed: true,
      temporaryWaiver: false,
      formalReleaseBlocked: false,
    });
  });
});
