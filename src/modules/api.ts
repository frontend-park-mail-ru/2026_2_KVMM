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
 * Страница постов одного пользователя.
 */
export interface UserPostsResponse extends FeedResponse {
  profile_id: number;
}

/**
 * Краткий профиль человека в списках друзей: имя и текущая аватарка.
 */
export interface ShortProfile {
  id: number;
  nickname: string;
  profile_name?: string;
  surname?: string;
  patronymic?: string;
  avatar_urls?: string;
}

/**
 * Связь с другим человеком: master отправил запрос, slave получил. profile — вторая сторона.
 */
export interface Relationship {
  profile_id_master: number;
  profile_id_slave: number;
  profile: ShortProfile;
  relationships_status: "request" | "accepted" | "canceled";
  relationships_type: string;
  created_at: string;
}

/**
 * Страница списка с подгрузкой по смещению: next_cursor — сколько элементов уже отдано.
 */
export interface OffsetPage {
  cursor: number;
  limit: number;
  has_more: boolean;
  next_cursor?: number;
}

/**
 * Страница связей.
 */
export interface RelationshipsResponse extends OffsetPage {
  relationships: Relationship[];
}

/**
 * Страница возможных знакомых: друзья друзей и число общих друзей.
 */
export interface SuggestionsResponse extends OffsetPage {
  profiles: { profile: ShortProfile; common_count: number }[];
}

const FRIENDSHIP = "friendship";

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

/**
 * Поля профиля, которые можно изменить. Пустая строка очищает необязательное поле.
 */
export interface ProfileUpdate {
  phone_number?: string;
  profile_name?: string;
  surname?: string;
  patronymic?: string;
  gender?: string;
  birthday?: string;
  bio?: string;
}

/**
 * Загруженная аватарка.
 */
export interface Avatar {
  id: number;
  url: string;
  created_at: string;
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

  if (body instanceof FormData) {
    options.body = body;
  } else if (body) {
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
  return Boolean(session?.profile && typeof session.csrf_token === "string");
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
  updateProfile: (fields: ProfileUpdate) =>
    request<Profile>("PATCH", "/profile/update", { body: fields }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    return request<Avatar>("POST", "/profile/avatar", { body: form });
  },
  requestEmailChange: (email: string) =>
    request<{ message: string }>("POST", "/auth/email/change", {
      body: { email },
    }),
  confirmEmail: (email: string, code: string) =>
    request<Profile>("POST", "/auth/email/confirm", {
      body: { email, code },
    }),
  userPosts: (profileId: number, cursor: number, limit: number) =>
    request<UserPostsResponse>(
      "GET",
      `/posts/user?profile_id=${profileId}&cursor=${cursor}&limit=${limit}`,
    ),
  createPost: (text: string) =>
    request<Post>("POST", "/posts/create", { body: { post_text: text } }),
  updatePost: (postId: number, text: string) =>
    request<Post>("PATCH", "/posts/update", {
      body: { post_id: postId, post_text: text },
    }),
  deletePost: (postId: number) =>
    request<null>("DELETE", `/posts/delete?post_id=${postId}`),
  avatars: () => request<{ avatars: Avatar[] }>("GET", "/profile/avatars"),
  friends: (cursor: number) =>
    request<RelationshipsResponse>(
      "GET",
      `/relationships/list?relationships_status=accepted&relationships_type=${FRIENDSHIP}&cursor=${cursor}`,
    ),
  pendingRelationships: (cursor: number) =>
    request<RelationshipsResponse>(
      "GET",
      `/relationships/list?relationships_status=request&relationships_type=${FRIENDSHIP}&cursor=${cursor}`,
    ),
  incomingRequests: (cursor: number) =>
    request<RelationshipsResponse>(
      "GET",
      `/relationships/requests?relationships_type=${FRIENDSHIP}&cursor=${cursor}`,
    ),
  suggestions: (cursor: number) =>
    request<SuggestionsResponse>(
      "GET",
      `/relationships/suggestions?cursor=${cursor}`,
    ),
  addFriend: (profileId: number) =>
    request<Relationship>("POST", "/relationships/create", {
      body: { profile_id_slave: profileId, relationships_type: FRIENDSHIP },
    }),
  acceptFriend: (profileId: number) =>
    request<Relationship>("PATCH", "/relationships/accept", {
      body: { profile_id: profileId, relationships_type: FRIENDSHIP },
    }),
  removeFriend: (profileId: number) =>
    request<Relationship>("DELETE", "/relationships/cancle", {
      body: { profile_id: profileId, relationships_type: FRIENDSHIP },
    }),
  deleteAvatar: (avatarId: number) =>
    request<null>("DELETE", `/profile/avatars/${avatarId}`),
  mediaUrl: (path: string) => `${path}`,
};
