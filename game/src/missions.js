// The story of NEON HARBOR, in six jobs, plus the repeatable work that keeps
// Rio fed after the credits. Mama Lala, who raised half of Palm Court and
// buries the other half's secrets, is retiring — but the Coral Kings, who run
// the bay's night freight, have taken her ledger, her boat money and her
// nephew Dedi. One job at a time, Rio takes it all back.
//
// A mission is a list of stages. Each stage is one objective of a plain kind
// (go somewhere, steal and deliver a marked car, survive a shootout, lose
// the police, reach a place against the clock) with the dialogue that opens
// and closes it. The engine below walks the stages, draws the beacon and
// reports back to the game; the writing lives in the data, as it should.

import { NAMES } from './config.js';

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    giver: NAMES.fixer,
    intro: [
      [NAMES.fixer, 'Rio. You drive, you keep quiet, you come back. That is the whole job.'],
      [NAMES.hero, 'And if I do it well?'],
      [NAMES.fixer, 'Then Azura Bay starts to owe you favours. Start with Dedi — he is waiting by the motel.'],
    ],
    stages: [
      { kind: 'goto', at: 'safehouse', label: `Pick up ${NAMES.friend} at the ${NAMES.safehouse}`, radius: 6 },
      { kind: 'goto', at: 'diner', label: `Drive ${NAMES.friend} to the ${NAMES.diner}`, radius: 7, passenger: true },
    ],
    reward: 150,
    outro: [[NAMES.friend, 'Mama is right about you. The Kings took her ledger, Rio. Everything she owns is in it.']],
  },
  {
    id: 'paper-trail',
    title: 'Paper Trail',
    giver: NAMES.fixer,
    intro: [
      [NAMES.fixer, 'The Kings keep the ledger at Club Kelapa until midnight. Their courier car is parked out back — silver, loud, ugly.'],
      [NAMES.hero, 'Steal the car, find the ledger.'],
      [NAMES.fixer, 'Bring the CAR to Bengkel Jaya. Dedi will crack it open. And Rio — they will notice.'],
    ],
    stages: [
      { kind: 'steal', at: 'club', label: `Steal the courier car behind the ${NAMES.club}`, radius: 8 },
      { kind: 'deliver', at: 'garage', label: `Deliver the car to ${NAMES.garage}`, radius: 8, heat: 2 },
    ],
    reward: 320,
    outro: [[NAMES.friend, 'Ledger pages, boat papers... and a list of cops on the Kings payroll. Ratna is clean. Remember that.']],
  },
  {
    id: 'night-freight',
    title: 'Night Freight',
    giver: NAMES.friend,
    intro: [
      [NAMES.friend, 'A freezer truck of "fish" leaves the garage at dusk. The Kings cannot know it moved.'],
      [NAMES.hero, 'Ninety seconds of road, no noise.'],
      [NAMES.friend, 'Ninety seconds. The diner yard. Go loud and we are both fish food.'],
    ],
    stages: [
      { kind: 'goto', at: 'garage', label: `Reach ${NAMES.garage} and take the freight job`, radius: 7 },
      { kind: 'timed', at: 'diner', label: 'Deliver the freight to the diner yard — fast and quiet', radius: 8, seconds: 95, quiet: true },
    ],
    reward: 410,
    outro: [[NAMES.fixer, 'Quiet as the tide. The Kings are counting their fish and finding arithmetic.']],
  },
  {
    id: 'coral-reckoning',
    title: 'Coral Reckoning',
    giver: NAMES.fixer,
    intro: [
      [NAMES.fixer, 'They came for Dedi at the diner. He is alive — he talks too much to die quietly — but they stayed to finish the place.'],
      [NAMES.hero, 'How many?'],
      [NAMES.fixer, 'Enough to make it a story. End it, Rio.'],
    ],
    stages: [
      { kind: 'goto', at: 'diner', label: `Get to the ${NAMES.diner} — ${NAMES.friend} is pinned down`, radius: 9 },
      { kind: 'shootout', at: 'diner', label: `Clear the Coral Kings from the ${NAMES.diner}`, radius: 26, count: 5 },
    ],
    reward: 560,
    outro: [
      [NAMES.friend, 'You shoot like you drive — angry and precise.'],
      [NAMES.fixer, 'Their captain ran. He will tell the bay what happened here. Let him.'],
    ],
  },
  {
    id: 'ratnas-gambit',
    title: "Ratna's Gambit",
    giver: NAMES.copChief,
    intro: [
      [NAMES.copChief, 'Santoso. I have a list of my own officers, in your friend\'s handwriting.'],
      [NAMES.hero, 'Inspector. Is this an arrest?'],
      [NAMES.copChief, 'It is a trade. Plant this tracker on the Kings\' captain\'s car at the club. My clean officers do the rest. Touch nothing else.'],
    ],
    stages: [
      { kind: 'goto', at: 'precinct', label: `Meet ${NAMES.copChief} near the ${NAMES.precinct}`, radius: 7 },
      { kind: 'steal', at: 'club', label: `Take the captain's car at the ${NAMES.club} and plant the tracker`, radius: 8 },
      { kind: 'loseCops', label: 'Shake the patrols — lose your wanted level', radius: 0 },
    ],
    reward: 700,
    outro: [[NAMES.copChief, 'The tracker sings. Whatever happens next, Rio — when the sirens change tune, run south.']],
  },
  {
    id: 'low-tide',
    title: 'Low Tide',
    giver: NAMES.fixer,
    intro: [
      [NAMES.fixer, 'Ratna moved. Half the precinct is in cells and the Kings are burning their own docks to hide the ash.'],
      [NAMES.fixer, 'One last run: the boat money, all of it, is in a Kings wagon at the garage. Bring it home before the tide turns.'],
      [NAMES.hero, 'And if the whole bay chases me?'],
      [NAMES.fixer, 'Then drive like the tide, sayang. Even the bay cannot catch the tide.'],
    ],
    stages: [
      { kind: 'steal', at: 'garage', label: `Take the Kings' money wagon at ${NAMES.garage}`, radius: 8 },
      { kind: 'deliver', at: 'safehouse', label: `Bring the money home to the ${NAMES.safehouse}`, radius: 8, heat: 3 },
    ],
    reward: 1200,
    outro: [
      [NAMES.fixer, 'The ledger, the boat, the bay. All home.'],
      [NAMES.hero, 'What now, Mama?'],
      [NAMES.fixer, 'Now? Now Azura Bay is yours to drive, Rio. Try not to give it back.'],
    ],
  },
];

// Side work after (or between) story jobs: a ringing phone marker at the
// motel offers timed courier runs across the bay for cash.
export const SIDE_JOB = {
  title: 'Courier Run',
  secondsPerMetre: 0.11,
  minSeconds: 35,
  payPerMetre: 0.55,
};

export class MissionEngine {
  constructor(game) {
    this.game = game;
    this.active = null;      // {mission, stageIndex, stage, timer, spawned, targetCar}
    this.availableAt = null; // landmark kind the next mission starts from
  }

  nextMission() {
    const idx = this.game.save.missionIndex;
    return idx < MISSIONS.length ? MISSIONS[idx] : null;
  }

  /** Where the next chapter begins: the fixer's motel, unless story is done. */
  startLandmark() {
    if (!this.nextMission()) return null;
    return this.game.landmark(this.nextMission().stages[0].kind === 'goto' && this.game.save.missionIndex === 4 ? 'precinct' : 'safehouse');
  }

  begin() {
    const mission = this.nextMission();
    if (!mission || this.active) return false;
    this.active = { mission, stageIndex: 0, timer: 0, spawned: false, targetCar: null, hostiles: [] };
    this.game.hud.showDialogue(mission.intro, () => {});
    this.enterStage();
    this.game.hud.toast(`Mission started — ${mission.title}`);
    return true;
  }

  enterStage() {
    const run = this.active;
    const stage = run.mission.stages[run.stageIndex];
    run.stage = stage;
    run.spawned = false;
    run.warnedDeliver = false;
    // A deliver stage follows its steal stage and needs the same marked car.
    if (stage.kind !== 'deliver') run.targetCar = null;
    if (stage.kind === 'timed') run.timer = stage.seconds;
    if (stage.kind === 'steal') run.targetCar = this.game.spawnMissionCar(stage);
    if (stage.kind === 'shootout') run.hostiles = this.game.spawnShootout(stage);
    this.game.hud.setObjective(`${run.mission.title} — ${stage.label}`);
  }

  stageTarget() {
    const stage = this.active?.stage;
    if (!stage || !stage.at) return null;
    if (stage.kind === 'steal' && this.active.targetCar) {
      return { x: this.active.targetCar.x, z: this.active.targetCar.z, radius: stage.radius };
    }
    const mark = this.game.landmark(stage.at);
    return mark ? { x: mark.x, z: mark.z, radius: stage.radius } : null;
  }

  completeStage() {
    const run = this.active;
    const game = this.game;
    run.stageIndex += 1;
    if (run.stageIndex < run.mission.stages.length) {
      game.audio.cash();
      this.enterStage();
      return;
    }
    // Mission complete: pay, save, applaud, queue the next chapter.
    const { reward, title, outro } = run.mission;
    game.addCash(reward);
    game.save.missionIndex += 1;
    if (game.save.missionIndex >= MISSIONS.length) game.save.storyDone = true;
    game.persistSave();
    game.audio.missionDone();
    game.hud.showDialogue(outro, () => {});
    game.hud.toast(`Mission complete — ${title} · +$${reward}`);
    game.hud.setObjective(game.save.storyDone
      ? 'Story complete — Azura Bay is yours. Courier runs at the motel pay cash.'
      : `Return to the ${NAMES.safehouse} for the next job`);
    this.active = null;
  }

  fail(reason) {
    const game = this.game;
    if (!this.active) return;
    game.audio.missionFail();
    game.hud.toast(`Mission failed — ${reason}. The job waits at the ${NAMES.safehouse}.`);
    game.hud.setObjective(`Retry “${this.active.mission.title}” at the ${NAMES.safehouse}`);
    for (const hostile of this.active.hostiles || []) game.removePerson(hostile);
    this.active = null;
  }

  update(dt) {
    const run = this.active;
    if (!run) return;
    const game = this.game;
    const stage = run.stage;
    const player = game.player;
    if (stage.kind === 'timed') {
      run.timer -= dt;
      game.hud.setTimer(run.timer);
      if (run.timer <= 0) { this.fail('out of time'); return; }
      if (stage.quiet && game.wanted.stars > 1) { this.fail('too much heat — the Kings heard you'); return; }
    } else {
      game.hud.setTimer(null);
    }
    if (stage.kind === 'shootout') {
      const alive = run.hostiles.filter((h) => !h.dead).length;
      game.hud.setObjective(`${run.mission.title} — ${stage.label} (${run.hostiles.length - alive}/${run.hostiles.length})`);
      if (alive === 0) this.completeStage();
      return;
    }
    if (stage.kind === 'loseCops') {
      if (game.wanted.stars === 0) this.completeStage();
      return;
    }
    const target = this.stageTarget();
    if (!target) return;
    const dist = Math.hypot(player.x - target.x, player.z - target.z);
    if (stage.kind === 'steal') {
      // Done the moment Rio is driving the marked car.
      if (player.car && player.car === run.targetCar) {
        if (stage.heat) game.wanted.commitCrime('missionHeat', true);
        this.completeStage();
      }
      return;
    }
    if (stage.kind === 'deliver') {
      if (dist < target.radius && player.car && player.car === run.targetCar) this.completeStage();
      else if (dist < target.radius && !run.warnedDeliver) {
        run.warnedDeliver = true;
        game.hud.toast('You need the marked car — bring IT here');
      }
      return;
    }
    // goto / timed: simply arrive, on foot or by car.
    if (dist < target.radius) this.completeStage();
  }
}
