import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const PLACES_REQUEST_LIMIT = 999;
const ROLLING_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;

type UsageState = {
    timestamps: number[];
};

let reservationQueue = Promise.resolve();

function usageFilePath() {
    const directory =
        process.env.AUTO_BELI_LOG_DIR ?? path.join(process.cwd(), "logs");
    return path.join(directory, "google-places-usage.json");
}

async function readUsage(filePath: string): Promise<UsageState> {
    try {
        const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("timestamps" in parsed) ||
            !Array.isArray(parsed.timestamps) ||
            !parsed.timestamps.every(
                (timestamp) =>
                    typeof timestamp === "number" && Number.isFinite(timestamp),
            )
        ) {
            throw new Error("Google Places usage file is invalid");
        }
        return { timestamps: parsed.timestamps };
    } catch (error) {
        if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
        ) {
            return { timestamps: [] };
        }
        throw error;
    }
}

async function reserveRequest() {
    const filePath = usageFilePath();
    const now = Date.now();
    const cutoff = now - ROLLING_WINDOW_MS;
    const usage = await readUsage(filePath);
    const activeTimestamps = usage.timestamps.filter(
        (timestamp) => timestamp > cutoff && timestamp <= now,
    );

    if (activeTimestamps.length >= PLACES_REQUEST_LIMIT) {
        throw new Error(
            `Google Places safety limit reached (${PLACES_REQUEST_LIMIT} requests in the last 31 days)`,
        );
    }

    activeTimestamps.push(now);
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(
        temporaryPath,
        `${JSON.stringify({ timestamps: activeTimestamps }, null, 2)}\n`,
        { mode: 0o600 },
    );
    await rename(temporaryPath, filePath);
}

export function reserveGooglePlacesRequest() {
    const reservation = reservationQueue.then(reserveRequest);
    reservationQueue = reservation.then(
        () => undefined,
        () => undefined,
    );
    return reservation;
}
