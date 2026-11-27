/**
 * Что известно о человеке без отдельного запроса: имя для показа и путь к аватарке.
 */
export interface KnownPerson {
  name: string;
  avatarUrl: string;
}

const known = new Map<string | number, KnownPerson>();

/**
 * Имена и аватарки людей, встреченных в ленте, списках друзей и чатах. Карточка может показать их, пока загружается профиль.
 */
export const people = {
  remember: (key: string | number, person: KnownPerson): void => {
    if ((typeof key === "string" ? key.length > 0 : key > 0) && person.name) {
      known.set(key, person);
    }
  },
  get: (key: string | number): KnownPerson | null => known.get(key) ?? null,
};
