import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import {
  brandName,
  shareDescription,
  siteDescription,
  siteName,
  siteTitle,
  siteUrl,
} from "@/lib/site";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s · Family Dhikr",
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "family dhikr",
    "dhikr counter",
    "group dhikr",
    "tasbih counter",
    "online tasbeeh",
    "zikr counter",
    "Farishta",
    "Farishta app",
    "Islamic app",
    "religion app",
  ],
  creator: brandName,
  publisher: brandName,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  category: "religion",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: siteName,
    title: siteTitle,
    description: shareDescription,
    images: [
      {
        url: "/og.png",
        width: 1024,
        height: 1024,
        alt: "Family Dhikr",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: shareDescription,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a4a42",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
