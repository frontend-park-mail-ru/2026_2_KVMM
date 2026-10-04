const API_URL = "/api";

async function request(method, path, { body, headers = {} } = {}) {
  const options = { method, credentials: "include", headers };

  if (body) {
    options.headers = { ...headers, "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    return { status: 0, data: null };
  }

  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

export const api = {
  me: () => request("GET", "/auth/me"),
  login: (login, password) =>
    request("POST", "/auth/login", { body: { login, password } }),
  register: (fields) => request("POST", "/auth/register", { body: fields }),
  logout: (csrfToken) =>
    request("POST", "/auth/logout", {
      headers: { "X-CSRF-Token": csrfToken },
    }),
  posts: (offset, limit) =>
    request("GET", `/posts?offset=${offset}&limit=${limit}`),
  mediaUrl: (path) => `${path}`,
};
