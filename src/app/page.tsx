import HomeClient from "./HomeClient";
import {
  brandName,
  faqs,
  siteDescription,
  siteName,
  siteUrl,
} from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: brandName,
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: siteName,
      alternateName: ["Family Dhikr by Farishta", "Farishta Dhikr"],
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#app`,
      name: siteName,
      alternateName: "Farishta Family Dhikr",
      url: siteUrl,
      description: siteDescription,
      applicationCategory: "LifestyleApplication",
      applicationSubCategory: "Religion & Spirituality",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires a modern web browser",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${siteUrl}/#organization` },
      image: `${siteUrl}/og.png`,
      featureList: [
        "Shared live dhikr rooms with a join code",
        "Real-time group total toward a goal",
        "Group and personal counts",
        "Arabic, transliteration and meaning for each dhikr",
        "Custom dhikr",
        "Works worldwide in any browser",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/#faq`,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ],
};

const steps = [
  {
    title: "Create a room",
    body: "Pick a dhikr and a goal for the family, like 12,000.",
  },
  {
    title: "Share the link",
    body: "Send it on WhatsApp. Family enter their name to join, no app or account needed.",
  },
  {
    title: "Tap to count",
    body: "Every tap adds to one shared total that everyone sees rise live.",
  },
];

const tips = [
  {
    title: "Group or personal",
    body: "Switch to see the family total or just your own count.",
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.5a4.5 4.5 0 0 1 5 4.5" />
      </>
    ),
  },
  {
    title: "Tapped too many?",
    body: "Use the minus button to take one back.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </>
    ),
  },
  {
    title: "Stay focused",
    body: "Hide the dhikr text, progress bar or family list.",
    icon: (
      <>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
  {
    title: "Weak signal is fine",
    body: "Your taps are saved and sent when you are back online.",
    icon: (
      <>
        <path d="M2 9a15 15 0 0 1 20 0" />
        <path d="M5.5 12.5a10 10 0 0 1 13 0" />
        <path d="M9 16a5 5 0 0 1 6 0" />
        <circle cx="12" cy="19.5" r="0.8" fill="currentColor" />
      </>
    ),
  },
];

export default function HomePage() {
  return (
    <main className="min-h-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <HomeClient />

      <dialog
        id="how-it-works"
        aria-labelledby="how-it-works-title"
        className="sheet mx-auto mb-0 mt-auto h-[85dvh] max-h-[85dvh] w-full sm:h-[80dvh] max-w-lg flex-col overflow-hidden rounded-t-[32px] bg-[#f6faf8] p-0 text-[var(--ink)] shadow-[0_-20px_60px_rgba(16,41,36,0.25)] open:flex sm:mb-auto sm:rounded-[32px]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-[rgba(16,41,36,0.15)]" />

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h2
                id="how-it-works-title"
                className="font-display text-3xl leading-tight text-[var(--ink)]"
              >
                How it works
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Count dhikr together as a family, live, from anywhere.
              </p>
            </div>
            <form method="dialog">
              <button
                aria-label="Close"
                className="tap-btn grid h-9 w-9 place-items-center rounded-full bg-[rgba(16,41,36,0.06)] text-[var(--muted)] outline-none"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </form>
          </div>

          <ol className="mt-6 space-y-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-2xl border border-[rgba(16,41,36,0.06)] bg-white p-4 shadow-[0_4px_14px_rgba(16,41,36,0.04)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] font-display text-lg text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-[var(--ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <h3 className="mt-8 mb-3 text-xs font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            Good to know
          </h3>
          <ul className="grid grid-cols-2 gap-3">
            {tips.map((tip) => (
              <li
                key={tip.title}
                className="rounded-2xl bg-[rgba(47,143,120,0.08)] p-3.5"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-[var(--accent-deep)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {tip.icon}
                </svg>
                <p className="mt-2 text-sm font-semibold leading-snug text-[var(--ink)]">
                  {tip.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                  {tip.body}
                </p>
              </li>
            ))}
          </ul>

          <h3 className="mt-8 mb-3 text-xs font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            Questions
          </h3>
          <div className="divide-y divide-[rgba(16,41,36,0.06)] overflow-hidden rounded-2xl border border-[rgba(16,41,36,0.06)] bg-white">
            {faqs.map((f) => (
              <details key={f.question} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 8l5 5 5-5" />
                  </svg>
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-[var(--muted)]">
                  {f.answer}
                </p>
              </details>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            Free, no ads, no account. Made by {brandName}.
          </p>
        </div>

        <form
          method="dialog"
          className="border-t border-[rgba(16,41,36,0.06)] bg-[#f6faf8] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <button className="tap-btn w-full rounded-2xl bg-[var(--accent)] px-4 py-3.5 font-semibold text-white shadow-[0_10px_24px_rgba(47,143,120,0.3)]">
            Start counting
          </button>
        </form>
      </dialog>
    </main>
  );
}
