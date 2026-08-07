import Image from "next/image";

import { extensionFor } from "../lib/photo-processing";
import type { Photo } from "../lib/photo-types";

type PhotoImageProps = {
  photo: Photo;
  alt: string;
};

export function PhotoImage({ photo, alt }: PhotoImageProps) {
  if (!photo.previewable) {
    return (
      <span
        className="absolute inset-0 grid place-items-center bg-[#ecefea] text-[#78837a]"
        aria-label={`${photo.name}, preview unavailable`}
      >
        <span className="text-sm">{extensionFor(photo.name)}</span>
      </span>
    );
  }

  return (
    <Image
      className="object-cover"
      src={photo.url}
      alt={alt}
      fill
      sizes="280px"
      draggable={false}
      unoptimized
    />
  );
}
