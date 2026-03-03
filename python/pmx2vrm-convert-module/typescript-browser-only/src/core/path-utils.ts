/**
 * Pure string path utilities — replaces node:path for browser compatibility.
 */

export function extname(p: string): string {
  const base = p.substring(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);
  const i = base.lastIndexOf('.');
  return i < 0 ? '' : base.substring(i);
}

export function basename(p: string, ext?: string): string {
  let name = p.substring(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);
  if (ext && name.endsWith(ext)) name = name.substring(0, name.length - ext.length);
  return name;
}

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i < 0 ? '.' : p.substring(0, i);
}
