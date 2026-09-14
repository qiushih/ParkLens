import type { PolygonGeometry } from './types.ts';

/**
 * Area-weighted centroid of a polygon's outer ring(s), rounded to 6 decimals (~10 cm).
 * Planar maths on lng/lat is accurate enough at parking-lot scale.
 */
export function centroid(geometry: PolygonGeometry): [lng: number, lat: number] {
  const rings = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).map(
    (polygon) => polygon[0] ?? [],
  );

  // Work relative to the first vertex. With raw coordinates (~-80, 43) each cross product is
  // ~3500 while a lot's area is ~1e-7 square degrees, so the area would be lost to rounding.
  const [originX = 0, originY = 0] = rings[0]?.[0] ?? [];

  let twiceArea = 0;
  let x = 0;
  let y = 0;
  let vertexCount = 0;
  let vertexX = 0;
  let vertexY = 0;

  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [ax = 0, ay = 0] = ring[i] ?? [];
      const [bx = 0, by = 0] = ring[(i + 1) % ring.length] ?? [];
      const [x0, y0, x1, y1] = [ax - originX, ay - originY, bx - originX, by - originY];
      const cross = x0 * y1 - x1 * y0;
      twiceArea += cross;
      x += (x0 + x1) * cross;
      y += (y0 + y1) * cross;
      vertexCount++;
      vertexX += x0;
      vertexY += y0;
    }
  }

  // Degenerate (zero-area) shapes fall back to the mean vertex.
  const [dx, dy] =
    Math.abs(twiceArea) > 1e-18
      ? [x / (3 * twiceArea), y / (3 * twiceArea)]
      : [vertexX / Math.max(vertexCount, 1), vertexY / Math.max(vertexCount, 1)];
  return [round6(originX + dx), round6(originY + dy)];
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
