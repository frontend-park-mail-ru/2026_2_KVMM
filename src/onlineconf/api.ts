export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface EntryBase {
  uid: string;
  scope: string;
  name: string;
}

type ConfigValue = { kind: "config"; value: JsonValue };
type FlagValue = { kind: "flag"; rollout: number; include?: string[]; exclude?: string[] };

export type EntryValue = ConfigValue | Required<FlagValue>;
export type Entry = EntryBase & (ConfigValue | FlagValue);
type NewEntry = Omit<EntryBase, "uid"> & EntryValue;

/** Профиль, которому выдан доступ к OnlineConf. */
export interface OnlineConfAdmin {
  profile_uid: string;
  created_at: string;
  is_bootstrap: boolean;
}

const ENTRIES_URL = "/api/onlineconf/admin/entries";
const ADMINS_URL = "/api/onlineconf/admin/admins";

/** Ошибка административного API с кодом и HTTP-статусом. */
export class OnlineConfHttpError extends Error {
  /**
   * @param message Сообщение об ошибке.
   * @param status HTTP-статус.
   * @param code Код ошибки из ответа.
   */
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * Возвращает пользователя в ленту Nexly при отказе в доступе.
 * @param cause Причина ошибки запроса.
 * @returns Признак перехода на ленту.
 */
export function redirectOnAccessDenied(cause: unknown): boolean {
  if (!(cause instanceof OnlineConfHttpError)) {
    return false;
  }
  if (cause.status === 401 || (cause.status === 403 && cause.code !== "csrf_failed")) {
    window.location.replace("/feed");
    return true;
  }
  return false;
}

async function request(url: string, options: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  }).catch((cause: unknown) => {
    if (options.signal?.aborted) {
      throw cause;
    }
    throw new Error("Не удалось подключиться к OnlineConf. Проверьте соединение и повторите попытку.");
  });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const details = data && typeof data === "object" ? data : {};
    const message = "message" in details && typeof details.message === "string"
      ? details.message.trim()
      : "";
    const code = "code" in details && typeof details.code === "string" ? details.code : "";
    throw new OnlineConfHttpError(
      message || "Запрос OnlineConf завершился ошибкой (" + response.status + ")",
      response.status,
      code,
    );
  }

  return data;
}

async function write(url: string, method: "POST" | "PATCH" | "DELETE", payload?: object): Promise<void> {
  const session = await request("/api/auth/me", {
    headers: ONLINECONF_DEV_MOCK ? { "X-OnlineConf-Dev-Mock": "1" } : undefined,
  });
  if (!session || typeof session !== "object" || !("csrf_token" in session) ||
      typeof session.csrf_token !== "string" || !session.csrf_token.trim()) {
    throw new Error("Не удалось получить токен сессии. Обновите страницу и попробуйте снова.");
  }

  await request(url, {
    method,
    headers: { "X-CSRF-Token": session.csrf_token },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

/**
 * Загружает ключи OnlineConf с выбранными фильтрами.
 * @param query Поиск по имени ключа.
 * @param scope Скоуп или пустая строка для всех скоупов.
 * @param signal Сигнал для отмены устаревшего запроса.
 * @returns Список записей, подходящих под фильтры.
 */
export async function listEntries(query: string, scope: string, signal: AbortSignal): Promise<Entry[]> {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (scope) {
    params.set("scope", scope);
  }

  const search = params.size ? "?" + params : "";
  const data = await request(ENTRIES_URL + search, { signal });
  if (!data || typeof data !== "object" || !("entries" in data) || !Array.isArray(data.entries)) {
    throw new Error("В ответе OnlineConf отсутствует список ключей");
  }
  return data.entries as Entry[];
}

/**
 * Создаёт ключ в выбранном скоупе.
 * @param entry Поля нового ключа.
 * @returns Запрос завершается после сохранения.
 */
export async function createEntry(entry: NewEntry): Promise<void> {
  await write(ENTRIES_URL, "POST", entry);
}

/**
 * Сохраняет изменяемые поля существующего ключа.
 * @param uid UUID ключа.
 * @param value Данные конфигурации или флага.
 * @returns Запрос завершается после сохранения.
 */
export async function updateEntry(uid: string, value: EntryValue): Promise<void> {
  const payload = value.kind === "config"
    ? { value: value.value }
    : { rollout: value.rollout, include: value.include, exclude: value.exclude };

  await write(ENTRIES_URL + "/" + encodeURIComponent(uid), "PATCH", payload);
}

/**
 * Получает профили с доступом к OnlineConf.
 * @returns Список администраторов.
 */
export async function listAdmins(): Promise<OnlineConfAdmin[]> {
  const data = await request(ADMINS_URL);
  if (!data || typeof data !== "object" || !("admins" in data) || !Array.isArray(data.admins)) {
    throw new Error("В ответе OnlineConf отсутствует список администраторов");
  }
  return data.admins as OnlineConfAdmin[];
}

/**
 * Выдаёт профилю доступ к OnlineConf.
 * @param profileUid Публичный UUID профиля Nexly.
 * @returns Запрос завершается после выдачи доступа.
 */
export async function grantAdmin(profileUid: string): Promise<void> {
  await write(ADMINS_URL, "POST", { profile_uid: profileUid });
}

/**
 * Отзывает доступ профиля к OnlineConf.
 * @param profileUid Публичный UUID профиля Nexly.
 * @returns Запрос завершается после отзыва доступа.
 */
export async function revokeAdmin(profileUid: string): Promise<void> {
  await write(ADMINS_URL + "/" + encodeURIComponent(profileUid), "DELETE");
}
