const state = {
  view: "home",
  movies: [],
  series: [],
  library: [],
  downloads: [],
  detail: null
};

const $ = (selector) => document.querySelector(selector);
const movieRail = $("#movieRail");
const seriesRail = $("#seriesRail");
const libraryGrid = $("#libraryGrid");
const heroStack = $("#heroStack");
const toast = $("#toast");
const mainRailTitle = $("#mainRailTitle");
const featuredPoster = $("#featuredPoster");
const featuredType = $("#featuredType");
const featuredTitle = $("#featuredTitle");
const featuredRatings = $("#featuredRatings");
const featuredMeta = $("#featuredMeta");
const featuredDescription = $("#featuredDescription");
let featuredIndex = 0;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "API error");
  return data;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-open");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-open"), 2600);
}

function fmtBytes(value = 0) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function fmtSpeed(value = 0) {
  return `${fmtBytes(value)}/s`;
}

function poster(meta) {
  return meta.poster || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 600'%3E%3Crect width='400' height='600' fill='%23151b22'/%3E%3Cpath d='M70 480 200 120l130 360z' fill='%23ff9f1c' opacity='.55'/%3E%3C/svg%3E";
}

function makeCard(meta) {
  const button = document.createElement("button");
  button.className = "card focusable";
  button.tabIndex = 0;

  const posterBox = document.createElement("div");
  posterBox.className = "poster";

  const image = document.createElement("img");
  image.src = poster(meta);
  image.alt = meta.name || "Poster";
  image.loading = "lazy";
  posterBox.append(image);

  if (meta.downloaded) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Disponible";
    posterBox.append(badge);
  }

  const ratings = document.createElement("div");
  ratings.className = "rating-row";
  ratings.append(...ratingChips(meta));
  posterBox.append(ratings);

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = meta.name || "Sin título";

  const subtitle = document.createElement("div");
  subtitle.className = "card-sub";
  subtitle.textContent = `${meta.year || ""}${meta.runtime ? ` · ${meta.runtime}` : ""}`;

  button.append(posterBox, title, subtitle);
  button.addEventListener("click", () => openDetail(meta));
  return button;
}

function ratingChips(meta) {
  const imdb = meta.imdbRating || meta.ratings?.imdb || "N/D";
  const rotten = meta.rottenRating || meta.ratings?.rotten || "N/D";
  const chips = [];
  const imdbChip = document.createElement("span");
  imdbChip.textContent = `IMDb ${imdb}`;
  chips.push(imdbChip);
  if (rotten && rotten !== "N/D") {
    const rottenChip = document.createElement("span");
    rottenChip.textContent = `RT ${rotten}`;
    chips.push(rottenChip);
  }
  return chips;
}

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function firstSentence(value = "") {
  const text = cleanText(value);
  const match = text.match(/^(.{80,210}?[.!?])\s/);
  if (match) return match[1];
  return text.length > 210 ? `${text.slice(0, 207).trim()}...` : text;
}

function personalAngle(item, synopsis) {
  const haystack = `${item.name || ""} ${item.genres?.join(" ") || ""} ${synopsis}`.toLowerCase();
  const angles = [
    {
      test: /space|galaxy|sci[- ]?fi|future|alien|robot|android|dystop|time|star|planet|apocalypse/,
      value: "porque mezcla mundo grande, decisiones pesadas y esa sensación de mirar algo que después deja teoría para charlar"
    },
    {
      test: /crime|detective|murder|killer|police|mafia|heist|conspiracy|mystery|investigation/,
      value: "porque tiene investigación, tensión y piezas para ir armando entre los dos sin mirar en piloto automático"
    },
    {
      test: /love|romance|relationship|marriage|couple|family|daughter|son|mother|father|friendship/,
      value: "porque debajo de la trama hay vínculos, lealtades y decisiones humanas, de esas que se discuten después"
    },
    {
      test: /horror|terror|ghost|haunt|monster|demon|vampire|zombie|nightmare/,
      value: "porque sirve para verla bien pegados, con tensión real pero sin perder el juego de mirarse en las partes fuertes"
    },
    {
      test: /comedy|funny|satire|absurd|mockumentary/,
      value: "porque tiene descanso, timing y humor para cortar la semana sin exigir demasiado cerebro"
    },
    {
      test: /adventure|quest|journey|mission|action|war|battle|survival|escape/,
      value: "porque tiene movimiento, misión y energía de pantalla grande; ideal si quieren algo que avance sin dormirse"
    },
    {
      test: /drama|grief|loss|secret|betrayal|ambition|power|politic/,
      value: "porque apunta más a personajes y conflicto que a ruido, y eso suele rendir cuando quieren algo con sustancia"
    }
  ];
  return angles.find((angle) => angle.test.test(haystack))?.value
    || "porque tiene suficiente identidad para elegirla con intención, no solo por ranking";
}

function editorialDescription(item, { compact = false } = {}) {
  const synopsis = cleanText(item.description);
  const premise = firstSentence(synopsis);
  const genres = Array.isArray(item.genres) ? item.genres.slice(0, 2).join(" y ").toLowerCase() : "";
  const imdb = item.imdbRating || item.ratings?.imdb;
  const rotten = item.rottenRating || item.ratings?.rotten;
  const score = [imdb ? `IMDb ${imdb}` : "", rotten && rotten !== "N/D" ? `RT ${rotten}` : ""].filter(Boolean).join(" · ");
  const kind = item.type === "series" ? "serie" : "película";
  const mood = genres ? `ADN de ${genres}` : "clima propio";
  const availability = item.downloaded ? "ya está lista para darle play" : "si les cierra, la bajamos y va directo al HDMI";
  const premiseLine = premise
    ? `Va de esto: ${premise}`
    : `No tengo una sinopsis fina cargada, pero esta ${kind} ${mood}.`;
  const ratingLine = score ? `La señal externa acompaña (${score}), pero no la elegiría solo por el número.` : "Sin puntajes fuertes cargados: acá la decisión tiene que salir por la premisa.";

  if (compact) {
    return `${premiseLine} Para vos y Cami puede funcionar ${personalAngle(item, synopsis)}. La pondría cuando quieran una ${kind} con ${mood}; ${availability}.`;
  }

  return `${premiseLine} Para vos y Cami puede funcionar ${personalAngle(item, synopsis)}. ${ratingLine} La pondría cuando quieran una ${kind} con ${mood}; ${availability}.`;
}

function metaKey(meta) {
  const stableId = meta.imdb_id || meta.id;
  if (stableId) return String(stableId).toLowerCase();
  return `${meta.name || ""}:${meta.year || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueMetas(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = metaKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderRail(node, items, { limit = 10, exclude = null, moving = false } = {}) {
  if (!node) return;
  node.classList.remove("is-rotating");
  node.classList.toggle("is-moving", moving);
  void node.offsetWidth;
  const excludeKey = exclude ? metaKey(exclude) : "";
  const nextItems = uniqueMetas(items).filter((item) => metaKey(item) !== excludeKey);
  node.replaceChildren(...nextItems.slice(0, limit).map(makeCard));
  node.classList.add("is-rotating");
}

function currentCatalog() {
  if (state.view === "series") return uniqueMetas(state.series);
  if (state.view === "movies") return uniqueMetas(state.movies);
  return uniqueMetas([...state.movies, ...state.series]);
}

function renderFeatured() {
  const items = currentCatalog();
  if (!items.length || !featuredTitle) return;
  const item = items[featuredIndex % items.length];
  featuredPoster.src = poster(item);
  featuredPoster.alt = item.name || "";
  featuredType.textContent = item.type === "series" ? "Serie principal" : "Película principal";
  featuredTitle.textContent = item.name || "Sin título";
  featuredRatings.replaceChildren(...ratingChips(item));
  featuredMeta.textContent = [
    item.year,
    item.runtime,
    item.downloaded ? "Disponible inmediata" : ""
  ].filter(Boolean).join(" · ");
  featuredDescription.textContent = editorialDescription(item, { compact: true });
  $("#featured").onclick = () => openDetail(item);
  return item;
}

function renderCurrentView() {
  const items = currentCatalog();
  const featured = renderFeatured();
  if (mainRailTitle) {
    mainRailTitle.textContent = state.view === "series"
      ? "Series en movimiento"
      : state.view === "movies"
        ? "Películas en movimiento"
        : "Películas y series en movimiento";
  }
  renderRail(movieRail, items, { limit: Number.POSITIVE_INFINITY, exclude: featured, moving: true });
}

function renderHero() {
  if (!heroStack) return;
  const top = state.movies[0] || state.series[0];
  heroStack.replaceChildren();
  if (top?.poster) {
    heroStack.style.setProperty("--spotlight-poster", `url("${poster(top)}")`);
  }
}

function renderLibrary() {
  if (!state.library.length) {
    const empty = document.createElement("div");
    empty.className = "library-item";
    const title = document.createElement("strong");
    title.textContent = "No hay videos descargados todavía";
    const hint = document.createElement("small");
    hint.textContent = "Copiá archivos a $HOME/media/downloads o configurá MEDIA_ROOT.";
    empty.append(title, hint);
    libraryGrid.replaceChildren(empty);
    return;
  }
  libraryGrid.replaceChildren(...state.library.map((file) => {
    const button = document.createElement("button");
    button.className = "library-item focusable";
    const title = document.createElement("strong");
    title.textContent = file.title;
    const meta = document.createElement("small");
    meta.textContent = `${fmtBytes(file.size)} · ${file.subtitles.length} subtítulos detectados`;
    button.append(title, meta);
    button.addEventListener("click", () => openLocal(file));
    return button;
  }));
}

function renderDownloads() {
  const active = state.downloads.filter((torrent) => torrent.progress < 1 && !String(torrent.state).includes("paused"));
  const strip = $("#downloadStrip");
  const meter = $("#downloadMeter");
  if (!active.length) {
    strip.querySelector("strong").textContent = "Sin descargas activas";
    strip.querySelector("small").textContent = `${state.downloads.length} torrents en qBittorrent`;
    meter.style.width = "0%";
    return;
  }
  const avg = active.reduce((sum, torrent) => sum + torrent.progress, 0) / active.length;
  const speed = active.reduce((sum, torrent) => sum + (torrent.dlspeed || 0), 0);
  strip.querySelector("strong").textContent = `${active.length} descarga${active.length > 1 ? "s" : ""} activa${active.length > 1 ? "s" : ""}`;
  strip.querySelector("small").textContent = `${Math.round(avg * 100)}% · ${fmtSpeed(speed)}`;
  meter.style.width = `${Math.round(avg * 100)}%`;
}

function catalogCacheKey(type) {
  return `mediaCenter.catalog.${type}`;
}

function readCachedCatalog(type) {
  try {
    const cached = JSON.parse(localStorage.getItem(catalogCacheKey(type)) || "null");
    return Array.isArray(cached?.metas) ? uniqueMetas(cached.metas) : [];
  } catch {
    return [];
  }
}

function writeCachedCatalog(type, metas) {
  localStorage.setItem(catalogCacheKey(type), JSON.stringify({ metas, savedAt: Date.now() }));
}

async function loadCatalog(type, { force = false } = {}) {
  if (!force) {
    const cached = readCachedCatalog(type);
    if (cached.length) {
      state[type === "movie" ? "movies" : "series"] = cached;
      renderCurrentView();
      return;
    }
  }
  const data = await api(`/api/catalog/${type}/top`);
  const metas = uniqueMetas(data.metas);
  writeCachedCatalog(type, metas);
  state[type === "movie" ? "movies" : "series"] = metas;
  renderCurrentView();
}

async function loadLibrary() {
  const data = await api("/api/library");
  state.library = data.items;
  renderLibrary();
}

async function loadDownloads() {
  const data = await api("/api/downloads");
  state.downloads = data.torrents;
  renderDownloads();
}

async function refreshAll() {
  await Promise.allSettled([loadCatalog("movie"), loadCatalog("series"), loadLibrary(), loadDownloads()]);
}

function openLocal(file) {
  state.detail = { localOnly: true, localFile: file, name: file.title, type: "local" };
  renderDetail();
}

async function openDetail(meta) {
  const detail = $("#detail");
  detail.classList.add("is-open");
  detail.setAttribute("aria-hidden", "false");
  state.detail = meta;
  renderDetail(true);
  try {
    const data = await api(`/api/meta/${meta.type}/${meta.imdb_id || meta.id}`);
    state.detail = { ...data.meta, raw: data.raw };
    renderDetail();
  } catch (error) {
    showToast(error.message);
  }
}

function closeDetail() {
  $("#detail").classList.remove("is-open");
  $("#detail").setAttribute("aria-hidden", "true");
  state.detail = null;
}

function localActions(file) {
  const actions = document.createElement("div");
  actions.className = "detail-actions";
  let selectedSubtitle = "";

  if (file.subtitles?.length) {
    const select = document.createElement("select");
    select.className = "subtitle-select focusable";
    const auto = document.createElement("option");
    auto.value = "";
    auto.textContent = "Subtítulos automáticos";
    select.append(auto, ...file.subtitles.map((sub) => {
      const label = sub.name.includes(".es.") || sub.name.endsWith(".es.srt") ? "Español" : sub.name.includes(".en.") || sub.name.endsWith(".en.srt") ? "English" : sub.name;
      const option = document.createElement("option");
      option.value = sub.path;
      option.textContent = label;
      return option;
    }));
    select.onchange = () => { selectedSubtitle = select.value; };
    actions.append(select);
  }

  const play = document.createElement("button");
  play.className = "primary focusable";
  play.textContent = "Ver en HDMI";
  play.onclick = () => playFile(file.path, true, selectedSubtitle);

  const playNoTakeover = document.createElement("button");
  playNoTakeover.className = "ghost focusable";
  playNoTakeover.textContent = "Ver sin takeover";
  playNoTakeover.onclick = () => playFile(file.path, false, selectedSubtitle);

  const subs = document.createElement("button");
  subs.className = "ghost focusable";
  subs.textContent = "Buscar subtítulos ES/EN";
  subs.onclick = () => fetchSubs(file.path);

  actions.append(play, playNoTakeover, subs);
  return actions;
}

function renderDetail(loading = false) {
  const item = state.detail;
  if (!item) return;

  $("#detailHero").style.backgroundImage = `linear-gradient(90deg, rgba(9,12,16,.9), rgba(9,12,16,.18)), url(${JSON.stringify(item.background || item.poster || "")})`;
  $("#detailType").textContent = loading ? "Cargando metadata" : (item.type === "series" ? "Serie" : item.type === "movie" ? "Película" : "Archivo local");
  $("#detailTitle").textContent = item.name || "Sin título";
  $("#detailMeta").textContent = [
    item.year,
    item.runtime,
    item.imdbRating ? `IMDb ${item.imdbRating}` : "",
    item.rottenRating && item.rottenRating !== "N/D" ? `RT ${item.rottenRating}` : "",
    item.downloaded ? "Disponible inmediata" : ""
  ].filter(Boolean).join(" · ");
  $("#detailDescription").textContent = item.localOnly ? "Archivo local listo para reproducir desde la biblioteca." : editorialDescription(item);

  const actions = $("#detailActions");
  actions.replaceChildren();
  if (item.localFile) {
    actions.append(localActions(item.localFile));
  } else {
    const unavailable = document.createElement("button");
    unavailable.className = "ghost focusable";
    unavailable.textContent = "No descargada";
    unavailable.disabled = true;
    actions.append(unavailable);
  }

  const zone = $("#episodeZone");
  zone.replaceChildren();
  const videos = item.raw?.videos || [];
  if (item.type === "series" && videos.length) {
    const bySeason = Map.groupBy ? Map.groupBy(videos, (video) => video.season || 0) : groupBy(videos, (video) => video.season || 0);
    for (const [season, eps] of bySeason.entries()) {
      const title = document.createElement("div");
      title.className = "season-title";
      title.textContent = `Temporada ${season}`;
      zone.append(title);
      eps.forEach((episode) => {
        const button = document.createElement("button");
        button.className = "episode focusable";
        const name = document.createElement("strong");
        name.textContent = `${episode.episode}. ${episode.title || item.name}`;
        const released = document.createElement("small");
        released.textContent = episode.released ? new Date(episode.released).getFullYear() : "";
        button.append(name, released);
        button.onclick = () => showToast("Episodio listado. Requiere archivo local descargado para reproducir.");
        zone.append(button);
      });
    }
  }
}

function groupBy(items, fn) {
  const map = new Map();
  for (const item of items) {
    const key = fn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

async function playFile(filePath, takeover, subtitlePath = "") {
  await api("/api/play", {
    method: "POST",
    body: JSON.stringify({ path: filePath, takeover, subtitlePath })
  });
  showToast(takeover ? "MPV lanzado en HDMI" : "MPV lanzado");
}

async function fetchSubs(filePath) {
  await api("/api/subtitles/fetch", {
    method: "POST",
    body: JSON.stringify({ path: filePath, langs: ["es", "en"] })
  });
  showToast("Búsqueda de subtítulos iniciada");
  setTimeout(loadLibrary, 2200);
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  featuredIndex = 0;
  applyViewVisibility();
  renderCurrentView();
  if (view === "library") {
    document.querySelector('[data-section="library"]').scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (view === "movies") document.querySelector('[data-section="movies"]').scrollIntoView({ behavior: "smooth" });
  if (view === "series") document.querySelector('[data-section="series"]').scrollIntoView({ behavior: "smooth" });
  if (view === "home") window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyViewVisibility() {
  const visibility = {
    featured: state.view !== "library",
    movies: state.view !== "library",
    series: false,
    library: state.view === "library"
  };
  for (const [section, visible] of Object.entries(visibility)) {
    const node = document.querySelector(`[data-section="${section}"]`);
    if (node) node.hidden = !visible;
  }
}

function rotateItems(items) {
  if (items.length <= 10) return items;
  const copy = [...items];
  copy.push(copy.shift());
  return copy;
}

function rotateCatalogs() {
  renderCurrentView();
}

function advanceFeatured() {
  const items = currentCatalog();
  if (!items.length) return;
  featuredIndex = (featuredIndex + 1) % items.length;
  renderCurrentView();
}

function moveFocus(dx, dy) {
  const focusables = [...document.querySelectorAll(".focusable:not(:disabled), .card:not(:disabled), .library-item:not(:disabled), .episode:not(:disabled)")].filter((el) => el.offsetParent !== null);
  const current = document.activeElement;
  const index = focusables.indexOf(current);
  if (index === -1) return focusables[0]?.focus();
  const rect = current.getBoundingClientRect();
  const candidates = focusables
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter((item) => item.el !== current)
    .filter((item) => dx ? Math.sign(item.rect.left - rect.left) === dx : Math.sign(item.rect.top - rect.top) === dy)
    .map((item) => ({
      el: item.el,
      score: Math.abs(item.rect.left - rect.left) + Math.abs(item.rect.top - rect.top) * (dx ? 1.7 : 0.7)
    }))
    .sort((a, b) => a.score - b.score);
  candidates[0]?.el.focus();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") return closeDetail();
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    moveFocus(...map[event.key]);
  }
});

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));
document.querySelectorAll("[data-refresh]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = button.dataset.refresh;
    if (target === "movie") await loadCatalog("movie", { force: true });
    if (target === "series") await loadCatalog("series", { force: true });
    if (target === "library") await loadLibrary();
    showToast("Actualizado");
  });
});

const openLibrary = $("#openLibrary");
const refreshAllButton = $("#refreshAll");
if (openLibrary) openLibrary.onclick = () => setView("library");
if (refreshAllButton) refreshAllButton.onclick = () => refreshAll().then(() => showToast("Media Center actualizado"));
$("#detailClose").onclick = closeDetail;
$("#closeDetail").onclick = closeDetail;

setView("home");
refreshAll();
setInterval(loadDownloads, 2500);
setInterval(advanceFeatured, 22500);
