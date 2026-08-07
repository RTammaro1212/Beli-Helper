"use client";

import type {
    ChangeEvent,
    DragEvent,
    MouseEvent as ReactMouseEvent,
} from "react";
import { useEffect, useRef, useState } from "react";

import { EmptyUpload } from "./components/empty-upload";
import { OrganizerHeader } from "./components/organizer-header";
import { PhotoClusterCard } from "./components/photo-cluster-card";
import { PhotoContextMenu } from "./components/photo-context-menu";
import {
    addPhotosToClusters,
    clusterCoordinate,
    processFiles,
} from "./lib/photo-processing";
import {
    clearBrowserData,
    loadClusters,
    saveClusters,
    saveLabelLog,
} from "./lib/browser-storage";
import { resizePhotosForLabeling } from "./lib/image-resize";
import {
    PHOTO_DRAG_TYPE,
    type PhotoCluster,
    type PhotoContextMenuState,
} from "./lib/photo-types";
import {
    labelStackResponseSchema,
    type MealCategory,
    type RestaurantSelection,
} from "./lib/stack-schema";

export default function Home() {
    const [clusters, setClusters] = useState<PhotoCluster[]>([]);
    const [processing, setProcessing] = useState(false);
    const [labeling, setLabeling] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [message, setMessage] = useState("Drop photos or a zip anywhere");
    const [draggingOver, setDraggingOver] = useState(false);
    const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
    const [dropTargetClusterId, setDropTargetClusterId] = useState<string | null>(
        null,
    );
    const [photoContextMenu, setPhotoContextMenu] =
        useState<PhotoContextMenuState | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const objectUrls = useRef<string[]>([]);

    useEffect(() => {
        const urls = objectUrls;
        return () => urls.current.forEach((url) => URL.revokeObjectURL(url));
    }, []);

    useEffect(() => {
        let cancelled = false;
        void loadClusters()
            .then((savedClusters) => {
                if (cancelled) return;
                const restored = savedClusters.map((cluster) => ({
                    ...cluster,
                    labelStatus:
                        cluster.labelStatus === "matching" ||
                            cluster.labelStatus === "queued"
                            ? ("ready" as const)
                            : (cluster.labelStatus ?? "ready"),
                    placesSearch: cluster.placesSearch ?? null,
                    match: cluster.match ?? null,
                    category: cluster.category ?? cluster.match?.category ?? null,
                    selection: cluster.selection ?? null,
                    labelError: cluster.labelError ?? null,
                    photos: cluster.photos.map((photo) => {
                        const url = URL.createObjectURL(photo.blob);
                        objectUrls.current.push(url);
                        return { ...photo, url };
                    }),
                }));
                setClusters(restored);
                if (restored.length) setMessage("Saved progress restored");
            })
            .catch((error) => console.error("Could not restore saved photos", error))
            .finally(() => {
                if (!cancelled) setHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        void saveClusters(clusters).catch((error) =>
            console.error("Could not save photo progress", error),
        );
    }, [clusters, hydrated]);

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

    const chooseFiles = () => inputRef.current?.click();

    const addFiles = async (files: File[]) => {
        if (!files.length) return;
        setProcessing(true);
        setMessage("Reading photos and metadata…");

        try {
            const photos = await processFiles(files);
            objectUrls.current.push(...photos.map((photo) => photo.url));
            setClusters((current) => addPhotosToClusters(current, photos));
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
                objectUrls.current = objectUrls.current.filter(
                    (url) => url !== photo.url,
                );
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
                        {
                            id: crypto.randomUUID(),
                            photos: [photo],
                            labelStatus: "ready",
                            placesSearch: null,
                            match: null,
                            category: null,
                            selection: null,
                            labelError: null,
                        },
                    ]
                    : [cluster],
            );
        });
        setPhotoContextMenu(null);
    };

    const selectRestaurant = (
        clusterId: string,
        selection: RestaurantSelection,
    ) => {
        setClusters((current) =>
            current.map((cluster) =>
                cluster.id === clusterId ? { ...cluster, selection } : cluster,
            ),
        );
    };

    const selectCategory = (clusterId: string, category: MealCategory) => {
        setClusters((current) =>
            current.map((cluster) =>
                cluster.id === clusterId ? { ...cluster, category } : cluster,
            ),
        );
    };

    const clearAll = () => {
        if (!window.confirm("Clear all photos, labels, and saved progress?")) return;
        objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrls.current = [];
        setClusters([]);
        setMessage("Drop photos or a zip anywhere");
        void clearBrowserData().catch((error) =>
            console.error("Could not clear saved progress", error),
        );
    };

    const labelClusters = async (targets: PhotoCluster[]) => {
        if (!targets.length || labeling) return;
        const targetIds = new Set(targets.map((cluster) => cluster.id));
        const runId = crypto.randomUUID();
        setLabeling(true);
        setMessage(`Labeling ${targets.length} meal${targets.length === 1 ? "" : "s"}…`);
        setClusters((current) =>
            current.map((cluster) =>
                targetIds.has(cluster.id)
                    ? { ...cluster, labelStatus: "queued", labelError: null }
                    : cluster,
            ),
        );

        let completed = 0;
        let failed = 0;
        for (const cluster of targets) {
            setClusters((current) =>
                current.map((item) =>
                    item.id === cluster.id
                        ? { ...item, labelStatus: "matching" }
                        : item,
                ),
            );

            try {
                const coordinate = clusterCoordinate(cluster);
                if (!coordinate) throw new Error("Location unavailable");
                const photos = await resizePhotosForLabeling(cluster.photos);
                if (!photos.length) throw new Error("These photos could not be resized");

                const request = await fetch("/api/label", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        runId,
                        stackId: cluster.id,
                        coordinate,
                        photos,
                    }),
                });
                const body = (await request.json()) as unknown;
                if (!request.ok) {
                    const errorBody = body as { error?: string };
                    throw new Error(errorBody.error ?? "Labeling failed");
                }
                const response = labelStackResponseSchema.parse(body);
                await saveLabelLog(runId, cluster.id, response);
                setClusters((current) =>
                    current.map((item) =>
                        item.id === cluster.id
                            ? {
                                ...item,
                                labelStatus: "matched",
                                placesSearch: response.placesSearch,
                                match: response.match,
                                category: response.match.category,
                                selection: response.match.selected,
                                labelError: null,
                            }
                            : item,
                    ),
                );
            } catch (error) {
                failed += 1;
                const labelError =
                    error instanceof Error ? error.message : "Labeling failed";
                setClusters((current) =>
                    current.map((item) =>
                        item.id === cluster.id
                            ? { ...item, labelStatus: "error", labelError }
                            : item,
                    ),
                );
            }

            completed += 1;
            setMessage(
                failed
                    ? `${completed} of ${targets.length} checked · ${failed} needs attention`
                    : `${completed} of ${targets.length} meals labeled`,
            );
        }

        setLabeling(false);
    };

    const openPhotoContextMenu = (
        event: ReactMouseEvent<HTMLElement>,
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

    const startPhotoDrag = (
        event: DragEvent<HTMLElement>,
        photoId: string,
    ) => {
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
    const unlabeledClusters = clusters.filter((cluster) => !cluster.match);

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

            <OrganizerHeader
                hasPhotos={hasPhotos}
                processing={processing}
                labeling={labeling}
                mealCount={clusters.length}
                unlabeledCount={unlabeledClusters.length}
                onChooseFiles={chooseFiles}
                onClear={clearAll}
                onLabel={() => void labelClusters(unlabeledClusters)}
            />

            {hasPhotos ? (
                <section className="mx-auto w-full max-w-7xl pt-[clamp(36px,5vw,68px)]" aria-live="polite">
                    <div className="mb-[clamp(36px,5vw,58px)] flex items-end justify-between gap-8 max-[680px]:flex-col max-[680px]:items-start">
                        <div>
                            <h1 className="m-0 text-[clamp(34px,4vw,56px)] font-medium leading-none tracking-[-0.055em]">
                                {clusters.length} meal{clusters.length === 1 ? "" : "s"}
                            </h1>
                            <p className="mt-3 font-sans text-[15px] text-[#78837a]">
                                {message}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] items-start gap-4">
                        {clusters.map((cluster) => (
                            <PhotoClusterCard
                                key={cluster.id}
                                cluster={cluster}
                                draggedPhotoId={draggedPhotoId}
                                isDropTarget={dropTargetClusterId === cluster.id}
                                onDropTargetChange={setDropTargetClusterId}
                                onMovePhoto={movePhoto}
                                onBringToFront={bringPhotoToFront}
                                onDeletePhoto={deletePhoto}
                                onStartDrag={startPhotoDrag}
                                onEndDrag={endPhotoDrag}
                                onOpenContextMenu={openPhotoContextMenu}
                                onSelectRestaurant={selectRestaurant}
                                onSelectCategory={selectCategory}
                                labeling={labeling}
                                onLabel={(clusterId) => {
                                    const cluster = clusters.find(
                                        (item) => item.id === clusterId,
                                    );
                                    if (cluster && !cluster.match) {
                                        void labelClusters([cluster]);
                                    }
                                }}
                            />
                        ))}
                    </div>
                </section>
            ) : (
                <EmptyUpload
                    processing={processing}
                    message={message}
                    onChooseFiles={chooseFiles}
                />
            )}

            {photoContextMenu ? (
                <PhotoContextMenu
                    menu={photoContextMenu}
                    onSplit={splitIntoSeparateMeal}
                />
            ) : null}

            {draggingOver ? (
                <div
                    className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-[rgba(226,239,227,0.92)] text-[clamp(38px,7vw,82px)] tracking-[-0.05em] text-[#087e2b]"
                    aria-hidden="true"
                >
                    <span>Drop to add photos</span>
                </div>
            ) : null}
        </main>
    );
}
