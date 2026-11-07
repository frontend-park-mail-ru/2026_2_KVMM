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

const SERVER_ERRORS: Record<string, string> = {
  invalid_credentials: "Неверный логин или пароль",
  already_exists:
    "Пользователь с таким логином, email или телефоном уже существует",
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
  if (status === 0 || status >= 500) {
    return NETWORK_ERROR;
  }
  return SERVER_ERRORS[data?.code ?? ""] ?? DEFAULT_ERROR;
}

/**
 * Поле регистрации, к которому относится ответ бэка: 409 — к логину (бэк не говорит, что именно занято), 400 — по тексту ошибки.
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
    return { field: "nickname", message: SERVER_ERRORS.already_exists };
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
