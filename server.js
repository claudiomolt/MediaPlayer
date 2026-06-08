import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const binDir = path.join(__dirname, "bin");
const homeDir = process.env.HOME || process.cwd();
const mediaRoot = process.env.MEDIA_ROOT || path.join(homeDir, "media", "downloads");
const subtitleRoot = process.env.SUB_DIR || path.join(homeDir, "media", "subtitles");
const port = Number(process.env.MEDIA_CENTER_PORT || 3340);
const qbtUrl = process.env.QBT_URL || "http://127.0.0.1:8080";

const videoExt = new Set([".mkv", ".mp4", ".avi", ".mov", ".webm", ".m4v"]);
const subExt = new Set([".srt", ".ass", ".vtt", ".sub"]);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function text(res, body, status = 200) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

function normalize(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/tt\d{7,9}/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isInside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

async function walk(root) {
  const out = [];
  if (!existsSync(root)) return out;
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(full));
    } else {
      const info = await stat(full);
      out.push({ path: full, name: entry.name, size: info.size, mtime: info.mtimeMs });
    }
  }
  return out;
}

async function library() {
  const files = await walk(mediaRoot);
  const subtitleFiles = await walk(subtitleRoot);
  const subtitles = subtitleFiles
    .filter((file) => subExt.has(path.extname(file.name).toLowerCase()))
    .map((file) => ({ ...file, base: normalize(path.basename(file.name, path.extname(file.name))) }));

  return files
    .filter((file) => videoExt.has(path.extname(file.name).toLowerCase()))
    .sort((a, b) => b.mtime - a.mtime)
    .map((file) => {
      const base = normalize(path.basename(file.name, path.extname(file.name)));
      const localSubs = subtitles.filter((sub) => base.includes(sub.base) || sub.base.includes(base));
      return {
        ...file,
        base,
        title: path.basename(file.name, path.extname(file.name)).replace(/[._]+/g, " "),
        subtitles: localSubs
      };
    });
}

async function cinemeta(urlPath) {
  const response = await fetch(`https://v3-cinemeta.strem.io${urlPath}`, { redirect: "follow" });
  if (!response.ok) throw new Error(`Cinemeta ${response.status}`);
  return response.json();
}

function enrichMeta(meta, localLibrary) {
  const title = normalize(`${meta.name || ""} ${meta.year || meta.releaseInfo || ""}`);
  const nameOnly = normalize(meta.name || "");
  const imdb = normalize(meta.imdb_id || meta.id || "");
  const match = localLibrary.find((file) => {
    return file.base.includes(imdb) || file.base.includes(title) || (nameOnly && file.base.includes(nameOnly));
  });
  return {
    id: meta.id,
    imdb_id: meta.imdb_id || meta.id,
    type: meta.type,
    name: meta.name,
    year: meta.year || meta.releaseInfo,
    poster: meta.poster,
    background: meta.background,
    logo: meta.logo,
    description: meta.description,
    genres: meta.genres || meta.genre || [],
    runtime: meta.runtime,
    imdbRating: meta.imdbRating,
    rottenRating: meta.rottenRating || meta.tomatoMeter || null,
    ratings: {
      imdb: meta.imdbRating || null,
      rotten: meta.rottenRating || meta.tomatoMeter || null
    },
    downloaded: Boolean(match),
    localFile: match || null
  };
}

async function qbt(pathname, options = {}) {
  const response = await fetch(`${qbtUrl}${pathname}`, options);
  if (!response.ok) throw new Error(`qBittorrent ${response.status}`);
  const type = response.headers.get("content-type") || "";
  return type.includes("json") ? response.json() : response.text();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function runScript(name, args = []) {
  const script = path.join(binDir, name);
  const child = spawn(script, args, {
    cwd: __dirname,
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  return child.pid;
}

async function api(req, res, url) {
  try {
    if (url.pathname === "/api/health") {
      const version = await qbt("/api/v2/app/version").catch(() => null);
      return json(res, { ok: true, qbt: version, mediaRoot, subtitleRoot });
    }

    if (url.pathname === "/api/library") {
      return json(res, { items: await library() });
    }

    if (url.pathname === "/api/downloads") {
      const torrents = await qbt("/api/v2/torrents/info").catch(() => []);
      return json(res, {
        torrents: torrents.map((torrent) => ({
          name: torrent.name,
          progress: torrent.progress,
          state: torrent.state,
          dlspeed: torrent.dlspeed,
          eta: torrent.eta,
          size: torrent.size,
          downloaded: torrent.downloaded,
          save_path: torrent.save_path
        }))
      });
    }

    const catalogMatch = url.pathname.match(/^\/api\/catalog\/(movie|series)\/([a-z0-9_-]+)$/);
    if (catalogMatch) {
      const [, type, catalog] = catalogMatch;
      const skip = Number(url.searchParams.get("skip") || 0);
      const data = await cinemeta(`/catalog/${type}/${catalog}.json?skip=${skip}`);
      const local = await library();
      return json(res, { metas: (data.metas || []).map((meta) => enrichMeta(meta, local)) });
    }

    const metaMatch = url.pathname.match(/^\/api\/meta\/(movie|series)\/(tt\d{7,9})$/);
    if (metaMatch) {
      const [, type, id] = metaMatch;
      const data = await cinemeta(`/meta/${type}/${id}.json`);
      const local = await library();
      return json(res, { meta: enrichMeta(data.meta, local), raw: data.meta });
    }

    if (url.pathname === "/api/torrent/add" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.uri) return json(res, { error: "Missing uri" }, 400);
      const pid = runScript("qbt-add.sh", [body.uri, mediaRoot]);
      return json(res, { ok: true, pid });
    }

    if (url.pathname === "/api/subtitles/fetch" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.path || !isInside(mediaRoot, body.path)) return json(res, { error: "Invalid path" }, 400);
      const langs = Array.isArray(body.langs) && body.langs.length ? body.langs : ["es", "en"];
      const pid = runScript("fetch-subs.sh", [body.path, ...langs]);
      return json(res, { ok: true, pid });
    }

    if (url.pathname === "/api/play" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.path || !isInside(mediaRoot, body.path)) return json(res, { error: "Invalid path" }, 400);
      const args = [];
      if (body.takeover) args.push("--takeover");
      if (body.subtitlePath) {
        const subtitleOk = isInside(subtitleRoot, body.subtitlePath) || isInside(path.dirname(body.path), body.subtitlePath);
        if (!subtitleOk) return json(res, { error: "Invalid subtitle path" }, 400);
        args.push("--sub", body.subtitlePath);
      }
      args.push(body.path);
      const pid = runScript("play-hdmi.sh", args);
      return json(res, { ok: true, pid });
    }

    return json(res, { error: "Not found" }, 404);
  } catch (error) {
    return json(res, { error: error.message }, 500);
  }
}

function serveStatic(res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const file = path.join(publicDir, requested);
  if (!isInside(publicDir, file) || !existsSync(file)) return false;
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "content-type": mime[ext] || "application/octet-stream" });
  createReadStream(file).pipe(res);
  return true;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return api(req, res, url);
  if (serveStatic(res, url.pathname)) return;
  text(res, "Not found", 404);
}).listen(port, "127.0.0.1", () => {
  console.log(`Media Center ready: http://127.0.0.1:${port}`);
});
