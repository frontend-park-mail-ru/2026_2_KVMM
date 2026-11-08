import { nextOffset } from "@nexly/utils";
import { api } from "./api";

const POLL_INTERVAL = 60000;
const MAX_PAGES = 10;

let count = 0;
let timer = 0;
let isRunning = false;
let isBound = false;
let generation = 0;
const listeners = new Set<(count: number) => void>();

function set(value: number): void {
  if (value !== count) {
    count = value;
    listeners.forEach((listener) => listener(count));
  }
}

async function load(): Promise<number | null> {
  let total = 0;
  let cursor = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { status, data } = await api.incomingRequests(cursor);
    if (status !== 200 || !data?.relationships) {
      return null;
    }
    total += data.relationships.length;
    const next = nextOffset(cursor, data);
    if (!next.hasMore) {
      break;
    }
    cursor = next.cursor;
  }
  return total;
}

/**
 * Число входящих заявок в друзья для значка в меню. Бэк не сообщает о новых заявках, поэтому число
 * обновляется раз в минуту, при переходах по страницам, при возвращении на вкладку и после ответа на заявку.
 */
export const friendRequests = {
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
   * Пересчитывает заявки. Ответы, пришедшие после выхода, игнорируются; при ошибке остаётся прежнее число.
   */
  async refresh(): Promise<void> {
    if (!isRunning) {
      return;
    }
    const current = generation;
    const total = await load();
    if (total !== null && current === generation) {
      set(total);
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
};
