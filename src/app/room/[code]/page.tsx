import RoomClient from "./RoomClient";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  return <RoomClient code={code} />;
}
