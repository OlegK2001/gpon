/**
 * Единые константы для анимации пакетов и симуляции
 * Один источник правды для скорости и TTL
 */

export const BASE_PACKET_SPEED_SEG_PER_SEC = 0.15 // сегментов в секунду
export const ANIMATION_TICK_MS = 16 // для плавности (или rAF)

/**
 * Получить эффективную скорость с учётом скорости симуляции
 */
export function getEffectiveSpeed(simSpeed: number): number {
  return BASE_PACKET_SPEED_SEG_PER_SEC * Math.max(simSpeed, 0.1)
}

/**
 * Вычислить время прохождения пути пакета
 * @param pathLen - длина пути (количество устройств)
 * @param simSpeed - скорость симуляции
 * @param extraMs - дополнительное время для завершения анимации (по умолчанию 500ms)
 * @returns время в миллисекундах
 */
export function getPathTravelMs(pathLen: number, simSpeed: number, extraMs: number = 500): number {
  const segments = Math.max(pathLen - 1, 0) // количество сегментов между устройствами
  const effectiveSpeed = getEffectiveSpeed(simSpeed)
  const travelTime = (segments / effectiveSpeed) * 1000 // время в миллисекундах
  return travelTime + extraMs
}

/**
 * Вычислить время прохождения одного сегмента
 * @param simSpeed - скорость симуляции
 * @returns время в миллисекундах
 */
export function getSegmentDurationMs(simSpeed: number): number {
  const effectiveSpeed = getEffectiveSpeed(simSpeed)
  return 1000 / effectiveSpeed
}

