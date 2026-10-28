/**
 * Small yes/no flags kept on this device, like "tip seen" or "checklist hidden". They're
 * conveniences only: if storage isn't available, things simply show again.
 */

const key = (name: string) => `flag:${name}`;

export function getFlag(name: string): boolean {
  try {
    return localStorage.getItem(key(name)) === '1';
  } catch {
    return false;
  }
}

export function setFlag(name: string) {
  try {
    localStorage.setItem(key(name), '1');
  } catch {
    // Not remembered; the tip or checklist just shows again next time.
  }
}
