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
            className="mx-auto flex min-h-[calc(100vh-160px)] max-w-7xl flex-col items-center justify-center gap-6 pb-24 text-center"
            aria-live="polite"
        >
            <button
                className="group relative h-[min(53vw,330px)] w-[min(68vw,430px)] bg-transparent transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
                type="button"
                onClick={onChooseFiles}
                disabled={processing}
                aria-label="Choose photos or zip files"
            >
                {placeholderImages.map(({ src, className }, index) => (
                    <span
                        className={`absolute block aspect-square w-48 overflow-hidden bg-neutral-100 transition-transform duration-300 ${className}`}
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

            <h1 className="m-0 font-sans text-3xl font-semibold leading-none tracking-[-0.04em] text-neutral-950">
                {processing ? "Sorting your photos…" : "Drop photos here"}
            </h1>
        </section>
    );
}
