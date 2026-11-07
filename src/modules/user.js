let profile = null;
let csrfToken = "";

/**
 * Текущий пользователь: профиль и CSRF-токен хранятся в памяти вкладки.
 */
export const user = {
  get profile() {
    return profile;
  },

  get csrfToken() {
    return csrfToken;
  },

  get isAuthorized() {
    return profile !== null;
  },

  set(data) {
    profile = data.profile;
    csrfToken = data.csrf_token;
  },

  clear() {
    profile = null;
    csrfToken = "";
  },
};
