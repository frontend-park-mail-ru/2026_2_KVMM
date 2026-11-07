import type { ApiResult } from "./api";

/**
 * Поле регистрации и текст ошибки под ним.
 */
export interface FieldError {
  field: string;
  message: string;
}

export const NETWORK_ERROR = "Сервер недоступен, попробуйте позже";
const DEFAULT_ERROR = "Проверьте правильность заполнения полей";

const FIELD_REJECTED = "Сервер не принял это значение, проверьте его";

const NICKNAME_TAKEN = "Этот логин уже занят";

const SERVER_ERRORS: Record<string, string> = {
  invalid_credentials: "Неверный логин или пароль",
  already_exists:
    "Пользователь с таким логином, email или телефоном уже существует",
  invalid_code_or_request: "Неверный или устаревший код",
  email_delivery_failed:
    "Не удалось отправить письмо. Новый код можно запросить через 2 минуты",
  csrf_failed: "Сессия устарела, обновите страницу",
  unauthorized: "Сессия истекла, войдите снова",
  invalid_avatar: "Можно загрузить только изображение png или jpg",
  avatar_limit: "Загружено максимальное число фото",
};

const REGISTER_FIELD_PATTERNS: [RegExp, string, string?][] = [
  [/email or phone/i, "email", "Укажите email или номер телефона"],
  [/confirm_?password/i, "confirm_password"],
  [/phone_?number/i, "phone_number"],
  [/profile_?name/i, "profile_name"],
  [/patronymic/i, "patronymic"],
  [/surname/i, "surname"],
  [/nickname/i, "nickname"],
  [/email/i, "email"],
  [/password/i, "password"],
  [/gender/i, "gender"],
  [/birthday|\bage\b/i, "birthday"],
  [/\bbio\b/i, "bio"],
];

/**
 * Текст ошибки для пользователя по ответу сервера.
 * @param response Результат запроса из api.ts.
 * @param response.status HTTP-статус, 0 — сервер недоступен.
 * @param response.data Тело ответа с кодом ошибки.
 * @returns Текст ошибки.
 */
export function serverErrorMessage({
  status,
  data,
}: ApiResult<unknown>): string {
  const known = status === 0 ? undefined : SERVER_ERRORS[data?.code ?? ""];
  if (known) {
    return known;
  }
  return status === 0 || status >= 500 ? NETWORK_ERROR : DEFAULT_ERROR;
}

/**
 * Поле регистрации, к которому относится ответ бэка: 409 — логин занят (бэк принимает при регистрации только логин), 400 — по тексту ошибки.
 * @param response Результат запроса из api.ts.
 * @param response.status HTTP-статус.
 * @param response.data Тело ответа с кодом и описанием ошибки.
 * @returns Имя поля и текст под ним или null, если поле не определить.
 */
export function registerFieldError({
  status,
  data,
}: ApiResult<unknown>): FieldError | null {
  if (status === 409 && data?.code === "already_exists") {
    return { field: "nickname", message: NICKNAME_TAKEN };
  }
  const message = data?.message;
  if (status !== 400 || typeof message !== "string") {
    return null;
  }
  const match = REGISTER_FIELD_PATTERNS.find(([pattern]) =>
    pattern.test(message),
  );
  return match
    ? { field: match[1], message: match[2] ?? FIELD_REJECTED }
    : null;
}
