"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DhikrPreview from "@/components/DhikrPreview";
import { COMMON_DHIKRS, DEFAULT_DHIKR, type Dhikr } from "@/lib/dhikr";
import { getDeviceId, getSavedName, saveName } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { EnterRoomResult } from "@/lib/types";

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

  useEffect(() => {
    const sheet = document.getElementById("how-it-works");
    if (!(sheet instanceof HTMLDialogElement)) return;
    const closeOnBackdrop = (e: MouseEvent) => {
      if (e.target === sheet) sheet.close();
    };
    sheet.addEventListener("click", closeOnBackdrop);
    return () => sheet.removeEventListener("click", closeOnBackdrop);
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
      setError(
        "Supabase is not configured yet. Add env keys and run the schema.",
      );
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
        const { data, error: rpcError } = await supabase.rpc("create_room_v2", {
          p_name: title,
          p_goal: goalNum,
          p_display_name: displayName,
          p_device_id: getDeviceId(),
          p_dhikr_key: selectedDhikr.key,
          p_dhikr_label: selectedDhikr.label,
          p_dhikr_arabic: selectedDhikr.arabic,
          p_dhikr_transliteration: selectedDhikr.transliteration,
          p_dhikr_meaning: selectedDhikr.meaning,
        });
        if (rpcError) throw rpcError;
        const { room } = data as EnterRoomResult;
        router.push(`/room/${room.code}`);
        return;
      }

      const joinCode = code.trim().toUpperCase();
      if (joinCode.length < 4) {
        setError("Enter the room code from your family.");
        setLoading(false);
        return;
      }

      // The room page links this device to the name saved above.
      const { error: rpcError } = await supabase.rpc("get_room", {
        p_code: joinCode,
      });
      if (rpcError) {
        throw new Error(
          rpcError.message.includes("room_not_found")
            ? "No room uses that code. Check it with your family."
            : rpcError.message,
        );
      }
      router.push(`/room/${joinCode}`);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Something went wrong. Try again.";
      setError(message);
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-3.5 py-2.5 text-base outline-none ring-[var(--ring)] focus:ring-4";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col justify-center px-4 py-6">
      <header className="animate-rise mb-4 text-center">
        <h1 className="font-display text-4xl leading-none tracking-tight text-[var(--ink)] sm:text-5xl">
          Family Dhikr
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Count dhikr together, live.{" "}
          <button
            type="button"
            onClick={() =>
              (
                document.getElementById(
                  "how-it-works",
                ) as HTMLDialogElement | null
              )?.showModal()
            }
            className="font-medium text-[var(--accent-deep)] underline underline-offset-4"
          >
            How it works
          </button>
        </p>
      </header>

      <section className="glass animate-rise-delay rounded-[28px] p-4 sm:p-6">
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-[rgba(16,41,36,0.06)] p-1">
          {(["create", "join"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === m
                  ? "bg-white text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)]"
              }`}
            >
              {m === "create" ? "Create room" : "Join room"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className={labelClass}>Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Saif"
              className={inputClass}
              autoComplete="nickname"
              maxLength={40}
            />
          </label>

          {mode === "create" ? (
            <>
              <div className="flex gap-2">
                <label className="block min-w-0 flex-1">
                  <span className={labelClass}>Room name</span>
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Tonight’s dhikr"
                    className={inputClass}
                    maxLength={60}
                  />
                </label>
                <label className="block w-28">
                  <span className={labelClass}>Goal</span>
                  <input
                    value={goal}
                    onChange={(e) =>
                      setGoal(e.target.value.replace(/[^\d]/g, ""))
                    }
                    inputMode="numeric"
                    className={inputClass}
                  />
                </label>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--muted)]">
                    Dhikr
                  </span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-[rgba(16,41,36,0.06)] p-0.5">
                    {(["standard", "custom"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDhikrMode(m)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          dhikrMode === m
                            ? "bg-[var(--accent)] text-white shadow-sm"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {m === "standard" ? "Standard" : "Custom"}
                      </button>
                    ))}
                  </div>
                </div>

                {dhikrMode === "standard" ? (
                  <label className="block">
                    <span className="sr-only">Choose dhikr</span>
                    <select
                      value={dhikrKey}
                      onChange={(e) => setDhikrKey(e.target.value)}
                      className={`${inputClass} appearance-none`}
                    >
                      {COMMON_DHIKRS.map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="Dhikr name"
                      className={inputClass}
                      maxLength={80}
                    />
                    <input
                      value={customArabic}
                      onChange={(e) => setCustomArabic(e.target.value)}
                      placeholder="Arabic (optional)"
                      dir="auto"
                      className={inputClass}
                      maxLength={120}
                    />
                    <div className="flex gap-2">
                      <input
                        value={customTransliteration}
                        onChange={(e) =>
                          setCustomTransliteration(e.target.value)
                        }
                        placeholder="Transliteration"
                        className={`${inputClass} min-w-0 flex-1`}
                        maxLength={120}
                      />
                      <input
                        value={customMeaning}
                        onChange={(e) => setCustomMeaning(e.target.value)}
                        placeholder="Meaning"
                        className={`${inputClass} min-w-0 flex-1`}
                        maxLength={160}
                      />
                    </div>
                  </div>
                )}

                {(selectedDhikr.arabic ||
                  selectedDhikr.transliteration ||
                  selectedDhikr.meaning) && (
                  <DhikrPreview
                    dhikr={selectedDhikr}
                    compact
                    className="mt-2"
                  />
                )}
              </div>
            </>
          ) : (
            <label className="block">
              <span className={labelClass}>Room code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD2345"
                className={`${inputClass} text-center font-display text-2xl tracking-[0.3em]`}
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
              Add your Supabase URL and anon key to <code>.env.local</code>,
              then run <code>supabase/schema.sql</code> in the SQL editor.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="tap-btn w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(47,143,120,0.35)] hover:bg-[var(--accent-deep)] disabled:opacity-60"
          >
            {loading
              ? "Opening…"
              : mode === "create"
                ? "Create & open room"
                : "Join room"}
          </button>
        </form>
      </section>

      <p className="mt-5 text-center text-xs text-[var(--muted)]">
        Made by the{" "}
        <a
          href="https://farishta.si"
          className="font-medium text-[var(--accent-deep)] underline underline-offset-4"
        >
          Farishta
        </a>{" "}
        team
      </p>
    </div>
  );
}
