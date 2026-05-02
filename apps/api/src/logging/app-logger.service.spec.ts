import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppLoggerService } from "./app-logger.service";

describe("AppLoggerService", () => {
  it("keeps only the latest entries in the ring buffer", () => {
    const logger = AppLoggerService.createForTest(3);

    logger.debug("one", "Test");
    logger.log("two", "Test");
    logger.warn("three", "Test");
    logger.error("four", "Test");

    const result = logger.queryLogs({ level: "all", limit: 10 });

    assert.deepEqual(
      result.logs.map((entry) => entry.message),
      ["four", "three", "two"],
    );
    assert.equal(result.total, 3);
  });

  it("filters by minimum level and search text", () => {
    const logger = AppLoggerService.createForTest(10);

    logger.verbose("noise", "Test");
    logger.debug("queued task abc", "TaskQueueService");
    logger.warn("provider retry abc", "Provider");
    logger.error("failed task xyz", "TaskWorkerService");

    const result = logger.queryLogs({
      level: "warn",
      search: "abc",
      limit: 10,
    });

    assert.deepEqual(
      result.logs.map((entry) => entry.level),
      ["warn"],
    );
    assert.equal(result.logs[0]?.message, "provider retry abc");
  });

  it("normalizes query levels case-insensitively with info and warning aliases", () => {
    const logger = AppLoggerService.createForTest(10);

    logger.verbose("verbose entry");
    logger.debug("debug entry");
    logger.log("info entry");
    logger.warn("warn entry");
    logger.error("error entry");

    assert.deepEqual(
      logger.queryLogs({ level: "ALL", limit: 10 }).logs.map((entry) => entry.level),
      ["error", "warn", "log", "debug", "verbose"],
    );
    assert.deepEqual(
      logger.queryLogs({ level: "DEBUG", limit: 10 }).logs.map((entry) => entry.level),
      ["error", "warn", "log", "debug"],
    );
    assert.deepEqual(
      logger.queryLogs({ level: "INFO", limit: 10 }).logs.map((entry) => entry.level),
      ["error", "warn", "log"],
    );
    assert.deepEqual(
      logger.queryLogs({ level: "log", limit: 10 }).logs.map((entry) => entry.level),
      ["error", "warn", "log"],
    );
    assert.deepEqual(
      logger.queryLogs({ level: "warning", limit: 10 }).logs.map((entry) => entry.level),
      ["error", "warn"],
    );
    assert.deepEqual(
      logger.queryLogs({ level: "ERROR", limit: 10 }).logs.map((entry) => entry.level),
      ["error"],
    );
  });

  it("redacts sensitive values and applies limit", () => {
    const logger = AppLoggerService.createForTest(10);

    logger.debug("safe");
    logger.error(
      "Authorization: Bearer token-value-123 api_key=sk-testsecret123456 password=hunter2",
      "Trace token=abc.def.ghi secret: hidden",
      "Auth",
    );

    const result = logger.queryLogs({ level: "all", limit: 1 });
    const entry = result.logs[0];

    assert.equal(result.logs.length, 1);
    assert.equal(entry?.context, "Auth");
    assert.match(entry?.message ?? "", /Bearer \[redacted\]/);
    assert.match(entry?.message ?? "", /\[redacted-api-key\]/);
    assert.match(entry?.message ?? "", /password=\[redacted\]/);
    assert.match(entry?.trace ?? "", /token=\[redacted\]/);
    assert.match(entry?.trace ?? "", /secret: \[redacted\]/);
  });
});
