/**
 * Bootstrap that must run before any AI SDK imports.
 * Goal: never let warnings/log spam corrupt the Ink TUI (and break scrollback).
 */

// Disable AI SDK warning logging (AI SDK checks this global at runtime)
(globalThis as any).AI_SDK_LOG_WARNINGS = false;

// Also disable optional SDK noise via env vars if honored
process.env.AI_SDK_TELEMETRY = process.env.AI_SDK_TELEMETRY ?? "0";
process.env.AI_SDK_MIDDLEWARE_LOGGING =
  process.env.AI_SDK_MIDDLEWARE_LOGGING ?? "0";

function shouldSuppress(text: string): boolean {
  // AI SDK warning banner + temperature warnings
  if (text.includes("AI SDK Warning System:")) return true;
  if (text.includes("AI SDK Warning")) return true;
  if (text.includes('The feature "temperature" is not supported')) return true;

  // Raw OpenAI/AI-SDK rate limit object dumps (these destroy Ink output)
  if (text.includes("rate_limit_exceeded")) return true;
  if (text.includes("tokens per min") || text.includes("TPM): Limit"))
    return true;
  if (text.includes("sequence_number") && text.includes("rate_limit"))
    return true;

  return false;
}

function wrapWrite(
  original: typeof process.stdout.write
): typeof process.stdout.write {
  return function (this: any, chunk: any, encoding?: any, cb?: any): boolean {
    try {
      const text =
        typeof chunk === "string"
          ? chunk
          : chunk?.toString?.(encoding ?? "utf8");
      if (typeof text === "string" && shouldSuppress(text)) {
        if (typeof cb === "function") cb();
        return true;
      }
    } catch {
      // ignore
    }
    return (original as any).call(this, chunk, encoding, cb);
  } as any;
}

// Filter both streams to prevent *any* dependency output from corrupting Ink.
process.stdout.write = wrapWrite(process.stdout.write.bind(process.stdout));
process.stderr.write = wrapWrite(process.stderr.write.bind(process.stderr));
