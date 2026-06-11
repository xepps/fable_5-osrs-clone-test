export const uniqueName = (requested: string, existing: readonly string[]): string => {
  const taken = new Set(existing.map((name) => name.toLowerCase()))
  if (!taken.has(requested.toLowerCase())) return requested
  const next = (suffix: number): string => {
    const candidate = `${requested}(${suffix})`
    return taken.has(candidate.toLowerCase()) ? next(suffix + 1) : candidate
  }
  return next(2)
}
