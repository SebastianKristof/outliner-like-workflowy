export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `item_${Math.random().toString(36).slice(2, 10)}`;
}
