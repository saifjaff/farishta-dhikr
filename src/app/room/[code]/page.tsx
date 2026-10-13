import type { Metadata } from "next";
import RoomClient from "./RoomClient";

type Props = {
  params: Promise<{ code: string }>;
};

// Rooms are private family spaces; keep them out of search results.
export const metadata: Metadata = {
  title: "Dhikr room",
  robots: { index: false, follow: true },
};

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  return <RoomClient code={code} />;
}
