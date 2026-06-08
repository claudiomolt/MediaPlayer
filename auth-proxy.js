import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

const target = process.env.MEDIA_CENTER_TARGET || "http://127.0.0.1:3342";
const port = Number(process.env.MEDIA_CENTER_AUTH_PORT || 3343);
const homeDir = process.env.HOME || process.cwd();
const authFile = process.env.MEDIA_CENTER_AUTH_FILE || path.join(homeDir, "media", "media-center-auth.txt");

function readAuth() {
  const lines = readFileSync(authFile, "utf8").trim().split(/\n+/);
  const data = Object.fromEntries(lines.map((line) => {
    const [key, ...rest] = line.split("=");
    return [key, rest.join("=")];
  }));
  if (!data.user || !data.password) throw new Error(`Invalid auth file: ${authFile}`);
  return `${data.user}:${data.password}`;
}

function unauthorized(res) {
  res.writeHead(401, {
    "www-authenticate": 'Basic realm="MediaPlayer"',
    "content-type": "text/plain; charset=utf-8"
  });
  res.end("Authentication required");
}

createServer(async (req, res) => {
  let expected;
  try {
    expected = `Basic ${Buffer.from(readAuth()).toString("base64")}`;
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error.message);
    return;
  }
  if (req.headers.authorization !== expected) return unauthorized(res);

  const url = new URL(req.url || "/", target);
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("authorization");

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : req,
      duplex: "half"
    });
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
    if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (error) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Auth proxy ready: http://127.0.0.1:${port} -> ${target}`);
});
