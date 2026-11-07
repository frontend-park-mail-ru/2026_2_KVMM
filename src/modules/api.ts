const API_URL = "/api";

/**
 * Профиль пользователя в ответах бэкенда.
 */
export interface Profile {
  id: number;
  nickname: string;
  email?: string;
  phone_number?: string;
  profile_name: string;
  surname: string;
  patronymic?: string;
  gender: string;
  birthday?: string;
  bio?: string;
  image_url?: string;
  avatar_urls?: string[];
  created_at: string;
}

/**
 * Пост ленты.
 */
export interface Post {
  id: number;
  post_text?: string;
  author_profile_id?: number;
  author: Profile;
  created_at: string;
  comments_count: number;
  reposts_count: number;
  likes_count: number;
  media_count: number;
  media_urls?: string[];
}

/**
 * Страница ленты с курсором следующей страницы.
 */
export interface FeedResponse {
  posts: Post[];
  cursor: number;
  limit: number;
  has_more: boolean;
  next_cursor?: number;
}

/**
 * Ответ на вход, регистрацию и запрос текущего пользователя.
 */
export interface Session {
  profile: Profile;
  csrf_token: string;
}

/**
 * Ошибка бэкенда.
 */
export interface ApiError {
  code: string;
  message: string;
}

/**
 * Результат запроса: HTTP-статус (0 — сервер недоступен) и тело ответа, если оно разобралось как JSON.
 */
export interface ApiResult<T> {
  status: number;
  data: (T & Partial<ApiError>) | null;
}

/**
 * Поля регистрации, которые принимает бэкенд.
 */
export interface RegisterFields {
  nickname: string;
  email?: string;
  phone_number?: string;
  password: string;
  confirm_password: string;
  profile_name: string;
  surname: string;
  patronymic?: string;
  gender: string;
  birthday: string;
  bio?: string;
}

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  { body, headers = {} }: RequestOptions = {},
): Promise<ApiResult<T>> {
  const options: RequestInit = { method, credentials: "include", headers };

  if (body) {
    options.headers = { ...headers, "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    return { status: 0, data: null };
  }

  const data = (await response
    .json()
    .catch(() => null)) as ApiResult<T>["data"];
  return { status: response.status, data };
}

/**
 * Запросы к API бэкенда. Каждый возвращает { status, data }, status 0 — сервер недоступен.
 */
export const api = {
  me: () => request<Session>("GET", "/auth/me"),
  login: (login: string, password: string) =>
    request<Session>("POST", "/auth/login", { body: { login, password } }),
  register: (fields: RegisterFields) =>
    request<Session>("POST", "/auth/register", { body: fields }),
  logout: (csrfToken: string) =>
    request<null>("POST", "/auth/logout", {
      headers: { "X-CSRF-Token": csrfToken },
    }),
  posts: (cursor: number, limit: number) =>
    request<FeedResponse>("GET", `/posts?cursor=${cursor}&limit=${limit}`),
  mediaUrl: (path: string) => `${path}`,
};
