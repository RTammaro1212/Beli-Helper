import { NextResponse } from "next/server";
import { z } from "zod";

import {
    pauseBeliAutomation,
    resumeBeliAutomation,
} from "../../../lib/beli-automation";

export const runtime = "nodejs";

const controlRequestSchema = z.object({
    sessionId: z.string().uuid(),
    action: z.enum(["pause", "resume"]),
});

function isLocalRequest(request: Request) {
    return ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(request.url).hostname,
    );
}

export async function POST(request: Request) {
    try {
        if (!isLocalRequest(request)) {
            return NextResponse.json(
                { error: "This action is only available locally." },
                { status: 403 },
            );
        }
        const input = controlRequestSchema.parse(await request.json());
        const session =
            input.action === "pause"
                ? pauseBeliAutomation(input.sessionId)
                : resumeBeliAutomation(input.sessionId);
        if (!session) {
            return NextResponse.json(
                { error: `Ranking cannot ${input.action} from its current state.` },
                { status: 409 },
            );
        }
        return NextResponse.json(session);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "The ranking control is invalid." },
                { status: 400 },
            );
        }
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not control ranking.",
            },
            { status: 500 },
        );
    }
}
