// Dev server mirroring the native app's quire:// API so the UI can be iterated in a browser.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const VAULT = process.argv[2] || path.join(process.env.HOME, 'Documents/knowledge-base');
const WEB = path.resolve('web');
const PORT = +(process.env.PORT||4747);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };

async function walk(dir, rel = '', out = { notes: [], files: [] }) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name), r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) await walk(abs, r, out);
    else if (e.name.toLowerCase().endsWith('.md')) {
      const st = await fs.stat(abs);
      out.notes.push({ path: r, mtime: st.mtimeMs, content: await fs.readFile(abs, 'utf8') });
    } else out.files.push(r);
  }
  return out;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/vault') {
      const data = await walk(VAULT);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ name: path.basename(VAULT), root: VAULT, ...data }));
    }
    let file;
    if (url.pathname.startsWith('/vault/')) /* ?w= resizing is native-only */ file = path.join(VAULT, decodeURIComponent(url.pathname.slice(7)));
    else file = path.join(WEB, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end(String(e));
  }
}).listen(PORT, () => console.log(`Quire dev → http://localhost:${PORT}  (vault: ${VAULT})`));
