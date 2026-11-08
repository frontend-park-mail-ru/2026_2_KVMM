import { api } from "./api";
import type { ApiResult, RelationshipsResponse, ShortProfile } from "./api";
import { nextOffset } from "@nexly/utils";

/**
 * Связь текущего пользователя с человеком: нет связи, входящая заявка, отправленная заявка или дружба.
 */
export type RelationStatus = "none" | "incoming" | "sent" | "friend";

/**
 * Результат поиска связи: HTTP-статус (не 200 — связь неизвестна), сама связь и краткий профиль человека, если он нашёлся в списках.
 */
export interface RelationResult {
  status: number;
  relation: RelationStatus;
  profile?: ShortProfile;
}

const MAX_PAGES = 10;

/**
 * Ищет человека в списке связей, проходя страницы по смещению (до 10).
 * @param load Загрузка страницы списка по смещению.
 * @param profileId Кого искать.
 * @returns Статус последнего запроса и найденная связь, если есть.
 */
async function scan(
  load: (cursor: number) => Promise<ApiResult<RelationshipsResponse>>,
  profileId: number,
): Promise<{
  status: number;
  found?: RelationshipsResponse["relationships"][number];
}> {
  let cursor = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { status, data } = await load(cursor);
    if (status !== 200 || !data?.relationships) {
      return { status };
    }
    const found = data.relationships.find(
      (relationship) => relationship.profile.id === profileId,
    );
    const next = nextOffset(cursor, data);
    if (found || !next.hasMore) {
      return { status, found };
    }
    cursor = next.cursor;
  }
  return { status: 200 };
}

/**
 * Ищет связь с человеком в списках друзей и заявок, по 10 страниц каждого. Временная замена ручки чужого профиля, которой у бэка пока нет.
 * @param profileId Id человека.
 * @param myId Id текущего пользователя.
 * @returns Статус ответа, связь и краткий профиль человека.
 */
export async function findRelation(
  profileId: number,
  myId: number,
): Promise<RelationResult> {
  const [friends, pending] = await Promise.all([
    scan(api.friends, profileId),
    scan(api.pendingRelationships, profileId),
  ]);
  const status = friends.status !== 200 ? friends.status : pending.status;
  if (status !== 200) {
    return { status, relation: "none" };
  }
  if (friends.found) {
    return { status, relation: "friend", profile: friends.found.profile };
  }
  if (pending.found) {
    const isMine = pending.found.profile_id_master === myId;
    return {
      status,
      relation: isMine ? "sent" : "incoming",
      profile: pending.found.profile,
    };
  }
  return { status, relation: "none" };
}
