// Proves the game is served whole: the page answers, and every file it names
// answers too. No browser; the game's logic is covered by test/.
//
//   node scripts/smoke.mjs
import { serve } from "./serve.mjs";

const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
let failed = false;
try {
  const page = await fetch(base);
  const html = await page.text();
  if (!page.ok || !html.includes('id="brick-canvas"')) throw new Error(`the page: ${page.status}`);
  const named = [...html.matchAll(/(?:src|href)="((?:src|fonts)\/[^"]+)"/g)].map((m) => m[1]);
  const css = await (await fetch(base + "src/theme-pixel.css")).text();
  named.push(...[...css.matchAll(/url\("\.\.\/([^"]+)"\)/g)].map((m) => m[1]));
  for (const path of new Set(named)) {
    const r = await fetch(base + path);
    if (!r.ok) { console.error(`missing: ${path} (${r.status})`); failed = true; }
  }
  if (named.length < 5) { console.error(`the page names only ${named.length} files`); failed = true; }
  // The import of game.js is a file the page does not name.
  if (!(await fetch(base + "src/words.js")).ok) { console.error("missing: src/words.js"); failed = true; }
  if (!failed) console.log(`smoke: ok, ${new Set(named).size + 1} files served`);
} catch (error) {
  console.error(`smoke: ${error.message}`);
  failed = true;
} finally {
  server.close();
}
process.exit(failed ? 1 : 0);
