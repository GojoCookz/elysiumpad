// Rebuild the approved sibling source without modifying the shared application.
// This release-only overlay corrects empty/error copy found by independent review.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.dirname(root);
const source = path.join(workspace, 'getrektdonhype/source/elysium');
const { build } = await import(pathToFileURL(path.join(workspace, 'monerochanpad-v2/node_modules/esbuild/lib/main.js')));
await build({
  entryPoints: [path.join(source, 'app.mjs')],
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  nodePaths: [path.join(workspace, 'hoodstonk/app/node_modules')],
  outfile: path.join(root, 'elysium/purrlysium/app.js'), legalComments: 'eof',
  define: { __PURRLYSIUM__: 'true' },
  plugins: [{ name: 'release-empty-state', setup(build) {
    build.onLoad({ filter: /[/\\]elysium[/\\]terminal\.mjs$/ }, async ({ path: file }) => {
      let contents = await readFile(file, 'utf8');
      const replacements = [
        ["'Other pads: indexing Elysium…'", "ext.error ? 'Other pads: unavailable' : 'Other pads: indexing Elysium…'"],
        [": 'No coins match.'));", ": !q && !rows.length && !extRows.length ? 'No coins yet' : 'No coins match.'));"]
      ];
      for (const [before, after] of replacements) {
        if (!contents.includes(before)) throw new Error(`Approved source changed; review release overlay: ${before}`);
        contents = contents.replace(before, after);
      }
      return { contents, loader: 'js', resolveDir: path.dirname(file) };
    });
  }}]
});
