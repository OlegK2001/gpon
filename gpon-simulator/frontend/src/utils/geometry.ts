/**
 * Geometry utilities for topology visualization
 */

export interface Point {
  x: number
  y: number
}

export interface NodeBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Calculate intersection point of line from center A to center B with circle boundary
 * Returns the point on the circle where the line should enter/exit
 */
export function getLineEndpoints(
  centerA: Point,
  centerB: Point,
  radiusA: number,
  radiusB: number
): { start: Point; end: Point; angle: number } {
  const dx = centerB.x - centerA.x
  const dy = centerB.y - centerA.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Avoid division by zero
  if (distance < 0.01) {
    return {
      start: centerA,
      end: centerB,
      angle: 0
    }
  }
  
  // Unit vector
  const ux = dx / distance
  const uy = dy / distance
  
  // Calculate intersection points with circle boundaries
  const start: Point = {
    x: centerA.x + ux * radiusA,
    y: centerA.y + uy * radiusA
  }
  
  const end: Point = {
    x: centerB.x - ux * radiusB,
    y: centerB.y - uy * radiusB
  }
  
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  
  return { start, end, angle }
}

/**
 * Calculate SVG marker position for arrow
 * Offset from the end point to avoid overlapping with node border
 */
export function getArrowPosition(
  endPoint: Point,
  angle: number,
  offset: number = 3
): Point {
  const radians = (angle * Math.PI) / 180
  return {
    x: endPoint.x - Math.cos(radians) * offset,
    y: endPoint.y - Math.sin(radians) * offset
  }
}

/**
 * Check if point is inside node bounds (for hit testing)
 */
export function isPointInNode(point: Point, bounds: NodeBounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

/**
 * Calculate distance between two points
 */
export function getDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Interpolate point along line for animations
 */
export function interpolatePoint(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  }
}

