import { getApiBase } from "@/shared/api/client";
import { getUpcomingGames } from "@/shared/api/info";
import { mapGameResponseToGame } from "@/shared/api/mappers";
import type { Game } from "@/entities/game/type";

export type HeroGame = Game & {
  bannerUrl?: string;
};

/** 백엔드 /info/games/top5 사용. */
export async function fetchHeroGames(): Promise<HeroGame[]> {
  if (!getApiBase()) return [];
  const list = await getUpcomingGames();
  return list.map((r) => mapGameResponseToGame(r) as HeroGame);
}

export async function fetchUpcomingGames(): Promise<Game[]> {
  if (!getApiBase()) return [];
  const list = await getUpcomingGames();
  return list.map(mapGameResponseToGame);
}
