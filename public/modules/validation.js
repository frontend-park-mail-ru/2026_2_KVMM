const MESSAGES = {
  required: "Заполните поле",
  passwordMin: "Пароль должен содержать минимум 8 символов",
};

const PASSWORD_MIN_LENGTH = 8;

function length(value) {
  return [...value].length;
}

export function validateLogin(value) {
  return value.trim() ? "" : MESSAGES.required;
}

export function validateLoginPassword(value) {
  if (!value) {
    return MESSAGES.required;
  }
  if (length(value) < PASSWORD_MIN_LENGTH) {
    return MESSAGES.passwordMin;
  }
  return "";
}
