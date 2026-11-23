export type Room = {
  id: string;
  code: string;
  name: string;
  goal: number;
  count: number;
  version: number;
  created_at: string;
  dhikr_key?: string | null;
  dhikr_label?: string | null;
  dhikr_arabic?: string | null;
  dhikr_transliteration?: string | null;
  dhikr_meaning?: string | null;
};

export type RoomMember = {
  id: string;
  display_name: string;
  taps: number;
};

export type EnterRoomResult = {
  room: Room;
  member: RoomMember;
};

export type CountTapsResult = {
  count: number;
  version: number;
  taps: number;
  duplicate: boolean;
};
