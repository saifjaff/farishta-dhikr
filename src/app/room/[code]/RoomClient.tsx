"use client";

import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DhikrPreview from "@/components/DhikrPreview";
import { roomDhikr } from "@/lib/dhikr";
import { getSavedName, saveName } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";
import { getClientId, TAP_FLUSH_MS, type TapBroadcast } from "@/lib/tap-sync";
import type { Room, RoomMember } from "@/lib/types";

type Props = {
  code: string;
};

const dhikrHiddenKey = (code: string) => `family-dhikr:hide-dhikr:${code}`;

type CountMode = "group" | "personal";

function bumpPersonal(
  members: RoomMember[],
  displayName: string,
  delta: number,
  roomId: string,
): RoomMember[] {
  if (delta <= 0) return members;
  const me = displayName.trim().toLowerCase();
  const idx = members.findIndex(
    (m) => m.display_name.trim().toLowerCase() === me,
  );
  if (idx === -1) {
    return [
      ...members,
      {
        id: `local-${displayName}`,
        room_id: roomId,
        display_name: displayName,
        taps: delta,
        last_seen: new Date().toISOString(),
      },
    ];
  }
  return members.map((m, i) =>
    i === idx ? { ...m, taps: m.taps + delta } : m,
  );
}

export default function RoomClient({ code }: Props) {
  const roomCode = code.toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bump, setBump] = useState(false);
  const [dhikrOpen, setDhikrOpen] = useState(true);
  const [countMode, setCountMode] = useState<CountMode>("group");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingDeltaRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);
  const displayNameRef = useRef("");
  const clientIdRef = useRef("");
  const membersReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const progress = useMemo(() => {
    if (!room || room.goal <= 0) return 0;
    return Math.min(100, (room.count / room.goal) * 100);
  }, [room]);

  const progressLabel = useMemo(() => {
    if (!room) return "0%";
    if (progress >= 100) return "100%";
    if (progress > 0 && progress < 1) return `${progress.toFixed(2)}%`;
    if (progress < 10) return `${progress.toFixed(1)}%`;
    return `${Math.round(progress)}%`;
  }, [room, progress]);

  const activeDhikr = useMemo(
    () => (room ? roomDhikr(room) : null),
    [room],
  );

  const personalCount = useMemo(() => {
    const me = name.trim().toLowerCase();
    if (!me) return 0;
    const member = members.find(
      (m) => m.display_name.trim().toLowerCase() === me,
    );
    return member?.taps ?? 0;
  }, [members, name]);

  const displayCount =
    countMode === "personal" ? personalCount : (room?.count ?? 0);

  const loadMembers = useCallback(async (roomId: string) => {
    const supabase = getSupabase();
    const { data, error: membersError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .order("taps", { ascending: false });
    if (membersError) throw membersError;
    setMembers((data ?? []) as RoomMember[]);
  }, []);

  const scheduleMembersReload = useCallback(
    (roomId: string) => {
      if (membersReloadTimerRef.current) return;
      membersReloadTimerRef.current = setTimeout(() => {
        membersReloadTimerRef.current = null;
        void loadMembers(roomId);
      }, 1200);
    },
    [loadMembers],
  );

  const pulse = useCallback(() => {
    setBump(true);
    window.setTimeout(() => setBump(false), 180);
  }, []);

  const applyLocalDelta = useCallback(
    (delta: number, displayName: string) => {
      setRoom((prev) =>
        prev ? { ...prev, count: Math.max(0, prev.count + delta) } : prev,
      );
      if (delta > 0) {
        setMembers((prev) =>
          bumpPersonal(prev, displayName, delta, room?.id ?? ""),
        );
      }
      pulse();
    },
    [pulse, room?.id],
  );

  const flushPending = useCallback(async () => {
    if (flushingRef.current) return;
    const delta = pendingDeltaRef.current;
    if (delta === 0) return;

    pendingDeltaRef.current = 0;
    flushingRef.current = true;
    const displayName = displayNameRef.current;

    try {
      const { data, error: rpcError } = await getSupabase().rpc(
        "adjust_room_count",
        {
          p_code: roomCode,
          p_delta: delta,
          p_display_name: displayName || null,
        },
      );
      if (rpcError) throw rpcError;

      // Only trust server count when nothing else is queued
      if (pendingDeltaRef.current === 0) {
        const updated = (Array.isArray(data) ? data[0] : data) as Room;
        setRoom(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
      const { data } = await getSupabase()
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .single();
      if (data && pendingDeltaRef.current === 0) {
        setRoom(data as Room);
      }
    } finally {
      flushingRef.current = false;
      if (pendingDeltaRef.current !== 0) {
        void flushPending();
      }
    }
  }, [roomCode]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void flushPending();
    }, TAP_FLUSH_MS);
  }, [flushPending]);

  useEffect(() => {
    const saved = getSavedName();
    setName(saved);
    setNameDraft(saved);
    displayNameRef.current = saved;
    clientIdRef.current = getClientId();
    const hidden = localStorage.getItem(dhikrHiddenKey(roomCode)) === "1";
    setDhikrOpen(!hidden);
  }, [roomCode]);

  function toggleDhikr() {
    setDhikrOpen((open) => {
      const next = !open;
      localStorage.setItem(dhikrHiddenKey(roomCode), next ? "0" : "1");
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const supabase = getSupabase();
        const { data, error: roomError } = await supabase
          .from("rooms")
          .select("*")
          .eq("code", roomCode)
          .single();
        if (roomError) throw roomError;
        if (cancelled) return;

        const current = data as Room;
        setRoom(current);
        await loadMembers(current.id);

        const savedName = getSavedName().trim();
        if (savedName) {
          displayNameRef.current = savedName;
          await supabase.rpc("join_room", {
            p_code: roomCode,
            p_display_name: savedName,
          });
          if (!cancelled) await loadMembers(current.id);
        }

        const channel = supabase
          .channel(`room-live:${roomCode}`, {
            config: { broadcast: { self: false } },
          })
          .on(
            "broadcast",
            { event: "tap" },
            ({ payload }) => {
              const tap = payload as TapBroadcast;
              if (!tap || tap.clientId === clientIdRef.current) return;
              if (!tap.delta) return;
              applyLocalDelta(tap.delta, tap.displayName || "Guest");
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "rooms",
              filter: `id=eq.${current.id}`,
            },
            (payload) => {
              // Reconcile from DB only when local queue is idle
              if (
                pendingDeltaRef.current !== 0 ||
                flushingRef.current ||
                flushTimerRef.current
              ) {
                return;
              }
              setRoom(payload.new as Room);
            },
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "room_members",
              filter: `room_id=eq.${current.id}`,
            },
            () => {
              scheduleMembersReload(current.id);
            },
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not open this room.",
          );
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (membersReloadTimerRef.current) {
        clearTimeout(membersReloadTimerRef.current);
        membersReloadTimerRef.current = null;
      }
      // Flush any leftover taps before leaving
      if (pendingDeltaRef.current !== 0) {
        void flushPending();
      }
      if (channelRef.current) {
        void getSupabase().removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    roomCode,
    loadMembers,
    applyLocalDelta,
    scheduleMembersReload,
    flushPending,
  ]);

  async function ensureName(): Promise<string | null> {
    const trimmed = name.trim() || nameDraft.trim();
    if (!trimmed) {
      setError("Add your name before counting.");
      return null;
    }
    if (trimmed !== name) {
      saveName(trimmed);
      setName(trimmed);
      setNameDraft(trimmed);
      displayNameRef.current = trimmed;
      await getSupabase().rpc("join_room", {
        p_code: roomCode,
        p_display_name: trimmed,
      });
    } else {
      displayNameRef.current = trimmed;
    }
    return trimmed;
  }

  async function adjust(delta: number) {
    setError(null);
    const displayName = await ensureName();
    if (!displayName) return;

    // 1) Instant local UI
    applyLocalDelta(delta, displayName);

    // 2) Instant realtime to everyone else (Broadcast)
    const payload: TapBroadcast = {
      clientId: clientIdRef.current || getClientId(),
      displayName,
      delta,
      at: Date.now(),
    };
    void channelRef.current?.send({
      type: "broadcast",
      event: "tap",
      payload,
    });

    // 3) Queue durable DB write (batched, still near-realtime)
    pendingDeltaRef.current += delta;
    scheduleFlush();
  }

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    saveName(trimmed);
    setName(trimmed);
    displayNameRef.current = trimmed;
    setError(null);
    try {
      await getSupabase().rpc("join_room", {
        p_code: roomCode,
        p_display_name: trimmed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save name.");
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy code.");
    }
  }

  if (error && !room) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="font-display text-3xl">Room not found</h1>
        <p className="text-[var(--muted)]">{error}</p>
        <Link
          href="/"
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
        >
          Back home
        </Link>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg items-center justify-center px-5">
        <p className="text-[var(--muted)]">Opening room…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-5 pb-10 pt-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Rooms
        </Link>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold tracking-[0.18em] text-[var(--accent-deep)]"
        >
          {copied ? "Copied" : room.code}
        </button>
      </div>

      <header className="animate-rise mb-8 text-center">
        <h1 className="font-display text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
          {room.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Goal {room.goal.toLocaleString()} · share code{" "}
          <span className="font-semibold tracking-widest">{room.code}</span>
        </p>
      </header>

      {!name && (
        <form
          onSubmit={saveDisplayName}
          className="glass mb-5 rounded-2xl p-4 animate-rise"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              Your name to join this room
            </span>
            <div className="flex gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="w-full rounded-xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-3 py-2.5 outline-none ring-[var(--ring)] focus:ring-4"
                placeholder="Your name"
                maxLength={40}
              />
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2.5 font-semibold text-white"
              >
                Join
              </button>
            </div>
          </label>
        </form>
      )}

      <section className="glass animate-rise-delay rounded-[28px] px-5 py-8 text-center sm:px-8">
        <div className="mx-auto mb-4 grid max-w-[220px] grid-cols-2 gap-1 rounded-2xl bg-[rgba(16,41,36,0.06)] p-1">
          <button
            type="button"
            onClick={() => setCountMode("group")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              countMode === "group"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Group
          </button>
          <button
            type="button"
            onClick={() => setCountMode("personal")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              countMode === "personal"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Personal
          </button>
        </div>
        <p className="mb-2 text-sm font-medium tracking-[0.2em] text-[var(--muted)] uppercase">
          {countMode === "personal" ? "Your count" : "Count"}
        </p>
        <p
          className={`font-display text-7xl leading-none tracking-tight text-[var(--ink)] sm:text-8xl ${
            bump ? "count-bump" : ""
          } ${progress >= 100 ? "animate-count-pulse" : ""}`}
        >
          {displayCount.toLocaleString()}
        </p>

        <div className="mx-auto mt-6 h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-[rgba(16,41,36,0.08)]">
          <div
            className="progress-fill h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${Math.max(progress, room.count > 0 ? 0.4 : 0)}%` }}
          />
        </div>
        <p className="mt-2 tabular-nums text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">
            {room.count.toLocaleString()}
          </span>
          {" of "}
          {room.goal.toLocaleString()}
          {" · "}
          {progressLabel}
          {progress >= 100 ? " · Goal reached, mashaAllah" : ""}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void adjust(-1)}
            disabled={room.count <= 0}
            className="tap-btn rounded-3xl border border-[rgba(16,41,36,0.12)] bg-white/80 py-6 text-4xl font-light text-[var(--ink)] disabled:opacity-40"
            aria-label="Decrease count"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => void adjust(1)}
            className="tap-btn rounded-3xl bg-[var(--accent)] py-6 text-4xl font-light text-white shadow-[0_16px_32px_rgba(47,143,120,0.35)]"
            aria-label="Increase count"
          >
            +
          </button>
        </div>
      </section>

      {error && (
        <p className="mt-4 rounded-xl bg-[#f8e8e4] px-3 py-2 text-sm text-[#8a3b2d]">
          {error}
        </p>
      )}

      {activeDhikr && (
        <section className="glass mt-5 overflow-hidden rounded-2xl animate-rise">
          <button
            type="button"
            onClick={toggleDhikr}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={dhikrOpen}
          >
            <span className="text-sm font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">
              Dhikr · Arabic & transliteration
            </span>
            <span
              className={`text-[var(--muted)] transition-transform ${
                dhikrOpen ? "" : "rotate-180"
              }`}
              aria-hidden
            >
              ⌃
            </span>
          </button>
          {dhikrOpen && (
            <div className="border-t border-[rgba(16,41,36,0.06)] px-4 pb-4 pt-3">
              <p className="mb-2 text-center text-sm font-medium text-[var(--accent-deep)]">
                {activeDhikr.label}
              </p>
              <DhikrPreview
                dhikr={activeDhikr}
                className="border-0 bg-transparent px-0 py-1"
              />
            </div>
          )}
        </section>
      )}

      <section className="mt-6 animate-rise">
        <h2 className="mb-3 text-sm font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
          Family in this room
        </h2>
        <ul className="glass divide-y divide-[rgba(16,41,36,0.06)] overflow-hidden rounded-2xl">
          {members.length === 0 && (
            <li className="px-4 py-4 text-sm text-[var(--muted)]">
              No one has joined yet.
            </li>
          )}
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="font-medium">{member.display_name}</span>
              <span className="tabular-nums text-[var(--muted)]">
                {member.taps.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
