import { useEffect, useRef, useState } from "react";
import { FaCheck } from "react-icons/fa6";
import SquareLoader from "react-spinners/SquareLoader";

import type { Photo } from "../lib/photo-types";
import {
    RANKING_STEPS,
    type RankingSessionStatus,
    type RankingStepId,
} from "../lib/ranking-types";
import { PhotoImage } from "./photo-image";

export type RankFeedback = {
    rating: "liked" | "fine" | "disliked" | null;
    description: string;
    photoDescriptions: string[];
};

type RankingOverlayProps = {
    restaurantName: string;
    photos: Photo[];
    launching: boolean;
    progress: RankingSessionStatus | null;
    onCancel: () => void;
    onCancelProcess: () => void;
    onContinue: (feedback: RankFeedback) => void;
    onReopenPhone: () => void;
    onTogglePause: () => void;
    onRetry: (step: RankingStepId) => void;
    onSkipStep: (step: RankingStepId) => void;
    onContinuePhotos: () => void;
    onSkipPhotos: () => void;
    onFinished: () => void;
};

const ratings = [
    { value: "liked", label: "I liked it!", color: "bg-[#74b894]" },
    { value: "fine", label: "It was fine", color: "bg-[#f6dda0]" },
    { value: "disliked", label: "I didn’t like it", color: "bg-[#efafb1]" },
] as const;

const confetti = Array.from({ length: 42 }, (_, index) => ({
    id: index,
    left: `${(index * 37) % 100}%`,
    delay: `${(index % 9) * 0.09}s`,
    duration: `${1.8 + (index % 6) * 0.18}s`,
    color: ["#134f5c", "#74b894", "#f6dda0", "#efafb1"][index % 4],
}));

export function RankingOverlay({
    restaurantName,
    photos,
    launching,
    progress,
    onCancel,
    onCancelProcess,
    onContinue,
    onReopenPhone,
    onTogglePause,
    onRetry,
    onSkipStep,
    onContinuePhotos,
    onSkipPhotos,
    onFinished,
}: RankingOverlayProps) {
    const [rating, setRating] = useState<RankFeedback["rating"]>(null);
    const [description, setDescription] = useState("");
    const [photoDescriptions, setPhotoDescriptions] = useState<Record<string, string>>(
        {},
    );
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialogRef.current?.focus();

        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (
                event.key === "Escape" &&
                progress?.state !== "running" &&
                progress?.state !== "paused"
            ) {
                onCancel();
            }
        };
        window.addEventListener("keydown", closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [onCancel, progress?.state]);

    const showingProgress = progress !== null;
    const completed = progress?.state === "complete";

    return (
        <div
            ref={dialogRef}
            className="fixed inset-0 z-[200] grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(280px,45vh)] bg-white outline-none lg:grid-cols-[minmax(0,1fr)_minmax(360px,34vw)] lg:grid-rows-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ranking-title"
            tabIndex={-1}
        >
            <section className="flex min-h-0 flex-col bg-white">
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-10">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-8 2xl:grid-cols-3">
                        {photos.map((photo) => (
                            <div className="block min-w-0" key={photo.id}>
                                <span className="relative block aspect-square w-full overflow-hidden bg-neutral-100">
                                    <PhotoImage photo={photo} alt="" />
                                </span>
                                <input
                                    className="mt-3 w-full rounded-sm bg-neutral-100 px-4 py-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                                    aria-label={`Dish description for ${photo.name}`}
                                    type="text"
                                    disabled={showingProgress}
                                    value={photoDescriptions[photo.id] ?? ""}
                                    placeholder="Menu"
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setPhotoDescriptions((current) => ({
                                            ...current,
                                            [photo.id]: value,
                                        }));
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="relative min-h-0 overflow-y-auto bg-white px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-14">
                {showingProgress ? (
                    <div className="flex min-h-full flex-col" aria-live="polite">
                        <h2
                            className="m-0 text-2xl font-semibold tracking-[-0.025em] text-neutral-950"
                            id="ranking-title"
                        >
                            Ranking {restaurantName}
                        </h2>
                        {!completed ? (
                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    className="rounded-sm bg-neutral-100 px-4 py-2 text-sm text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                                    type="button"
                                    disabled={launching}
                                    onClick={onReopenPhone}
                                >
                                    Reopen phone
                                </button>
                                {progress.state === "running" || progress.state === "paused" ? (
                                    <button
                                        className="rounded-sm bg-neutral-100 px-4 py-2 text-sm text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                                        type="button"
                                        disabled={launching}
                                        onClick={onTogglePause}
                                    >
                                        {progress.state === "paused" ? "Resume" : "Pause"}
                                    </button>
                                ) : null}
                                {progress.state === "running" || progress.state === "paused" ? (
                                    <button
                                        className="rounded-sm bg-neutral-100 px-4 py-2 text-sm text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                                        type="button"
                                        disabled={launching}
                                        onClick={onCancelProcess}
                                    >
                                        Cancel
                                    </button>
                                ) : (
                                    <button
                                        className="rounded-sm bg-neutral-100 px-4 py-2 text-sm text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                                        type="button"
                                        disabled={launching}
                                        onClick={onCancel}
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                        ) : null}

                        <ul className="mt-10 flex list-none flex-col gap-5 p-0">
                            {RANKING_STEPS.filter(
                                (step) =>
                                    progress.steps[step.id] !== "pending" || completed,
                            ).map((step) => {
                                const state = progress.steps[step.id];
                                const showsError =
                                    progress.state === "error" && state === "active";
                                return (
                                    <li
                                        className={`group/step flex items-start gap-3 text-sm ${state === "complete" ? "text-neutral-400" : "text-neutral-900"}`}
                                        key={step.id}
                                    >
                                        {state === "active" && progress.state === "running" ? (
                                            <SquareLoader
                                                color="var(--color-accent)"
                                                size={16}
                                                speedMultiplier={1.15}
                                                aria-label="In progress"
                                            />
                                        ) : (
                                            <span
                                                className="mt-0.5 size-4 shrink-0 rounded-full bg-neutral-300"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start gap-3">
                                                <span>{step.label}</span>
                                                <div className="ml-auto flex gap-2 opacity-0 transition-opacity group-hover/step:opacity-100 group-focus-within/step:opacity-100">
                                                    <button
                                                        className="rounded-xs bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-200 disabled:cursor-default disabled:opacity-50"
                                                        type="button"
                                                        disabled={launching}
                                                        onClick={() => onRetry(step.id)}
                                                    >
                                                        Retry from here
                                                    </button>
                                                    <button
                                                        className="rounded-xs bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-200 disabled:cursor-default disabled:opacity-50"
                                                        type="button"
                                                        disabled={launching}
                                                        onClick={() => onSkipStep(step.id)}
                                                    >
                                                        Skip
                                                    </button>
                                                </div>
                                            </div>
                                            {showsError ? (
                                                <div className="mt-2">
                                                    <p className="text-sm text-neutral-600">
                                                        {progress.error}
                                                    </p>
                                                    {progress.recovery === "photos_not_found" ? (
                                                        <div className="mt-4 flex flex-wrap gap-3">
                                                            <button
                                                                className="rounded-sm bg-accent px-6 py-3 text-sm text-white transition-colors hover:bg-accent/85 disabled:opacity-50"
                                                                type="button"
                                                                disabled={launching}
                                                                onClick={onContinuePhotos}
                                                            >
                                                                Continue with added photos
                                                            </button>
                                                            <button
                                                                className="rounded-sm bg-neutral-100 px-6 py-3 text-sm text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                                                                type="button"
                                                                disabled={launching}
                                                                onClick={onSkipPhotos}
                                                            >
                                                                Skip photos
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        {completed ? (
                            <button
                                className="mt-auto rounded-sm bg-accent px-6 py-3 text-sm text-white transition-colors hover:bg-accent/85"
                                type="button"
                                onClick={onFinished}
                            >
                                Yay
                            </button>
                        ) : null}

                        {completed ? (
                            <div className="pointer-events-none fixed inset-0 z-[220] overflow-hidden" aria-hidden="true">
                                {confetti.map((piece) => (
                                    <span
                                        className="ranking-confetti absolute -top-8 h-4 w-2"
                                        key={piece.id}
                                        style={{
                                            left: piece.left,
                                            animationDelay: piece.delay,
                                            animationDuration: piece.duration,
                                            backgroundColor: piece.color,
                                        }}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <>
                        <h2
                            className="m-0 text-2xl font-semibold tracking-[-0.025em] text-neutral-950"
                            id="ranking-title"
                        >
                            How was {restaurantName}?
                        </h2>

                        <div className="mt-10 flex flex-col gap-5">
                            {ratings.map((option) => {
                                const selected = rating === option.value;
                                return (
                                    <button
                                        className="flex items-center gap-4 bg-transparent text-left text-sm font-semibold text-neutral-700"
                                        type="button"
                                        aria-pressed={selected}
                                        key={option.value}
                                        onClick={() => setRating(option.value)}
                                    >
                                        <span
                                            className={`grid size-16 shrink-0 place-items-center rounded-full ${option.color} transition-transform hover:scale-105`}
                                            aria-hidden="true"
                                        >
                                            {selected ? (
                                                <FaCheck className="size-6 text-white" />
                                            ) : null}
                                        </span>
                                        <span>{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <textarea
                            className="mt-10 min-h-48 w-full resize-none rounded-sm bg-neutral-100 p-4 text-sm font-normal text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                            aria-label="Description"
                            value={description}
                            placeholder="Add a description (optional)"
                            onChange={(event) => setDescription(event.target.value)}
                        />

                        <div className="mt-5 flex gap-3">
                            <button
                                className="rounded-sm bg-neutral-100 px-6 py-3 text-sm text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                                type="button"
                                disabled={launching}
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            <button
                                className="rounded-sm bg-accent px-6 py-3 text-sm text-white transition-colors hover:bg-accent/85 disabled:opacity-50"
                                type="button"
                                disabled={launching || !rating}
                                onClick={() =>
                                    onContinue({
                                        rating,
                                        description,
                                        photoDescriptions: photos.map((photo) =>
                                            photoDescriptions[photo.id]?.trim() || "Menu"
                                        ),
                                    })
                                }
                            >
                                Continue
                            </button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
