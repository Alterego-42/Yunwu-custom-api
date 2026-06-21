export type PromptDispatchParseResult =
  | {
      status: "plain";
      prompts: [];
      reason?: undefined;
    }
  | {
      status: "parsed";
      prompts: string[];
      reason?: undefined;
    }
  | {
      status: "invalid";
      prompts: [];
      reason: string;
    };

type ObjectChunk = {
  start: number;
  end: number;
  content: string;
};

function hasJsonLikeMarkers(value: string) {
  return value.includes("{") || value.includes("}");
}

function isAllowedSeparator(value: string) {
  return /^[\s,[\]]*$/.test(value);
}

function readQuotedString(value: string, startIndex: number) {
  const quote = value[startIndex];
  if (quote !== "\"" && quote !== "'") {
    return null;
  }

  let output = "";
  for (let index = startIndex + 1; index < value.length; index += 1) {
    const character = value[index];

    if (character === "\\") {
      const next = value[index + 1];
      if (next === undefined) {
        return null;
      }

      if (next === "n") {
        output += "\n";
      } else if (next === "r") {
        output += "\r";
      } else if (next === "t") {
        output += "\t";
      } else {
        output += next;
      }
      index += 1;
      continue;
    }

    if (character === quote) {
      return {
        value: output,
        endIndex: index + 1,
      };
    }

    output += character;
  }

  return null;
}

function collectObjectChunks(value: string) {
  const chunks: ObjectChunk[] = [];
  let quote: "\"" | "'" | null = null;
  let escaped = false;
  let depth = 0;
  let objectStart = -1;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
      continue;
    }

    if (character === "}") {
      if (depth === 0) {
        return {
          chunks: [],
          error: "对象括号不匹配。",
        };
      }

      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        chunks.push({
          start: objectStart,
          end: index + 1,
          content: value.slice(objectStart + 1, index),
        });
        objectStart = -1;
      }
    }
  }

  if (quote) {
    return {
      chunks: [],
      error: "字符串引号未闭合。",
    };
  }

  if (depth !== 0) {
    return {
      chunks: [],
      error: "对象括号未闭合。",
    };
  }

  return { chunks };
}

function validateObjectSeparators(value: string, chunks: ObjectChunk[]) {
  let cursor = 0;

  for (const chunk of chunks) {
    if (!isAllowedSeparator(value.slice(cursor, chunk.start))) {
      return false;
    }
    cursor = chunk.end;
  }

  return isAllowedSeparator(value.slice(cursor));
}

function extractPrompt(content: string) {
  const keyPattern = /(?:^|[,\s])(?:"prompt"|'prompt'|prompt)\s*:/g;
  const match = keyPattern.exec(content);
  if (!match) {
    return null;
  }

  let cursor = match.index + match[0].length;
  while (cursor < content.length && /\s/.test(content[cursor] ?? "")) {
    cursor += 1;
  }

  const parsedString = readQuotedString(content, cursor);
  if (!parsedString) {
    return null;
  }

  return parsedString.value.trim();
}

export function parsePromptDispatchInput(input: string): PromptDispatchParseResult {
  const trimmedInput = input.trim();
  if (!trimmedInput || !hasJsonLikeMarkers(trimmedInput)) {
    return {
      status: "plain",
      prompts: [],
    };
  }

  const { chunks, error } = collectObjectChunks(trimmedInput);
  if (error) {
    return {
      status: "invalid",
      prompts: [],
      reason: error,
    };
  }

  if (!chunks || chunks.length === 0) {
    return {
      status: "invalid",
      prompts: [],
      reason: "未找到可解析的对象。",
    };
  }

  if (!validateObjectSeparators(trimmedInput, chunks)) {
    return {
      status: "invalid",
      prompts: [],
      reason: "对象之间只能使用逗号或数组括号分隔。",
    };
  }

  const prompts: string[] = [];
  for (const chunk of chunks) {
    const prompt = extractPrompt(chunk.content);
    if (!prompt) {
      return {
        status: "invalid",
        prompts: [],
        reason: "每个对象都需要提供非空 prompt 字符串。",
      };
    }
    prompts.push(prompt);
  }

  return {
    status: "parsed",
    prompts,
  };
}
