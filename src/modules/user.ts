import type { Profile, Session } from "./api";

let profile: Profile | null = null;
let csrfToken = "";

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
    profile = data.profile;
    csrfToken = data.csrf_token;
  },

  clear(): void {
    profile = null;
    csrfToken = "";
  },
};
