export type Room = {
  id: string;
  code: string;
  name: string;
  goal: number;
  count: number;
  created_at: string;
  dhikr_key?: string | null;
  dhikr_label?: string | null;
  dhikr_arabic?: string | null;
  dhikr_transliteration?: string | null;
  dhikr_meaning?: string | null;
};

export type RoomMember = {
  id: string;
  room_id: string;
  display_name: string;
  taps: number;
  last_seen: string;
};
