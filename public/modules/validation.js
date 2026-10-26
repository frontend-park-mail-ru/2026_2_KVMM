import { applyPhoneMask } from "./phoneMask.js";

export const MAX_LENGTH = {
  login: 254,
  nickname: 32,
  email: 254,
  name: 32,
  password: 64,
  bio: 256,
};

const MESSAGES = {
  required: "Заполните поле",
  nicknameLength: "Логин должен содержать от 4 до 32 символов",
  nicknameChars:
    "Логин может содержать только латинские буквы, цифры, _ и . и начинаться с буквы",
  email: 'Введите правильный email "name@example.ru"',
  emailRequired: "Введите email или нажмите «Возможно потом»",
  phone: "Введите номер в формате +7 (999) 123-45-67",
  phoneCountry: "Можно указать только российский номер, он начинается с +7",
  phoneRegion:
    "Такого кода нет в российской нумерации: после +7 идёт 3, 4, 8 или 9",
  contact: "Укажите email или номер телефона",
  nameChars: "Можно использовать только буквы, пробел, дефис и апостроф",
  passwordMin: "Пароль должен содержать минимум 8 символов",
  passwordMax: "Пароль должен содержать не более 64 символов",
  passwordChars:
    "Пароль может содержать только латинские буквы, цифры и символы",
  passwordStrength: "Пароль должен содержать хотя бы одну букву и одну цифру",
  passwordMismatch: "Пароли не совпадают",
  gender: "Выберите пол",
  birthdayRequired: "Укажите дату рождения",
  birthdayTooYoung: "Регистрация доступна с 14 лет",
  birthdayInvalid: "Проверьте дату рождения",
  consent: "Подтвердите согласие на обработку персональных данных",
  bio: "Рассказ о себе должен быть не длиннее 256 символов",
};

const NAME_LENGTH_MESSAGES = {
  profile_name: "Имя должно содержать от 2 до 32 символов",
  surname: "Фамилия должна содержать от 2 до 32 символов",
  patronymic: "Отчество должно содержать от 2 до 32 символов",
};

const NICKNAME_MIN_LENGTH = 4;
const NAME_MIN_LENGTH = 2;
const PASSWORD_MIN_LENGTH = 8;
const AGE = { min: 14, max: 120 };

const NICKNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.]*$/;
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_PATTERN = /^\+7[3489]\d{9}$/;
const FOREIGN_PHONE_PATTERN = /^\+[0-689]/;
const NON_RUSSIAN_CODE_PATTERN = /^\+7[0-2567]/;
const PHONE_LIKE_PATTERN = /^[\d\s()+-]+$/;
const NAME_PATTERN = /^[\p{L}\p{M}]+([ '’-][\p{L}\p{M}]+)*$/u;
const PASSWORD_CHARS_PATTERN = /^[\x21-\x7E]+$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function length(value) {
  return [...value].length;
}

function isInRange(value, min, max) {
  return length(value) >= min && length(value) <= max;
}

function isEmail(value) {
  return EMAIL_PATTERN.test(value) && value.length <= MAX_LENGTH.email;
}

function passwordLengthOrCharsError(value) {
  if (!value) {
    return MESSAGES.required;
  }
  if (length(value) < PASSWORD_MIN_LENGTH) {
    return MESSAGES.passwordMin;
  }
  if (length(value) > MAX_LENGTH.password) {
    return MESSAGES.passwordMax;
  }
  if (!PASSWORD_CHARS_PATTERN.test(value)) {
    return MESSAGES.passwordChars;
  }
  return "";
}

function parseDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isReal ? { year, month, day } : null;
}

function ageOn(birth, today) {
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const hadBirthday =
    month > birth.month || (month === birth.month && day >= birth.day);
  return today.getUTCFullYear() - birth.year - (hadBirthday ? 0 : 1);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function yearsAgo(today, years, extraDays = 0) {
  return new Date(
    Date.UTC(
      today.getUTCFullYear() - years,
      today.getUTCMonth(),
      today.getUTCDate() + extraDays,
    ),
  );
}

/**
 * Убирает из телефона пробелы, скобки и дефисы маски.
 * @param {string} value Телефон вида +7 (999) 123-45-67.
 * @returns {string} Телефон вида +79991234567.
 */
export function normalizePhone(value) {
  return value.replace(/[\s()-]/g, "");
}

/**
 * Границы поля даты рождения для возраста от 14 до 120 лет.
 * @param {Date} [today] Текущий момент, сравнение идёт по UTC.
 * @returns {{min: string, max: string}} Даты в формате YYYY-MM-DD.
 */
export function birthdayRange(today = new Date()) {
  return {
    min: isoDate(yearsAgo(today, AGE.max + 1, 1)),
    max: isoDate(yearsAgo(today, AGE.min)),
  };
}

/**
 * Проверяет логин на форме входа.
 * @param {string} value Логин, email или телефон.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateLogin(value) {
  return value.trim() ? "" : MESSAGES.required;
}

/**
 * Проверяет пароль на форме входа: длина 8–64 и печатные ASCII без пробела.
 * @param {string} value Пароль.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateLoginPassword(value) {
  return passwordLengthOrCharsError(value);
}

/**
 * Проверяет логин при регистрации: латиница, цифры, _ и ., начинается с буквы, 4–32 символа.
 * @param {string} value Логин.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateNickname(value) {
  const nickname = value.trim();
  if (!nickname) {
    return MESSAGES.required;
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return MESSAGES.nicknameChars;
  }
  return isInRange(nickname, NICKNAME_MIN_LENGTH, MAX_LENGTH.nickname)
    ? ""
    : MESSAGES.nicknameLength;
}

/**
 * Проверяет email по правилу WHATWG для input type=email, длина до 254 символов. Пустой допустим, если указан телефон.
 * @param {string} value Email.
 * @param {string} phone Значение поля телефона.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateEmail(value, phone) {
  const email = value.trim();
  if (!email) {
    return normalizePhone(phone) ? "" : MESSAGES.contact;
  }
  return isEmail(email) ? "" : MESSAGES.email;
}

/**
 * Приводит логин, похожий на телефон (8 999 123-45-67, +7 (999)…), к виду +79991234567, остальное только обрезает.
 * @param {string} value Логин, email или телефон с формы входа.
 * @returns {string} Логин для отправки на бэк.
 */
export function normalizeLogin(value) {
  const login = value.trim();
  if (!PHONE_LIKE_PATTERN.test(login)) {
    return login;
  }
  const phone = normalizePhone(applyPhoneMask(login).value);
  return PHONE_PATTERN.test(phone) ? phone : login;
}

/**
 * Проверяет российский телефон: +7, код на 3, 4, 8 или 9 и ещё 9 цифр. Пустой допустим, если указан email.
 * @param {string} value Телефон из поля с маской.
 * @param {string} email Значение поля email.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validatePhone(value, email) {
  const phone = normalizePhone(value);
  if (!phone) {
    return email.trim() ? "" : MESSAGES.contact;
  }
  if (FOREIGN_PHONE_PATTERN.test(phone)) {
    return MESSAGES.phoneCountry;
  }
  if (NON_RUSSIAN_CODE_PATTERN.test(phone)) {
    return MESSAGES.phoneRegion;
  }
  return PHONE_PATTERN.test(phone) ? "" : MESSAGES.phone;
}

/**
 * Проверяет имя, фамилию или отчество: буквы, между частями один пробел, дефис или апостроф, 2–32 символа.
 * @param {string} value Значение поля.
 * @param {"profile_name"|"surname"|"patronymic"} field Поле, для текста ошибки о длине.
 * @param {boolean} [isRequired] Обязательно ли поле.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateName(value, field, isRequired = true) {
  const name = value.trim();
  if (!name) {
    return isRequired ? MESSAGES.required : "";
  }
  if (!NAME_PATTERN.test(name)) {
    return MESSAGES.nameChars;
  }
  return isInRange(name, NAME_MIN_LENGTH, MAX_LENGTH.name)
    ? ""
    : NAME_LENGTH_MESSAGES[field];
}

/**
 * Проверяет, что пол выбран.
 * @param {string} value male, female или пустая строка.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateGender(value) {
  return value ? "" : MESSAGES.gender;
}

/**
 * Проверяет дату рождения: существующая дата, возраст от 14 до 120 лет по UTC.
 * @param {string} value Дата YYYY-MM-DD или пустая строка.
 * @param {ValidityState} [validity] Состояние поля, badInput — дата введена не полностью.
 * @param {Date} [today] Текущий момент.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateBirthday(value, validity, today = new Date()) {
  if (validity?.badInput) {
    return MESSAGES.birthdayInvalid;
  }
  if (!value) {
    return MESSAGES.birthdayRequired;
  }
  const birth = parseDate(value);
  if (!birth) {
    return MESSAGES.birthdayInvalid;
  }
  const age = ageOn(birth, today);
  if (age < 0 || age > AGE.max) {
    return MESSAGES.birthdayInvalid;
  }
  return age < AGE.min ? MESSAGES.birthdayTooYoung : "";
}

/**
 * Проверяет пароль при регистрации: 8–64 печатных ASCII без пробела, минимум одна буква и одна цифра.
 * @param {string} value Пароль.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validatePassword(value) {
  const error = passwordLengthOrCharsError(value);
  if (error) {
    return error;
  }
  return /[A-Za-z]/.test(value) && /[0-9]/.test(value)
    ? ""
    : MESSAGES.passwordStrength;
}

/**
 * Проверяет, что повтор совпадает с паролем.
 * @param {string} value Повтор пароля.
 * @param {string} password Пароль.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validatePasswordConfirm(value, password) {
  if (!value) {
    return MESSAGES.required;
  }
  return value === password ? "" : MESSAGES.passwordMismatch;
}

/**
 * Проверяет email на шаге «Добавьте email»: здесь поле обязательно, пропустить шаг можно отдельной кнопкой.
 * @param {string} value Email.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateEmailRequired(value) {
  return value.trim() ? validateEmail(value, "") : MESSAGES.emailRequired;
}

/**
 * Проверяет согласие на обработку персональных данных — без него регистрация невозможна.
 * @param {boolean} checked Отмечен ли чекбокс.
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateConsent(checked) {
  return checked ? "" : MESSAGES.consent;
}

/**
 * Проверяет рассказ о себе: не длиннее 256 символов.
 * @param {string} value Текст из поля «Расскажите о себе».
 * @returns {string} Текст ошибки или пустая строка.
 */
export function validateBio(value) {
  return length(value.trim()) <= MAX_LENGTH.bio ? "" : MESSAGES.bio;
}
