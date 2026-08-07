"use client";

import type { IconType } from "react-icons";
import {
    FaBreadSlice,
    FaIceCream,
    FaMartiniGlass,
    FaMugHot,
    FaUtensils,
} from "react-icons/fa6";

import {
    MEAL_CATEGORIES,
    type MealCategory,
} from "../lib/stack-schema";

const CATEGORY_ICONS: Record<MealCategory, IconType> = {
    Restaurant: FaUtensils,
    Bar: FaMartiniGlass,
    "Coffee/Tea": FaMugHot,
    Bakery: FaBreadSlice,
    "Dessert/Ice Cream": FaIceCream,
};

type MealCategoryMenuProps = {
    value: MealCategory;
    onChange: (category: MealCategory) => void;
};

export function MealCategoryMenu({
    value,
    onChange,
}: MealCategoryMenuProps) {
    const CategoryIcon = CATEGORY_ICONS[value];

    return (
        <div className="flex w-fit min-w-0 items-center gap-2 bg-accent/10 px-3 py-2 text-neutral-800 rounded-sm justify-center">
            <CategoryIcon className="size-4 shrink-0 text-accent" aria-hidden="true" />
            <select
                className="min-w-0 field-sizing-content w-fit appearance-none inline-block bg-transparent font-sans text-sm font-semibold text-neutral-800 outline-none focus:outline-none"
                aria-label="Location type"
                value={value}
                onChange={(event) => onChange(event.target.value as MealCategory)}
            >
                {MEAL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                        {category}
                    </option>
                ))}
            </select>
        </div>
    );
}
