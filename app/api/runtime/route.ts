import { getLabelRuntime } from "@/app/lib/restaurant-matcher";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getLabelRuntime());
}
