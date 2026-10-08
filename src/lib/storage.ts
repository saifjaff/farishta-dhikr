const NAME_KEY = "family-dhikr:display-name";

export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function saveName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim());
}
