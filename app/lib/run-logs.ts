import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
