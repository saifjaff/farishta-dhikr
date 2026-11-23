// Simulates many people tapping in one room, using the same batching as the app.
// Usage: node --env-file=.env.local scripts/load-test.mjs [clients=30] [seconds=20]
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLIENTS = Number(process.argv[2] ?? 30);
const SECONDS = Number(process.argv[3] ?? 20);
const MIN_GAP = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const admin = createClient(url, key);
const host = randomUUID();
const { data: created, error: createErr } = await admin.rpc("create_room_v2", {
  p_name: `zz load test ${new Date().toISOString().slice(0, 16)}`,
  p_goal: 1_000_000,
  p_display_name: "host",
  p_device_id: host,
});
if (createErr) throw createErr;
const code = created.room.code;
const roomId = created.room.id;
console.log(`room ${code}: ${CLIENTS} clients for ${SECONDS}s`);

const latencies = [];
let rpcErrors = 0;

async function runClient(i) {
  const sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });
  const device = randomUUID();
  const { error } = await sb.rpc("enter_room", {
    p_code: code,
    p_device_id: device,
    p_display_name: `tester ${i}`,
  });
  if (error) throw error;

  const state = { known: { count: 0, version: -1 }, broadcasts: 0, sent: 0 };
  const apply = (count, version) => {
    if (version > state.known.version) state.known = { count, version };
  };
  await new Promise((resolve) => {
    sb.channel(`room-live:${roomId}`)
      .on("broadcast", { event: "count" }, ({ payload }) => {
        state.broadcasts++;
        apply(payload.count, payload.version);
      })
      .subscribe((s) => s === "SUBSCRIBED" && resolve());
  });

  let pending = 0;
  let lastSend = 0;
  let stop = false;
  const tapsPerSecond = 2 + Math.random() * 6;
  const tapper = (async () => {
    const end = Date.now() + SECONDS * 1000;
    while (Date.now() < end) {
      await sleep(1000 / tapsPerSecond);
      pending++;
      state.sent++;
    }
    stop = true;
  })();

  while (!stop || pending > 0) {
    if (pending === 0) {
      await sleep(20);
      continue;
    }
    const wait = lastSend + MIN_GAP - Date.now();
    if (wait > 0) await sleep(wait);
    const delta = pending;
    pending = 0;
    const batch = randomUUID();
    for (let attempt = 0; ; attempt++) {
      lastSend = Date.now();
      const t0 = performance.now();
      const { data, error: e } = await sb.rpc("count_taps", {
        p_code: code,
        p_device_id: device,
        p_batch_id: batch,
        p_delta: delta,
      });
      if (!e) {
        latencies.push(performance.now() - t0);
        apply(data.count, data.version);
        break;
      }
      rpcErrors++;
      await sleep(Math.min(500 * 2 ** attempt, 8000));
    }
  }
  await tapper;
  return { sb, state };
}

const results = await Promise.all(Array.from({ length: CLIENTS }, (_, i) => runClient(i)));
await sleep(2000);
for (const r of results) {
  const { data } = await r.sb.rpc("get_room", { p_code: code });
  r.state.known = { count: data.count, version: data.version };
}

const { data: finalRoom } = await admin.rpc("get_room", { p_code: code });
const { data: members } = await admin.rpc("get_room_members", { p_code: code });
const totalSent = results.reduce((s, r) => s + r.state.sent, 0);
const memberSum = members.reduce((s, m) => s + m.taps, 0);
const agree = results.every((r) => r.state.known.count === finalRoom.count);
const broadcasts = results.map((r) => r.state.broadcasts);
latencies.sort((a, b) => a - b);
const pct = (p) => Math.round(latencies[Math.floor((latencies.length - 1) * p)] ?? 0);

console.log(`taps sent:          ${totalSent}`);
console.log(`server total:       ${finalRoom.count}  ${finalRoom.count === totalSent ? "OK" : "MISMATCH"}`);
console.log(`sum of members:     ${memberSum}  ${memberSum === totalSent ? "OK" : "MISMATCH"}`);
console.log(`all clients agree:  ${agree ? "OK" : "NO"}`);
console.log(`writes:             ${latencies.length} (${(latencies.length / SECONDS).toFixed(1)}/s), errors retried: ${rpcErrors}`);
console.log(`write latency ms:   p50 ${pct(0.5)}, p95 ${pct(0.95)}, max ${pct(1)}`);
console.log(`broadcasts/client:  ${Math.min(...broadcasts)}-${Math.max(...broadcasts)} (${(broadcasts[0] / SECONDS).toFixed(1)}/s)`);
console.log(`test room code:     ${code}`);

await Promise.all(results.map((r) => r.sb.removeAllChannels()));
process.exit(finalRoom.count === totalSent && memberSum === totalSent && agree ? 0 : 1);
