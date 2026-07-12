export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/** Structured, scoped logger — one instance per package/module (e.g. createLogger("meta-ads-specialist")). */
export function createLogger(scope: string) {
  return {
    debug: (message: string, fields?: LogFields) => emit("debug", scope, message, fields),
    info: (message: string, fields?: LogFields) => emit("info", scope, message, fields),
    warn: (message: string, fields?: LogFields) => emit("warn", scope, message, fields),
    error: (message: string, fields?: LogFields) => emit("error", scope, message, fields),
  };
}

export type Logger = ReturnType<typeof createLogger>;
