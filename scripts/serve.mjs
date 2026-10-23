import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const mount = "/classroom-escape/";
const supportedMounts = [mount, "/Escape-Class/"];
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(302, { Location: mount });
      res.end();
      return;
    }
    const currentMount = supportedMounts.find((path) =>
      url.pathname.startsWith(path),
    );
    if (!currentMount) {
      res.writeHead(404);
      res.end();
      return;
    }
    const relative =
      decodeURIComponent(url.pathname.slice(currentMount.length)) ||
      "index.html";
    const file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${port}${mount}`),
);
