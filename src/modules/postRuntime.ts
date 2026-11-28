import { api } from "./api";
import { user } from "./user";
import { MAX_LENGTH } from "./validation";

const MAX_CONFIGURED_LENGTH = 2048;
const DEFAULT_RUNTIME = { maxTextLength: MAX_LENGTH.post, likesEnabled: true };
let runtime = DEFAULT_RUNTIME;
let profileUid: string | undefined;
let requestVersion = 0;
const listeners = new Set<() => void>();

function setRuntime(next: typeof DEFAULT_RUNTIME): void {
  if (runtime.maxTextLength === next.maxTextLength && runtime.likesEnabled === next.likesEnabled) {
    return;
  }
  runtime = next;
  listeners.forEach((listener) => listener());
}

/** Настройки публикаций для текущего пользователя. */
export const postRuntime = {
  /** @returns Действующий лимит длины текста. */
  get maxTextLength(): number {
    return runtime.maxTextLength;
  },

  /** @returns Доступно ли текущему пользователю изменение лайков. */
  get likesEnabled(): boolean {
    return runtime.likesEnabled;
  },

  /** Запоминает отказ сервера для текущей сессии до следующего снимка. */
  markLikesUnavailable(): void {
    setRuntime({ ...runtime, likesEnabled: false });
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
      setRuntime(DEFAULT_RUNTIME);
    }
    if (!uid) {
      return;
    }

    const { status, data } = await api.postsRuntime();
    if (status !== 200 || version !== requestVersion || uid !== user.profile?.uid) {
      return;
    }
    const limit = data?.max_text_length;
    const validLimit = typeof limit === "number" && Number.isInteger(limit) &&
      limit >= 1 && limit <= MAX_CONFIGURED_LENGTH;
    const likesEnabled = data?.likes_enabled;
    setRuntime({
      maxTextLength: validLimit ? limit : runtime.maxTextLength,
      likesEnabled: typeof likesEnabled === "boolean" ? likesEnabled : runtime.likesEnabled,
    });
  },

  /**
   * Сообщает подписчику об изменении настроек постов.
   * @param listener Обработчик изменения.
   * @returns Функция отписки.
   */
  onChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
