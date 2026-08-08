import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function serializeError(error: unknown, depth = 0): unknown {
  if (!(error instanceof Error)) return { value: String(error) };

  const details: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  const errorRecord = error as Error & Record<string, unknown>;
  for (const key of [
    "code",
    "statusCode",
    "stderr",
    "stdout",
    "responseBody",
  ]) {
    if (errorRecord[key] !== undefined) details[key] = errorRecord[key];
  }
  if (error.cause !== undefined && depth < 3) {
    details.cause = serializeError(error.cause, depth + 1);
  }
  return details;
}

export async function createRunLog(runId: string) {
  const baseDirectory =
    process.env.AUTO_BELI_LOG_DIR ?? path.join(process.cwd(), "logs");
  const directory = path.join(baseDirectory, runId);
  await mkdir(directory, { recursive: true });

  return {
    directory,
    async write(name: string, value: unknown) {
      await writeFile(
        path.join(directory, `${name}.json`),
        `${JSON.stringify(value, null, 2)}\n`,
        "utf8",
      );
    },
  };
}
