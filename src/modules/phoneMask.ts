const PREFIX = "+7 (";
const NATIONAL_LENGTH = 10;
const FOREIGN_CODE_PATTERN = /^\+[0-689]/;
const PREFIX_DIGIT_PATTERN = /^[78]/;
const DIGIT_PATTERN = /\d/;

/**
 * Значение поля после маски и позиция курсора в нём.
 */
export interface MaskedValue {
  value: string;
  caret: number;
}

/**
 * Выделяет 10 цифр номера без кода страны. Ведущую 7 при «+» и ведущие 7 или 8 перед лишней цифрой считает кодом и отбрасывает.
 * @param compact Ввод без пробелов.
 * @returns Цифры номера и сколько цифр отброшено в начале — для пересчёта курсора.
 */
function nationalDigits(compact: string): {
  national: string;
  dropped: number;
} {
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

/**
 * Расставляет цифры номера по маске +7 (999) 123-45-67 по мере ввода.
 * @param national До 10 цифр номера.
 * @returns Номер в маске, частичный, если цифр меньше.
 */
function format(national: string): string {
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

/**
 * Позиция курсора сразу после count-й цифры номера в маске, чтобы курсор не прыгал в конец при правке в середине.
 * @param formatted Номер в маске.
 * @param count Сколько цифр номера должно быть перед курсором.
 * @returns Индекс курсора.
 */
function caretAfterDigits(formatted: string, count: number): number {
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
 * @param value Текущее значение поля.
 * @param caret Позиция курсора в value.
 * @returns Отформатированное значение и новая позиция курсора.
 */
export function applyPhoneMask(
  value: string,
  caret: number = value.length,
): MaskedValue {
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

/**
 * Ищет ближайшую цифру номера от позиции в заданную сторону, не заходя в префикс «+7 (».
 * @param value Значение поля.
 * @param from С какой позиции искать.
 * @param step -1 — влево, 1 — вправо.
 * @returns Индекс цифры или -1.
 */
function digitIndex(value: string, from: number, step: number): number {
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

/**
 * Ставит новое значение и курсор и запускает input, чтобы маска и проверка поля отработали как при обычном вводе.
 * @param control Поле телефона.
 * @param value Новое значение.
 * @param caret Позиция курсора.
 */
function replaceValue(
  control: HTMLInputElement,
  value: string,
  caret: number,
): void {
  control.value = value;
  control.setSelectionRange(caret, caret);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Backspace и Delete рядом со скобкой, пробелом или дефисом стирают ближайшую цифру, а не символ маски, который маска тут же вернула бы. Стирание до пустого префикса очищает поле.
 * @param event Событие beforeinput поля.
 */
function onBeforeInput(event: InputEvent): void {
  const control = event.target as HTMLInputElement;
  const { value, selectionStart: start, selectionEnd: end } = control;
  if (start === null || start !== end || !value.startsWith(PREFIX)) {
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
 * @param control Поле type="tel".
 */
export function attachPhoneMask(control: HTMLInputElement): void {
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
