#!/usr/bin/env node
/**
 * A placeholder for an executable-floor command whose piece has not been built
 * yet. Exits 0 with a clear statement of what it will do and who owns it, so a
 * critic running `npm run <script>` never has to guess whether the silence
 * means "passing" or "missing".
 *
 *   node scripts/not-implemented.mjs "<script name>" "<owner>" "<what it will check>"
 */
const [, , name = 'this script', owner = 'a later piece', detail = ''] = process.argv;

console.log(`\n  ${name}: NOT YET IMPLEMENTED — this is not a pass.`);
console.log(`  Owner: ${owner}`);
if (detail) console.log(`  Will check: ${detail}`);
console.log('  Exiting 0 so the piece that owns it is not blocked by its own absence.\n');
