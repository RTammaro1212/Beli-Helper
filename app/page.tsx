"use client";

import Image from "next/image";
import Link from "next/link";
import {
    ChangeEvent,
    DragEvent,
    KeyboardEvent,
    MouseEvent as ReactMouseEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import JSZip from "jszip";
import exifr from "exifr";

const MAX_DISTANCE_METERS = 20;
const MAX_TIME_DIFFERENCE_MS = 4 * 60 * 60 * 1000;
const PHOTO_DRAG_TYPE = "application/x-auto-beli-photo";
const STACK_ANGLES = [0, -5, 6] as const;
const STACK_OFFSETS = [
    { x: 0, y: 0 },
    { x: -10, y: 5 },
    { x: 9, y: -4 },
] as const;

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

type Photo = {
    id: string;
    name: string;
    path: string;
    url: string;
    previewable: boolean;
    takenAt: number | null;
    latitude: number | null;
    longitude: number | null;
};

type PhotoCluster = {
    id: string;
    photos: Photo[];
};

type CandidateFile = {
    blob: Blob;
    name: string;
    path: string;
};

type PhotoContextMenu = {
    clusterId: string;
    photoId: string;
    x: number;
    y: number;
};

const placeholderImages = [
    { src: "/food-placeholders/ramen.png", className: "z-40 left-[26%] top-[2%] -rotate-3 group-hover:-translate-y-2 group-hover:-rotate-6" },
    { src: "/food-placeholders/croissant.png", className: "z-30 right-[3%] top-[12%] rotate-6 group-hover:translate-x-2 group-hover:-translate-y-0.5 group-hover:rotate-9" },
    { src: "/food-placeholders/cake.png", className: "z-20 bottom-[1%] right-[25%] rotate-2 group-hover:translate-y-2 group-hover:rotate-3" },
    { src: "/food-placeholders/dumplings.png", className: "z-10 bottom-[10%] left-[2%] -rotate-9 group-hover:-translate-x-2 group-hover:translate-y-1 group-hover:-rotate-12" },
];

function extensionFor(name: string) {
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
    if (isZip(name)) {
        const archive = await JSZip.loadAsync(blob);
        const collected: CandidateFile[] = [];

        for (const entry of Object.values(archive.files)) {
            if (entry.dir) continue;
            const nestedBlob = await entry.async("blob");
            const nestedPath = `${path.replace(/\.zip$/i, "")}/${entry.name}`;
            if (isZip(entry.name)) {
                collected.push(
                    ...(await unpackBlob(
                        nestedBlob,
                        entry.name,
                        nestedPath,
                    )),
                );
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

    return isImage(name) ? [{ blob, name, path }] : [];
}

async function readPhoto(candidate: CandidateFile): Promise<Photo> {
    let latitude: number | null = null;
    let longitude: number | null = null;
    let takenAt: number | null = null;

    try {
        const metadata = await exifr.parse(candidate.blob, {
            pick: [
                "DateTimeOriginal",
                "CreateDate",
                "ModifyDate",
            ],
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
    return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
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

function clusterPhotos(photos: Photo[]) {
    const sorted = [...photos].sort(
        (a, b) => (a.takenAt ?? Number.MAX_SAFE_INTEGER) - (b.takenAt ?? Number.MAX_SAFE_INTEGER),
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

function formatClusterDate(cluster: PhotoCluster) {
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

function PhotoImage({ photo, alt }: { photo: Photo; alt: string }) {
    if (!photo.previewable) {
        return (
            <span className="absolute inset-0 grid place-items-center bg-[#ecefea] text-[#78837a]" aria-label={`${photo.name}, preview unavailable`}>
                <span className="text-sm">{extensionFor(photo.name)}</span>
            </span>
        );
    }

    return <Image className="object-cover" src={photo.url} alt={alt} fill sizes="280px" draggable={false} unoptimized />;
}

export default function Home() {
    const [clusters, setClusters] = useState<PhotoCluster[]>([]);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState("Drop photos or a zip anywhere");
    const [draggingOver, setDraggingOver] = useState(false);
    const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
    const [dropTargetClusterId, setDropTargetClusterId] = useState<string | null>(null);
    const [photoContextMenu, setPhotoContextMenu] = useState<PhotoContextMenu | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const objectUrls = useRef<string[]>([]);

    useEffect(() => {
        const urls = objectUrls.current;
        return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }, []);

    useEffect(() => {
        const closeMenu = () => setPhotoContextMenu(null);
        const closeMenuOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") closeMenu();
        };

        window.addEventListener("click", closeMenu);
        window.addEventListener("blur", closeMenu);
        window.addEventListener("resize", closeMenu);
        window.addEventListener("scroll", closeMenu, true);
        window.addEventListener("keydown", closeMenuOnEscape);

        return () => {
            window.removeEventListener("click", closeMenu);
            window.removeEventListener("blur", closeMenu);
            window.removeEventListener("resize", closeMenu);
            window.removeEventListener("scroll", closeMenu, true);
            window.removeEventListener("keydown", closeMenuOnEscape);
        };
    }, []);

    const addFiles = async (files: File[]) => {
        if (!files.length) return;
        setProcessing(true);
        setMessage("Reading photos and metadata…");

        try {
            const candidates = (
                await Promise.all(
                    files.map((file) =>
                        unpackBlob(
                            file,
                            file.name,
                            file.webkitRelativePath || file.name,
                        ),
                    ),
                )
            ).flat();

            const photos = await Promise.all(candidates.map(readPhoto));
            objectUrls.current.push(...photos.map((photo) => photo.url));
            setClusters((current) =>
                clusterPhotos([...current.flatMap((cluster) => cluster.photos), ...photos]),
            );
            setMessage(
                photos.length
                    ? `${photos.length} photo${photos.length === 1 ? "" : "s"} added`
                    : "No images found — videos and other files were ignored",
            );
        } catch (error) {
            console.error(error);
            setMessage("That upload could not be read. Try the images or zip again.");
        } finally {
            setProcessing(false);
        }
    };

    const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
        void addFiles(Array.from(event.target.files ?? []));
        event.target.value = "";
    };

    const handlePageDrop = (event: DragEvent<HTMLElement>) => {
        if (Array.from(event.dataTransfer.types).includes(PHOTO_DRAG_TYPE)) return;
        event.preventDefault();
        setDraggingOver(false);
        void addFiles(Array.from(event.dataTransfer.files));
    };

    const movePhoto = (photoId: string, targetClusterId: string) => {
        setClusters((current) => {
            const source = current.find((cluster) =>
                cluster.photos.some((photo) => photo.id === photoId),
            );
            if (!source || source.id === targetClusterId) return current;
            const photo = source.photos.find((item) => item.id === photoId);
            if (!photo) return current;

            return current
                .map((cluster) => {
                    if (cluster.id === source.id) {
                        return {
                            ...cluster,
                            photos: cluster.photos.filter((item) => item.id !== photoId),
                        };
                    }
                    if (cluster.id === targetClusterId) {
                        return { ...cluster, photos: [photo, ...cluster.photos] };
                    }
                    return cluster;
                })
                .filter((cluster) => cluster.photos.length > 0);
        });
        setDraggedPhotoId(null);
        setDropTargetClusterId(null);
    };

    const bringPhotoToFront = (clusterId: string, photoId: string) => {
        setClusters((current) =>
            current.map((cluster) => {
                if (cluster.id !== clusterId || cluster.photos[0]?.id === photoId) {
                    return cluster;
                }
                const selected = cluster.photos.find((photo) => photo.id === photoId);
                if (!selected) return cluster;
                return {
                    ...cluster,
                    photos: [
                        selected,
                        ...cluster.photos.filter((photo) => photo.id !== photoId),
                    ],
                };
            }),
        );
    };

    const deletePhoto = (photoId: string) => {
        setClusters((current) => {
            const photo = current
                .flatMap((cluster) => cluster.photos)
                .find((item) => item.id === photoId);
            if (photo) {
                URL.revokeObjectURL(photo.url);
                objectUrls.current = objectUrls.current.filter((url) => url !== photo.url);
            }

            return current
                .map((cluster) => ({
                    ...cluster,
                    photos: cluster.photos.filter((item) => item.id !== photoId),
                }))
                .filter((cluster) => cluster.photos.length > 0);
        });
    };

    const splitIntoSeparateMeal = (clusterId: string, photoId: string) => {
        setClusters((current) => {
            const source = current.find((cluster) => cluster.id === clusterId);
            const photo = source?.photos.find((item) => item.id === photoId);
            if (!source || !photo || source.photos.length === 1) return current;

            return current.flatMap((cluster) =>
                cluster.id === clusterId
                    ? [
                        {
                            ...cluster,
                            photos: cluster.photos.filter((item) => item.id !== photoId),
                        },
                        { id: crypto.randomUUID(), photos: [photo] },
                    ]
                    : [cluster],
            );
        });
        setPhotoContextMenu(null);
    };

    const openPhotoContextMenu = (
        event: ReactMouseEvent,
        clusterId: string,
        photoId: string,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        setPhotoContextMenu({
            clusterId,
            photoId,
            x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
            y: Math.max(8, Math.min(event.clientY, window.innerHeight - 48)),
        });
    };

    const handlePreviewKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
        clusterId: string,
        photoId: string,
    ) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            bringPhotoToFront(clusterId, photoId);
        }
    };

    const startPhotoDrag = (event: DragEvent, photoId: string) => {
        setDraggedPhotoId(photoId);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(PHOTO_DRAG_TYPE, photoId);
        event.dataTransfer.setData("text/plain", photoId);
    };

    const endPhotoDrag = () => {
        setDraggedPhotoId(null);
        setDropTargetClusterId(null);
        setDraggingOver(false);
    };

    const hasPhotos = clusters.length > 0;

    return (
        <main
            className="relative min-h-screen bg-white px-[clamp(20px,4.5vw,68px)] pb-20 text-[#1b241c]"
            onDragEnter={(event) => {
                event.preventDefault();
                if (!Array.from(event.dataTransfer.types).includes(PHOTO_DRAG_TYPE)) {
                    setDraggingOver(true);
                }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
                if (event.currentTarget === event.target) setDraggingOver(false);
            }}
            onDrop={handlePageDrop}
        >
            <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept="image/*,.heic,.heif,.tif,.tiff,.zip,application/zip"
                multiple
                onChange={handleFileInput}
            />

            <header className="relative z-10 grid min-h-[92px] grid-cols-[1fr_auto_1fr] items-center max-[680px]:min-h-[78px]">
                <button
                    className="w-fit justify-self-start bg-[#e5f3e6] px-4 py-2 font-sans text-[15px] text-[#087e2b] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={processing}
                >
                    {hasPhotos ? "Add photos" : "Choose files"}
                </button>
                <Link className="text-[clamp(30px,3vw,42px)] font-medium leading-none tracking-[-0.055em] no-underline max-[680px]:text-[29px]" href="/" aria-label="Auto Beli home">
                    Auto Beli
                </Link>
                {hasPhotos && (
                    <button
                        className="w-fit justify-self-end bg-[#1c9c42] px-4 py-2 font-sans text-[15px] text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 max-[680px]:px-3"
                        type="button"
                        disabled={processing}
                        onClick={() => setMessage("Clusters are ready for the next step")}
                    >
                        Label
                    </button>
                )}
            </header>

            {!hasPhotos ? (
                <section className="flex min-h-[calc(100vh-150px)] flex-col items-center justify-center px-0 pb-[88px] pt-[30px] text-center" aria-live="polite">
                    <button
                        className="group relative mb-[42px] h-[min(53vw,330px)] w-[min(68vw,430px)] bg-transparent transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={processing}
                        aria-label="Choose photos or zip files"
                    >
                        {placeholderImages.map(({ src, className }, index) => (
                            <span className={`absolute block aspect-square w-[clamp(128px,20vw,205px)] overflow-hidden bg-[#f4f4f1] transition-transform duration-300 ${className}`} key={src}>
                                <Image
                                    src={src}
                                    alt=""
                                    fill
                                    priority={index === 0}
                                    sizes="220px"
                                    className="object-cover grayscale"
                                />
                            </span>
                        ))}
                    </button>
                    <h1 className="m-0 text-[clamp(34px,4vw,56px)] font-medium leading-none tracking-[-0.055em]">{processing ? "Sorting your photos…" : "Drop photos here"}</h1>
                    <p className="mt-4 font-sans text-lg text-[#78837a]">{message}</p>
                </section>
            ) : (
                <section className="pt-[clamp(48px,7vw,96px)]" aria-live="polite">
                    <div className="mb-[clamp(48px,7vw,86px)] flex items-end justify-between gap-8 max-[680px]:flex-col max-[680px]:items-start">
                        <div>
                            <h1 className="m-0 text-[clamp(34px,4vw,56px)] font-medium leading-none tracking-[-0.055em]">
                                {clusters.length} meal{clusters.length === 1 ? "" : "s"}
                            </h1>
                            <p className="mt-3 font-sans text-[15px] text-[#78837a]">{message}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,330px),1fr))] items-start gap-x-[clamp(50px,7vw,110px)] gap-y-[88px] max-[680px]:gap-y-[72px]">
                        {clusters.map((cluster) => {
                            const stackPhotos = cluster.photos.slice(0, 3);
                            const topPhoto = stackPhotos[0];
                            return (
                                <article
                                    className={`min-w-0 p-4 pt-10 transition-colors ${dropTargetClusterId === cluster.id
                                        ? "bg-[#d9f5dc]"
                                        : "hover:bg-[#f7f8f6]"
                                        }`}
                                    key={cluster.id}
                                    onDragEnter={(event) => {
                                        if (Array.from(event.dataTransfer.types).includes(PHOTO_DRAG_TYPE)) {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setDropTargetClusterId(cluster.id);
                                        }
                                    }}
                                    onDragOver={(event) => {
                                        if (Array.from(event.dataTransfer.types).includes(PHOTO_DRAG_TYPE)) {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            event.dataTransfer.dropEffect = "move";
                                            setDropTargetClusterId(cluster.id);
                                        }
                                    }}
                                    onDragLeave={(event) => {
                                        if (
                                            !event.relatedTarget ||
                                            !event.currentTarget.contains(event.relatedTarget as Node)
                                        ) {
                                            setDropTargetClusterId((current) =>
                                                current === cluster.id ? null : current,
                                            );
                                        }
                                    }}
                                    onDrop={(event) => {
                                        if (!Array.from(event.dataTransfer.types).includes(PHOTO_DRAG_TYPE)) {
                                            return;
                                        }
                                        event.preventDefault();
                                        event.stopPropagation();
                                        const photoId = event.dataTransfer.getData(PHOTO_DRAG_TYPE);
                                        if (photoId) movePhoto(photoId, cluster.id);
                                    }}
                                >
                                    <div
                                        className="group relative mx-auto mb-8 aspect-square w-[min(72%,270px)] cursor-grab active:cursor-grabbing"
                                        draggable
                                        onDragStart={(event) => startPhotoDrag(event, topPhoto.id)}
                                        onDragEnd={endPhotoDrag}
                                        onContextMenu={(event) =>
                                            openPhotoContextMenu(event, cluster.id, topPhoto.id)
                                        }
                                        aria-label={`Drag ${topPhoto.name} to another cluster`}
                                    >
                                        {stackPhotos
                                            .map((photo, index) => (
                                                <span
                                                    className="absolute inset-0 block origin-center overflow-hidden bg-[#f2f6f1] transition-transform duration-200"
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
                                        <span className="absolute -bottom-[13px] -right-[13px] z-50 grid size-[43px] place-items-center bg-[#1c9c42] text-[17px] text-white">{cluster.photos.length}</span>
                                    </div>

                                    <div className="text-center">
                                        <h2 className="m-0 font-sans text-[17px] font-medium">{formatClusterDate(cluster)}</h2>
                                    </div>

                                    <div className="mt-[22px] grid grid-cols-[repeat(auto-fill,minmax(62px,1fr))] gap-[9px]" aria-label="Photos in this cluster">
                                        {cluster.photos.map((photo) => (
                                            <div
                                                className="group/preview relative aspect-square cursor-grab overflow-hidden bg-[#f2f6f1] opacity-80 outline-1 outline-[#d7dcd6] transition duration-150 hover:z-10 hover:-translate-y-[3px] hover:opacity-100 active:cursor-grabbing"
                                                key={photo.id}
                                                draggable
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`Bring ${photo.name} to the front of this stack`}
                                                onClick={() => bringPhotoToFront(cluster.id, photo.id)}
                                                onKeyDown={(event) =>
                                                    handlePreviewKeyDown(event, cluster.id, photo.id)
                                                }
                                                onDragStart={(event) => startPhotoDrag(event, photo.id)}
                                                onDragEnd={endPhotoDrag}
                                                onContextMenu={(event) =>
                                                    openPhotoContextMenu(event, cluster.id, photo.id)
                                                }
                                                title={`Drag ${photo.name} to another stack`}
                                            >
                                                <PhotoImage photo={photo} alt={photo.name} />
                                                <button
                                                    className={draggedPhotoId
                                                        ? "hidden"
                                                        : "absolute right-1.5 top-1.5 z-20 grid size-6 place-items-center bg-white text-lg leading-none text-[#1b241c] opacity-0 transition-opacity hover:opacity-80 focus:opacity-100 group-hover/preview:opacity-100"
                                                    }
                                                    type="button"
                                                    draggable={false}
                                                    aria-label={`Delete ${photo.name}`}
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        deletePhoto(photo.id);
                                                    }}
                                                >
                                                    <span aria-hidden="true">×</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            {photoContextMenu && (
                <div
                    className="fixed z-[60] min-w-[212px] bg-[#f2f6f1] p-1 font-sans"
                    role="menu"
                    style={{ left: photoContextMenu.x, top: photoContextMenu.y }}
                    onContextMenu={(event) => event.preventDefault()}
                >
                    <button
                        className="w-full bg-transparent px-3 py-2 text-left text-sm text-[#1b241c] transition-opacity hover:bg-[#d9f5dc] hover:opacity-80"
                        type="button"
                        role="menuitem"
                        onClick={() =>
                            splitIntoSeparateMeal(
                                photoContextMenu.clusterId,
                                photoContextMenu.photoId,
                            )
                        }
                    >
                        Split into separate meal
                    </button>
                </div>
            )}

            {draggingOver && (
                <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-[rgba(226,239,227,0.92)] text-[clamp(38px,7vw,82px)] tracking-[-0.05em] text-[#087e2b]" aria-hidden="true">
                    <span>Drop to add photos</span>
                </div>
            )}
        </main>
    );
}
