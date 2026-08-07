import { useState } from "react";
import { FaCheck } from "react-icons/fa6";

export type RankFeedback = {
    rating: "liked" | "fine" | "disliked" | null;
    description: string;
};

type RankingOverlayProps = {
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
    launching,
    onCancel,
    onContinue,
}: RankingOverlayProps) {
    const [rating, setRating] = useState<RankFeedback["rating"]>(null);
    const [description, setDescription] = useState("");

    return (
        <div
            className="absolute inset-0 z-[120] flex flex-col bg-neutral-200/95 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ranking-title"
        >
            <h2
                className="m-0 text-center text-xl font-semibold text-neutral-950"
                id="ranking-title"
            >
                How was it?
            </h2>

            <div className="mt-6 grid grid-cols-3 gap-3">
                {ratings.map((option) => {
                    const selected = rating === option.value;
                    return (
                        <button
                            className="flex min-w-0 flex-col items-center gap-3 bg-transparent text-sm font-normal text-neutral-700"
                            type="button"
                            aria-pressed={selected}
                            key={option.value}
                            onClick={() => setRating(option.value)}
                        >
                            <span
                                className={`grid aspect-square w-full max-w-20 place-items-center rounded-full ${option.color} transition-transform hover:scale-105`}
                                aria-hidden="true"
                            >
                                {selected ? (
                                    <FaCheck className="size-7 text-white" />
                                ) : null}
                            </span>
                            <span>{option.label}</span>
                        </button>
                    );
                })}
            </div>

            <textarea
                className="mt-6 min-h-28 w-full flex-1 resize-none rounded-sm bg-white p-3 text-sm font-normal text-neutral-950 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                aria-label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
            />

            <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                    className="rounded-sm bg-neutral-300 px-4 py-3 text-sm text-neutral-800 transition-colors hover:bg-neutral-400 disabled:opacity-50"
                    type="button"
                    disabled={launching}
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <button
                    className="rounded-sm bg-accent px-4 py-3 text-sm text-white transition-colors hover:bg-accent/85 disabled:opacity-50"
                    type="button"
                    disabled={launching}
                    onClick={() => onContinue({ rating, description })}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
