import HomeClient from "./HomeClient";
import { COMMON_DHIKRS } from "@/lib/dhikr";
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

      <div className="mx-auto w-full max-w-lg px-5 pb-16">
        <section className="glass rounded-[28px] p-6 sm:p-8">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            Count dhikr together, wherever your family is
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Family Dhikr is a free, live tasbih counter by {brandName}. One
            person creates a room, picks a dhikr and a goal, and shares the
            code. Everyone taps on their own phone, and the shared total updates
            in real time for the whole family, across the globe.
          </p>
          <ol className="mt-5 space-y-2 text-sm text-[var(--ink)]">
            <li>
              <span className="font-semibold">1. Create a room</span>
              <span className="text-[var(--muted)]">
                {" "}
                with a dhikr and a goal, like 12,000.
              </span>
            </li>
            <li>
              <span className="font-semibold">2. Share the code</span>
              <span className="text-[var(--muted)]">
                {" "}
                on WhatsApp or anywhere.
              </span>
            </li>
            <li>
              <span className="font-semibold">3. Count together</span>
              <span className="text-[var(--muted)]">
                {" "}
                and watch the family total rise live.
              </span>
            </li>
          </ol>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            Dhikr you can count
          </h2>
          <ul className="flex flex-wrap gap-2">
            {COMMON_DHIKRS.map((d) => (
              <li
                key={d.key}
                className="rounded-full bg-white/70 px-3 py-1.5 text-sm text-[var(--ink)]"
                title={d.meaning}
              >
                {d.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            Questions
          </h2>
          <div className="glass divide-y divide-[rgba(16,41,36,0.06)] overflow-hidden rounded-2xl">
            {faqs.map((f) => (
              <details key={f.question} className="group px-4 py-3">
                <summary className="cursor-pointer list-none font-medium text-[var(--ink)]">
                  {f.question}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {f.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          Family Dhikr is made by {brandName}.
        </p>
      </div>
    </main>
  );
}
