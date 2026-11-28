import { api } from "./api";
import { user } from "./user";
import { MAX_LENGTH } from "./validation";

const MAX_CONFIGURED_LENGTH = 2048;
let maxTextLength = MAX_LENGTH.post;
let profileUid: string | undefined;
let requestVersion = 0;
const listeners = new Set<() => void>();

function setMaxTextLength(value: number): void {
  if (maxTextLength !== value) {
    maxTextLength = value;
    listeners.forEach((listener) => listener());
  }
}

/** Настройки публикаций для текущего пользователя. */
export const postRuntime = {
  /** @returns Действующий лимит длины текста. */
  get maxTextLength(): number {
    return maxTextLength;
  },

  /**
   * Загружает настройки публикаций для вошедшего пользователя.
   * При временной ошибке использует последнее успешное значение этой сессии.
   * @returns Запрос завершается после попытки обновления.
   */
  async refresh(): Promise<void> {
    const uid = user.profile?.uid;
    const version = ++requestVersion;
    if (uid !== profileUid) {
      profileUid = uid;
      setMaxTextLength(MAX_LENGTH.post);
    }
    if (!uid) {
      return;
    }

    const { status, data } = await api.postsRuntime();
    if (version !== requestVersion || uid !== user.profile?.uid) {
      return;
    }
    const limit = data?.max_text_length;
    if (status === 200 && typeof limit === "number" && Number.isInteger(limit) &&
        limit >= 1 && limit <= MAX_CONFIGURED_LENGTH) {
      setMaxTextLength(limit);
    }
  },

  /**
   * Сообщает редактору об изменении лимита.
   * @param listener Обработчик изменения.
   * @returns Функция отписки.
   */
  onLimitChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
