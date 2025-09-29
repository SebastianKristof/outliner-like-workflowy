export const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `item_${Math.random().toString(36).slice(2, 10)}`;
};
