/**
 * Parse boolean values from CLI flags, env vars, or config strings.
 * Node's parseArgs treats any present `--dry-run` flag as true, so callers
 * must normalize string values like "false" explicitly.
 */
export function parseEnvBool(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  return defaultValue;
}
