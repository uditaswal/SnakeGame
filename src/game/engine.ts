export type Direction = 'up' | 'down' | 'left' | 'right'

export type Point = Readonly<{
  x: number
  y: number
}>

export type GameStatus = 'ready' | 'running' | 'paused' | 'lost' | 'won'

export type GameConfig = Readonly<{
  columns: number
  rows: number
  initialSpeedMs: number
  minimumSpeedMs: number
  speedStepMs: number
}>

export type GameLossReason = 'wall' | 'self' | null

export type GameState = Readonly<{
  version: 1
  snake: readonly Point[]
  food: Point | null
  direction: Direction
  queuedDirection: Direction
  score: number
  ticks: number
  status: GameStatus
  lossReason: GameLossReason
}>

export type RandomSource = () => number

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export const DEFAULT_CONFIG: GameConfig = {
  columns: 20,
  rows: 20,
  initialSpeedMs: 130,
  minimumSpeedMs: 62,
  speedStepMs: 3,
}

const DIRECTION_VECTOR: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

const samePoint = (first: Point, second: Point) =>
  first.x === second.x && first.y === second.y

const pointKey = (point: Point) => `${point.x}:${point.y}`

export function placeFood(
  snake: readonly Point[],
  config: GameConfig = DEFAULT_CONFIG,
  random: RandomSource = Math.random,
): Point | null {
  const occupied = new Set(snake.map(pointKey))
  const available: Point[] = []

  for (let y = 0; y < config.rows; y += 1) {
    for (let x = 0; x < config.columns; x += 1) {
      const point = { x, y }
      if (!occupied.has(pointKey(point))) available.push(point)
    }
  }

  if (available.length === 0) return null

  const normalizedRandom = Math.min(Math.max(random(), 0), 0.999999999)
  return available[Math.floor(normalizedRandom * available.length)]
}

export function createGame(
  config: GameConfig = DEFAULT_CONFIG,
  random: RandomSource = Math.random,
): GameState {
  const centerX = Math.floor(config.columns / 2)
  const centerY = Math.floor(config.rows / 2)
  const snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ]

  return {
    version: 1,
    snake,
    food: placeFood(snake, config, random),
    direction: 'right',
    queuedDirection: 'right',
    score: 0,
    ticks: 0,
    status: 'ready',
    lossReason: null,
  }
}

export function startGame(state: GameState): GameState {
  if (state.status !== 'ready' && state.status !== 'paused') return state
  return { ...state, status: 'running' }
}

export function pauseGame(state: GameState): GameState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state
}

export function queueDirection(state: GameState, direction: Direction): GameState {
  if (OPPOSITE[state.direction] === direction) return state
  return { ...state, queuedDirection: direction }
}

export function getTickDelay(
  score: number,
  config: GameConfig = DEFAULT_CONFIG,
): number {
  return Math.max(config.minimumSpeedMs, config.initialSpeedMs - score * config.speedStepMs)
}

export function stepGame(
  state: GameState,
  config: GameConfig = DEFAULT_CONFIG,
  random: RandomSource = Math.random,
): GameState {
  if (state.status !== 'running') return state

  const vector = DIRECTION_VECTOR[state.queuedDirection]
  const head = state.snake[0]
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y }
  const hitWall =
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= config.columns ||
    nextHead.y >= config.rows

  if (hitWall) {
    return {
      ...state,
      direction: state.queuedDirection,
      ticks: state.ticks + 1,
      status: 'lost',
      lossReason: 'wall',
    }
  }

  const ateFood = state.food !== null && samePoint(nextHead, state.food)
  const collisionBody = ateFood ? state.snake : state.snake.slice(0, -1)
  const hitSelf = collisionBody.some((segment) => samePoint(segment, nextHead))

  if (hitSelf) {
    return {
      ...state,
      direction: state.queuedDirection,
      ticks: state.ticks + 1,
      status: 'lost',
      lossReason: 'self',
    }
  }

  const snake = ateFood
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)]
  const food = ateFood ? placeFood(snake, config, random) : state.food

  return {
    ...state,
    snake,
    food,
    direction: state.queuedDirection,
    score: state.score + (ateFood ? 1 : 0),
    ticks: state.ticks + 1,
    status: food === null ? 'won' : 'running',
    lossReason: null,
  }
}

