import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const bundlePath = path.resolve(process.cwd(), 'dist/server.cjs');
if (!existsSync(bundlePath)) {
  console.error('Missing dist/server.cjs. Run npm run build before npm start.');
  process.exit(1);
}

await import(pathToFileURL(bundlePath).href);
