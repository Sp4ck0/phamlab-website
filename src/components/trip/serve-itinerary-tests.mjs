// Standalone synthetic harness: no Vite config, environment files or API client.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.ITINERARY_TEST_DEPS + '/package.json');
const { build } = require('esbuild');
const result = await build({ entryPoints: [fileURLToPath(new URL('./itinerary.browser.jsx', import.meta.url))], bundle: true, write: false, outdir: 'memory', jsx: 'automatic', tsconfigRaw: {}, loader: { '.woff2': 'dataurl' } });
const script = result.outputFiles.find(f => f.path.endsWith('.js')).text;
const css = result.outputFiles.find(f => f.path.endsWith('.css')).text;
const server = createServer((request, response) => {
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:");
  if (request.url === '/check.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(script); }
  else if (request.url === '/check.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/check.css"></head><body><div id="root"></div><script src="/check.js"></script></body></html>'); }
});
server.listen(4179, '127.0.0.1', () => console.log('Synthetic-only itinerary check: http://127.0.0.1:4179'));
