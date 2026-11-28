type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface EntryBase {
  id: string;
  scope: string;
  name: string;
}

export type Entry = EntryBase & (
  | { kind: "config"; value: JsonValue }
  | { kind: "flag"; rollout: number; include: string[]; exclude: string[] }
);

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

  const search = params.size ? `?${params}` : "";
  const response = await fetch(`/api/onlineconf/admin/entries${search}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ключи OnlineConf (${response.status})`);
  }

  const data = await response.json() as { entries: Entry[] };
  if (!Array.isArray(data.entries)) {
    throw new Error("В ответе OnlineConf отсутствует список ключей");
  }
  return data.entries;
}
