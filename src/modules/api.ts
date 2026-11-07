import { user } from "./user";

const API_URL = "/api";

/**
 * Профиль пользователя в ответах бэкенда.
 */
export interface Profile {
  id: number;
  nickname: string;
  email?: string;
  phone_number?: string;
  profile_name?: string;
  surname?: string;
  patronymic?: string;
  gender?: string;
  birthday?: string;
  bio?: string;
  avatar_urls?: string[];
  created_at: string;
}

/**
 * Автор поста: имя для показа (фамилия и имя или логин) и текущая аватарка.
 */
export interface PostAuthor {
  name: string;
  avatar_urls?: string;
  type?: string;
}

/**
 * Пост ленты.
 */
export interface Post {
  id: number;
  post_text?: string;
  author_profile_id?: number;
  author: PostAuthor;
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
 * Поля регистрации: бэкенд принимает только логин, пароль с повтором и согласие на обработку данных.
 */
export interface RegisterFields {
  nickname: string;
  password: string;
  confirm_password: string;
  privacy_policy_allowed: true;
}

interface RequestOptions {
  body?: unknown;
}

async function request<T>(
  method: string,
  path: string,
  { body }: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (method !== "GET" && user.csrfToken) {
    headers["X-CSRF-Token"] = user.csrfToken;
  }
  const options: RequestInit = { method, credentials: "include", headers };

  if (body) {
    headers["Content-Type"] = "application/json";
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
 * Проверяет, что ответ — сессия: профиль и CSRF-токен.
 * @param data Тело ответа.
 * @returns true, если в ответе есть профиль и токен.
 */
export function isSession(data: unknown): data is Session {
  const session = data as Session | null;
  return Boolean(
    session?.profile && typeof session.csrf_token === "string",
  );
}

/**
 * Запросы к API бэкенда. Каждый возвращает { status, data }, status 0 — сервер недоступен. Изменяющие запросы сами добавляют CSRF-токен текущей сессии.
 */
export const api = {
  me: () => request<Session>("GET", "/auth/me"),
  login: (login: string, password: string) =>
    request<Session>("POST", "/auth/login", { body: { login, password } }),
  register: (fields: RegisterFields) =>
    request<Session>("POST", "/auth/register", { body: fields }),
  logout: () => request<null>("POST", "/auth/logout"),
  feed: (cursor: number, limit: number) =>
    request<FeedResponse>("GET", `/feed?cursor=${cursor}&limit=${limit}`),
  mediaUrl: (path: string) => `${path}`,
};
