import { useEffect, useRef, useState } from "react";
import { FaCheck } from "react-icons/fa6";

import type { Photo } from "../lib/photo-types";
import { PhotoImage } from "./photo-image";

export type RankFeedback = {
    rating: "liked" | "fine" | "disliked" | null;
    description: string;
    dishNames: Record<string, string>;
};

type RankingOverlayProps = {
    restaurantName: string;
    photos: Photo[];
    launching: boolean;
    onCancel: () => void;
    onContinue: (feedback: RankFeedback) => void;
};

const ratings = [
    { value: "liked", label: "I liked it!", color: "bg-[#74b894]" },
    { value: "fine", label: "It was fine", color: "bg-[#f6dda0]" },
    { value: "disliked", label: "I didn’t like it", color: "bg-[#efafb1]" },
] as const;

export function RankingOverlay({
    restaurantName,
    photos,
    launching,
    onCancel,
    onContinue,
}: RankingOverlayProps) {
    const [rating, setRating] = useState<RankFeedback["rating"]>(null);
    const [description, setDescription] = useState("");
    const [dishNames, setDishNames] = useState<Record<string, string>>({});
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialogRef.current?.focus();

        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [onCancel]);

    const updateDishName = (photoId: string, name: string) => {
        setDishNames((current) => ({ ...current, [photoId]: name }));
    };

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
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-10">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-8 2xl:grid-cols-3">
                        {photos.map((photo) => (
                            <label className="block min-w-0" key={photo.id}>
                                <span className="relative block aspect-square w-full overflow-hidden bg-neutral-100">
                                    <PhotoImage photo={photo} alt="" />
                                </span>
                                <input
                                    className="mt-3 w-full bg-transparent px-0 py-2 text-sm font-normal text-neutral-950 placeholder:text-neutral-400 focus-visible:outline-none"
                                    type="text"
                                    value={dishNames[photo.id] ?? ""}
                                    placeholder="Name this dish"
                                    aria-label={`Name dish in ${photo.name}`}
                                    onChange={(event) =>
                                        updateDishName(photo.id, event.target.value)
                                    }
                                />
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex shrink-0 gap-3 bg-white px-6 pb-6 pt-4 sm:px-10 sm:pb-10">
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
                            onContinue({ rating, description, dishNames })
                        }
                    >
                        Continue
                    </button>
                </div>
            </section>

            <section className="min-h-0 overflow-y-auto bg-white px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-14">
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
            </section>
        </div>
    );
}
