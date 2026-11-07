import {
  MAX_LENGTH,
  birthdayRange,
  validateBio,
  validateBirthday,
  validateEmail,
  validateGender,
  validateName,
  validateNickname,
  validatePassword,
  validatePasswordConfirm,
  validatePhone,
} from "./validation";
import { attachPhoneMask } from "./phoneMask";
import type { InputConfig, InputOption } from "../components/Input/Input";

/**
 * Настройки поля профиля без имени: имя задаёт форма.
 */
export type FieldConfig = Omit<InputConfig, "name">;

export const GENDERS: InputOption[] = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
];

/**
 * Поля профиля и регистрации с правилами проверки. Зависимые поля (email и телефон, пароль и повтор) читают соседнее значение через valueOf.
 * @param valueOf Текущее значение другого поля по имени.
 * @returns Настройки полей по имени.
 */
export function fieldConfigs(
  valueOf: (name: string) => string,
): Record<string, FieldConfig> {
  return {
    nickname: {
      type: "text",
      placeholder: "Введите логин",
      autocomplete: "username",
      attributes: { maxlength: MAX_LENGTH.nickname },
      validate: validateNickname,
    },
    password: {
      type: "password",
      placeholder: "Введите пароль",
      autocomplete: "new-password",
      attributes: { maxlength: MAX_LENGTH.password },
      validate: validatePassword,
    },
    confirm_password: {
      type: "password",
      placeholder: "Повторите пароль",
      autocomplete: "new-password",
      attributes: { maxlength: MAX_LENGTH.password },
      validate: (value) => validatePasswordConfirm(value, valueOf("password")),
    },
    email: {
      type: "email",
      placeholder: "Введите email",
      autocomplete: "email",
      attributes: { maxlength: MAX_LENGTH.email },
      validate: (value) => validateEmail(value, valueOf("phone_number")),
    },
    phone_number: {
      type: "tel",
      placeholder: "Введите номер телефона",
      autocomplete: "tel",
      mask: attachPhoneMask,
      validate: (value) => validatePhone(value, valueOf("email")),
    },
    profile_name: {
      type: "text",
      placeholder: "Введите имя",
      autocomplete: "given-name",
      attributes: { maxlength: MAX_LENGTH.name },
      validate: (value) => validateName(value, "profile_name"),
    },
    surname: {
      type: "text",
      placeholder: "Введите фамилию",
      autocomplete: "family-name",
      attributes: { maxlength: MAX_LENGTH.name },
      validate: (value) => validateName(value, "surname"),
    },
    patronymic: {
      type: "text",
      placeholder: "Введите отчество",
      autocomplete: "additional-name",
      attributes: { maxlength: MAX_LENGTH.name },
      validate: (value) => validateName(value, "patronymic", false),
    },
    gender: {
      placeholder: "Выберите пол",
      autocomplete: "sex",
      options: GENDERS,
      validate: validateGender,
    },
    birthday: {
      type: "date",
      placeholder: "Дата рождения",
      autocomplete: "bday",
      attributes: {
        ...birthdayRange(),
        required: "required",
        "aria-label": "Дата рождения",
      },
      validate: validateBirthday,
    },
    bio: {
      type: "textarea",
      placeholder: "Расскажите о себе",
      attributes: { maxlength: MAX_LENGTH.bio },
      validate: validateBio,
    },
  };
}
