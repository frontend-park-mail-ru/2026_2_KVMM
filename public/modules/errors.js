export const NETWORK_ERROR = "Сервер недоступен, попробуйте позже";
const DEFAULT_ERROR = "Проверьте правильность заполнения полей";

const SERVER_ERRORS = {
  invalid_credentials: "Неверный логин или пароль",
  already_exists:
    "Пользователь с таким логином, email или телефоном уже существует",
};

export function serverErrorMessage({ status, data }) {
  if (status === 0 || status >= 500) {
    return NETWORK_ERROR;
  }
  return SERVER_ERRORS[data?.code] ?? DEFAULT_ERROR;
}
