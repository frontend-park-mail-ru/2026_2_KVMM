import { applyPhoneMask } from "./phoneMask";

export const MAX_LENGTH = {
  login: 254,
  nickname: 32,
  email: 254,
  name: 32,
  password: 64,
  bio: 256,
  post: 256,
};

const MESSAGES = {
  required: "Заполните поле",
  nicknameLength: "Логин должен содержать от 4 до 32 символов",
  nicknameChars:
    "Логин может содержать только латинские буквы, цифры, _ и . и начинаться с буквы",
  email: 'Введите правильный email "name@example.ru"',
  phone: "Введите номер в формате +7 (999) 123-45-67",
  phoneCountry: "Можно указать только российский номер, он начинается с +7",
  phoneRegion:
    "Такого кода нет в российской нумерации: после +7 идёт 3, 4, 8 или 9",
  nameChars: "Можно использовать только буквы, пробел, дефис и апостроф",
  passwordMin: "Пароль должен содержать минимум 8 символов",
  passwordMax: "Пароль должен содержать не более 64 символов",
  passwordChars:
    "Пароль может содержать только латинские буквы, цифры и символы",
  passwordStrength: "Пароль должен содержать хотя бы одну букву и одну цифру",
  passwordMismatch: "Пароли не совпадают",
  birthdayTooYoung: "Регистрация доступна с 14 лет",
  birthdayInvalid: "Проверьте дату рождения",
  consent: "Подтвердите согласие на обработку персональных данных",
  bio: "Рассказ о себе должен быть не длиннее 256 символов",
  code: "Введите 6 цифр из письма",
  postEmpty: "Напишите текст поста",
  postLength: "Пост должен быть не длиннее 256 символов",
  avatarType: "Можно загрузить только png или jpg",
  avatarSize: "Файл должен быть не больше 5 МБ",
};

const AVATAR_TYPES = ["image/png", "image/jpeg"];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const CODE_PATTERN = /^\d{6}$/;

/**
 * Поле имени, фамилии или отчества.
 */
export type NameField = "profile_name" | "surname" | "patronymic";

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const NAME_LENGTH_MESSAGES: Record<NameField, string> = {
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

/**
 * Длина в символах, а не в UTF-16: эмодзи и составные буквы считаются за один.
 * @param value Строка.
 * @returns Число символов.
 */
function length(value: string): number {
  return [...value].length;
}

/**
 * Укладывается ли длина в границы, включительно.
 * @param value Строка.
 * @param min Наименьшая длина.
 * @param max Наибольшая длина.
 * @returns true, если длина допустима.
 */
function isInRange(value: string, min: number, max: number): boolean {
  return length(value) >= min && length(value) <= max;
}

/**
 * Похоже ли на email и не длиннее ли, чем пропустит бэк.
 * @param value Строка.
 * @returns true, если это допустимый email.
 */
function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value) && value.length <= MAX_LENGTH.email;
}

/**
 * Ошибка пароля по длине и символам: допустимы только печатные ASCII, как на бэке.
 * @param value Пароль.
 * @returns Текст ошибки или пустая строка.
 */
function passwordLengthOrCharsError(value: string): string {
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

/**
 * Разбирает дату ГГГГ-ММ-ДД и отбрасывает несуществующие, например 31 февраля.
 * @param value Значение поля даты.
 * @returns Год, месяц и день или null.
 */
function parseDate(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isReal ? { year, month, day } : null;
}

/**
 * Полных лет на указанный день.
 * @param birth Дата рождения.
 * @param today День, на который считать.
 * @returns Возраст в годах.
 */
function ageOn(birth: DateParts, today: Date): number {
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const hadBirthday =
    month > birth.month || (month === birth.month && day >= birth.day);
  return today.getUTCFullYear() - birth.year - (hadBirthday ? 0 : 1);
}

/**
 * Дата в виде ГГГГ-ММ-ДД для атрибутов min и max поля даты.
 * @param date Дата.
 * @returns Строка ГГГГ-ММ-ДД.
 */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Дата на заданное число лет раньше, со сдвигом в днях — для границ допустимого возраста.
 * @param today От какой даты считать.
 * @param years Сколько лет назад.
 * @param extraDays Сдвиг в днях.
 * @returns Дата в UTC.
 */
function yearsAgo(today: Date, years: number, extraDays: number = 0): Date {
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
 * @param value Телефон вида +7 (999) 123-45-67.
 * @returns Телефон вида +79991234567.
 */
export function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, "");
}

/**
 * Границы поля даты рождения для возраста от 14 до 120 лет.
 * @param today Текущий момент, сравнение идёт по UTC.
 * @returns Даты в формате YYYY-MM-DD.
 */
export function birthdayRange(today: Date = new Date()): {
  min: string;
  max: string;
} {
  return {
    min: isoDate(yearsAgo(today, AGE.max + 1, 1)),
    max: isoDate(yearsAgo(today, AGE.min)),
  };
}

/**
 * Проверяет логин на форме входа.
 * @param value Логин, email или телефон.
 * @returns Текст ошибки или пустая строка.
 */
export function validateLogin(value: string): string {
  return value.trim() ? "" : MESSAGES.required;
}

/**
 * Проверяет пароль на форме входа: длина 8–64 и печатные ASCII без пробела.
 * @param value Пароль.
 * @returns Текст ошибки или пустая строка.
 */
export function validateLoginPassword(value: string): string {
  return passwordLengthOrCharsError(value);
}

/**
 * Проверяет логин при регистрации: латиница, цифры, _ и ., начинается с буквы, 4–32 символа.
 * @param value Логин.
 * @returns Текст ошибки или пустая строка.
 */
export function validateNickname(value: string): string {
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
 * Проверяет email по правилу WHATWG для input type=email, длина до 254 символов. Поле необязательное: пустое допустимо.
 * @param value Email.
 * @returns Текст ошибки или пустая строка.
 */
export function validateEmail(value: string): string {
  const email = value.trim();
  if (!email) {
    return "";
  }
  return isEmail(email) ? "" : MESSAGES.email;
}

/**
 * Проверяет email для входа по коду: здесь поле обязательно.
 * @param value Email.
 * @returns Текст ошибки или пустая строка.
 */
export function validateRequiredEmail(value: string): string {
  return value.trim() ? validateEmail(value) : MESSAGES.required;
}

/**
 * Приводит логин, похожий на телефон (8 999 123-45-67, +7 (999)…), к виду +79991234567, остальное только обрезает.
 * @param value Логин, email или телефон с формы входа.
 * @returns Логин для отправки на бэк.
 */
export function normalizeLogin(value: string): string {
  const login = value.trim();
  if (!PHONE_LIKE_PATTERN.test(login)) {
    return login;
  }
  const phone = normalizePhone(applyPhoneMask(login).value);
  return PHONE_PATTERN.test(phone) ? phone : login;
}

/**
 * Проверяет российский телефон: +7, код на 3, 4, 8 или 9 и ещё 9 цифр. Поле необязательное: пустое допустимо.
 * @param value Телефон из поля с маской.
 * @returns Текст ошибки или пустая строка.
 */
export function validatePhone(value: string): string {
  const phone = normalizePhone(value);
  if (!phone) {
    return "";
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
 * Проверяет имя, фамилию или отчество: буквы, между частями один пробел, дефис или апостроф, 2–32 символа. Поле необязательное: пустое допустимо.
 * @param value Значение поля.
 * @param field Поле, для текста ошибки о длине.
 * @returns Текст ошибки или пустая строка.
 */
export function validateName(value: string, field: NameField): string {
  const name = value.trim();
  if (!name) {
    return "";
  }
  if (!NAME_PATTERN.test(name)) {
    return MESSAGES.nameChars;
  }
  return isInRange(name, NAME_MIN_LENGTH, MAX_LENGTH.name)
    ? ""
    : NAME_LENGTH_MESSAGES[field];
}

/**
 * Проверяет дату рождения: существующая дата, возраст от 14 до 120 лет по UTC. Поле необязательное: пустое допустимо, а недописанная дата — ошибка.
 * @param value Дата YYYY-MM-DD или пустая строка.
 * @param validity Состояние поля, badInput — дата введена не полностью.
 * @param today Текущий момент.
 * @returns Текст ошибки или пустая строка.
 */
export function validateBirthday(
  value: string,
  validity?: ValidityState,
  today: Date = new Date(),
): string {
  if (validity?.badInput) {
    return MESSAGES.birthdayInvalid;
  }
  if (!value) {
    return "";
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
 * @param value Пароль.
 * @returns Текст ошибки или пустая строка.
 */
export function validatePassword(value: string): string {
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
 * @param value Повтор пароля.
 * @param password Пароль.
 * @returns Текст ошибки или пустая строка.
 */
export function validatePasswordConfirm(
  value: string,
  password: string,
): string {
  if (!value) {
    return MESSAGES.required;
  }
  return value === password ? "" : MESSAGES.passwordMismatch;
}

/**
 * Проверяет согласие на обработку персональных данных — без него регистрация невозможна.
 * @param checked Отмечен ли чекбокс.
 * @returns Текст ошибки или пустая строка.
 */
export function validateConsent(checked: boolean): string {
  return checked ? "" : MESSAGES.consent;
}

/**
 * Проверяет рассказ о себе: не длиннее 256 символов.
 * @param value Текст из поля «Расскажите о себе».
 * @returns Текст ошибки или пустая строка.
 */
export function validateBio(value: string): string {
  return length(value.trim()) <= MAX_LENGTH.bio ? "" : MESSAGES.bio;
}

/**
 * Проверяет код из письма: ровно 6 цифр.
 * @param value Код из поля.
 * @returns Текст ошибки или пустая строка.
 */
export function validateEmailCode(value: string): string {
  const code = value.trim();
  if (!code) {
    return MESSAGES.required;
  }
  return CODE_PATTERN.test(code) ? "" : MESSAGES.code;
}

/**
 * Проверяет фото профиля по макету: png или jpg, не больше 5 МБ. Без файла ошибки нет — фото необязательно.
 * @param file Выбранный файл или null.
 * @returns Текст ошибки или пустая строка.
 */
export function validateAvatarFile(file: File | null): string {
  if (!file) {
    return "";
  }
  if (!AVATAR_TYPES.includes(file.type)) {
    return MESSAGES.avatarType;
  }
  return file.size <= AVATAR_MAX_BYTES ? "" : MESSAGES.avatarSize;
}

/**
 * Проверяет текст поста: не пустой и не длиннее 256 символов, как на бэке.
 * @param value Текст из поля.
 * @returns Текст ошибки или пустая строка.
 */
export function validatePostText(value: string): string {
  const text = value.trim();
  if (!text) {
    return MESSAGES.postEmpty;
  }
  return length(text) <= MAX_LENGTH.post ? "" : MESSAGES.postLength;
}
