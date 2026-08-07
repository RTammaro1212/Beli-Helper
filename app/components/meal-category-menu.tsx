"use client";

import { useId, useRef, useState } from "react";

import {
  MEAL_CATEGORIES,
  type MealCategory,
} from "../lib/stack-schema";

type MealCategoryMenuProps = {
  value: MealCategory;
  onChange: (category: MealCategory) => void;
};

export function MealCategoryMenu({
  value,
  onChange,
}: MealCategoryMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative w-fit font-sans"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        className="flex items-center gap-2 bg-[#efeee9] px-2.5 py-1 text-[14px] text-[#4f5650] transition-colors hover:bg-[#e6e4de]"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span>{value}</span>
        <span aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div
          id={menuId}
          className="absolute left-0 top-full z-[90] mt-1 min-w-[190px] bg-[#f5f4f0] p-1.5"
          role="listbox"
          aria-label="Meal category"
        >
          {MEAL_CATEGORIES.map((category) => (
            <button
              key={category}
              className="block w-full bg-transparent px-2.5 py-2 text-left text-[14px] text-[#303531] transition-colors hover:bg-[#e8e6e0]"
              type="button"
              role="option"
              aria-selected={category === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(category);
                setOpen(false);
              }}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
