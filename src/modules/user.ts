import type { Profile, Session } from "./api";

let profile: Profile | null = null;
let csrfToken = "";
const listeners = new Set<() => void>();

/**
 * Сообщает подписчикам, что поменялось, кто авторизован.
 */
function notify(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Текущий пользователь: профиль и CSRF-токен хранятся в памяти вкладки.
 */
export const user = {
  /**
   * Профиль вошедшего пользователя.
   * @returns Профиль или null для гостя.
   */
  get profile(): Profile | null {
    return profile;
  },

  /**
   * CSRF-токен текущей сессии для изменяющих запросов и WebSocket.
   * @returns Токен или пустая строка.
   */
  get csrfToken(): string {
    return csrfToken;
  },

  /**
   * Вошёл ли пользователь.
   * @returns true, если профиль есть.
   */
  get isAuthorized(): boolean {
    return profile !== null;
  },

  /**
   * Запоминает сессию после входа, регистрации или /auth/me. Подписчики узнают об этом, только если сменился пользователь или токен.
   * @param data Профиль и CSRF-токен.
   */
  set(data: Session): void {
    const isNew =
      profile?.id !== data.profile.id || csrfToken !== data.csrf_token;
    profile = data.profile;
    csrfToken = data.csrf_token;
    if (isNew) {
      notify();
    }
  },

  /**
   * Обновляет профиль после правки, не трогая сессию.
   * @param data Новый профиль.
   */
  setProfile(data: Profile): void {
    profile = data;
  },

  /**
   * Забывает пользователя при выходе или истёкшей сессии.
   */
  clear(): void {
    const wasAuthorized = profile !== null;
    profile = null;
    csrfToken = "";
    if (wasAuthorized) {
      notify();
    }
  },

  /**
   * Подписка на вход и выход: вызывается, когда меняется, кто авторизован.
   * @param listener Обработчик.
   * @returns Функция отписки.
   */
  onChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
