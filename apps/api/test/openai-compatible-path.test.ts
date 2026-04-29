import assert from "node:assert/strict";
import test from "node:test";
import { OpenAICompatibleService } from "../src/openai-compatible/openai-compatible.service";

function createConfig(pathValue?: string) {
  return {
    get(key: string) {
      if (key === "storage.local.path") {
        return pathValue;
      }

      return undefined;
    },
  };
}

test("getLocalStoragePath preserves absolute Windows paths", () => {
  const service = new OpenAICompatibleService(
    createConfig("C:\\temp\\yunwu-storage") as never,
  );

  assert.equal(
    service["getLocalStoragePath"](),
    "C:\\temp\\yunwu-storage",
  );
});

test("getLocalStoragePath resolves relative paths from cwd", () => {
  const service = new OpenAICompatibleService(
    createConfig("./storage") as never,
  );

  const resolved = service["getLocalStoragePath"]();
  assert.match(resolved, /[\\/]storage$/);
  assert.ok(!resolved.includes("C:\\temp\\yunwu-storage"));
});
