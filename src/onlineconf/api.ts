export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface EntryBase {
  id: string;
  scope: string;
  name: string;
}

export type EntryValue =
  | { kind: "config"; value: JsonValue }
  | { kind: "flag"; rollout: number; include: string[]; exclude: string[] };

export type Entry = EntryBase & EntryValue;
type NewEntry = Omit<EntryBase, "id"> & EntryValue;

const ENTRIES_URL = "/api/onlineconf/admin/entries";

async function request(url: string, options: RequestInit = {}): Promise<unknown> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers, cache: "no-store" }).catch((cause: unknown) => {
    if (options.signal?.aborted) {
      throw cause;
    }
    throw new Error("Не удалось подключиться к OnlineConf. Проверьте соединение и повторите попытку.");
  });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data && typeof data.message === "string"
      ? data.message.trim()
      : "";
    throw new Error(message || "Запрос OnlineConf завершился ошибкой (" + response.status + ")");
  }

  return data;
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
  await request(ENTRIES_URL, { method: "POST", body: JSON.stringify(entry) });
}

/**
 * Сохраняет изменяемые поля существующего ключа.
 * @param id Идентификатор ключа.
 * @param value Данные конфигурации или флага.
 * @returns Запрос завершается после сохранения.
 */
export async function updateEntry(id: string, value: EntryValue): Promise<void> {
  const payload = value.kind === "config"
    ? { value: value.value }
    : { rollout: value.rollout, include: value.include, exclude: value.exclude };

  await request(ENTRIES_URL + "/" + encodeURIComponent(id), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Удаляет запись OnlineConf по идентификатору.
 * @param id Идентификатор ключа.
 * @returns Запрос завершается после удаления.
 */
export async function deleteEntry(id: string): Promise<void> {
  await request(ENTRIES_URL + "/" + encodeURIComponent(id), { method: "DELETE" });
}
