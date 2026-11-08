/**
 * Что нужно закешировать при установке: версия сборки и все её файлы. Подставляется webpack после сборки.
 */
interface Manifest {
  version: string;
  assets: string[];
}

const sw = self as unknown as ServiceWorkerGlobalScope;
const MANIFEST = JSON.parse("__NEXLY_MANIFEST__") as Manifest;

const SHELL_PREFIX = "nexly-shell-";
const SHELL_CACHE = `${SHELL_PREFIX}${MANIFEST.version}`;
const API_CACHE = "nexly-api";
const MEDIA_CACHE = "nexly-media";
const SHELL_PAGE = "/index.html";
const CACHE_HEADER = "X-Nexly-Cache";
const MEDIA_LIMIT = 200;

/**
 * Копия ответа из кеша с пометкой: страница по ней понимает, что сети нет и данные сохранённые.
 * @param response Ответ из кеша.
 * @returns Тот же ответ с заголовком X-Nexly-Cache.
 */
function markCached(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(CACHE_HEADER, "offline");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Сначала сеть, при ошибке сети — сохранённый ответ. Успешные ответы сохраняются.
 * @param request Запрос.
 * @param cacheName Кеш.
 * @param fallback Путь в кеше, если для самого запроса ничего нет.
 * @returns Ответ сети, ответ из кеша или сетевая ошибка.
 */
async function networkFirst(
  request: Request,
  cacheName: string,
  fallback?: string,
): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok && cacheName === API_CACHE) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await caches.match(request, { ignoreVary: true })) ??
      (fallback ? await caches.match(fallback) : undefined);
    return cached ? markCached(cached) : Response.error();
  }
}

/**
 * Сначала кеш, иначе сеть с сохранением. Для файлов, которые не меняются по своему адресу.
 * @param request Запрос.
 * @param cacheName Кеш для сохранения или пустая строка, чтобы не сохранять.
 * @param limit Сколько записей держать в кеше.
 * @returns Ответ из кеша или сети.
 */
async function cacheFirst(
  request: Request,
  cacheName: string,
  limit: number = 0,
): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok && cacheName) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(
      keys
        .slice(0, Math.max(0, keys.length - limit))
        .map((key) => cache.delete(key)),
    );
  }
  return response;
}

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(MANIFEST.assets))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith(SHELL_PREFIX) && name !== SHELL_CACHE,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== sw.location.origin) {
    return;
  }
  if (url.pathname.startsWith("/api/media/")) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE, MEDIA_LIMIT));
  } else if (url.pathname === "/api/chats/ws") {
    return;
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, SHELL_PAGE));
  } else if (MANIFEST.assets.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, ""));
  }
});
