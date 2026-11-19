// NEON HARBOR v2 — story missions and the courier side job.
// Seven chained jobs for Mama Lala, driven through callbacks into the
// main game so this module never touches three.js or the DOM itself.
//
// Objective kinds understood by the director:
//   reach    — get to the checkpoint (on foot or driving)
//   deliver  — reach the checkpoint while driving the marked car
//   clearout — defeat every gang member spawned at the checkpoint
//   escape   — lose the police (stars must reach zero)
//   race     — hit a series of checkpoints before the timer ends

import { CFG, NAMES } from "./config.js";

export const MISSIONS = [
  {
    id: "m1-first-run",
    title: "First Run",
    payout: 220,
    intro: [
      { who: NAMES.fixer, text: "Rio. You look thinner than your father's stories. Sit. Eat. Then drive." },
      { who: NAMES.fixer, text: "A cooler of medicine for old Pak Darma at the Pelangi Motel. No questions, no detours." },
      { who: NAMES.hero, text: "Driving I can do. Trouble?" },
      { who: NAMES.fixer, text: "In Azura Bay? Trouble is the weather, nak. Just bring the car back whole." },
    ],
    objective: { kind: "reach", landmark: "motel", text: "Drive to the Pelangi Motel" },
    outro: [
      { who: NAMES.fixer, text: "Pak Darma sends his thanks. You drive like your father — careful hands, heavy foot." },
    ],
  },
  {
    id: "m2-sirena-shift",
    title: "Sirena Shift",
    payout: 340,
    intro: [
      { who: NAMES.fixer, text: "Club Sirena needs a singer delivered before the midnight set. She is... particular." },
      { who: NAMES.fixer, text: "Pick her up at the club, bring her to the diner. My nephew welded the doors. Don't ask." },
    ],
    objective: { kind: "reach", landmark: "club", text: "Pick up the singer at Club Sirena", secondLeg: { landmark: "diner", text: "Drop the singer at Mama Lala's Diner" } },
    outro: [
      { who: NAMES.fixer, text: "She sang in the car the whole way, didn't she? She does that. Good work." },
    ],
  },
  {
    id: "m3-hot-metal",
    title: "Hot Metal",
    payout: 480,
    heat: 40,
    intro: [
      { who: NAMES.fixer, text: "A coral-red coupe is parked by Haris Auto. The Kings stole it from a friend of mine." },
      { who: NAMES.fixer, text: "Take it back and deliver it to the garage. If the Kings complain, that is their hobby, not yours." },
    ],
    objective: { kind: "reach", landmark: "garage", text: "Steal the coupe and deliver it to Haris Auto Repair", requiresTheft: true },
    outro: [
      { who: NAMES.fixer, text: "Haris says the engine purrs. The Kings will sulk for a week. Let them." },
    ],
  },
  {
    id: "m4-coral-warning",
    title: "Coral Warning",
    payout: 620,
    intro: [
      { who: NAMES.fixer, text: "The Coral Kings shook down the arms shop and scared Budi half to death." },
      { who: 'Bima "Reef" Prasetyo', text: "Tell the old woman the harbour has new management, driver." },
      { who: NAMES.fixer, text: "Go to Toko Senjata Budi. Show them Azura Bay is not theirs yet. Budi left a pistol for you." },
    ],
    objective: { kind: "clearout", landmark: "arms", text: "Clear the Coral Kings out of Toko Senjata Budi", gangCount: 3 },
    outro: [
      { who: NAMES.fixer, text: "Budi is sweeping up and singing. You sent a message the whole bay heard." },
    ],
  },
  {
    id: "m5-clean-getaway",
    title: "Clean Getaway",
    payout: 750,
    heat: 120,
    intro: [
      { who: NAMES.fixer, text: "Tonight you carry the diner's takings to the motel safe. Every cent." },
      { who: NAMES.fixer, text: "The Kings will tip off the police — they always do. Lose the heat, then deliver. Splash & Go is your friend." },
    ],
    objective: { kind: "reach", landmark: "motel", text: "Reach the Pelangi Motel — but lose the police first", escapeFirst: true },
    outro: [
      { who: NAMES.fixer, text: "Clean car, clean hands, full safe. Your father would have charged me double." },
    ],
  },
  {
    id: "m6-harbour-ledger",
    title: "The Harbour Ledger",
    payout: 950,
    intro: [
      { who: NAMES.fixer, text: "Reef keeps a ledger of every bribe in this city. It sits at Club Sirena tonight." },
      { who: NAMES.fixer, text: "His best men guard it. Take the club back, then bring word to me. This ends the Kings, Rio." },
    ],
    objective: { kind: "clearout", landmark: "club", text: "Take Club Sirena back from the Coral Kings", gangCount: 5 },
    outro: [
      { who: NAMES.fixer, text: "Names, dates, amounts... Reef is finished and doesn't know it yet. One last job, nak." },
    ],
  },
  {
    id: "m7-last-ferry",
    title: "Last Ferry",
    payout: 1500,
    timed: 150,
    intro: [
      { who: NAMES.fixer, text: "Reef is running for the last ferry with the harbour's money. The ledger goes to the precinct first — proof before pride." },
      { who: NAMES.fixer, text: "Precinct, then the wash, then the motel dock road. Beat the clock and Azura Bay is free of him." },
    ],
    objective: { kind: "race", text: "Hit every checkpoint before the ferry leaves", legs: ["precinct", "wash", "motel"] },
    outro: [
      { who: NAMES.fixer, text: "The ferry left empty, the precinct has its ledger, and Reef has a cell with a sea view." },
      { who: NAMES.fixer, text: "The harbour is yours now, Rio Santoso. Don't let it go to your head." },
    ],
  },
];

export class MissionDirector {
  /**
   * hooks: { setObjective(text, pos), clearObjective(), grantCash(n, why),
   *          addWanted(n), toast(msg), playDialogue(lines, onDone),
   *          spawnGangAt(pos, n) -> members[], landmarkPos(id) -> {x,z},
   *          onStoryComplete(), blip(kind) }
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.index = 0;          // next mission to offer
    this.active = null;      // runtime state of the running mission
    this.storyDone = false;
    this.courier = null;
  }

  get available() {
    return !this.active && !this.courier && !this.storyDone;
  }

  startNext() {
    if (this.active || this.storyDone) return false;
    const def = MISSIONS[this.index];
    if (!def) { this.storyDone = true; return false; }
    const begin = () => {
      this.active = {
        def,
        leg: 0,
        gang: [],
        gangSpawned: false,
        timeLeft: def.timed ?? null,
        needsEscape: Boolean(def.objective.escapeFirst),
        theftDone: !def.objective.requiresTheft,
      };
      if (def.heat) this.hooks.addWanted(def.heat);
      this.refreshObjective();
      this.hooks.toast(`${def.title} — ${NAMES.city}`);
    };
    this.hooks.playDialogue(def.intro, begin);
    return true;
  }

  /** Where the current objective wants the player, or null. */
  currentTarget() {
    const a = this.active;
    if (a) {
      if (a.needsEscape) return null; // escape has no marker; lose the heat
      const obj = a.def.objective;
      if (obj.kind === "race") return this.hooks.landmarkPos(obj.legs[a.leg]);
      if (a.leg === 1 && obj.secondLeg) return this.hooks.landmarkPos(obj.secondLeg.landmark);
      return this.hooks.landmarkPos(obj.landmark);
    }
    if (this.courier) return this.courier.target;
    return null;
  }

  currentObjectiveText() {
    const a = this.active;
    if (a) {
      if (a.needsEscape) return "Lose the police!";
      const obj = a.def.objective;
      if (obj.kind === "race") return `${obj.text} (${a.leg + 1}/${obj.legs.length})`;
      if (a.leg === 1 && obj.secondLeg) return obj.secondLeg.text;
      return obj.text;
    }
    if (this.courier) return this.courier.text;
    return null;
  }

  refreshObjective() {
    const text = this.currentObjectiveText();
    if (text) this.hooks.setObjective(text, this.currentTarget());
  }

  notifyTheft() {
    if (this.active && !this.active.theftDone) {
      this.active.theftDone = true;
      this.hooks.toast("That's the car. Get it to the garage!");
    }
  }

  notifyStars(stars) {
    if (this.active?.needsEscape && stars === 0) {
      this.active.needsEscape = false;
      this.hooks.toast("Heat's off. Now deliver!");
      this.refreshObjective();
    }
  }

  /** Called every frame by main with a snapshot of the world. */
  update(dt, snapshot) {
    const a = this.active;
    if (a) {
      if (a.timeLeft !== null) {
        a.timeLeft -= dt;
        if (a.timeLeft <= 0) {
          this.failActive("Out of time — the ferry got away. Try again at the diner.");
          return;
        }
      }
      const obj = a.def.objective;
      if (obj.kind === "clearout" && !a.gangSpawned) {
        const target = this.hooks.landmarkPos(obj.landmark);
        if (snapshot.distanceTo(target.x, target.z) < 55) {
          a.gang = this.hooks.spawnGangAt(target, obj.gangCount);
          a.gangSpawned = true;
          this.hooks.toast("Coral Kings! Watch their fire!");
        }
      }
      if (obj.kind === "clearout" && a.gangSpawned) {
        if (a.gang.every((m) => m.dead)) this.completeActive();
        return;
      }
      if (a.needsEscape) return;
      const target = this.currentTarget();
      if (target && snapshot.distanceTo(target.x, target.z) < 9) {
        if (obj.kind === "race") {
          a.leg += 1;
          this.hooks.blip("pickup");
          if (a.leg >= obj.legs.length) { this.completeActive(); return; }
          this.refreshObjective();
          return;
        }
        if (obj.secondLeg && a.leg === 0) {
          a.leg = 1;
          this.hooks.toast("Got her. Now the diner — gently!");
          this.refreshObjective();
          return;
        }
        if (obj.requiresTheft && !a.theftDone) {
          this.hooks.toast("You need the stolen coupe for this delivery.");
          return;
        }
        this.completeActive();
      }
      return;
    }
    if (this.courier) {
      this.courier.timeLeft -= dt;
      if (this.courier.timeLeft <= 0) {
        this.hooks.toast("Courier job expired.");
        this.courier = null;
        this.hooks.clearObjective();
        return;
      }
      if (snapshot.distanceTo(this.courier.target.x, this.courier.target.z) < 9) {
        const pay = this.courier.payout;
        this.courier = null;
        this.hooks.grantCash(pay, "courier");
        this.hooks.clearObjective();
        this.hooks.toast(`Delivered! +$${pay}`);
      }
    }
  }

  completeActive() {
    const a = this.active;
    if (!a) return;
    const def = a.def;
    this.active = null;
    this.index += 1;
    this.hooks.grantCash(def.payout, "mission");
    this.hooks.clearObjective();
    const wasFinal = this.index >= MISSIONS.length;
    this.hooks.playDialogue(def.outro, () => {
      if (wasFinal) {
        this.storyDone = true;
        this.hooks.onStoryComplete();
      } else {
        this.hooks.toast(`Next job waiting at ${NAMES.landmarks.diner}`);
      }
    });
  }

  failActive(reason) {
    this.active = null;
    this.hooks.clearObjective();
    this.hooks.toast(reason);
  }

  /** Repeatable side job: carry a parcel across the bay against the clock. */
  startCourier(rng, fromPos) {
    if (this.active || this.courier) return false;
    const ids = Object.keys(NAMES.landmarks);
    let pick = ids[rng.int(0, ids.length - 1)];
    let target = this.hooks.landmarkPos(pick);
    let guard = 0;
    while (Math.hypot(target.x - fromPos.x, target.z - fromPos.z) < 130 && guard++ < 8) {
      pick = ids[rng.int(0, ids.length - 1)];
      target = this.hooks.landmarkPos(pick);
    }
    const dist = Math.hypot(target.x - fromPos.x, target.z - fromPos.z);
    const payout = Math.round(CFG.economy.courierBase + dist * CFG.economy.courierPerMetre);
    this.courier = {
      target,
      payout,
      timeLeft: Math.round(35 + dist / 5.2),
      text: `Courier: deliver to ${NAMES.landmarks[pick]} ($${payout})`,
    };
    this.refreshObjective();
    this.hooks.toast("Courier job taken. Clock's running!");
    return true;
  }

  timerValue() {
    if (this.active?.timeLeft != null) return this.active.timeLeft;
    if (this.courier) return this.courier.timeLeft;
    return null;
  }
}
