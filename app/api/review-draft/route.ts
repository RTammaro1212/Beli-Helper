import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { REVIEW_STYLE_PROMPT } from "@/app/lib/review-style";

export const runtime = "nodejs";
export const maxDuration = 300;

const CODEX_MODEL = "gpt-5.6-luna";
const CODEX_PATHS = [
    process.env.AUTO_BELI_CODEX_PATH,
    "/Applications/ChatGPT.app/Contents/Resources/codex",
    "/Applications/Codex.app/Contents/Resources/codex",
].filter((path): path is string => Boolean(path));

const requestSchema = z.object({
    restaurantName: z.string().min(1).max(200),
    rating: z.enum(["liked", "fine", "disliked"]),
    companions: z.array(z.string().min(1).max(100)).max(20),
    labels: z.array(z.string().min(1).max(100)).max(100),
    rawNotes: z.string().max(8_000),
    dishes: z.array(z.string().min(1).max(200)).max(100),
    favoriteDishes: z.array(z.string().min(1).max(200)).max(100),
});

function isLocalRequest(request: Request) {
    return ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(request.url).hostname,
    );
}

async function resolveCodexPath() {
    for (const path of CODEX_PATHS) {
        try {
            await access(path, constants.X_OK);
            return path;
        } catch {
            // Try the next installed ChatGPT/Codex location.
        }
    }
    return "codex";
}

export async function POST(request: Request) {
    if (!isLocalRequest(request)) {
        return NextResponse.json(
            { error: "Review drafting is only available locally." },
            { status: 403 },
        );
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json(
            { error: "The review details could not be read." },
            { status: 400 },
        );
    }

    try {
        const { codexExec } = await import("ai-sdk-provider-codex-cli");
        const result = await generateText({
            model: codexExec(CODEX_MODEL, {
                allowNpx: false,
                codexPath: await resolveCodexPath(),
                skipGitRepoCheck: true,
                approvalMode: "never",
                sandboxMode: "read-only",
                reasoningEffort: "medium",
            }),
            system: REVIEW_STYLE_PROMPT,
            prompt: [
                `Restaurant: ${parsed.data.restaurantName}`,
                `Reaction: ${parsed.data.rating}`,
                `Who went: ${parsed.data.companions.join(", ") || "not supplied"}`,
                `Beli labels: ${parsed.data.labels.join(", ") || "none supplied"}`,
                `Dishes shown: ${parsed.data.dishes.join(", ") || "none supplied"}`,
                `Favorite dishes: ${parsed.data.favoriteDishes.join(", ") || "none supplied"}`,
                `Ryan's raw thoughts:\n${parsed.data.rawNotes || "No additional thoughts supplied."}`,
            ].join("\n\n"),
            include: {
                requestBody: false,
                requestMessages: false,
                responseBody: false,
            },
        });
        const draft = result.text.trim();
        if (!draft) throw new Error("ChatGPT returned an empty draft.");
        return NextResponse.json({ draft, model: CODEX_MODEL });
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? `ChatGPT could not write this draft: ${error.message}`
                        : "ChatGPT could not write this draft.",
            },
            { status: 500 },
        );
    }
}

