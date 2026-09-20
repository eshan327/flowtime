import assert from 'node:assert/strict'
import test from 'node:test'
import { getMenuPosition } from '../src/features/tasks/lib/menuPosition.ts'

const viewport = { top: 0, right: 500, bottom: 400, width: 500, height: 400 }
const menu = { top: 0, right: 0, bottom: 0, width: 208, height: 180 }

test('task menus stay in the viewport and flip above their trigger when needed', () => {
  assert.deepEqual(
    getMenuPosition({ top: 40, right: 480, bottom: 76, width: 36, height: 36 }, menu, viewport),
    { top: 80, left: 272 }
  )
  assert.deepEqual(
    getMenuPosition({ top: 350, right: 480, bottom: 386, width: 36, height: 36 }, menu, viewport),
    { top: 166, left: 272 }
  )
})
