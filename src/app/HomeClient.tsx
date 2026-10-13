"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DhikrPreview from "@/components/DhikrPreview";
import {
  COMMON_DHIKRS,
  DEFAULT_DHIKR,
  type Dhikr,
} from "@/lib/dhikr";
import { getSavedName, saveName } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Room } from "@/lib/types";

type Mode = "create" | "join";
type DhikrMode = "standard" | "custom";

export default function HomeClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [goal, setGoal] = useState("12000");
  const [code, setCode] = useState("");
  const [dhikrMode, setDhikrMode] = useState<DhikrMode>("standard");
  const [dhikrKey, setDhikrKey] = useState(DEFAULT_DHIKR.key);
  const [customLabel, setCustomLabel] = useState("");
  const [customArabic, setCustomArabic] = useState("");
  const [customTransliteration, setCustomTransliteration] = useState("");
  const [customMeaning, setCustomMeaning] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const selectedDhikr: Dhikr = useMemo(() => {
    if (dhikrMode === "custom") {
      return {
        key: "custom",
        label: customLabel.trim() || "Custom dhikr",
        arabic: customArabic.trim(),
        transliteration: customTransliteration.trim(),
        meaning: customMeaning.trim(),
      };
    }
    return COMMON_DHIKRS.find((d) => d.key === dhikrKey) ?? DEFAULT_DHIKR;
  }, [
    dhikrMode,
    dhikrKey,
    customLabel,
    customArabic,
    customTransliteration,
    customMeaning,
  ]);

  useEffect(() => {
    setName(getSavedName());
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const displayName = name.trim();
    if (!displayName) {
      setError("Enter your name so the family can see who’s counting.");
      return;
    }
    if (!configured) {
      setError("Supabase is not configured yet. Add env keys and run the schema.");
      return;
    }

    if (mode === "create" && dhikrMode === "custom" && !customLabel.trim()) {
      setError("Give your custom dhikr a name.");
      return;
    }

    saveName(displayName);
    setLoading(true);

    try {
      const supabase = getSupabase();

      if (mode === "create") {
        const title = roomName.trim() || "Family Dhikr";
        const goalNum = Math.max(1, Number(goal) || 12000);
        const { data, error: rpcError } = await supabase.rpc("create_room", {
          p_name: title,
          p_goal: goalNum,
          p_display_name: displayName,
          p_dhikr_key: selectedDhikr.key,
          p_dhikr_label: selectedDhikr.label,
          p_dhikr_arabic: selectedDhikr.arabic,
          p_dhikr_transliteration: selectedDhikr.transliteration,
          p_dhikr_meaning: selectedDhikr.meaning,
        });
        if (rpcError) throw rpcError;
        const room = (Array.isArray(data) ? data[0] : data) as Room;
        router.push(`/room/${room.code}`);
        return;
      }

      const joinCode = code.trim().toUpperCase();
      if (joinCode.length < 4) {
        setError("Enter the room code from your family.");
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc("join_room", {
        p_code: joinCode,
        p_display_name: displayName,
      });
      if (rpcError) throw rpcError;
      const room = (Array.isArray(data) ? data[0] : data) as Room;
      router.push(`/room/${room.code}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-5 pb-10 pt-10 sm:pt-16">
      <header className="animate-rise mb-10 text-center">
        <p className="mb-3 text-sm font-medium tracking-[0.22em] text-[var(--accent-deep)] uppercase">
          Shared counting
        </p>
        <h1 className="font-display text-5xl leading-none tracking-tight text-[var(--ink)] sm:text-6xl">
          Family Dhikr
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-[var(--muted)]">
          A free, live dhikr counter for families. Create a room, invite
          everyone with a code, and count toward your goal together.
        </p>
      </header>

      <section className="glass animate-rise-delay rounded-[28px] p-6 sm:p-8">
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-[rgba(16,41,36,0.06)] p-1">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              mode === "create"
                ? "bg-white text-[var(--ink)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Create room
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              mode === "join"
                ? "bg-white text-[var(--ink)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Join room
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              Your name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Saif"
              className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
              autoComplete="nickname"
              maxLength={40}
            />
          </label>

          {mode === "create" ? (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
                  Room name
                </span>
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Tonight’s dhikr"
                  className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
                  maxLength={60}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
                  Goal (total count)
                </span>
                <input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
                />
              </label>

              <div className="pt-1">
                <p className="mb-2 text-sm font-medium text-[var(--muted)]">
                  Dhikr for this room
                </p>
                <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-[rgba(16,41,36,0.06)] p-1">
                  <button
                    type="button"
                    onClick={() => setDhikrMode("standard")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      dhikrMode === "standard"
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setDhikrMode("custom")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      dhikrMode === "custom"
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {dhikrMode === "standard" ? (
                  <label className="block">
                    <span className="sr-only">Choose dhikr</span>
                    <select
                      value={dhikrKey}
                      onChange={(e) => setDhikrKey(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
                    >
                      {COMMON_DHIKRS.map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="space-y-3">
                    <input
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="Dhikr name"
                      className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
                      maxLength={80}
                    />
                    <input
                      value={customArabic}
                      onChange={(e) => setCustomArabic(e.target.value)}
                      placeholder="Arabic (optional)"
                      dir="auto"
                      className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
                      maxLength={120}
                    />
                    <input
                      value={customTransliteration}
                      onChange={(e) => setCustomTransliteration(e.target.value)}
                      placeholder="Transliteration"
                      className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
                      maxLength={120}
                    />
                    <input
                      value={customMeaning}
                      onChange={(e) => setCustomMeaning(e.target.value)}
                      placeholder="Meaning (optional)"
                      className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
                      maxLength={160}
                    />
                  </div>
                )}

                {(selectedDhikr.arabic ||
                  selectedDhikr.transliteration ||
                  selectedDhikr.meaning) && (
                  <DhikrPreview dhikr={selectedDhikr} className="mt-3" />
                )}
              </div>
            </>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
                Room code
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-center font-display text-2xl tracking-[0.35em] outline-none ring-[var(--ring)] focus:ring-4"
                maxLength={8}
                autoCapitalize="characters"
              />
            </label>
          )}

          {error && (
            <p className="rounded-xl bg-[#f8e8e4] px-3 py-2 text-sm text-[#8a3b2d]">
              {error}
            </p>
          )}

          {!configured && (
            <p className="rounded-xl bg-[#fff4d8] px-3 py-2 text-sm text-[#7a5a12]">
              Add your Supabase URL and anon key to <code>.env.local</code>, then
              run <code>supabase/schema.sql</code> in the SQL editor.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="tap-btn w-full rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-base font-semibold text-white shadow-[0_12px_28px_rgba(47,143,120,0.35)] hover:bg-[var(--accent-deep)] disabled:opacity-60"
          >
            {loading
              ? "Opening…"
              : mode === "create"
                ? "Create & open room"
                : "Join room"}
          </button>
        </form>
      </section>
    </div>
  );
}
