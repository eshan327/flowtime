import { DEFAULT_NEUTRAL_COLOR, DEFAULT_TASK_COLOR as BASE_TASK_COLOR } from '@/lib/colors'

export const COLOR_PRESETS = [
  BASE_TASK_COLOR,
  '#e5534b',
  '#f0883e',
  '#d19a66',
  '#e5c07b',
  '#89ca78',
  '#56b6c2',
  '#61afef',
  '#528bff',
  '#c678dd',
  '#be5ab0',
  '#ff7eb6',
  '#4ec9b0',
  '#3dc9b0',
  '#73c991',
  '#b5cea8',
  '#9cdcfe',
  '#ce9178',
  '#d4a574',
  DEFAULT_NEUTRAL_COLOR,
] as const

export const DEFAULT_TASK_COLOR = BASE_TASK_COLOR
export const POSITION_RENORMALIZE_THRESHOLD = 0.0001
