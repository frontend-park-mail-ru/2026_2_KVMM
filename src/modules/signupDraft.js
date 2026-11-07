import { applyPhoneMask } from "./phoneMask.js";
import { normalizeLogin } from "./validation.js";

export const SIGNUP_STEPS = [
  "/signup",
  "/signup/email",
  "/signup/about",
  "/signup/photo",
];

const PHONE_PATTERN = /^\+7\d{10}$/;

let values = {};
let completed = new Set();
let fieldError = null;
let loginTarget = null;

function loginFieldOf(login) {
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
  value: (name) => values[name] ?? "",
  set: (name, value) => {
    values[name] = value;
  },
  complete: (path) => completed.add(path),
  isComplete: (path) => completed.has(path),
  reopen: (path) => completed.delete(path),
  setFieldError: (error) => {
    fieldError = error;
  },
  takeFieldError: () => {
    const error = fieldError;
    fieldError = null;
    return error;
  },
  applyLogin: (login, password) => {
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
  loginPrefill: () => {
    const field =
      loginTarget?.field ??
      ["nickname", "email", "phone_number"].find((name) => values[name]);
    const login = field ? (values[field] ?? "") : "";
    loginTarget = field ? { field, value: login } : null;
    return { login, password: values.password ?? "" };
  },
  clear: () => {
    values = {};
    completed = new Set();
    fieldError = null;
    loginTarget = null;
  },
};

/**
 * Первый непройденный шаг регистрации перед запрошенным.
 * @param {string} path Запрошенный шаг.
 * @returns {?string} Путь шага, на который нужно вернуть пользователя, или null.
 */
export function signupRedirect(path) {
  const index = SIGNUP_STEPS.indexOf(path);
  const missing = SIGNUP_STEPS.slice(0, index).find(
    (step) => !completed.has(step),
  );
  return missing ?? null;
}
