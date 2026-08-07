import type {
  DragEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";

import { formatClusterDate } from "../lib/photo-processing";
import {
  PHOTO_DRAG_TYPE,
  type PhotoCluster,
} from "../lib/photo-types";
import { PhotoImage } from "./photo-image";

const STACK_ANGLES = [0, -5, 6] as const;
const STACK_OFFSETS = [
  { x: 0, y: 0 },
  { x: -10, y: 5 },
  { x: 9, y: -4 },
] as const;

type PhotoClusterCardProps = {
  cluster: PhotoCluster;
  draggedPhotoId: string | null;
  isDropTarget: boolean;
  onDropTargetChange: (clusterId: string | null) => void;
  onMovePhoto: (photoId: string, targetClusterId: string) => void;
  onBringToFront: (clusterId: string, photoId: string) => void;
  onDeletePhoto: (photoId: string) => void;
  onStartDrag: (event: DragEvent<HTMLElement>, photoId: string) => void;
  onEndDrag: () => void;
  onOpenContextMenu: (
    event: MouseEvent<HTMLElement>,
    clusterId: string,
    photoId: string,
  ) => void;
};

function isPhotoDrag(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes(PHOTO_DRAG_TYPE);
}

export function PhotoClusterCard({
  cluster,
  draggedPhotoId,
  isDropTarget,
  onDropTargetChange,
  onMovePhoto,
  onBringToFront,
  onDeletePhoto,
  onStartDrag,
  onEndDrag,
  onOpenContextMenu,
}: PhotoClusterCardProps) {
  const stackPhotos = cluster.photos.slice(0, 3);
  const topPhoto = stackPhotos[0];

  const handlePreviewKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    photoId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onBringToFront(cluster.id, photoId);
    }
  };

  return (
    <article
      className={`min-w-0 p-4 pt-10 transition-colors ${
        isDropTarget ? "bg-[#d9f5dc]" : "hover:bg-[#f7f8f6]"
      }`}
      onDragEnter={(event) => {
        if (!isPhotoDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        onDropTargetChange(cluster.id);
      }}
      onDragOver={(event) => {
        if (!isPhotoDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        onDropTargetChange(cluster.id);
      }}
      onDragLeave={(event) => {
        if (
          !event.relatedTarget ||
          !event.currentTarget.contains(event.relatedTarget as Node)
        ) {
          onDropTargetChange(null);
        }
      }}
      onDrop={(event) => {
        if (!isPhotoDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const photoId = event.dataTransfer.getData(PHOTO_DRAG_TYPE);
        if (photoId) onMovePhoto(photoId, cluster.id);
      }}
    >
      <div
        className="group relative mx-auto mb-8 aspect-square w-[min(72%,270px)] cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(event) => onStartDrag(event, topPhoto.id)}
        onDragEnd={onEndDrag}
        onContextMenu={(event) =>
          onOpenContextMenu(event, cluster.id, topPhoto.id)
        }
        aria-label={`Drag ${topPhoto.name} to another cluster`}
      >
        {stackPhotos.map((photo, index) => (
          <span
            className="absolute inset-0 block origin-center overflow-hidden bg-[#f2f6f1] outline-1 outline-[#d7dcd6] transition-transform duration-200"
            key={photo.id}
            style={{
              zIndex: stackPhotos.length - index,
              transform:
                stackPhotos.length === 1
                  ? "none"
                  : `translate(${STACK_OFFSETS[index].x}px, ${STACK_OFFSETS[index].y}px) rotate(${STACK_ANGLES[index]}deg)`,
            }}
          >
            <PhotoImage photo={photo} alt="" />
          </span>
        ))}
        <span className="absolute -bottom-[13px] -right-[13px] z-50 grid size-[43px] place-items-center bg-[#1c9c42] text-[17px] text-white">
          {cluster.photos.length}
        </span>
      </div>

      <div className="text-center">
        <h2 className="m-0 font-sans text-[17px] font-medium">
          {formatClusterDate(cluster)}
        </h2>
      </div>

      <div
        className="mt-[22px] grid grid-cols-[repeat(auto-fill,minmax(62px,1fr))] gap-[9px]"
        aria-label="Photos in this cluster"
      >
        {cluster.photos.map((photo) => (
          <div
            className="group/preview relative aspect-square cursor-grab overflow-hidden bg-[#f2f6f1] opacity-80 outline-1 outline-[#d7dcd6] transition duration-150 hover:z-10 hover:-translate-y-[3px] hover:opacity-100 active:cursor-grabbing"
            key={photo.id}
            draggable
            role="button"
            tabIndex={0}
            aria-label={`Bring ${photo.name} to the front of this stack`}
            onClick={() => onBringToFront(cluster.id, photo.id)}
            onKeyDown={(event) => handlePreviewKeyDown(event, photo.id)}
            onDragStart={(event) => onStartDrag(event, photo.id)}
            onDragEnd={onEndDrag}
            onContextMenu={(event) =>
              onOpenContextMenu(event, cluster.id, photo.id)
            }
            title={`Drag ${photo.name} to another stack`}
          >
            <PhotoImage photo={photo} alt={photo.name} />
            <button
              className={
                draggedPhotoId
                  ? "hidden"
                  : "absolute right-1.5 top-1.5 z-20 grid size-6 place-items-center bg-white text-lg leading-none text-[#1b241c] opacity-0 transition-opacity hover:opacity-80 focus:opacity-100 group-hover/preview:opacity-100"
              }
              type="button"
              draggable={false}
              aria-label={`Delete ${photo.name}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onDeletePhoto(photo.id);
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}
