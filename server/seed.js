// CLI equivalent of POST /api/demo/seed: `node server/seed.js --demo` (npm run seed).
// Demo rows are flagged and are only ever removed by DELETE /api/demo.

import { createConfig } from './index.js';
import { openDatabase } from './db.js';

const args = process.argv.slice(2);

if (!args.includes('--demo')) {
  console.error('Usage: node server/seed.js --demo');
  console.error('Inserts 5 sample notes (and 2 sample grinders when none exist) marked as demo data.');
  process.exit(2);
}

const config = createConfig();
const db = openDatabase(config.dbPath);

try {
  const { created, ids } = db.seedDemo();
  console.log(`[coffee-notes] seeded ${created} demo notes (ids: ${ids.join(', ')}) into ${config.dbPath}`);
  console.log('[coffee-notes] remove them again with: curl -X DELETE ' + `http://${config.host}:${config.port}/api/demo`);
} finally {
  db.close();
}
