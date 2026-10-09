// Serves the exported web build (dist/) under the app base path with an
// index.html fallback, mirroring how the backend serves the PWA in production.
// Used by the Playwright web smoke test; no API is served, so API calls 404.
const fs = require("fs");
const http = require("http");
const path = require("path");

const distDir = path.resolve(__dirname, "..", "dist");
const basePath = "/app";
const indexPath = path.join(distDir, "index.html");

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function parsePort(argv) {
  const index = argv.indexOf("--port");
  const port = index === -1 ? NaN : Number(argv[index + 1]);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Usage: node scripts/serve-web-dist.js --port <port>");
  }
  return port;
}

function resolveDistFile(urlPath) {
  const relativePath = decodeURIComponent(urlPath.slice(basePath.length));
  const filePath = path.join(distDir, path.normalize(relativePath));
  if (!filePath.startsWith(distDir + path.sep)) return null;
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : null;
}

function sendFile(response, filePath) {
  const contentType = contentTypes[path.extname(filePath)] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(response);
}

if (!fs.existsSync(indexPath)) {
  throw new Error(`No web build found at ${distDir}. Run "npm run build:web" first.`);
}

const port = parsePort(process.argv);

http
  .createServer((request, response) => {
    const urlPath = new URL(request.url ?? "/", "http://localhost").pathname;
    if (urlPath !== basePath && !urlPath.startsWith(`${basePath}/`)) {
      response.writeHead(404).end();
      return;
    }
    sendFile(response, resolveDistFile(urlPath) ?? indexPath);
  })
  .listen(port, () => {
    console.log(`Serving ${distDir} at http://localhost:${port}${basePath}`);
  });
