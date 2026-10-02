let profile = null;
let csrfToken = "";

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
