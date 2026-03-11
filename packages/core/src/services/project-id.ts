/**
 * Derive a deterministic project ID from a filesystem path.
 *
 * Algorithm:
 * 1. Replace all `/` and `\` with `-`
 * 2. Convert to lowercase
 * 3. Strip leading `-`
 */
export function deriveProjectId(cwd: string): string {
  return cwd
    .replace(/[/\\:]/g, "-")
    .toLowerCase()
    .replace(/^-+/, "")
    .replace(/-+/g, "-");
}

/**
 * Extract the project name (last path segment) from a path.
 */
export function deriveProjectName(cwd: string): string {
  const segments = cwd.replace(/\\/g, "/").split("/").filter(Boolean);
  return segments[segments.length - 1] ?? cwd;
}
