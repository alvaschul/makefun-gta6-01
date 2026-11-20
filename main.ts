// main.ts — NEON HARBOR hand-in program for make.fun (gta6-01).
//
// What this does, in plain terms: it packages the finished game for the
// judges. It finds its own folder, works out where the bundle should go
// (the MAKEFUN_OUTPUT_DIR environment variable, or /output by default),
// copies the playable game/ folder — and the screenshots/ folder when it
// exists — into that destination, then asks the make.fun kit's dossier
// builder to describe everything that was staged. The resulting dossier
// text is written to dossier.json in the destination so the entry can be
// verified exactly as submitted.
//
// Only Node's standard library is used here; the dossier logic itself
// lives in vendor/makefun-game.ts, supplied by the competition kit.

import { cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const TAG = "[neon-harbor]";

function log(message: string): void {
  console.log(`${TAG} ${message}`);
}

async function copyFolder(source: string, destination: string, label: string) {
  log(`copying ${label} -> ${destination}`);
  await cp(source, destination, { recursive: true });
}

async function main(): Promise<void> {
  const here = resolve(fileURLToPath(new URL(".", import.meta.url)));
  log(`source folder: ${here}`);

  const rawOutput = process.env.MAKEFUN_OUTPUT_DIR;
  const outputDir = rawOutput && rawOutput.trim() !== "" ? rawOutput : "/output";
  log(`destination: ${outputDir}`);
  await mkdir(outputDir, { recursive: true });

  // The game itself is mandatory: without it there is no entry.
  const gameSource = join(here, "game");
  if (!existsSync(gameSource)) {
    throw new Error(`${TAG} required folder is missing: ${gameSource}`);
  }
  await copyFolder(gameSource, join(outputDir, "game"), "game/");

  // Screenshots are expected by the dossier builder, but a missing folder
  // is reported and skipped here; buildDossier will complain properly if
  // it cannot find any images in the destination.
  const shotsSource = join(here, "screenshots");
  if (existsSync(shotsSource)) {
    await copyFolder(shotsSource, join(outputDir, "screenshots"), "screenshots/");
  } else {
    log("screenshots/ not found next to main.ts — skipping the copy step");
  }

  log("building dossier with the make.fun kit limits");
  let dossier: string;
  try {
    dossier = await buildDossier(outputDir, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
      game_path_max_bytes: 1000,
    });
  } catch (err) {
    console.error(
      `${TAG} buildDossier failed. Before retrying: make sure the four ` +
        `screenshots are staged in screenshots/ (see shots.json for the ` +
        `expected file names) and that game/ is complete, then run again.`
    );
    throw err;
  }

  const dossierPath = join(outputDir, "dossier.json");
  await writeFile(dossierPath, dossier, "utf8");
  log(`dossier written: ${dossierPath} (${Buffer.byteLength(dossier, "utf8")} bytes)`);
  log("done");
}

main().catch((err) => {
  console.error(`${TAG} fatal:`, err);
  process.exit(1);
});
