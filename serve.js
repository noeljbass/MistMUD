import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const types = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8'
};
const publicFile = /^(?:index\.html|style\.css|src\/[a-z-]+\.js|world\/[a-z-]+\.json)$/;
const port = Number(process.env.PORT ?? 8080);
const server = createServer(async (request, response) => {
  const path = request.url.split('?')[0].slice(1) || 'index.html';
  if (!publicFile.test(path)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const contents = await readFile(new URL(path, import.meta.url));
    response.writeHead(200, { 'Content-Type': types[path.split('.').at(-1)] });
    response.end(contents);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('File unavailable');
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Play The Skaa’s Secret at http://127.0.0.1:${server.address().port}`);
});
