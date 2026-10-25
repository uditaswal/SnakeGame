import { DEFAULT_CONFIG, type GameConfig } from './engine'

const MIN_CELL_SIZE = 24
const MAX_CELL_SIZE = 48
const MIN_COLUMNS = 12
const MIN_ROWS = 12

export function gameConfigForBoard(width: number, height: number): GameConfig {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_CONFIG
  }

  const targetCellSize = Math.min(
    MAX_CELL_SIZE,
    Math.max(MIN_CELL_SIZE, Math.floor(Math.min(width / 20, height / 20))),
  )

  return {
    ...DEFAULT_CONFIG,
    columns: Math.max(MIN_COLUMNS, Math.round(width / targetCellSize)),
    rows: Math.max(MIN_ROWS, Math.round(height / targetCellSize)),
  }
}

export function sameGeometry(first: GameConfig, second: GameConfig): boolean {
  return first.columns === second.columns && first.rows === second.rows
}
