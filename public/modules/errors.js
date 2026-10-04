export const NETWORK_ERROR = "Сервер недоступен, попробуйте позже";
const DEFAULT_ERROR = "Проверьте правильность заполнения полей";

const SERVER_ERRORS = {
  invalid_credentials: "Неверный логин или пароль",
  already_exists:
    "Пользователь с таким логином, email или телефоном уже существует",
};

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
