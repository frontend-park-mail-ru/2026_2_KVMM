/**
 * Что известно о человеке без отдельного запроса: имя для показа и путь к аватарке.
 */
export interface KnownPerson {
  name: string;
  avatarUrl: string;
}

const known = new Map<string, KnownPerson>();

/**
 * Имена и аватарки людей, встреченных в ленте, списках друзей и чатах. Карточка может показать их, пока загружается профиль.
 */
export const people = {
  remember: (uid: string, person: KnownPerson): void => {
    if (uid && person.name) {
      known.set(uid, person);
    }
  },
  get: (uid: string): KnownPerson | null => known.get(uid) ?? null,
};
