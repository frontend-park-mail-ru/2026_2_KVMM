const MESSAGES = {
  required: "Заполните поле",
  nickname: "Логин должен содержать от 4 до 32 символов",
  email: 'Введите правильный email "name@example.ru"',
  phone: "Введите номер в формате +79991234567",
  contact: "Укажите email или номер телефона",
  nameChars: "Можно использовать только буквы и дефис",
  passwordMin: "Пароль должен содержать минимум 8 символов",
  passwordMax: "Пароль слишком длинный",
  passwordMismatch: "Пароли не совпадают",
  gender: "Выберите пол",
};

const NAME_LENGTH_MESSAGES = {
  profile_name: "Имя должно содержать от 2 до 32 символов",
  surname: "Фамилия должна содержать от 2 до 32 символов",
  patronymic: "Отчество должно содержать от 2 до 32 символов",
};

const NICKNAME_LENGTH = { min: 4, max: 32 };
const NAME_LENGTH = { min: 2, max: 32 };
const PASSWORD_LENGTH = { min: 8, max: 72 };

const EMAIL_ATOM = '[^\\s\\u0000-\\u001f\\u007f()<>\\[\\]:;@\\\\,."]+';
const EMAIL_DOT_ATOM = `${EMAIL_ATOM}(\\.${EMAIL_ATOM})*`;
const EMAIL_PATTERN = new RegExp(`^${EMAIL_DOT_ATOM}@${EMAIL_DOT_ATOM}$`, "u");
const PHONE_PATTERN = /^\+[1-9][0-9]*$/;
const NAME_PATTERN = /^\p{L}+(-\p{L}+)*$/u;

function length(value) {
  return [...value].length;
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function isInRange(value, { min, max }) {
  return length(value) >= min && length(value) <= max;
}

export function normalizePhone(value) {
  return value.replace(/[\s()-]/g, "");
}

export function validateLogin(value) {
  return value.trim() ? "" : MESSAGES.required;
}

export function validateLoginPassword(value) {
  if (!value) {
    return MESSAGES.required;
  }
  if (length(value) < PASSWORD_LENGTH.min) {
    return MESSAGES.passwordMin;
  }
  return "";
}

export function validateNickname(value) {
  const nickname = value.trim();
  if (!nickname) {
    return MESSAGES.required;
  }
  return isInRange(nickname, NICKNAME_LENGTH) ? "" : MESSAGES.nickname;
}

export function validateEmail(value, phone) {
  const email = value.trim();
  if (!email) {
    return normalizePhone(phone) ? "" : MESSAGES.contact;
  }
  return EMAIL_PATTERN.test(email) ? "" : MESSAGES.email;
}

export function validatePhone(value, email) {
  const phone = normalizePhone(value);
  if (!phone) {
    return email.trim() ? "" : MESSAGES.contact;
  }
  return PHONE_PATTERN.test(phone) ? "" : MESSAGES.phone;
}

export function validateName(value, field, isRequired = true) {
  const name = value.trim();
  if (!name) {
    return isRequired ? MESSAGES.required : "";
  }
  if (!NAME_PATTERN.test(name)) {
    return MESSAGES.nameChars;
  }
  return isInRange(name, NAME_LENGTH) ? "" : NAME_LENGTH_MESSAGES[field];
}

export function validatePassword(value) {
  if (!value) {
    return MESSAGES.required;
  }
  if (length(value) < PASSWORD_LENGTH.min) {
    return MESSAGES.passwordMin;
  }
  if (
    length(value) > PASSWORD_LENGTH.max ||
    byteLength(value) > PASSWORD_LENGTH.max
  ) {
    return MESSAGES.passwordMax;
  }
  return "";
}

export function validatePasswordConfirm(value, password) {
  if (!value) {
    return MESSAGES.required;
  }
  return value === password ? "" : MESSAGES.passwordMismatch;
}

export function validateGender(value) {
  return value ? "" : MESSAGES.gender;
}
