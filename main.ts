// Golden Hour: Island Run — the hand-in program (Node 22, standard library only).
//
// The game is plain static files under game/ and its screenshots under
// screenshots/; this program copies both into the output directory and writes
// the dossier the judge reads, with the vendored make.fun library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; the grader
// runs this file twice and both runs must write the same bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The hand-in needs 3 or 4 screenshots; refuse to write a dossier without them
// instead of handing in an entry the gate would reject.
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name) && !name.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ holds ${shots.length} images, need 3 or 4`);
}
for (const name of shots) {
  const bytes = statSync(join(shotsDir, name)).size;
  if (bytes > 262144) throw new Error(`screenshots/${name} is ${bytes} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The gate's own caps, so a bad hand-in fails here instead of on the server:
// at most 4 screenshots, each at most 256 KiB; game/ at most 993 files and
// 48 MiB in all; no path under game/ over 1000 bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`handed in: ${shots.length} screenshots, dossier ${dossier.length} bytes -> ${out}`);
