import { applyPhoneMask } from "./phoneMask";
import { normalizeLogin } from "./validation";
import type { FieldError } from "./errors";

type DraftValue = string | boolean;

interface LoginTarget {
  field: string;
  value: string;
}

/**
 * Зачем отправлен код: подтвердить новый email вошедшего пользователя, войти по email без пароля или зарегистрироваться по email.
 */
export type EmailPurpose = "change" | "login" | "register";

/**
 * Откуда пришли подтверждать email: next — куда вести после кода, back — куда вернуть, если email заняли, skip — подпись кнопки ухода без подтверждения.
 */
export interface EmailFlow {
  purpose: EmailPurpose;
  next: string;
  back: string;
  skip: string;
}

/**
 * Email, на который отправлен код подтверждения, момент отправки и сценарий, из которого пришли.
 */
export interface PendingEmail extends EmailFlow {
  email: string;
  sentAt: number;
}

export const SIGNUP_STEPS = ["/signup", "/signup/about", "/signup/photo"];

const PHONE_PATTERN = /^\+7\d{10}$/;

let values: Record<string, DraftValue> = {};
let completed = new Set<string>();
let fieldError: FieldError | null = null;
let loginTarget: LoginTarget | null = null;
let pendingEmail: PendingEmail | null = null;

/**
 * Определяет, что ввёл человек при входе: email, телефон или логин. По этому полю ошибка входа показывается в шаге регистрации.
 * @param login Значение поля входа.
 * @returns email, phone_number или nickname.
 */
function loginFieldOf(login: string): string {
  if (login.includes("@")) {
    return "email";
  }
  return PHONE_PATTERN.test(normalizeLogin(login))
    ? "phone_number"
    : "nickname";
}

/**
 * Черновик входа и регистрации в памяти: значения полей между шагами и страницами, пройденные шаги. В хранилище браузера не пишется, потому что в нём пароль.
 */
export const signupDraft = {
  value: (name: string): DraftValue => values[name] ?? "",
  text: (name: string): string => String(values[name] ?? ""),
  set: (name: string, value: DraftValue): void => {
    values[name] = value;
  },
  complete: (path: string) => completed.add(path),
  isComplete: (path: string): boolean => completed.has(path),
  reopen: (path: string) => completed.delete(path),
  setFieldError: (error: FieldError | null): void => {
    fieldError = error;
  },
  takeFieldError: (): FieldError | null => {
    const error = fieldError;
    fieldError = null;
    return error;
  },
  applyLogin: (login: string, password: string): void => {
    const value = login.trim();
    const field = loginFieldOf(value);
    const stored =
      field === "phone_number" ? applyPhoneMask(value).value : value;
    if (
      loginTarget &&
      loginTarget.field !== field &&
      values[loginTarget.field] === loginTarget.value
    ) {
      values[loginTarget.field] = "";
    }
    values[field] = stored;
    values.password = password;
    loginTarget = { field, value: stored };
    completed = new Set();
  },
  loginPrefill: (): { login: string; password: string } => {
    const field =
      loginTarget?.field ??
      ["nickname", "email", "phone_number"].find((name) => values[name]);
    const login = field ? String(values[field] ?? "") : "";
    loginTarget = field ? { field, value: login } : null;
    return { login, password: String(values.password ?? "") };
  },
  forgetPasswords: (): void => {
    delete values.password;
    delete values.confirm_password;
    loginTarget = null;
  },
  setPendingEmail: (email: string, flow: EmailFlow): void => {
    const { purpose, next, back, skip } = flow;
    pendingEmail = { email, sentAt: Date.now(), purpose, next, back, skip };
  },
  pendingEmail: (): PendingEmail | null => pendingEmail,
  clearPendingEmail: (): void => {
    pendingEmail = null;
  },
  clear: (): void => {
    values = {};
    completed = new Set();
    fieldError = null;
    loginTarget = null;
    pendingEmail = null;
  },
};

/**
 * Доступен ли шаг регистрации: гостю — только создание аккаунта, вошедшему — только дозаполнение профиля.
 * @param path Путь шага.
 * @param isAuthorized Вошёл ли пользователь.
 * @returns true, если на шаг можно перейти.
 */
export function isStepAvailable(path: string, isAuthorized: boolean): boolean {
  return (path === SIGNUP_STEPS[0]) !== isAuthorized;
}
