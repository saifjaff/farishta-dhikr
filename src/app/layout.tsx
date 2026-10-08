import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const siteUrl = "https://family-dhikr.vercel.app";
const shareDescription =
  "Remember Allah together. Create a room and count dhikr with your family.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Family Dhikr",
    template: "%s · Family Dhikr",
  },
  description: shareDescription,
  applicationName: "Family Dhikr",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Family Dhikr",
    title: "Family Dhikr",
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
    title: "Family Dhikr",
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
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
