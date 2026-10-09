export type Dhikr = {
  key: string;
  label: string;
  arabic: string;
  transliteration: string;
  meaning: string;
};

/** Top 10 common dhikrs preloaded for room creation. */
export const COMMON_DHIKRS: Dhikr[] = [
  {
    key: "subhanallah",
    label: "Subhan Allah",
    arabic: "سُبْحَانَ اللَّهِ",
    transliteration: "Subḥān Allāh",
    meaning: "Glory be to Allah",
  },
  {
    key: "alhamdulillah",
    label: "Alhamdulillah",
    arabic: "الْحَمْدُ لِلَّهِ",
    transliteration: "Alḥamdulillāh",
    meaning: "All praise is due to Allah",
  },
  {
    key: "allahu-akbar",
    label: "Allahu Akbar",
    arabic: "اللَّهُ أَكْبَرُ",
    transliteration: "Allāhu Akbar",
    meaning: "Allah is the Greatest",
  },
  {
    key: "la-ilaha-illallah",
    label: "La ilaha illallah",
    arabic: "لَا إِلٰهَ إِلَّا اللَّهُ",
    transliteration: "Lā ilāha illallāh",
    meaning: "There is no god but Allah",
  },
  {
    key: "astaghfirullah",
    label: "Astaghfirullah",
    arabic: "أَسْتَغْفِرُ اللَّهَ",
    transliteration: "Astaghfirullāh",
    meaning: "I seek forgiveness from Allah",
  },
  {
    key: "subhanallahi-wa-bihamdihi",
    label: "Subhanallahi wa bihamdihi",
    arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    transliteration: "Subḥānallāhi wa biḥamdih",
    meaning: "Glory and praise be to Allah",
  },
  {
    key: "subhanallahil-azeem",
    label: "Subhanallahil Azeem",
    arabic: "سُبْحَانَ اللَّهِ الْعَظِيمِ",
    transliteration: "Subḥānallāhil ʿAẓīm",
    meaning: "Glory be to Allah, the Magnificent",
  },
  {
    key: "la-hawla",
    label: "La hawla wa la quwwata",
    arabic: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
    transliteration: "Lā ḥawla wa lā quwwata illā billāh",
    meaning: "There is no power except with Allah",
  },
  {
    key: "salawat",
    label: "Salawat on the Prophet ﷺ",
    arabic: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ",
    transliteration: "Allāhumma ṣalli ʿalā Muḥammad",
    meaning: "O Allah, send blessings upon Muhammad",
  },
  {
    key: "hasbunallah",
    label: "Hasbunallahu wa ni'mal wakeel",
    arabic: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
    transliteration: "Ḥasbunallāhu wa niʿmal wakīl",
    meaning: "Allah is sufficient for us, and He is the best Disposer of affairs",
  },
  {
    key: "amman-yujibul-mudtarra",
    label: "Amman yujībul-muḍṭarra",
    arabic: "أَمَّن يُجِيبُ الْمُضْطَرَّ إِذَا دَعَاهُ وَيَكْشِفُ السُّوءَ",
    transliteration: "Amman yujībul-muḍṭarra idhā daʿāhu wa yakshifus-sūʾ",
    meaning: "Who answers the distressed when they call upon Him and removes evil",
  },
  {
    key: "ya-salamu",
    label: "Ya Salamu",
    arabic: "يَا سَلَامُ",
    transliteration: "Yā Salāmu",
    meaning: "O Source of Peace",
  },
];

export const DEFAULT_DHIKR = COMMON_DHIKRS[0];

export function getDhikrByKey(key: string | null | undefined): Dhikr | null {
  if (!key) return null;
  return COMMON_DHIKRS.find((d) => d.key === key) ?? null;
}

export function roomDhikr(room: {
  dhikr_key?: string | null;
  dhikr_label?: string | null;
  dhikr_arabic?: string | null;
  dhikr_transliteration?: string | null;
  dhikr_meaning?: string | null;
}): Dhikr | null {
  if (room.dhikr_label || room.dhikr_arabic || room.dhikr_transliteration) {
    return {
      key: room.dhikr_key ?? "custom",
      label: room.dhikr_label ?? "Dhikr",
      arabic: room.dhikr_arabic ?? "",
      transliteration: room.dhikr_transliteration ?? "",
      meaning: room.dhikr_meaning ?? "",
    };
  }
  return getDhikrByKey(room.dhikr_key);
}
