export const SIGNUP_STEPS = [
  "/signup",
  "/signup/email",
  "/signup/about",
  "/signup/photo",
];

let values = {};
let completed = new Set();
let fieldError = null;

/**
 * Черновик регистрации в памяти: значения полей между шагами и пройденные шаги. В хранилище браузера не пишется, потому что в нём пароль.
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
  clear: () => {
    values = {};
    completed = new Set();
    fieldError = null;
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
