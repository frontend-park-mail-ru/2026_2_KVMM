import { api } from "./api";
import { user } from "./user";
import { MAX_LENGTH } from "./validation";

const MAX_CONFIGURED_LENGTH = 2048;
const REFRESH_INTERVAL = 15_000;
const REQUEST_TIMEOUT = 8_000;
const DEFAULT_RUNTIME = { maxTextLength: MAX_LENGTH.post, likesEnabled: true };
let runtime = DEFAULT_RUNTIME;
let profileUid: string | undefined;
let pendingRequest: AbortController | undefined;
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

  /** Обновляет настройки по таймеру и сразу после возвращения на вкладку. */
  watch(): void {
    const refresh = (): void => {
      if (user.isAuthorized && !pendingRequest) {
        void postRuntime.refresh();
      }
    };
    window.setInterval(refresh, REFRESH_INTERVAL);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    });
  },

  /**
   * Загружает настройки публикаций для вошедшего пользователя.
   * При временной ошибке использует последнее успешное значение этой сессии.
   * @returns Запрос завершается после попытки обновления.
   */
  async refresh(): Promise<void> {
    const uid = user.profile?.uid;
    pendingRequest?.abort();
    pendingRequest = undefined;
    if (uid !== profileUid) {
      profileUid = uid;
      setRuntime(DEFAULT_RUNTIME);
    }
    if (!uid) {
      return;
    }

    const request = new AbortController();
    pendingRequest = request;
    const timeout = window.setTimeout(() => request.abort(), REQUEST_TIMEOUT);
    const { status, data } = await api.postsRuntime(request.signal);
    window.clearTimeout(timeout);
    if (pendingRequest !== request) {
      return;
    }
    pendingRequest = undefined;
    if (status !== 200 || request.signal.aborted || uid !== user.profile?.uid) {
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
