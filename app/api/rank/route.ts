import { NextResponse } from "next/server";

import { openRankingWorkspace } from "../../lib/mac-window-manager";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const hostname = new URL(request.url).hostname;
        if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
            return NextResponse.json(
                { error: "This action is only available locally." },
                { status: 403 },
            );
        }
        await openRankingWorkspace();
        return NextResponse.json({ ok: true });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Could not open the ranking workspace.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
