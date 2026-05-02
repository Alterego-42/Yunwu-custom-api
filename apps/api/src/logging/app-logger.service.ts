import { ConsoleLogger, Injectable, type LoggerService } from "@nestjs/common";

export type AppLogLevel = "error" | "warn" | "log" | "debug" | "verbose";
export type AppLogLevelQuery = AppLogLevel | "info" | "warning" | "all" | string;

export interface AppLogEntry {
  id: number;
  timestamp: string;
  level: AppLogLevel;
  context?: string;
  message: string;
  trace?: string;
}

export interface AppLogQuery {
  level?: AppLogLevelQuery;
  limit?: number;
  search?: string;
}

export interface AppLogsResponse {
  logs: AppLogEntry[];
  total: number;
  limit: number;
}

const DEFAULT_BUFFER_SIZE = 500;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const LEVEL_RANK: Record<AppLogLevel, number> = {
  verbose: 0,
  debug: 1,
  log: 2,
  warn: 3,
  error: 4,
};

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly consoleLogger = new ConsoleLogger();
  private bufferSize = DEFAULT_BUFFER_SIZE;
  private readonly buffer: AppLogEntry[] = [];
  private nextId = 1;

  constructor() {
    this.consoleLogger.setLogLevels([
      "error",
      "warn",
      "log",
      "debug",
      "verbose",
    ]);
  }

  static createForTest(bufferSize: number) {
    const logger = new AppLoggerService();
    logger.bufferSize = Math.max(1, bufferSize);
    return logger;
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    const entry = this.capture("log", message, optionalParams);
    this.consoleLogger.log(entry.message, ...this.contextParam(entry));
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    const entry = this.capture("error", message, optionalParams);
    this.consoleLogger.error(entry.message, ...this.errorParams(entry));
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    const entry = this.capture("warn", message, optionalParams);
    this.consoleLogger.warn(entry.message, ...this.contextParam(entry));
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    const entry = this.capture("debug", message, optionalParams);
    this.consoleLogger.debug(entry.message, ...this.contextParam(entry));
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    const entry = this.capture("verbose", message, optionalParams);
    this.consoleLogger.verbose(entry.message, ...this.contextParam(entry));
  }

  queryLogs(query: AppLogQuery = {}): AppLogsResponse {
    const level = this.normalizeLevel(query.level);
    const limit = this.normalizeLimit(query.limit);
    const search = query.search?.trim().toLowerCase();
    const matchesLevel = (entry: AppLogEntry) =>
      level === "all" || LEVEL_RANK[entry.level] >= LEVEL_RANK[level];

    const logs = this.buffer
      .filter(matchesLevel)
      .filter((entry) => {
        if (!search) {
          return true;
        }

        return [
          entry.level,
          entry.context ?? "",
          entry.message,
          entry.trace ?? "",
        ]
          .join("\n")
          .toLowerCase()
          .includes(search);
      });

    return {
      logs: logs.slice(-limit).reverse(),
      total: logs.length,
      limit,
    };
  }

  clearForTest() {
    this.buffer.length = 0;
    this.nextId = 1;
  }

  private capture(
    level: AppLogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): AppLogEntry {
    const { context, trace, extras } = this.parseOptionalParams(
      level,
      optionalParams,
    );
    const renderedMessage = this.renderMessage(message, extras);
    const entry: AppLogEntry = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      level,
      ...(context ? { context: this.sanitize(context) } : {}),
      message: this.sanitize(renderedMessage),
      ...(trace ? { trace: this.sanitize(trace) } : {}),
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.splice(0, this.buffer.length - this.bufferSize);
    }

    return entry;
  }

  private parseOptionalParams(level: AppLogLevel, optionalParams: unknown[]) {
    const params = [...optionalParams];
    const context =
      typeof params.at(-1) === "string" ? String(params.pop()) : undefined;
    const trace =
      level === "error" && typeof params.at(-1) === "string"
        ? String(params.pop())
        : undefined;

    return { context, trace, extras: params };
  }

  private renderMessage(message: unknown, extras: unknown[]) {
    const parts = [message, ...extras].map((part) => this.stringify(part));
    return parts.filter((part) => part.length > 0).join(" ");
  }

  private stringify(value: unknown): string {
    if (value instanceof Error) {
      return value.stack ?? value.message;
    }
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private sanitize(value: string) {
    return value
      .replace(
        /\b(authorization)(["'\s:=]+)Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
        "$1$2Bearer [redacted]",
      )
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
      .replace(
        /\b(api[_-]?key)(["'\s:=]+)([^"',\s}]+)/gi,
        "$1$2[redacted-api-key]",
      )
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted-api-key]")
      .replace(
        /\b(token|password|secret)(["'\s:=]+)([^"',\s}]+)/gi,
        "$1$2[redacted]",
      )
      .replace(
        /\b(authorization)(["'\s:=]+)(?!Bearer\b)([^"',\s}]+)/gi,
        "$1$2[redacted]",
      )
      .replace(
        /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
        "[redacted-token]",
      )
      .replace(/[A-Za-z0-9+/=_-]{64,}/g, "[redacted-token]");
  }

  private normalizeLevel(level?: AppLogLevelQuery): AppLogLevel | "all" {
    switch (level?.trim().toLowerCase()) {
      case "all":
        return "all";
      case "error":
        return "error";
      case "warn":
      case "warning":
        return "warn";
      case "info":
      case "log":
        return "log";
      case "debug":
        return "debug";
      case "verbose":
        return "verbose";
      default:
        return "debug";
    }
  }

  private normalizeLimit(limit?: number) {
    if (typeof limit !== "number" || !Number.isFinite(limit)) {
      return DEFAULT_LIMIT;
    }

    return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
  }

  private contextParam(entry: AppLogEntry): [string] | [] {
    return entry.context ? [entry.context] : [];
  }

  private errorParams(
    entry: AppLogEntry,
  ): [string, string] | [string] | [undefined, string] | [] {
    if (entry.trace) {
      return entry.context ? [entry.trace, entry.context] : [entry.trace];
    }
    return entry.context ? [undefined, entry.context] : [];
  }
}
