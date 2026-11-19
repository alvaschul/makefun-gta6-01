/**
 * NEON HARBOR v2 — hand-in program (make.fun entry gta6-01, resubmission build)
 * ============================================================================
 *
 * NEON HARBOR v2 is an original open-world crime game that runs in the
 * browser. It is set in Azura Bay, a fictional neon-lit harbour city built
 * for this entry. The player is Rio Santoso, a small-time driver who takes
 * jobs from fixer Mama Lala while the Coral Kings, a rival crew, try to push
 * him out of the harbour wards. Every name, character, place, line of
 * dialogue and asset in the game was written for this project; nothing is
 * taken from any commercial game.
 *
 * This resubmission exists because the first build was rejected on
 * authorship grounds: too little of it had been written inside a recorded
 * session. This version was therefore rebuilt from a blank repository in a
 * single recorded session. Every source file in game/src, the page shell,
 * the server, the shot list and this program were typed during that
 * session, in order, so the recording is the authorship record.
 *
 * What this program does
 * ----------------------
 * 1. Resolves the folder it lives in (the repository root).
 * 2. Reads the destination from the MAKEFUN_OUTPUT_DIR environment
 *    variable, falling back to /output when the variable is unset.
 * 3. Creates the destination folder when it does not exist yet.
 * 4. Copies the playable game (the game/ folder) and the staged
 *    screenshots (the screenshots/ folder, when present) into the
 *    destination, preserving their relative layout.
 * 5. Asks the kit helper buildDossier() to describe the copied payload
 *    under the size limits declared by the competition, and writes the
 *    returned string to dossier.json in the destination folder.
 *
 * The program uses only the Node.js standard library (Node 22) plus the
 * single kit helper in vendor/makefun-game.ts. It never touches the
 * network, never shells out, and is safe to run repeatedly: re-running it
 * simply refreshes the destination copy.
 *
 * File inventory for this build is finalised in a short addendum at the
 * bottom of the header once the game sources are complete.
 *
 * Addendum — final inventory of the resubmission build (all authored in
 * the recorded rebuild session, in this order):
 *   main.ts (this file), serve.ts, README.md, shots.json,
 *   game/index.html, and game/src/{config, random, input, save, audio,
 *   city, vehicles, people, police, missions, hud, weather, shots,
 *   main}.js — fourteen game modules, roughly three and a half thousand
 *   lines in total across the hand-written files. The vendored three.js
 *   build under game/vendor/three and the kit helper in vendor/ are
 *   third-party/kit files and are not part of the authored count.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

/** Absolute path of the folder that contains this program. */
const rootDir = dirname(fileURLToPath(import.meta.url));

/** Destination folder for the hand-in payload. */
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

/**
 * Copy one payload folder from the repository into the output folder.
 * A missing source folder is tolerated for screenshots only, because
 * screenshots are produced by a later staging step than the code build;
 * a missing game folder is a real error and is allowed to throw.
 */
function copyPayloadFolder(name: string, required: boolean): void {
  const source = join(rootDir, name);
  if (!existsSync(source)) {
    if (required) {
      throw new Error(`Required payload folder is missing: ${source}`);
    }
    console.log(`[neon-harbor] optional folder "${name}" not present, skipping`);
    return;
  }
  const target = join(outputDir, name);
  cpSync(source, target, { recursive: true });
  console.log(`[neon-harbor] copied ${name}/ -> ${target}`);
}

function main(): void {
  mkdirSync(outputDir, { recursive: true });
  copyPayloadFolder("game", true);
  copyPayloadFolder("screenshots", false);

  let dossierText: string;
  try {
    dossierText = buildDossier(outputDir, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
      game_path_max_bytes: 1000,
    });
  } catch (error) {
    // The kit helper refuses to describe a payload whose screenshots have
    // not been staged yet (they are captured after the code build, by the
    // game's own shot mode). Fail with guidance instead of a raw stack.
    console.error(
      "[neon-harbor] could not build the dossier. If screenshots/ has not " +
      "been staged yet, run the shot-mode captures listed in shots.json " +
      "first, then re-run this program."
    );
    throw error;
  }

  const dossierPath = join(outputDir, "dossier.json");
  writeFileSync(dossierPath, dossierText, "utf8");
  console.log(`[neon-harbor] dossier written to ${dossierPath}`);
}

main();
