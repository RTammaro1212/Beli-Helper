import { NextResponse } from "next/server";

import {
    MacWindowManagerError,
    openRankingWorkspace,
} from "../../../lib/mac-window-manager";

export const runtime = "nodejs";

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
        await openRankingWorkspace();
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof MacWindowManagerError) {
            return NextResponse.json(
                { code: error.code, error: error.message },
                { status: error.code === "accessibility_required" ? 409 : 500 },
            );
        }
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not reopen the ranking workspace.",
            },
            { status: 500 },
        );
    }
}
