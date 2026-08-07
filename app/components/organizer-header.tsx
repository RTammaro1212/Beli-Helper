import Link from "next/link";

type OrganizerHeaderProps = {
  hasPhotos: boolean;
  processing: boolean;
  onChooseFiles: () => void;
  onLabel: () => void;
};

export function OrganizerHeader({
  hasPhotos,
  processing,
  onChooseFiles,
  onLabel,
}: OrganizerHeaderProps) {
  return (
    <header className="relative z-10 grid min-h-[92px] grid-cols-[1fr_auto_1fr] items-center max-[680px]:min-h-[78px]">
      <button
        className="w-fit justify-self-start bg-[#e5f3e6] px-4 py-2 font-sans text-[15px] text-[#087e2b] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        onClick={onChooseFiles}
        disabled={processing}
      >
        {hasPhotos ? "Add photos" : "Choose files"}
      </button>

      <Link
        className="text-[clamp(30px,3vw,42px)] font-medium leading-none tracking-[-0.055em] no-underline max-[680px]:text-[29px]"
        href="/"
        aria-label="Auto Beli home"
      >
        Auto Beli
      </Link>

      {hasPhotos ? (
        <button
          className="w-fit justify-self-end bg-[#1c9c42] px-4 py-2 font-sans text-[15px] text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 max-[680px]:px-3"
          type="button"
          disabled={processing}
          onClick={onLabel}
        >
          Label
        </button>
      ) : null}
    </header>
  );
}
