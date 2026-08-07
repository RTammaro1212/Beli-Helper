import exifr from "exifr";
import JSZip from "jszip";

import type { Photo, PhotoCluster } from "./photo-types";

const MAX_DISTANCE_METERS = 20;
const MAX_TIME_DIFFERENCE_MS = 4 * 60 * 60 * 1000;

const imageExtensions = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
]);

const browserPreviewExtensions = new Set([
  "avif",
  "bmp",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "webp",
]);

type CandidateFile = {
  blob: Blob;
  name: string;
  path: string;
};

export function extensionFor(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isImage(name: string) {
  return imageExtensions.has(extensionFor(name));
}

function isZip(name: string) {
  return extensionFor(name) === "zip";
}

async function unpackBlob(
  blob: Blob,
  name: string,
  path: string,
): Promise<CandidateFile[]> {
  if (!isZip(name)) {
    return isImage(name) ? [{ blob, name, path }] : [];
  }

  const archive = await JSZip.loadAsync(blob);
  const collected: CandidateFile[] = [];

  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue;

    const nestedBlob = await entry.async("blob");
    const nestedPath = `${path.replace(/\.zip$/i, "")}/${entry.name}`;
    if (isZip(entry.name)) {
      collected.push(...(await unpackBlob(nestedBlob, entry.name, nestedPath)));
    } else if (isImage(entry.name)) {
      collected.push({
        blob: nestedBlob,
        name: entry.name.split("/").pop() ?? entry.name,
        path: nestedPath,
      });
    }
  }

  return collected;
}

async function readPhoto(candidate: CandidateFile): Promise<Photo> {
  let latitude: number | null = null;
  let longitude: number | null = null;
  let takenAt: number | null = null;

  try {
    const metadata = await exifr.parse(candidate.blob, {
      pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"],
    });
    const date =
      metadata?.DateTimeOriginal ?? metadata?.CreateDate ?? metadata?.ModifyDate;
    if (date) takenAt = new Date(date).getTime();
  } catch {
    // Capture time is optional.
  }

  try {
    const gps = await exifr.gps(candidate.blob);
    if (Number.isFinite(gps?.latitude)) latitude = gps.latitude;
    if (Number.isFinite(gps?.longitude)) longitude = gps.longitude;
  } catch {
    // Location is optional.
  }

  return {
    id: crypto.randomUUID(),
    name: candidate.name,
    path: candidate.path,
    url: URL.createObjectURL(candidate.blob),
    previewable: browserPreviewExtensions.has(extensionFor(candidate.name)),
    takenAt,
    latitude,
    longitude,
  };
}

function distanceInMeters(a: Photo, b: Photo) {
  if (
    a.latitude === null ||
    a.longitude === null ||
    b.latitude === null ||
    b.longitude === null
  ) {
    return null;
  }

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lonDelta = radians(b.longitude - a.longitude);
  const startLat = radians(a.latitude);
  const endLat = radians(b.latitude);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2;

  return (
    6_371_000 *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function photosBelongTogether(a: Photo, b: Photo) {
  const timeClose =
    a.takenAt !== null &&
    b.takenAt !== null &&
    Math.abs(a.takenAt - b.takenAt) <= MAX_TIME_DIFFERENCE_MS;
  if (!timeClose) return false;

  const distance = distanceInMeters(a, b);
  return distance !== null && distance <= MAX_DISTANCE_METERS;
}

export function clusterPhotos(photos: Photo[]) {
  const sorted = [...photos].sort(
    (a, b) =>
      (a.takenAt ?? Number.MAX_SAFE_INTEGER) -
      (b.takenAt ?? Number.MAX_SAFE_INTEGER),
  );
  const clusters: PhotoCluster[] = [];

  for (const photo of sorted) {
    const existing = clusters.find((cluster) =>
      cluster.photos.some((member) => photosBelongTogether(member, photo)),
    );
    if (existing) existing.photos.push(photo);
    else clusters.push({ id: crypto.randomUUID(), photos: [photo] });
  }

  return clusters;
}

export async function processFiles(files: File[]) {
  const candidates = (
    await Promise.all(
      files.map((file) =>
        unpackBlob(file, file.name, file.webkitRelativePath || file.name),
      ),
    )
  ).flat();

  return Promise.all(candidates.map(readPhoto));
}

export function formatClusterDate(cluster: PhotoCluster) {
  const timestamp = cluster.photos.find((photo) => photo.takenAt)?.takenAt;
  if (!timestamp) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}
