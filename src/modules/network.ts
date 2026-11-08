const API_CACHE = "nexly-api";
const CACHE_HEADER = "X-Nexly-Cache";

let isOffline = !navigator.onLine;
const listeners = new Set<(isOffline: boolean) => void>();

function set(value: boolean): void {
  if (value !== isOffline) {
    isOffline = value;
    listeners.forEach((listener) => listener(isOffline));
  }
}

window.addEventListener("offline", () => set(true));
window.addEventListener("online", () => set(false));

/**
 * Есть ли связь с сервером. Без сети service worker отдаёт сохранённые ответы с пометкой, по ней и по ошибкам запросов определяется офлайн.
 */
export const network = {
  get isOffline(): boolean {
    return isOffline;
  },

  /**
   * Учитывает результат запроса: ответ сети — связь есть, ответ из кеша или ошибка сети — связи нет.
   * @param response Ответ или null, если запрос не дошёл.
   */
  report(response: Response | null): void {
    set(!response || response.headers.has(CACHE_HEADER));
  },

  /**
   * Подписка на смену состояния.
   * @param listener Обработчик, получает true без связи.
   * @returns Функция отписки.
   */
  onChange(listener: (isOffline: boolean) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Регистрирует service worker, который кеширует приложение и ответы API для работы без сети.
   */
  registerWorker(): void {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  },

  /**
   * Удаляет сохранённые ответы API — при выходе, чтобы данные одного пользователя не увидел другой.
   */
  clearSaved(): void {
    if ("caches" in window) {
      caches.delete(API_CACHE).catch(() => {});
    }
  },
};
