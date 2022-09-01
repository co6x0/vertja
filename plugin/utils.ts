export const closePluginWithNotify = (message: string) => {
  figma.notify(message);
  figma.closePlugin();
};

// type guards
export const hasProperty = <
  K extends keyof T,
  T extends Record<string, unknown>
>(
  object: T,
  key: K
): boolean => {
  return !!object && Object.prototype.hasOwnProperty.call(object, key);
};
export const nonNullable = <T>(value: T): value is NonNullable<T> =>
  value != null;
