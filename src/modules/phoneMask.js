const PREFIX = "+7 (";
const NATIONAL_LENGTH = 10;
const FOREIGN_CODE_PATTERN = /^\+[0-689]/;
const PREFIX_DIGIT_PATTERN = /^[78]/;
const DIGIT_PATTERN = /\d/;

function nationalDigits(compact) {
  let digits = compact.replace(/\D/g, "");
  let dropped = 0;

  const hasCountryCode = compact.startsWith("+")
    ? digits.startsWith("7")
    : PREFIX_DIGIT_PATTERN.test(digits) && digits.length !== NATIONAL_LENGTH;
  if (hasCountryCode) {
    digits = digits.slice(1);
    dropped += 1;
  }
  if (digits.length > NATIONAL_LENGTH && PREFIX_DIGIT_PATTERN.test(digits)) {
    digits = digits.slice(1);
    dropped += 1;
  }

  return { national: digits.slice(0, NATIONAL_LENGTH), dropped };
}

function format(national) {
  let result = PREFIX + national.slice(0, 3);
  if (national.length > 3) {
    result += `) ${national.slice(3, 6)}`;
  }
  if (national.length > 6) {
    result += `-${national.slice(6, 8)}`;
  }
  if (national.length > 8) {
    result += `-${national.slice(8, 10)}`;
  }
  return result;
}

function caretAfterDigits(formatted, count) {
  if (count === 0) {
    return PREFIX.length;
  }
  let seen = 0;
  for (let index = PREFIX.length; index < formatted.length; index += 1) {
    if (DIGIT_PATTERN.test(formatted[index])) {
      seen += 1;
      if (seen === count) {
        return index + 1;
      }
    }
  }
  return formatted.length;
}

/**
 * Приводит ввод к виду +7 (999) 123-45-67 и пересчитывает позицию курсора.
 * Ведущие 8 и 7 считаются кодом выхода и кодом страны, номер другой страны (+1, +44…) не меняется.
 * @param {string} value Текущее значение поля.
 * @param {number} [caret] Позиция курсора в value.
 * @returns {{value: string, caret: number}} Отформатированное значение и новая позиция курсора.
 */
export function applyPhoneMask(value, caret = value.length) {
  const compact = value.replace(/\s/g, "");
  if (!compact || compact === "+" || FOREIGN_CODE_PATTERN.test(compact)) {
    return { value, caret };
  }

  const { national, dropped } = nationalDigits(compact);
  const digitsBefore = value.slice(0, caret).replace(/\D/g, "").length;
  const formatted = format(national);
  const count = Math.min(Math.max(digitsBefore - dropped, 0), national.length);
  return { value: formatted, caret: caretAfterDigits(formatted, count) };
}

function digitIndex(value, from, step) {
  for (
    let index = from;
    index >= PREFIX.length && index < value.length;
    index += step
  ) {
    if (DIGIT_PATTERN.test(value[index])) {
      return index;
    }
  }
  return -1;
}

function replaceValue(control, value, caret) {
  control.value = value;
  control.setSelectionRange(caret, caret);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function onBeforeInput(event) {
  const control = event.target;
  const { value, selectionStart: start, selectionEnd: end } = control;
  if (start !== end || !value.startsWith(PREFIX)) {
    return;
  }

  const isBackward = event.inputType === "deleteContentBackward";
  const isForward = event.inputType === "deleteContentForward";
  const neighbour = isBackward ? value[start - 1] : value[start];
  if ((!isBackward && !isForward) || DIGIT_PATTERN.test(neighbour ?? "")) {
    return;
  }

  event.preventDefault();
  const index = isBackward
    ? digitIndex(value, start - 1, -1)
    : digitIndex(value, Math.max(start, PREFIX.length), 1);
  if (index !== -1) {
    const rest = value.slice(0, index) + value.slice(index + 1);
    replaceValue(control, rest, isBackward ? index : start);
  } else if (value === PREFIX) {
    replaceValue(control, "", 0);
  }
}

/**
 * Подключает к полю маску российского телефона +7 (999) 123-45-67.
 * Backspace и Delete перед скобкой, пробелом или дефисом стирают ближайшую цифру.
 * @param {HTMLInputElement} control Поле type="tel".
 */
export function attachPhoneMask(control) {
  control.addEventListener("beforeinput", onBeforeInput);
  control.addEventListener("input", () => {
    const { value, caret } = applyPhoneMask(
      control.value,
      control.selectionStart ?? control.value.length,
    );
    if (value !== control.value) {
      control.value = value;
    }
    if (document.activeElement === control) {
      control.setSelectionRange(caret, caret);
    }
  });
  control.addEventListener("blur", () => {
    if (control.value === PREFIX) {
      control.value = "";
    }
  });
}
