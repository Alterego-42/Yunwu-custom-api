import { describe, expect, it } from "vitest";

import { parsePromptDispatchInput } from "@/lib/prompt-dispatch";

describe("prompt dispatch parser", () => {
  it("treats ordinary text as a plain prompt", () => {
    expect(parsePromptDispatchInput("draw a quiet mountain")).toEqual({
      status: "plain",
      prompts: [],
    });
  });

  it("parses json-like prompt objects separated by commas", () => {
    expect(
      parsePromptDispatchInput('{prompt:"first prompt"},{prompt:"second prompt"}'),
    ).toEqual({
      status: "parsed",
      prompts: ["first prompt", "second prompt"],
    });
  });

  it("parses array-wrapped prompt objects with quoted keys", () => {
    expect(
      parsePromptDispatchInput('[{"prompt":"first"},{"prompt":"second"}]'),
    ).toEqual({
      status: "parsed",
      prompts: ["first", "second"],
    });
  });

  it("parses single quoted values and unescapes common string escapes", () => {
    expect(
      parsePromptDispatchInput("{prompt:'line one\\nline two with \\'quote\\''}"),
    ).toEqual({
      status: "parsed",
      prompts: ["line one\nline two with 'quote'"],
    });
  });

  it("rejects json-like input without prompt fields", () => {
    const result = parsePromptDispatchInput('{text:"missing prompt"}');

    expect(result.status).toBe("invalid");
  });

  it("rejects extra text outside the object list", () => {
    const result = parsePromptDispatchInput('before {prompt:"first"}');

    expect(result.status).toBe("invalid");
  });
});
