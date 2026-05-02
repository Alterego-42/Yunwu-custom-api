import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  OpenAICompatibleService,
  PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE,
} from "../src/openai-compatible/openai-compatible.service";

function createConfig(
  pathValue?: string,
  options: { apiKey?: string; allowMockImages?: boolean } = {},
) {
  return {
    get(key: string) {
      if (key === "storage.local.path") {
        return pathValue;
      }
      if (key === "yunwu.apiKey") {
        return options.apiKey ?? "test-key";
      }
      if (key === "yunwu.allowMockImages") {
        return options.allowMockImages ?? false;
      }
      if (key === "storage.mode") {
        return "local";
      }

      return undefined;
    },
  };
}

function createConfigWithoutApiKey(options: { allowMockImages?: boolean } = {}) {
  return createConfig("./storage", {
    apiKey: "",
    allowMockImages: options.allowMockImages,
  });
}

function createProviderConfig() {
  return {
    getBaseUrl: async () => "https://yunwu.ai",
  };
}

test("getLocalStoragePath preserves absolute Windows paths", () => {
  const service = new OpenAICompatibleService(
    createConfig("C:\\temp\\yunwu-storage") as never,
    createProviderConfig() as never,
  );

  assert.equal(
    service["getLocalStoragePath"](),
    "C:\\temp\\yunwu-storage",
  );
});

test("getLocalStoragePath resolves relative paths from cwd", () => {
  const service = new OpenAICompatibleService(
    createConfig("./storage") as never,
    createProviderConfig() as never,
  );

  const resolved = service["getLocalStoragePath"]();
  assert.match(resolved, /[\\/]storage$/);
  assert.ok(!resolved.includes("C:\\temp\\yunwu-storage"));
});

test("createImageTask uses request-level baseUrl override", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (url: string) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ url: "https://example.com/generated.png" }],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const service = new OpenAICompatibleService(
      createConfig("./storage") as never,
      createProviderConfig() as never,
    );

    await service.createImageTask({
      capability: "image.generate",
      model: "gpt-image-2",
      prompt: "test",
      baseUrl: "https://api3.wlai.vip",
    });

    assert.equal(
      requestedUrl,
      "https://api3.wlai.vip/v1/images/generations",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createImageTask fails closed without an API key by default", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  }) as typeof fetch;

  try {
    const service = new OpenAICompatibleService(
      createConfigWithoutApiKey() as never,
      createProviderConfig() as never,
    );

    await assert.rejects(
      () =>
        service.createImageTask({
          capability: "image.generate",
          model: "gpt-image-2",
          prompt: "test",
        }),
      (error: unknown) => {
        assert(error instanceof Error);
        assert.equal(error.message, PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE);
        return true;
      },
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createImageTask only returns mock images when explicitly enabled", async () => {
  const service = new OpenAICompatibleService(
    createConfigWithoutApiKey({ allowMockImages: true }) as never,
    createProviderConfig() as never,
  );

  const result = await service.createImageTask({
    capability: "image.generate",
    model: "gpt-image-2",
    prompt: "test",
  });

  assert.equal(result.mocked, true);
  assert.match(result.url, /^https:\/\/picsum\.photos\/seed\//);
  assert.equal(result.responseSummary.mocked, true);
  assert.equal(result.responseSummary.mode, "mock");
});

test("checkProviderModels can explicitly skip the global API key fallback", async () => {
  const originalFetch = globalThis.fetch;
  const authorizations: string[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const authorization = (init?.headers as Record<string, string> | undefined)
      ?.Authorization;
    if (authorization) {
      authorizations.push(authorization);
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response;
  }) as typeof fetch;

  try {
    const service = new OpenAICompatibleService(
      createConfig("./storage", { apiKey: "sk-global-secret-123456" }) as never,
      createProviderConfig() as never,
    );

    const result = await service.checkProviderModels({
      baseUrl: "https://yunwu.ai",
      apiKey: null,
    });

    assert.equal(result.baseUrlReachable, true);
    assert.equal(result.error?.category, "missing_api_key");
    assert.deepEqual(authorizations, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createImageTask posts image generation body with task prompt and model", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedBody: Record<string, unknown> | undefined;
  let requestedContentType = "";

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requestedUrl = url;
    requestedContentType = String(
      (init?.headers as Record<string, string> | undefined)?.["Content-Type"] ??
        "",
    );
    requestedBody = JSON.parse(String(init?.body));

    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ url: "https://example.com/generated.png" }],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const service = new OpenAICompatibleService(
      createConfig("./storage") as never,
      createProviderConfig() as never,
    );

    const result = await service.createImageTask({
      capability: "image.generate",
      model: "gpt-image-2",
      prompt: "draw an orange fox holding a blue umbrella",
      baseUrl: "https://api3.wlai.vip/v1/",
      params: {
        prompt: "",
        model: "wrong-model",
        image: "https://example.com/should-not-be-sent.png",
        size: "1280x720",
      },
    });

    assert.equal(
      requestedUrl,
      "https://api3.wlai.vip/v1/images/generations",
    );
    assert.equal(requestedContentType, "application/json");
    assert.deepEqual(requestedBody, {
      size: "1280x720",
      model: "gpt-image-2",
      prompt: "draw an orange fox holding a blue umbrella",
    });
    assert.equal(result.width, 1280);
    assert.equal(result.height, 720);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createImageTask posts image edit multipart with prompt, model, and image file", async () => {
  const originalFetch = globalThis.fetch;
  const tempDir = await mkdtemp(join(tmpdir(), "yunwu-image-edit-"));
  const inputPath = join(tempDir, "asset.png");
  await writeFile(inputPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  let requestedUrl = "";
  let requestedBody: FormData | undefined;
  let requestedContentTypeHeader: string | undefined;

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requestedUrl = url;
    requestedBody = init?.body as FormData;
    requestedContentTypeHeader = (
      init?.headers as Record<string, string> | undefined
    )?.["Content-Type"];

    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ b64_json: Buffer.from("png").toString("base64") }],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const service = new OpenAICompatibleService(
      createConfig(tempDir) as never,
      createProviderConfig() as never,
    );

    const result = await service.createImageTask({
      capability: "image.edit",
      model: "gpt-image-2",
      prompt: "turn the subject into a watercolor portrait",
      baseUrl: "https://api3.wlai.vip",
      inputAssets: [
        {
          id: "asset-1",
          mimeType: "image/png",
          storageKey: "asset.png",
        },
      ],
      params: {
        prompt: "",
        model: "wrong-model",
        image: "https://example.com/should-not-be-sent.png",
        size: "1024x1536",
      },
    });

    assert.equal(requestedUrl, "https://api3.wlai.vip/v1/images/edits");
    assert.equal(
      requestedContentTypeHeader,
      undefined,
      "fetch must let FormData set multipart boundary",
    );
    assert.ok(requestedBody instanceof FormData);
    assert.equal(requestedBody.get("model"), "gpt-image-2");
    assert.equal(
      requestedBody.get("prompt"),
      "turn the subject into a watercolor portrait",
    );
    assert.equal(requestedBody.get("size"), "1024x1536");
    assert.equal(result.width, 1024);
    assert.equal(result.height, 1536);
    const image = requestedBody.get("image");
    assert.ok(image instanceof File);
    assert.equal(image.name, "asset.png");
    assert.equal(image.type, "image/png");
    assert.deepEqual(
      Array.from(new Uint8Array(await image.arrayBuffer())),
      [0x89, 0x50, 0x4e, 0x47],
    );
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createImageTask posts Gemini image edit as multimodal chat JSON with data URL input", async () => {
  const originalFetch = globalThis.fetch;
  const tempDir = await mkdtemp(join(tmpdir(), "yunwu-gemini-image-edit-"));
  const inputPath = join(tempDir, "asset.png");
  await writeFile(inputPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  let requestedUrl = "";
  let requestedBody: Record<string, unknown> | undefined;
  let requestedContentTypeHeader = "";

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requestedUrl = url;
    requestedContentTypeHeader = String(
      (init?.headers as Record<string, string> | undefined)?.["Content-Type"] ??
        "",
    );
    requestedBody = JSON.parse(String(init?.body));

    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: "https://example.com/gemini-edited.png",
                  },
                },
              ],
            },
          },
        ],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const service = new OpenAICompatibleService(
      createConfig(tempDir) as never,
      createProviderConfig() as never,
    );

    const result = await service.createImageTask({
      capability: "image.edit",
      model: "gemini-3-pro-image-preview",
      prompt: "turn the subject into a watercolor portrait",
      baseUrl: "https://api3.wlai.vip/v1/",
      inputAssets: [
        {
          id: "asset-1",
          mimeType: "image/png",
          storageKey: "asset.png",
        },
      ],
      params: {
        prompt: "",
        model: "wrong-model",
        image: "https://example.com/should-not-be-sent.png",
      },
    });

    assert.equal(requestedUrl, "https://api3.wlai.vip/v1/chat/completions");
    assert.equal(requestedContentTypeHeader, "application/json");
    assert.deepEqual(requestedBody, {
      model: "gemini-3-pro-image-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "turn the subject into a watercolor portrait",
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,iVBORw==",
              },
            },
          ],
        },
      ],
    });
    assert.equal(result.url, "https://example.com/gemini-edited.png");
    assert.equal(result.responseSummary.endpointPath, "/v1/chat/completions");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createImageTask parses Gemini image edit b64_json chat completions output", async () => {
  const originalFetch = globalThis.fetch;
  const tempDir = await mkdtemp(join(tmpdir(), "yunwu-gemini-image-edit-b64-"));
  const inputPath = join(tempDir, "asset.png");
  await writeFile(inputPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  globalThis.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                {
                  type: "image",
                  b64_json: Buffer.from("png").toString("base64"),
                  mimeType: "image/png",
                },
              ],
            },
          },
        ],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const service = new OpenAICompatibleService(
      createConfig(tempDir) as never,
      createProviderConfig() as never,
    );

    const result = await service.createImageTask({
      capability: "image.edit",
      model: "gemini-2.5-flash-image",
      prompt: "turn the subject into a watercolor portrait",
      baseUrl: "https://api3.wlai.vip",
      inputAssets: [
        {
          id: "asset-1",
          mimeType: "image/png",
          storageKey: "asset.png",
        },
      ],
    });

    assert.equal(
      result.url,
      `data:image/png;base64,${Buffer.from("png").toString("base64")}`,
    );
    assert.equal(result.mimeType, "image/png");
    assert.equal(result.responseSummary.hasBase64, true);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("extractImageResult parses chat content string JSON image URLs", () => {
  const service = new OpenAICompatibleService(
    createConfig("./storage") as never,
    createProviderConfig() as never,
  );

  const result = service["extractImageResult"]({
    choices: [
      {
        message: {
          content: JSON.stringify({
            image_url: {
              url: "https://example.com/content-string.png",
            },
          }),
        },
      },
    ],
  });

  assert.equal(result?.url, "https://example.com/content-string.png");
});

test("extractImageResult parses Gemini inline_data base64 output", () => {
  const service = new OpenAICompatibleService(
    createConfig("./storage") as never,
    createProviderConfig() as never,
  );
  const b64 = Buffer.from("png").toString("base64");

  const result = service["extractImageResult"]({
    choices: [
      {
        message: {
          content: [
            {
              inline_data: {
                mime_type: "image/png",
                data: b64,
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(result?.b64_json, b64);
  assert.equal(result?.mimeType, "image/png");
});

test("extractImageResult parses Gemini fileData file_uri output", () => {
  const service = new OpenAICompatibleService(
    createConfig("./storage") as never,
    createProviderConfig() as never,
  );

  const result = service["extractImageResult"]({
    choices: [
      {
        message: {
          content: [
            {
              fileData: {
                mimeType: "image/webp",
                fileUri: "https://example.com/gemini-file.webp",
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(result?.url, "https://example.com/gemini-file.webp");
  assert.equal(result?.mimeType, "image/webp");
});

test("extractImageResult parses Responses output_image URL output", () => {
  const service = new OpenAICompatibleService(
    createConfig("./storage") as never,
    createProviderConfig() as never,
  );

  const result = service["extractImageResult"]({
    output: [
      {
        content: [
          {
            type: "output_image",
            output_image: {
              url: "https://example.com/responses-output.png",
            },
          },
        ],
      },
    ],
  });

  assert.equal(result?.url, "https://example.com/responses-output.png");
});
