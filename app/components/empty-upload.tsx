import Image from "next/image";

const placeholderImages = [
  {
    src: "/food-placeholders/ramen.png",
    className:
      "z-40 left-[26%] top-[2%] -rotate-3 group-hover:-translate-y-2 group-hover:-rotate-6",
  },
  {
    src: "/food-placeholders/croissant.png",
    className:
      "z-30 right-[3%] top-[12%] rotate-6 group-hover:translate-x-2 group-hover:-translate-y-0.5 group-hover:rotate-9",
  },
  {
    src: "/food-placeholders/cake.png",
    className:
      "z-20 bottom-[1%] right-[25%] rotate-2 group-hover:translate-y-2 group-hover:rotate-3",
  },
  {
    src: "/food-placeholders/dumplings.png",
    className:
      "z-10 bottom-[10%] left-[2%] -rotate-9 group-hover:-translate-x-2 group-hover:translate-y-1 group-hover:-rotate-12",
  },
];

type EmptyUploadProps = {
  processing: boolean;
  message: string;
  onChooseFiles: () => void;
};

export function EmptyUpload({
  processing,
  message,
  onChooseFiles,
}: EmptyUploadProps) {
  return (
    <section
      className="flex min-h-[calc(100vh-150px)] flex-col items-center justify-center px-0 pb-[88px] pt-[30px] text-center"
      aria-live="polite"
    >
      <button
        className="group relative mb-[42px] h-[min(53vw,330px)] w-[min(68vw,430px)] bg-transparent transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
        type="button"
        onClick={onChooseFiles}
        disabled={processing}
        aria-label="Choose photos or zip files"
      >
        {placeholderImages.map(({ src, className }, index) => (
          <span
            className={`absolute block aspect-square w-[clamp(128px,20vw,205px)] overflow-hidden bg-[#f4f4f1] transition-transform duration-300 ${className}`}
            key={src}
          >
            <Image
              src={src}
              alt=""
              fill
              priority={index === 0}
              sizes="220px"
              className="object-cover grayscale"
            />
          </span>
        ))}
      </button>

      <h1 className="m-0 text-[clamp(34px,4vw,56px)] font-medium leading-none tracking-[-0.055em]">
        {processing ? "Sorting your photos…" : "Drop photos here"}
      </h1>
      <p className="mt-4 font-sans text-lg text-[#78837a]">{message}</p>
    </section>
  );
}
