import { apiRequest } from './api'

export type LeaderboardEntry = {
  rank: number
  username: string
  score: number
  achievedAt: string
}

export function getLeaderboard(): Promise<{ entries: LeaderboardEntry[] }> {
  return apiRequest('/api/leaderboard')
}
