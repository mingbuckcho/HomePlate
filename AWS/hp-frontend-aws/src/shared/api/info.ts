import { http } from "@/shared/api/http";
import type {
  GameResponse,
  GoodsResponse,
  NewsResponse,
  TeamRankingResponse,
} from "@/shared/api/types";

export async function getUpcomingGames(): Promise<GameResponse[]> {
  const { data } = await http.get<GameResponse[]>("/info/games/top5");
  return data;
}

export async function getNewsList(): Promise<NewsResponse[]> {
  const { data } = await http.get<NewsResponse[]>("/info/news");
  return data;
}

export async function getGoodsList(teamId?: string): Promise<GoodsResponse[]> {
  const params = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const { data } = await http.get<GoodsResponse[]>(`/info/goods${params}`);
  return data;
}

export async function getGamesByTeam(
  teamId: string,
  date?: string,
): Promise<GameResponse[]> {
  const params = new URLSearchParams({ teamId });
  if (date) params.set("date", date);
  const { data } = await http.get<GameResponse[]>(
    `/info/games/byTeam?${params.toString()}`,
  );
  return data;
}

export async function getRankings(): Promise<TeamRankingResponse[]> {
  const { data } = await http.get<TeamRankingResponse[]>("/info/rankings");
  return data;
}
