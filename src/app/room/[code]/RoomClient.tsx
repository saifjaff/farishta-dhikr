"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DhikrPreview from "@/components/DhikrPreview";
import { roomDhikr } from "@/lib/dhikr";
import {
  getDeviceId,
  getSavedName,
  loadQueue,
  saveName,
  saveQueue,
  type TapQueue,
} from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";
import type {
  CountTapsResult,
  EnterRoomResult,
  Room,
  RoomMember,
} from "@/lib/types";

type Props = {
  code: string;
};

const dhikrHiddenKey = (code: string) => `family-dhikr:hide-dhikr:${code}`;
const progressHiddenKey = (code: string) =>
  `family-dhikr:hide-progress:${code}`;
const familyHiddenKey = (code: string) => `family-dhikr:hide-family:${code}`;

type CountMode = "group" | "personal";
type Phase = "loading" | "needs-name" | "ready" | "not-found" | "failed";

// Minimum gap between writes while tapping fast; taps in between are sent together.
const MIN_SEND_GAP_MS = 300;
const MAX_BATCH = 1000;
const MEMBERS_POLL_MS = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorText(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

export default function RoomClient({ code }: Props) {
  const roomCode = code.toUpperCase();
  const [phase, setPhase] = useState<Phase>("loading");
  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<RoomMember | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [nameTaken, setNameTaken] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bump, setBump] = useState(false);
  const [dhikrOpen, setDhikrOpen] = useState(true);
  const [countMode, setCountMode] = useState<CountMode>("group");
  const [progressOpen, setProgressOpen] = useState(true);
  const [familyOpen, setFamilyOpen] = useState(true);
  // Taps not yet confirmed by the server, shown on top of the confirmed counts.
  const [unconfirmed, setUnconfirmed] = useState(0);

  const deviceIdRef = useRef("");
  const queueRef = useRef<TapQueue>({ pending: 0, inflight: null });
  const joinedRef = useRef(false);
  const aliveRef = useRef(true);
  const sendingRef = useRef(false);
  const lastSendAtRef = useRef(0);
  const versionRef = useRef(-1);
  const countModeRef = useRef<CountMode>("group");
  const familyOpenRef = useRef(true);
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groupCount = Math.max(0, (room?.count ?? 0) + unconfirmed);
  const personalCount = Math.max(0, (me?.taps ?? 0) + unconfirmed);
  const displayCount = countMode === "personal" ? personalCount : groupCount;

  const progress = useMemo(() => {
    if (!room || room.goal <= 0) return 0;
    return Math.min(100, (groupCount / room.goal) * 100);
  }, [room, groupCount]);

  const progressLabel = useMemo(() => {
    if (progress >= 100) return "100%";
    if (progress > 0 && progress < 1) return `${progress.toFixed(2)}%`;
    if (progress < 10) return `${progress.toFixed(1)}%`;
    return `${Math.round(progress)}%`;
  }, [progress]);

  const activeDhikr = useMemo(() => (room ? roomDhikr(room) : null), [room]);

  const flashBump = useCallback(() => {
    setBump(true);
    window.setTimeout(() => setBump(false), 220);
  }, []);

  const persistQueue = useCallback(() => {
    saveQueue(roomCode, queueRef.current);
    const q = queueRef.current;
    setUnconfirmed(q.pending + (q.inflight?.delta ?? 0));
  }, [roomCode]);

  /** Applies a server room total only if it is newer than what we have. */
  const applyServerCount = useCallback(
    (count: number, version: number, fromOthers: boolean) => {
      if (version <= versionRef.current) return;
      versionRef.current = version;
      setRoom((prev) => {
        if (!prev) return prev;
        if (
          fromOthers &&
          prev.count !== count &&
          countModeRef.current === "group"
        ) {
          setBump(true);
          window.setTimeout(() => setBump(false), 220);
        }
        return { ...prev, count, version };
      });
    },
    [],
  );

  const loadMembers = useCallback(async () => {
    const { data, error: rpcError } = await getSupabase().rpc(
      "get_room_members",
      { p_code: roomCode },
    );
    if (!rpcError && data && aliveRef.current) {
      setMembers(data as RoomMember[]);
    }
  }, [roomCode]);

  const fetchRoom = useCallback(async () => {
    if (queueRef.current.inflight) return;
    const { data, error: rpcError } = await getSupabase().rpc("get_room", {
      p_code: roomCode,
    });
    // Our own write may have started meanwhile; its reply is authoritative.
    if (rpcError || !data || queueRef.current.inflight) return;
    const next = data as Room;
    applyServerCount(next.count, next.version, true);
  }, [roomCode, applyServerCount]);

  const scheduleReconcile = useCallback(
    (ms: number) => {
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
      reconcileTimerRef.current = setTimeout(() => {
        reconcileTimerRef.current = null;
        void fetchRoom();
      }, ms);
    },
    [fetchRoom],
  );

  // One write in flight at a time. A failed batch keeps its id and is retried,
  // so the server can recognise and ignore a batch it already applied.
  const drain = useCallback(async () => {
    if (sendingRef.current || !joinedRef.current) return;
    sendingRef.current = true;
    let backoff = 500;
    try {
      while (aliveRef.current) {
        const q = queueRef.current;
        if (!q.inflight) {
          if (q.pending === 0) break;
          const wait = lastSendAtRef.current + MIN_SEND_GAP_MS - Date.now();
          if (wait > 0) await sleep(wait);
          const delta = Math.max(
            -MAX_BATCH,
            Math.min(MAX_BATCH, queueRef.current.pending),
          );
          if (delta === 0) break;
          queueRef.current = {
            pending: queueRef.current.pending - delta,
            inflight: { id: crypto.randomUUID(), delta },
          };
          persistQueue();
        }

        const batch = queueRef.current.inflight!;
        lastSendAtRef.current = Date.now();
        try {
          const { data, error: rpcError } = await getSupabase().rpc(
            "count_taps",
            {
              p_code: roomCode,
              p_device_id: deviceIdRef.current,
              p_batch_id: batch.id,
              p_delta: batch.delta,
            },
          );
          if (rpcError) throw rpcError;
          const res = data as CountTapsResult;
          queueRef.current = { ...queueRef.current, inflight: null };
          persistQueue();
          applyServerCount(res.count, res.version, false);
          setMe((m) => (m ? { ...m, taps: res.taps } : m));
          setOffline(false);
          backoff = 500;
        } catch (err) {
          const msg = errorText(err);
          if (
            msg.includes("room_not_found") ||
            msg.includes("invalid_batch") ||
            msg.includes("not_joined")
          ) {
            queueRef.current = { ...queueRef.current, inflight: null };
            persistQueue();
            setError("Some taps could not be saved. Please reopen the room.");
            continue;
          }
          setOffline(true);
          await sleep(backoff);
          backoff = Math.min(backoff * 2, 8000);
        }
      }
    } finally {
      sendingRef.current = false;
      if (aliveRef.current) scheduleReconcile(600);
    }
  }, [roomCode, persistQueue, applyServerCount, scheduleReconcile]);

  const refresh = useCallback(() => {
    if (!joinedRef.current || !aliveRef.current) return;
    void drain();
    void fetchRoom();
    if (familyOpenRef.current) void loadMembers();
  }, [drain, fetchRoom, loadMembers]);

  const finishEnter = useCallback(
    (res: EnterRoomResult) => {
      if (res.room.version > versionRef.current) {
        versionRef.current = res.room.version;
      }
      setRoom(res.room);
      setMe(res.member);
      setNameTaken(false);
      joinedRef.current = true;
      setPhase("ready");
      void loadMembers();
      void drain();
    },
    [loadMembers, drain],
  );

  const enter = useCallback(
    async (name: string | null, claim = false): Promise<string | null> => {
      const { data, error: rpcError } = await getSupabase().rpc("enter_room", {
        p_code: roomCode,
        p_device_id: deviceIdRef.current,
        p_display_name: name,
        p_claim: claim,
      });
      if (!aliveRef.current) return null;
      if (rpcError) return errorText(rpcError);
      finishEnter(data as EnterRoomResult);
      return null;
    },
    [roomCode, finishEnter],
  );

  const showNameGate = useCallback(
    async (taken: boolean) => {
      setNameTaken(taken);
      setPhase("needs-name");
      const { data } = await getSupabase().rpc("get_room", {
        p_code: roomCode,
      });
      if (data && aliveRef.current) setRoom(data as Room);
    },
    [roomCode],
  );

  useEffect(() => {
    countModeRef.current = countMode;
  }, [countMode]);

  useEffect(() => {
    familyOpenRef.current = familyOpen;
  }, [familyOpen]);

  useEffect(() => {
    setDhikrOpen(localStorage.getItem(dhikrHiddenKey(roomCode)) !== "1");
    setProgressOpen(localStorage.getItem(progressHiddenKey(roomCode)) !== "1");
    setFamilyOpen(localStorage.getItem(familyHiddenKey(roomCode)) !== "1");
  }, [roomCode]);

  // Boot: identify this device, restore unsent taps, and enter the room.
  useEffect(() => {
    aliveRef.current = true;
    deviceIdRef.current = getDeviceId();
    queueRef.current = loadQueue(roomCode);
    persistQueue();
    const savedName = getSavedName().trim();
    setNameDraft(savedName);

    (async () => {
      let err = await enter(null);
      if (err?.includes("name_required") && savedName) {
        err = await enter(savedName);
      }
      if (!err || !aliveRef.current) return;
      if (err.includes("room_not_found")) setPhase("not-found");
      else if (err.includes("name_required")) void showNameGate(false);
      else if (err.includes("name_taken")) void showNameGate(true);
      else {
        setError(err);
        setPhase("failed");
      }
    })();

    return () => {
      aliveRef.current = false;
      joinedRef.current = false;
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
      if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
    };
  }, [roomCode, enter, persistQueue, showNameGate]);

  // Live room totals over Broadcast, sent by the database at most every 250ms.
  const roomId = room?.id;
  useEffect(() => {
    if (phase !== "ready" || !roomId) return;
    const supabase = getSupabase();
    const topic = `room-live:${roomId}`;
    for (const existing of supabase.getChannels()) {
      if (existing.topic === `realtime:${topic}`) {
        void supabase.removeChannel(existing);
      }
    }
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "count" }, ({ payload }) => {
        const { count, version } = payload as {
          count: number;
          version: number;
        };
        if (!queueRef.current.inflight) {
          applyServerCount(count, version, true);
        }
        // Throttling can skip the last update of a burst; fetch once things go quiet.
        if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = setTimeout(() => {
          trailingTimerRef.current = null;
          void fetchRoom();
        }, 1200);
      })
      .subscribe((status) => {
        // Fires on connect and every reconnect; missed broadcasts aren't replayed.
        if (status === "SUBSCRIBED") refresh();
      });

    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channel);
    };
  }, [phase, roomId, applyServerCount, fetchRoom, refresh]);

  useEffect(() => {
    if (phase !== "ready" || !familyOpen) return;
    void loadMembers();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMembers();
    }, MEMBERS_POLL_MS);
    return () => window.clearInterval(id);
  }, [phase, familyOpen, loadMembers]);

  function toggleDhikr() {
    setDhikrOpen((open) => {
      const next = !open;
      localStorage.setItem(dhikrHiddenKey(roomCode), next ? "0" : "1");
      return next;
    });
  }

  function toggleProgress() {
    setProgressOpen((open) => {
      const next = !open;
      localStorage.setItem(progressHiddenKey(roomCode), next ? "0" : "1");
      return next;
    });
  }

  function toggleFamily() {
    setFamilyOpen((open) => {
      const next = !open;
      localStorage.setItem(familyHiddenKey(roomCode), next ? "0" : "1");
      return next;
    });
  }

  function adjust(delta: number) {
    if (phase !== "ready") return;
    if (delta < 0 && groupCount <= 0) return;
    if (delta < 0 && countMode === "personal" && personalCount <= 0) return;
    queueRef.current = {
      ...queueRef.current,
      pending: queueRef.current.pending + delta,
    };
    persistQueue();
    flashBump();
    void drain();
  }

  async function submitName(e: React.FormEvent, claim = false) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setJoining(true);
    setError(null);
    const err = await enter(trimmed, claim);
    setJoining(false);
    if (!err) {
      saveName(trimmed);
      return;
    }
    if (err.includes("name_taken")) setNameTaken(true);
    else if (err.includes("room_not_found")) setPhase("not-found");
    else setError(err);
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

  if (phase === "not-found" || phase === "failed") {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="font-display text-3xl">
          {phase === "not-found" ? "Room not found" : "Could not open room"}
        </h1>
        <p className="text-[var(--muted)]">
          {phase === "not-found"
            ? `No room uses the code ${roomCode}. Check the code with your family.`
            : error}
        </p>
        <Link
          href="/"
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
        >
          Back home
        </Link>
      </main>
    );
  }

  if (phase === "needs-name") {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-5 py-10">
        <header className="animate-rise mb-8 text-center">
          <p className="mb-2 text-sm font-medium tracking-[0.2em] text-[var(--accent-deep)] uppercase">
            You&apos;re invited
          </p>
          <h1 className="font-display text-4xl tracking-tight text-[var(--ink)]">
            {room?.name ?? "Dhikr room"}
          </h1>
          {room && (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Goal {room.goal.toLocaleString()} ·{" "}
              {room.count.toLocaleString()} counted so far
            </p>
          )}
        </header>
        <form
          onSubmit={(e) => submitName(e)}
          className="glass animate-rise-delay rounded-[28px] p-6"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              Your name, so the family can see who&apos;s counting
            </span>
            <input
              value={nameDraft}
              onChange={(e) => {
                setNameDraft(e.target.value);
                setNameTaken(false);
              }}
              className="w-full rounded-2xl border border-[rgba(16,41,36,0.1)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--ring)] focus:ring-4"
              placeholder="e.g. Saif"
              autoComplete="nickname"
              maxLength={40}
              autoFocus
            />
          </label>
          {nameTaken && (
            <div className="mt-3 rounded-xl bg-[#fff4d8] px-3 py-2 text-sm text-[#7a5a12]">
              Someone named {nameDraft.trim()} is already counting in this room
              on another device. Use a different name, or if that&apos;s you,
              continue as them.
              <button
                type="button"
                onClick={(e) => submitName(e, true)}
                disabled={joining}
                className="mt-2 block font-semibold underline"
              >
                That&apos;s me, continue as {nameDraft.trim()}
              </button>
            </div>
          )}
          {error && (
            <p className="mt-3 rounded-xl bg-[#f8e8e4] px-3 py-2 text-sm text-[#8a3b2d]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={joining || !nameDraft.trim()}
            className="tap-btn mt-4 w-full rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
          >
            {joining ? "Joining…" : "Join room"}
          </button>
        </form>
      </main>
    );
  }

  if (phase === "loading" || !room) {
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
          } ${
            progress >= 100 && countMode === "group"
              ? "animate-count-pulse"
              : ""
          }`}
        >
          {displayCount.toLocaleString()}
        </p>

        {progressOpen ? (
          <button
            type="button"
            onClick={toggleProgress}
            className="mx-auto mt-6 block w-full max-w-xs"
            aria-label="Hide progress"
          >
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgba(16,41,36,0.08)]">
              <div
                className="progress-fill h-full rounded-full bg-[var(--accent)]"
                style={{
                  width: `${Math.max(progress, groupCount > 0 ? 0.4 : 0)}%`,
                }}
              />
            </div>
            <p className="mt-2 tabular-nums text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">
                {groupCount.toLocaleString()}
              </span>
              {" of "}
              {room.goal.toLocaleString()}
              {" · "}
              {progressLabel}
              {progress >= 100 ? " · Goal reached, mashaAllah" : ""}
            </p>
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleProgress}
            className="mx-auto mt-6 block text-xs font-medium tracking-[0.12em] text-[var(--muted)] uppercase opacity-70"
          >
            Show progress
          </button>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={
              groupCount <= 0 ||
              (countMode === "personal" && personalCount <= 0)
            }
            className="tap-btn rounded-3xl border border-[rgba(16,41,36,0.12)] bg-white/80 py-6 text-4xl font-light text-[var(--ink)] disabled:opacity-40"
            aria-label="Decrease count"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => adjust(1)}
            className="tap-btn rounded-3xl bg-[var(--accent)] py-6 text-4xl font-light text-white shadow-[0_16px_32px_rgba(47,143,120,0.35)] disabled:opacity-60"
            aria-label="Increase count"
          >
            +
          </button>
        </div>

        {offline && (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Reconnecting… your taps are saved and will be sent.
          </p>
        )}
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
        <button
          type="button"
          onClick={toggleFamily}
          className="mb-3 flex w-full items-center justify-between text-left"
          aria-expanded={familyOpen}
        >
          <h2 className="text-sm font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            Family in this room
            {!familyOpen && members.length > 0 ? ` · ${members.length}` : ""}
          </h2>
          <span
            className={`text-[var(--muted)] transition-transform ${
              familyOpen ? "" : "rotate-180"
            }`}
            aria-hidden
          >
            ⌃
          </span>
        </button>
        {familyOpen && (
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
                <span className="font-medium">
                  {member.display_name}
                  {member.id === me?.id ? (
                    <span className="ml-1.5 text-xs text-[var(--muted)]">
                      (you)
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-[var(--muted)]">
                  {(member.id === me?.id
                    ? personalCount
                    : member.taps
                  ).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
