import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { LabelPhotoInput } from "./photo-types";
import {
  MEAL_CATEGORIES,
  mealCategorySchema,
  type GooglePlace,
  type LabelMatch,
  type LabelProvider,
  type PlaceCandidate,
} from "./stack-schema";

const execFileAsync = promisify(execFile);
const CODEX_MODEL = "gpt-5.6-luna";
const OPENROUTER_MODEL = "openai/gpt-5.6-luna";
const MINIMUM_CODEX_VERSION = [0, 144, 0] as const;

type MatchLogger = {
  write: (name: string, value: unknown) => Promise<void>;
};

function parseVersion(value: string) {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function isCompatibleVersion(version: number[] | null) {
  if (!version) return false;
  for (let index = 0; index < MINIMUM_CODEX_VERSION.length; index += 1) {
    if (version[index] > MINIMUM_CODEX_VERSION[index]) return true;
    if (version[index] < MINIMUM_CODEX_VERSION[index]) return false;
  }
  return true;
}

async function inspectCodex() {
  if (Number(process.versions.node.split(".")[0]) < 22) {
    return {
      available: false as const,
      reason: "The Codex provider requires Node.js 22 or newer",
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync("codex", ["--version"], {
      timeout: 5_000,
    });
    const versionOutput = `${stdout} ${stderr}`.trim();
    if (!isCompatibleVersion(parseVersion(versionOutput))) {
      return {
        available: false as const,
        reason: `Codex ${versionOutput || "version unknown"} is older than 0.144.0`,
      };
    }
    return { available: true as const, versionOutput };
  } catch (error) {
    return {
      available: false as const,
      reason: error instanceof Error ? error.message : "Codex is unavailable",
    };
  }
}

export async function getLabelRuntime() {
  const codex = await inspectCodex();
  return {
    provider: (codex.available ? "codex-cli" : "openrouter") as LabelProvider,
    codex,
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    googlePlacesConfigured: Boolean(process.env.GOOGLE_MAPS_PLACES_API_KEY),
  };
}

function imageParts(photos: LabelPhotoInput[]) {
  return photos.map((photo) => ({
    type: "file" as const,
    mediaType: photo.mediaType,
    data: Uint8Array.from(Buffer.from(photo.data, "base64")),
  }));
}

function placeSummary(place: GooglePlace) {
  return {
    placeId: place.id,
    name: place.displayName?.text,
    address: place.formattedAddress,
    types: place.types,
    primaryType: place.primaryType,
    location: place.location,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    priceLevel: place.priceLevel,
    websiteUri: place.websiteUri,
    editorialSummary: place.editorialSummary?.text,
    services: {
      takeout: place.takeout,
      delivery: place.delivery,
      dineIn: place.dineIn,
      servesBreakfast: place.servesBreakfast,
      servesLunch: place.servesLunch,
      servesDinner: place.servesDinner,
      servesCoffee: place.servesCoffee,
      servesDessert: place.servesDessert,
      servesBeer: place.servesBeer,
      servesWine: place.servesWine,
    },
  };
}

async function runMatch(
  provider: LabelProvider,
  photos: LabelPhotoInput[],
  places: GooglePlace[],
  log: MatchLogger,
) {
  const outputCount = Math.min(5, places.length);
  const schema = z.object({
    category: mealCategorySchema,
    candidates: z
      .array(
        z.object({
          placeId: z.string(),
          confidence: z.number().min(0).max(1),
          reason: z.string(),
        }),
      )
      .length(outputCount),
  });
  const prompt = [
    "Identify which nearby food business these meal photos most likely came from.",
    `Classify the meal as exactly one of these categories: ${MEAL_CATEGORIES.join(", ")}.`,
    `Return exactly ${outputCount} candidates, ordered most to least likely.`,
    "Every placeId must come from the provided list and each candidate must be unique. Consider visual cuisine, menus, branding, decor, GPS proximity, place type, and business details. Keep each reason short.",
    `Nearby places:\n${JSON.stringify(places.map(placeSummary))}`,
  ].join("\n\n");
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: prompt },
        ...imageParts(photos),
      ],
    },
  ];

  if (provider === "codex-cli") {
    const providerLogs: string[] = [];
    const { codexExec } = await import("ai-sdk-provider-codex-cli");
    const result = await generateText({
      model: codexExec(CODEX_MODEL, {
        allowNpx: false,
        skipGitRepoCheck: true,
        approvalMode: "never",
        sandboxMode: "read-only",
        reasoningEffort: "medium",
        logger: {
          debug: (message) => providerLogs.push(`debug ${message}`),
          info: (message) => providerLogs.push(`info ${message}`),
          warn: (message) => providerLogs.push(`warn ${message}`),
          error: (message) => providerLogs.push(`error ${message}`),
        },
      }),
      output: Output.object({ schema }),
      messages,
      include: {
        requestBody: false,
        requestMessages: false,
        responseBody: false,
      },
    });
    await log.write("codex-provider", { logs: providerLogs });
    return { output: result.output, model: CODEX_MODEL };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const openrouter = createOpenRouter({ apiKey });
  const result = await generateText({
    model: openrouter(OPENROUTER_MODEL),
    output: Output.object({ schema }),
    messages,
    providerOptions: {
      openrouter: {
        reasoning: { effort: "medium", exclude: true },
      },
    },
    include: {
      requestBody: false,
      requestMessages: false,
      responseBody: false,
    },
  });
  return { output: result.output, model: OPENROUTER_MODEL };
}

export async function matchRestaurant({
  runId,
  photos,
  places,
  log,
}: {
  runId: string;
  photos: LabelPhotoInput[];
  places: GooglePlace[];
  log: MatchLogger;
}): Promise<LabelMatch> {
  if (!places.length) throw new Error("No nearby food places were found");

  const runtime = await getLabelRuntime();
  await log.write("runtime", runtime);
  let provider = runtime.provider;
  let generated: Awaited<ReturnType<typeof runMatch>>;

  try {
    generated = await runMatch(provider, photos, places, log);
  } catch (error) {
    if (provider !== "codex-cli" || !process.env.OPENROUTER_API_KEY) throw error;
    await log.write("codex-fallback", {
      message: error instanceof Error ? error.message : String(error),
    });
    provider = "openrouter";
    generated = await runMatch(provider, photos, places, log);
  }

  const placesById = new Map(
    places.map((place) => [place.id!, place] as const),
  );
  const seenPlaceIds = new Set<string>();
  const candidates = generated.output.candidates.flatMap((candidate) => {
    const place = placesById.get(candidate.placeId);
    if (!place || seenPlaceIds.has(candidate.placeId)) return [];
    seenPlaceIds.add(candidate.placeId);
    return [
      {
        ...candidate,
        name: place.displayName!.text!,
        address: place.formattedAddress ?? undefined,
        place,
      } satisfies PlaceCandidate,
    ];
  });

  const expectedCandidates = Math.min(5, places.length);
  if (candidates.length !== expectedCandidates) {
    throw new Error(
      `The model did not return ${expectedCandidates} valid nearby places`,
    );
  }

  return {
    runId,
    provider,
    model: generated.model,
    category: generated.output.category,
    candidates,
    selected: {
      placeId: candidates[0].placeId,
      name: candidates[0].name,
      source: "model",
    },
    labeledAt: new Date().toISOString(),
  };
}
