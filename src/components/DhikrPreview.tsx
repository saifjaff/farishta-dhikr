import type { Dhikr } from "@/lib/dhikr";

type Props = {
  dhikr: Dhikr;
  className?: string;
};

export default function DhikrPreview({ dhikr, className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-[rgba(16,41,36,0.08)] bg-white/70 px-4 py-4 text-center ${className}`}
    >
      {dhikr.arabic ? (
        <p
          className="font-display text-3xl leading-relaxed text-[var(--ink)] sm:text-4xl"
          dir="rtl"
          lang="ar"
        >
          {dhikr.arabic}
        </p>
      ) : null}
      {dhikr.transliteration ? (
        <p className="mt-2 text-base font-medium text-[var(--ink)]">
          {dhikr.transliteration}
        </p>
      ) : null}
      {dhikr.meaning ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{dhikr.meaning}</p>
      ) : null}
    </div>
  );
}
