import { loadOverviewStats } from './dataLoader.ts'
import type { OverviewStats } from '../types/index.ts'

let cached: Promise<OverviewStats> | null = null

export function getOverviewStats(): Promise<OverviewStats> {
  if (!cached) {
    cached = loadOverviewStats()
  }
  return cached
}

export function invalidateOverviewCache(): void {
  cached = null
}
