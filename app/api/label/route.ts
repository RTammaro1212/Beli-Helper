import { NextResponse } from "next/server";

import { searchNearbyFoodPlaces } from "@/app/lib/places";
import { matchRestaurant } from "@/app/lib/restaurant-matcher";
import { createRunLog } from "@/app/lib/run-logs";
import {
  labelStackRequestSchema,
  labelStackResponseSchema,
} from "@/app/lib/stack-schema";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const parsed = labelStackRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid stack data" }, { status: 400 });
  }

  const input = parsed.data;
  const log = await createRunLog(input.runId);

  try {
    await log.write(`${input.stackId}-request`, {
      runId: input.runId,
      stackId: input.stackId,
      coordinate: input.coordinate,
      photos: input.photos.map((photo) => ({
        id: photo.id,
        name: photo.name,
        takenAt: photo.takenAt,
        mediaType: photo.mediaType,
        encodedBytes: photo.data.length,
      })),
    });

    const placesSearch = await searchNearbyFoodPlaces(input.coordinate);
    await log.write(`${input.stackId}-places`, placesSearch);
    const match = await matchRestaurant({
      runId: input.runId,
      photos: input.photos,
      places: placesSearch.places,
      log,
    });
    const response = labelStackResponseSchema.parse({
      placesSearch,
      match,
      logDirectory: log.directory,
    });
    await log.write(`${input.stackId}-result`, response);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Labeling failed";
    await log.write(`${input.stackId}-error`, { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
