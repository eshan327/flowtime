interface Rect {
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export function getMenuPosition(anchor: Rect, menu: Rect, viewport: Rect) {
  const gap = 4
  const edge = 8
  const top =
    anchor.bottom + gap + menu.height <= viewport.height - edge
      ? anchor.bottom + gap
      : Math.max(edge, anchor.top - menu.height - gap)

  return {
    top,
    left: Math.max(edge, Math.min(anchor.right - menu.width, viewport.width - menu.width - edge)),
  }
}
