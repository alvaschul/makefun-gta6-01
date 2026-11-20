// missions.js — Rio Santoso's seven jobs for Mama Lala.
// Rio drives to keep his family's stall by the ferry pier alive; Mama Lala,
// who runs the diner and half the favours in Azura Bay, feeds him work that
// keeps pulling him into the Coral Kings' orbit — Bima "Reef" Prasetyo's
// crew, who want the pier, the wash and eventually the whole shoreline.

import { playCash, playPickup } from "./audio.js";

export const MISSIONS = [
  {
    id: "first-fare",
    title: "First Fare",
    giver: "Mama Lala",
    brief: "A nervous guest at the Pelangi Motel needs a quiet ride to the diner. No questions, no detours.",
    kind: "drive-to",
    target: { name: "Pelangi Motel", x: -196, z: -150 },
    then: { name: "Mama Lala's Diner", x: -60, z: -84 },
    payout: 180,
    dialogue: [
      { who: "Mama Lala", line: "Rio, sayang. Motel Pelangi, room-side kerb. He pays cash, you ask nothing." },
      { who: "Rio", line: "A taxi job. Fine. The stall rent does not care where the money comes from." },
      { who: "Guest", line: "Just drive. If a teal car follows us, drive faster." },
    ],
  },
  {
    id: "parts-run",
    title: "Parts Run",
    giver: "Haris",
    brief: "Pick up a crate of parts from Haris Auto Repair and bring it to the diner before the dinner rush.",
    kind: "pickup",
    target: { name: "Haris Auto Repair", x: -150, z: 40 },
    then: { name: "Mama Lala's Diner", x: -60, z: -84 },
    payout: 220,
    dialogue: [
      { who: "Haris", line: "Gearbox parts, fragile as eggs. You crack them, you bought them." },
      { who: "Mama Lala", line: "My nephew's food truck dies without that crate, Rio. Gentle hands." },
    ],
  },
  {
    id: "sirena-night",
    title: "Sirena Night",
    giver: "Mama Lala",
    brief: "Club Sirena's singer missed her ride. Collect her and get her to the club before the first set.",
    kind: "pickup",
    target: { name: "Santa Rosa Hospital", x: -96, z: 176 },
    then: { name: "Club Sirena", x: 96, z: -168 },
    payout: 300,
    dialogue: [
      { who: "Mama Lala", line: "Sinta sings at Sirena tonight. She is waiting by Santa Rosa, don't ask why." },
      { who: "Sinta", line: "If Reef's boys are at the club, we go in the back way. Agreed?" },
    ],
  },
  {
    id: "budi-favour",
    title: "Budi's Favour",
    giver: "Budi",
    brief: "Budi at Toko Senjata needs a package moved to the harbour crates. The Coral Kings must not see it.",
    kind: "deliver",
    target: { name: "Toko Senjata Budi", x: 30, z: 96 },
    then: { name: "Harbour crates", x: 262, z: -40 },
    payout: 420,
    dialogue: [
      { who: "Budi", line: "In the boot, under the blanket. You are delivering fishing gear, understand?" },
      { who: "Rio", line: "Heavy fishing gear. Sure, Budi. This is the last favour." },
      { who: "Budi", line: "It is never the last favour in Azura Bay, anak." },
    ],
  },
  {
    id: "reef-warning",
    title: "Reef's Warning",
    giver: "Mama Lala",
    brief: "A Coral Kings driver is shadowing Rio. Lose him, then report back to the diner.",
    kind: "chase",
    target: { name: "Mama Lala's Diner", x: -60, z: -84 },
    payout: 500,
    dialogue: [
      { who: "Mama Lala", line: "Teal car, no plates — Reef is sending you a message. Shake him off, Rio." },
      { who: "Bima 'Reef' Prasetyo", line: "Nice driving, stall boy. The pier could use a driver like you." },
      { who: "Rio", line: "Tell Reef the pier is not his. And neither am I." },
    ],
  },
  {
    id: "clean-wash",
    title: "Clean Wash",
    giver: "Mama Lala",
    brief: "Things got loud. Get the car to Splash & Go, respray it, and let the heat die down.",
    kind: "escape",
    target: { name: "Splash & Go Car Wash & Respray", x: 150, z: 78 },
    payout: 350,
    dialogue: [
      { who: "Mama Lala", line: "Straight to Splash & Go, Rio. New colour, new car, no story." },
      { who: "Rio", line: "One wash and the whole bay forgets. I love this town." },
    ],
  },
  {
    id: "pier-stand",
    title: "The Pier Stand",
    giver: "Mama Lala",
    brief: "Reef is coming for the family stall tonight. Drive to the harbour and stand your ground — then bring Sinta home to the diner.",
    kind: "deliver",
    target: { name: "Harbour crates", x: 262, z: -40 },
    then: { name: "Mama Lala's Diner", x: -60, z: -84 },
    payout: 900,
    dialogue: [
      { who: "Mama Lala", line: "Tonight we find out what Azura Bay is made of. Drive, Rio." },
      { who: "Bima 'Reef' Prasetyo", line: "Last chance, stall boy. Walk away from the pier." },
      { who: "Rio", line: "My family fed this pier for thirty years. You walk away." },
      { who: "Mama Lala", line: "It is over. The stall stays ours — and so does the shoreline." },
    ],
  },
];

let index = -1;
let phase = "idle"; // idle | active | done
let leg = 0; // 0 = go to target, 1 = go to "then"
let current = null;
let dialogueQueue = [];
let ctxRef = null;

export function initMissions(ctx) {
  ctxRef = ctx;
  index = ctx?.saveData?.missionIndex ?? -1;
  phase = "idle";
  current = null;
  leg = 0;
}

export function startNextMission() {
  index += 1;
  if (index >= MISSIONS.length) {
    phase = "done";
    current = null;
    return null;
  }
  current = MISSIONS[index];
  phase = "active";
  leg = 0;
  dialogueQueue = current.dialogue.slice();
  ctxRef?.hud?.showDialogue?.(dialogueQueue[0]?.who, dialogueQueue[0]?.line);
  return current;
}

export function currentMission() {
  return current;
}

export function missionIndex() {
  return index;
}

export function currentObjectiveText() {
  if (phase === "done") return "Story complete — Azura Bay is yours to roam.";
  if (!current) return "Head to Mama Lala's Diner to find work.";
  const dest = leg === 0 ? current.target : current.then;
  if (!dest) return current.brief;
  const verbs = {
    "drive-to": "Drive to",
    pickup: leg === 0 ? "Pick up at" : "Drop off at",
    chase: "Lose your tail, then reach",
    deliver: leg === 0 ? "Collect at" : "Deliver to",
    escape: "Escape to",
  };
  return `${current.title}: ${verbs[current.kind] || "Go to"} ${dest.name}`;
}

export function currentTarget() {
  if (!current) {
    // Idle: point the player at the diner, where work is picked up.
    return { x: -60, z: -84, radius: 9, isDiner: true };
  }
  const dest = leg === 0 ? current.target : current.then;
  if (!dest) return null;
  return { x: dest.x, z: dest.z, radius: 9, isDiner: false };
}

export function advanceDialogue() {
  dialogueQueue.shift();
  const next = dialogueQueue[0];
  if (next) ctxRef?.hud?.showDialogue?.(next.who, next.line);
  else ctxRef?.hud?.hideDialogue?.();
  return next || null;
}

function completeMission() {
  const payout = current.payout;
  ctxRef.addCash(payout);
  playCash();
  ctxRef.hud?.showToast?.(`${current.title} complete — Rp ${payout}`);
  ctxRef.hud?.hideDialogue?.();
  phase = "idle";
  const finished = current;
  current = null;
  ctxRef.saveProgress?.();
  return finished;
}

// Called every frame by main. Returns a status string for the HUD/debug.
export function updateMissions(dt, ctx) {
  if (phase === "done") return "done";
  const target = currentTarget();
  if (!target) return phase;
  const dx = ctx.playerPos.x - target.x;
  const dz = ctx.playerPos.z - target.z;
  const dist = Math.hypot(dx, dz);
  if (dist > target.radius) return phase;

  if (!current && target.isDiner) {
    startNextMission();
    return "started";
  }
  if (!current) return phase;

  // Arrived at a leg destination.
  playPickup();
  if (leg === 0 && current.then) {
    leg = 1;
    advanceDialogue();
    ctx.hud?.showToast?.(`Next: ${current.then.name}`);
    return "leg-complete";
  }
  if (current.kind === "escape") {
    // The respray itself is handled by main/police; arriving ends the job.
    ctx.requestRespray?.();
  }
  if (current.kind === "chase" && ctx.wantedNow > 0) {
    ctx.hud?.showToast?.("You still have heat — lose the police first!");
    return "blocked";
  }
  completeMission();
  return "complete";
}
