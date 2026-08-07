export type Photo = {
  id: string;
  name: string;
  path: string;
  url: string;
  previewable: boolean;
  takenAt: number | null;
  latitude: number | null;
  longitude: number | null;
};

export type PhotoCluster = {
  id: string;
  photos: Photo[];
};

export type PhotoContextMenuState = {
  clusterId: string;
  photoId: string;
  x: number;
  y: number;
};

export const PHOTO_DRAG_TYPE = "application/x-auto-beli-photo";
