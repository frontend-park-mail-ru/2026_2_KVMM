import { applyPhoneMask } from "./phoneMask";
import { normalizeLogin } from "./validation";
import type { FieldError } from "./errors";

type DraftValue = string | boolean;

interface LoginTarget {
  field: string;
  value: string;
}

export const SIGNUP_STEPS = [
  "/signup",
  "/signup/email",
  "/signup/about",
  "/signup/photo",
];

const PHONE_PATTERN = /^\+7\d{10}$/;

let values: Record<string, DraftValue> = {};
let completed = new Set<string>();
let fieldError: FieldError | null = null;
let loginTarget: LoginTarget | null = null;

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
  clear: (): void => {
    values = {};
    completed = new Set();
    fieldError = null;
    loginTarget = null;
  },
};

/**
 * Первый непройденный шаг регистрации перед запрошенным.
 * @param path Запрошенный шаг.
 * @returns Путь шага, на который нужно вернуть пользователя, или null.
 */
export function signupRedirect(path: string): string | null {
  const index = SIGNUP_STEPS.indexOf(path);
  const missing = SIGNUP_STEPS.slice(0, index).find(
    (step) => !completed.has(step),
  );
  return missing ?? null;
}
