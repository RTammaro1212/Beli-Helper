"use client";

import { useId, useRef, useState } from "react";

import type {
  PlaceCandidate,
  RestaurantSelection,
} from "../lib/stack-schema";

type PlaceComboboxProps = {
  candidates: PlaceCandidate[];
  selection: RestaurantSelection | null;
  onSelect: (selection: RestaurantSelection) => void;
};

export function PlaceCombobox({
  candidates,
  selection,
  onSelect,
}: PlaceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selection?.name ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsId = useId();

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = candidates.filter((candidate) =>
    candidate.name.toLocaleLowerCase().includes(normalizedQuery),
  );
  const exactCandidate = candidates.find(
    (candidate) => candidate.name.toLocaleLowerCase() === normalizedQuery,
  );
  const isCurrentSelection =
    selection?.name.toLocaleLowerCase() === normalizedQuery;
  const hasCustomOption = Boolean(
    query.trim() && !exactCandidate && !isCurrentSelection,
  );
  const showOptions = open && (hasCustomOption || filtered.length > 0);

  if (!candidates.length) {
    return selection ? (
      <p className="m-0 py-1 font-sans text-[24px] font-medium leading-tight text-[#1b241c]">
        {selection.name}
      </p>
    ) : null;
  }

  const chooseCandidate = (candidate: PlaceCandidate) => {
    onSelect({
      placeId: candidate.placeId,
      name: candidate.name,
      source: "model",
    });
    setQuery(candidate.name);
    setOpen(false);
  };

  const chooseCustom = () => {
    const name = query.trim();
    if (!name) return;
    onSelect({ placeId: null, name, source: "user" });
    setQuery(name);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative z-[80] w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {open ? (
        <input
          ref={inputRef}
          className="w-full bg-[#efeee9] px-2 py-1 text-left font-sans text-[24px] font-medium leading-tight text-[#1b241c] outline-none"
          value={query}
          aria-label="Restaurant name"
          role="combobox"
          aria-expanded={showOptions}
          aria-controls={showOptions ? optionsId : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter") {
              event.preventDefault();
              if (exactCandidate) chooseCandidate(exactCandidate);
              else chooseCustom();
            }
          }}
        />
      ) : (
        <button
          className="w-full bg-transparent py-1 text-left font-sans text-[24px] font-medium leading-tight text-[#1b241c] underline decoration-[#a7aaa6] decoration-1 underline-offset-4"
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.select());
          }}
        >
          {selection?.name ?? "Name this place"}
        </button>
      )}

      {showOptions ? (
        <div
          id={optionsId}
          className="no-scrollbar absolute left-0 top-full z-[100] max-h-[260px] w-[min(420px,calc(100vw-40px))] overflow-y-auto bg-[#f5f4f0] p-2 text-left font-sans"
          role="listbox"
        >
          {hasCustomOption ? (
            <button
              className="block w-full bg-[#e8e6e0] px-3 py-2 text-left text-[15px] text-[#303531] hover:bg-[#dedcd5]"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={chooseCustom}
            >
              Use “{query.trim()}”
            </button>
          ) : null}
          {filtered.map((candidate) => (
            <button
              key={candidate.placeId}
              className="block w-full bg-transparent px-3 py-2 text-left hover:bg-[#e8e6e0]"
              type="button"
              role="option"
              aria-selected={selection?.placeId === candidate.placeId}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseCandidate(candidate)}
            >
              <span className="block text-[15px] font-medium">
                {candidate.name}
              </span>
              {candidate.address ? (
                <span className="block text-[13px] text-[#78837a]">
                  {candidate.address}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
