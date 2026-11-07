export const NETWORK_ERROR = "Сервер недоступен, попробуйте позже";
const DEFAULT_ERROR = "Проверьте правильность заполнения полей";

const FIELD_REJECTED = "Сервер не принял это значение, проверьте его";

const SERVER_ERRORS = {
  invalid_credentials: "Неверный логин или пароль",
  already_exists:
    "Пользователь с таким логином, email или телефоном уже существует",
};

const REGISTER_FIELD_PATTERNS = [
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
 * @param {object} response Результат запроса из api.js.
 * @param {number} response.status HTTP-статус, 0 — сервер недоступен.
 * @param {?{code: string}} response.data Тело ответа с кодом ошибки.
 * @returns {string} Текст ошибки.
 */
export function serverErrorMessage({ status, data }) {
  if (status === 0 || status >= 500) {
    return NETWORK_ERROR;
  }
  return SERVER_ERRORS[data?.code] ?? DEFAULT_ERROR;
}

/**
 * Поле регистрации, к которому относится ответ бэка: 409 — к логину (бэк не говорит, что именно занято), 400 — по тексту ошибки.
 * @param {object} response Результат запроса из api.js.
 * @param {number} response.status HTTP-статус.
 * @param {?{code: string, message: string}} response.data Тело ответа с кодом и описанием ошибки.
 * @returns {?{field: string, message: string}} Имя поля и текст под ним или null, если поле не определить.
 */
export function registerFieldError({ status, data }) {
  if (status === 409 && data?.code === "already_exists") {
    return { field: "nickname", message: SERVER_ERRORS.already_exists };
  }
  if (status !== 400 || typeof data?.message !== "string") {
    return null;
  }
  const match = REGISTER_FIELD_PATTERNS.find(([pattern]) =>
    pattern.test(data.message),
  );
  return match
    ? { field: match[1], message: match[2] ?? FIELD_REJECTED }
    : null;
}
