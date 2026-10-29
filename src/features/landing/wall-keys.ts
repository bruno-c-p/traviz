export type Box = { left: number; top: number; width: number; height: number };

function centerX(box: Box): number {
  return box.left + box.width / 2;
}

function nearestOnNextRow(boxes: readonly Box[], index: number, direction: 1 | -1): number | null {
  const current = boxes[index];

  if (!current) return null;

  const isBeyond = (box: Box) =>
    direction === 1
      ? box.top > current.top + current.height / 2
      : box.top < current.top - current.height / 2;

  const beyond = boxes.flatMap((box, boxIndex) => (isBeyond(box) ? [{ box, boxIndex }] : []));

  if (beyond.length === 0) return null;

  const rowTop =
    direction === 1
      ? Math.min(...beyond.map(({ box }) => box.top))
      : Math.max(...beyond.map(({ box }) => box.top));

  const row = beyond.filter(({ box }) => Math.abs(box.top - rowTop) < current.height / 2);
  const distance = (box: Box) => Math.abs(centerX(box) - centerX(current));

  return row.reduce((nearest, entry) =>
    distance(entry.box) < distance(nearest.box) ? entry : nearest,
  ).boxIndex;
}

export function nextWallIndex(key: string, index: number, boxes: readonly Box[]): number | null {
  const last = boxes.length - 1;

  switch (key) {
    case "ArrowRight":
      return Math.min(index + 1, last);
    case "ArrowLeft":
      return Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return last;
    case "ArrowDown":
      return nearestOnNextRow(boxes, index, 1);
    case "ArrowUp":
      return nearestOnNextRow(boxes, index, -1);
    default:
      return null;
  }
}
