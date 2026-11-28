import { nextOffset } from "@nexly/utils";
import { api } from "./api";
import type { ShortProfile } from "./api";

const POLL_INTERVAL = 60000;
const MAX_PAGES = 10;

let count = 0;
let timer = 0;
let isRunning = false;
let isBound = false;
let generation = 0;
const listeners = new Set<(count: number) => void>();

interface IncomingRequests {
  profiles: ShortProfile[];
  pageSize: number;
  hasMore: boolean;
}

const refreshListeners = new Set<(requests: IncomingRequests) => void>();

/**
 * Сохраняет новое число заявок и сообщает подписчикам, если оно изменилось.
 * @param value Число входящих заявок.
 */
function set(value: number): void {
  if (value !== count) {
    count = value;
    listeners.forEach((listener) => listener(count));
  }
}

/**
 * Загружает входящие заявки. Для значка достаточно первых десяти страниц, открытый список получает все страницы.
 * @returns Заявки или null при ошибке запроса.
 */
async function load(): Promise<IncomingRequests | null> {
  const profiles: ShortProfile[] = [];
  const maxPages = refreshListeners.size ? Infinity : MAX_PAGES;
  let cursor = 0;
  let pageSize = 0;
  let hasMore = false;
  for (let page = 0; page < maxPages; page++) {
    const { status, data } = await api.incomingRequests(cursor);
    if (status !== 200 || !data?.relationships) {
      return null;
    }
    pageSize ||= data.limit;
    profiles.push(...data.relationships.map(({ profile }) => profile));
    const next = nextOffset(cursor, data);
    hasMore = next.hasMore;
    if (!hasMore) {
      break;
    }
    cursor = next.cursor;
  }
  return { profiles, pageSize, hasMore };
}

/**
 * Входящие заявки в друзья для значка в меню и открытого списка. Обновляются раз в минуту,
 * при переходах по страницам, при возвращении на вкладку и после ответа на заявку.
 */
export const friendRequests = {
  /**
   * Последнее известное число входящих заявок.
   * @returns Число заявок.
   */
  get count(): number {
    return count;
  },

  /**
   * Включает подсчёт после входа.
   */
  start(): void {
    if (isRunning) {
      return;
    }
    isRunning = true;
    if (!isBound) {
      isBound = true;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          friendRequests.refresh();
        }
      });
    }
    timer = window.setInterval(() => friendRequests.refresh(), POLL_INTERVAL);
    friendRequests.refresh();
  },

  /**
   * Выключает подсчёт при выходе и прячет значок.
   */
  stop(): void {
    isRunning = false;
    generation += 1;
    clearInterval(timer);
    set(0);
  },

  /**
   * Пересчитывает заявки. Учитывает результат последнего запроса текущей сессии.
   */
  async refresh(): Promise<void> {
    if (!isRunning) {
      return;
    }
    const current = ++generation;
    const requests = await load();
    if (requests && current === generation) {
      set(requests.profiles.length);
      refreshListeners.forEach((listener) => listener(requests));
    }
  },

  /**
   * Подписка на смену числа заявок.
   * @param listener Обработчик, получает новое число.
   * @returns Функция отписки.
   */
  onChange(listener: (count: number) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Подписка на результат проверки, в том числе когда число заявок осталось прежним.
   * @param listener Обработчик списка входящих заявок.
   * @returns Функция отписки.
   */
  onRefresh(listener: (requests: IncomingRequests) => void): () => void {
    refreshListeners.add(listener);
    return () => refreshListeners.delete(listener);
  },
};
