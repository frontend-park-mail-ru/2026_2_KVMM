/**
 * Имя для показа: «Имя Фамилия», если они заданы, иначе логин.
 * @param profile Профиль или краткий профиль.
 * @param profile.nickname Логин.
 * @param profile.profile_name Имя.
 * @param profile.surname Фамилия.
 * @returns Имя для показа.
 */
export function displayName(profile: {
  nickname: string;
  profile_name?: string;
  surname?: string;
}): string {
  const name = [profile.profile_name, profile.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || profile.nickname;
}
