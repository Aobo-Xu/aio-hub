import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));

// Named exports that existed before the workstation contract; they must not
// change when LlmModelSelector is added.
const EXISTING_EXPORTS = [
  "Avatar",
  "BaseDialog",
  "InfoCard",
  "FileIcon",
  "RichTextRenderer",
  "AudioPlayer",
  "VideoPlayer",
  "RichCodeEditor",
  "DraggablePanel",
  "DropZone",
  "DynamicIcon",
];

describe("aiohub-ui public shim contract", () => {
  it("publishes LlmModelSelector from plugin-ui without altering existing exports", async () => {
    const mod = (await import("../plugin-ui")) as Record<string, unknown>;

    expect(mod.LlmModelSelector, "plugin-ui must named-export LlmModelSelector").toBeDefined();
    for (const name of EXISTING_EXPORTS) {
      expect(mod[name], `existing export ${name} must remain`).toBeDefined();
    }
  });

  it("browser ESM shim re-exports LlmModelSelector from window.AiohubUI", () => {
    const shimPath = path.resolve(
      testDir,
      "../../../public/plugins/shims/aiohub-ui-shim.js",
    );
    const text = readFileSync(shimPath, "utf8");

    for (const name of [...EXISTING_EXPORTS, "LlmModelSelector"]) {
      expect(
        new RegExp(`\\b${name}\\b`).test(text),
        `shim must destructure ${name} from window.AiohubUI`,
      ).toBe(true);
    }
  });
});
