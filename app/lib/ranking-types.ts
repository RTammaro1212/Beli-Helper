export const RANKING_STEPS = [
    { id: "open_beli", label: "Open Beli" },
    { id: "find_restaurant", label: "Find restaurant" },
    { id: "add_rating", label: "Add rating" },
    { id: "add_notes", label: "Add notes" },
    { id: "set_visit_date", label: "Set visit date" },
    { id: "add_photos", label: "Add photos" },
    { id: "finish_in_beli", label: "Finish in Beli" },
] as const;

export type RankingStepId = (typeof RANKING_STEPS)[number]["id"];
export type RankingStepState = "pending" | "active" | "complete";

export type RankingSessionStatus = {
    id: string;
    clusterId: string;
    state: "running" | "paused" | "cancelled" | "complete" | "error";
    steps: Record<RankingStepId, RankingStepState>;
    error: string | null;
    recovery: "skip_photos" | null;
};
