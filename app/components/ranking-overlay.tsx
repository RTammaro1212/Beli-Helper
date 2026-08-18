import { useEffect, useRef, useState } from "react";
import {
    FaBreadSlice,
    FaCheck,
    FaHeart,
    FaIceCream,
    FaMartiniGlass,
    FaMugHot,
    FaUtensils,
} from "react-icons/fa6";
import SquareLoader from "react-spinners/SquareLoader";

import type { Photo } from "../lib/photo-types";
import type { MealCategory } from "../lib/stack-schema";
import {
    RANKING_STEPS,
    type RankingSessionStatus,
    type RankingStepId,
} from "../lib/ranking-types";
import { PhotoImage } from "./photo-image";

export type RankFeedback = {
    rating: "liked" | "fine" | "disliked" | null;
    category: MealCategory;
    companions: string[];
    labels: string[];
    description: string;
    additionalFavoriteDishes: string[];
    photoDescriptions: string[];
    favoritePhotoIndexes: number[];
};

type RankingOverlayProps = {
    restaurantName: string;
    initialCategory: MealCategory;
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

const categories = [
    { value: "Restaurant", label: "Restaurants", icon: FaUtensils },
    { value: "Bar", label: "Bars", icon: FaMartiniGlass },
    { value: "Bakery", label: "Bakeries", icon: FaBreadSlice },
    { value: "Coffee/Tea", label: "Coffee & Tea", icon: FaMugHot },
    {
        value: "Dessert/Ice Cream",
        label: "Ice Cream & Dessert",
        icon: FaIceCream,
    },
] as const satisfies ReadonlyArray<{
    value: MealCategory;
    label: string;
    icon: typeof FaUtensils;
}>;

const beliLabelGroups = [
    {
        label: "Good for",
        options: [
            "Afternoon Tea",
            "After Work",
            "Atmosphere",
            "AYCE",
            "Beer",
            "Birthdays",
            "Bottomless Brunch",
            "Breakfast",
            "Brunch",
            "Business Lunch",
            "BYOB",
            "Cash Only",
            "Casual Dinner",
            "Cheap Eats",
            "Cocktails",
            "Coffee",
            "Dancing",
            "Date Night",
            "Delivery",
            "Dessert",
            "Dog Friendly",
            "Family Friendly",
            "Fine Dining",
            "First Date",
            "Girl's Night",
            "Gluten Free",
            "Good Music",
            "Great Service",
            "Halal",
            "Hangovers",
            "Happy Hour",
            "Healthy",
            "Hidden Gem",
            "Karaoke",
            "Kid Friendly",
            "Large Group (8+)",
            "Large Portions",
            "Last-Minute Res",
            "Late Night",
            "LGBTQ+",
            "Live Music",
            "Lunch",
            "Mocktails",
            "National Shipping",
            "Night Out",
            "On the Water",
            "Outdoor Seating",
            "Parents",
            "Photos",
            "Pre-Theatre",
            "Private Events",
            "Quick Bite",
            "Romantic",
            "Rooftop",
            "Sharing",
            "Small Plates",
            "Solo Dining",
            "Speakeasy",
            "Special Occasion",
            "Spicy",
            "Sports / TVs",
            "Takeout",
            "Tasting Menu",
            "Trendy",
            "Trivia",
            "Vegans",
            "Vegetarians",
            "Views",
            "Visitors",
            "Walk-ins",
            "Wine List",
            "Working",
        ],
    },
    {
        label: "What was wrong?",
        options: [
            "Bad Ambiance",
            "Bad Food",
            "Bad Music",
            "Bad Service",
            "Expensive",
            "Hard to Park",
            "Hard To Reserve",
            "Limited Options",
            "Limited Seating",
            "Long Wait",
            "Overpriced",
            "Overrated",
            "Small Portions",
            "Too Crowded",
            "Too Loud",
            "Touristy",
            "Traveled Badly",
            "Unhealthy",
            "Unsanitary",
            "Walk-in Only",
        ],
    },
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
    initialCategory,
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
    const [category, setCategory] = useState<MealCategory>(initialCategory);
    const [companions, setCompanions] = useState("");
    const [labels, setLabels] = useState<string[]>([]);
    const [labelSearch, setLabelSearch] = useState("");
    const [rawNotes, setRawNotes] = useState("");
    const [description, setDescription] = useState("");
    const [additionalFavoriteDishes, setAdditionalFavoriteDishes] = useState("");
    const [favoritePhotoIds, setFavoritePhotoIds] = useState<string[]>([]);
    const [drafting, setDrafting] = useState(false);
    const [draftError, setDraftError] = useState<string | null>(null);
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
    const celebrating = progress?.celebrating || completed;
    const favoritePhotoIndexes = photos.flatMap((photo, index) =>
        favoritePhotoIds.includes(photo.id) ? [index] : [],
    );
    const favoriteDishNames = favoritePhotoIndexes
        .map((index) => photoDescriptions[photos[index].id]?.trim())
        .filter((value): value is string => Boolean(value));

    const writeDraft = async () => {
        if (!rating || drafting) return;
        setDrafting(true);
        setDraftError(null);
        try {
            const response = await fetch("/api/review-draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    restaurantName,
                    rating,
                    companions: companions
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    labels,
                    rawNotes,
                    dishes: photos
                        .map((photo) => photoDescriptions[photo.id]?.trim())
                        .filter(Boolean),
                    favoriteDishes: [
                        ...favoriteDishNames,
                        ...additionalFavoriteDishes
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                    ],
                }),
            });
            const result = (await response.json()) as {
                draft?: string;
                error?: string;
            };
            if (!response.ok || !result.draft) {
                throw new Error(result.error ?? "Could not write a review draft.");
            }
            setDescription(result.draft);
        } catch (error) {
            setDraftError(
                error instanceof Error ? error.message : "Could not write a review draft.",
            );
        } finally {
            setDrafting(false);
        }
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
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-10">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-8 2xl:grid-cols-3">
                        {photos.map((photo) => {
                            const photoDescription = photoDescriptions[photo.id] ?? "";
                            const isFavorite = favoritePhotoIds.includes(photo.id);
                            return (
                            <div className="block min-w-0" key={photo.id}>
                                <span className="relative block aspect-square w-full overflow-hidden bg-neutral-100">
                                    <PhotoImage photo={photo} alt="" />
                                </span>
                                <input
                                    className="mt-3 w-full rounded-sm bg-neutral-100 px-4 py-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                                    aria-label={`Dish description for ${photo.name}`}
                                    type="text"
                                    disabled={showingProgress}
                                    value={photoDescription}
                                    placeholder="What’s this?"
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setPhotoDescriptions((current) => ({
                                            ...current,
                                            [photo.id]: value,
                                        }));
                                        if (!value.trim()) {
                                            setFavoritePhotoIds((current) =>
                                                current.filter((id) => id !== photo.id),
                                            );
                                        }
                                    }}
                                />
                                <button
                                    className={`mt-2 flex items-center gap-2 rounded-sm px-3 py-2 text-xs transition-colors disabled:cursor-default disabled:opacity-40 ${isFavorite ? "bg-[#f8dfe0] text-[#8d3438]" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                                    type="button"
                                    aria-pressed={isFavorite}
                                    disabled={showingProgress || !photoDescription.trim()}
                                    onClick={() =>
                                        setFavoritePhotoIds((current) =>
                                            isFavorite
                                                ? current.filter((id) => id !== photo.id)
                                                : [...current, photo.id],
                                        )
                                    }
                                >
                                    <FaHeart className="size-3.5" aria-hidden="true" />
                                    Favorite dish
                                </button>
                            </div>
                            );
                        })}
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

                        {celebrating ? (
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

                        <div className="mt-6 grid grid-cols-2 gap-2">
                            {categories.map((option) => {
                                const selected = category === option.value;
                                const CategoryIcon = option.icon;
                                return (
                                    <button
                                        className={`flex items-center justify-center gap-2 rounded-sm px-3 py-3 text-sm font-semibold transition-colors ${selected ? "bg-accent text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
                                        type="button"
                                        aria-pressed={selected}
                                        key={option.value}
                                        onClick={() => setCategory(option.value)}
                                    >
                                        <CategoryIcon className="size-4" aria-hidden="true" />
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex flex-col gap-5">
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

                        <div className="mt-10 flex flex-col gap-3">
                            <input
                                className="w-full rounded-sm bg-neutral-100 px-4 py-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                                aria-label="Who did you go with"
                                type="text"
                                value={companions}
                                placeholder="Who did you go with? (separate names with commas)"
                                onChange={(event) => setCompanions(event.target.value)}
                            />
                            <details className="group/labels relative">
                                <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm bg-neutral-100 px-4 py-3 text-sm text-neutral-950 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 [&::-webkit-details-marker]:hidden">
                                    <span>
                                        {labels.length
                                            ? `${labels.length} label${labels.length === 1 ? "" : "s"} selected`
                                            : "Add labels"}
                                    </span>
                                    <span
                                        className="text-neutral-500 transition-transform group-open/labels:rotate-180"
                                        aria-hidden="true"
                                    >
                                        ▾
                                    </span>
                                </summary>
                                <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-sm bg-neutral-50 p-3">
                                    <input
                                        className="sticky top-0 z-10 w-full rounded-sm bg-white px-4 py-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                                        aria-label="Search Beli labels"
                                        type="search"
                                        value={labelSearch}
                                        placeholder="Search labels"
                                        onChange={(event) =>
                                            setLabelSearch(event.target.value)
                                        }
                                    />
                                    {beliLabelGroups.map((group) => {
                                        const options = group.options.filter((option) =>
                                            option
                                                .toLowerCase()
                                                .includes(labelSearch.trim().toLowerCase()),
                                        );
                                        if (!options.length) return null;
                                        return (
                                            <div className="mt-4" key={group.label}>
                                                <p className="px-1 text-sm font-semibold text-neutral-950">
                                                    {group.label}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {options.map((option) => {
                                                        const selected = labels.includes(option);
                                                        return (
                                                            <button
                                                                className={`rounded-sm px-3 py-2 text-left text-xs transition-colors ${selected ? "bg-accent text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
                                                                type="button"
                                                                aria-pressed={selected}
                                                                key={option}
                                                                onClick={() =>
                                                                    setLabels((current) =>
                                                                        selected
                                                                            ? current.filter(
                                                                                  (value) =>
                                                                                      value !==
                                                                                      option,
                                                                              )
                                                                            : [...current, option],
                                                                    )
                                                                }
                                                            >
                                                                {option}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                            <textarea
                                className="min-h-32 w-full resize-none rounded-sm bg-neutral-100 p-4 text-sm font-normal text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                                aria-label="What stood out or disappointed"
                                value={rawNotes}
                                placeholder="What stood out or disappointed?"
                                onChange={(event) => setRawNotes(event.target.value)}
                            />
                            <button
                                className="self-start rounded-sm bg-neutral-100 px-4 py-2.5 text-sm text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                                type="button"
                                disabled={!rating || drafting}
                                onClick={() => void writeDraft()}
                            >
                                {drafting ? "Writing draft…" : "Write first draft"}
                            </button>
                            {draftError ? (
                                <p className="m-0 text-sm text-[#9b3f43]">{draftError}</p>
                            ) : null}
                            <textarea
                                className="min-h-44 w-full resize-y rounded-sm bg-neutral-100 p-4 text-sm font-normal text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                                aria-label="Review draft"
                                value={description}
                                placeholder="Review draft"
                                onChange={(event) => setDescription(event.target.value)}
                            />
                            <input
                                className="w-full rounded-sm bg-neutral-100 px-4 py-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                                aria-label="Additional favorite dishes"
                                type="text"
                                value={additionalFavoriteDishes}
                                placeholder="Additional favorite dishes (separate with commas)"
                                onChange={(event) => setAdditionalFavoriteDishes(event.target.value)}
                            />
                        </div>

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
                                        category,
                                        companions: companions
                                            .split(",")
                                            .map((value) => value.trim())
                                            .filter(Boolean),
                                        labels,
                                        description: description.trim() || rawNotes.trim(),
                                        additionalFavoriteDishes: additionalFavoriteDishes
                                            .split(",")
                                            .map((value) => value.trim())
                                            .filter(Boolean),
                                        photoDescriptions: photos.map((photo) =>
                                            photoDescriptions[photo.id]?.trim() || ""
                                        ),
                                        favoritePhotoIndexes,
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
