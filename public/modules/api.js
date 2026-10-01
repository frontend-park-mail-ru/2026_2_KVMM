const API_URL = "http://localhost:8080";

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
  me: () => request("GET", "/api/auth/me"),
  login: (login, password) =>
    request("POST", "/api/auth/login", { body: { login, password } }),
  register: (fields) => request("POST", "/api/auth/register", { body: fields }),
  logout: (csrfToken) =>
    request("POST", "/api/auth/logout", {
      headers: { "X-CSRF-Token": csrfToken },
    }),
  posts: (offset, limit) =>
    request("GET", `/api/posts?offset=${offset}&limit=${limit}`),
  mediaUrl: (path) => `${API_URL}${path}`,
};
