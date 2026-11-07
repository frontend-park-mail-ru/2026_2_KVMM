import type { Profile, Session } from "./api";

let profile: Profile | null = null;
let csrfToken = "";
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Текущий пользователь: профиль и CSRF-токен хранятся в памяти вкладки.
 */
export const user = {
  get profile(): Profile | null {
    return profile;
  },

  get csrfToken(): string {
    return csrfToken;
  },

  get isAuthorized(): boolean {
    return profile !== null;
  },

  set(data: Session): void {
    const isNew =
      profile?.id !== data.profile.id || csrfToken !== data.csrf_token;
    profile = data.profile;
    csrfToken = data.csrf_token;
    if (isNew) {
      notify();
    }
  },

  setProfile(data: Profile): void {
    profile = data;
  },

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
