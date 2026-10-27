import { validateExperience, type Experience } from "../game/learning";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Locks = {
  request: (
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => Promise<void> | void,
  ) => Promise<unknown>;
};
/** One writer per browser; an old app's external writes also stop this writer. */
export function createSaveCoordinator(
  storage: Store | null,
  key: string,
  onConflict: () => void,
  locks?: Locks,
) {
  const read = () => {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  let owned = !locks,
    blocked = false,
    expected = read();
  let release: (() => void) | null = null;
  return {
    async acquire() {
      if (owned && !blocked) return true;
      blocked = false;
      if (!locks) {
        owned = true;
        expected = read();
        return true;
      }
      return new Promise<boolean>((resolve) => {
        void locks
          .request(key, { ifAvailable: true }, (lock) => {
            if (!lock) {
              blocked = true;
              resolve(false);
              return;
            }
            owned = true;
            expected = read();
            resolve(true);
            return new Promise<void>((done) => {
              release = done;
            });
          })
          .catch(() => {
            // Locks denied (e.g. site data blocked) is not another tab: play on like a lockless browser.
            owned = true;
            expected = read();
            resolve(true);
          });
      });
    },
    writable() {
      if (!owned || blocked) return false;
      if (storage && read() !== expected) {
        blocked = true;
        owned = false;
        release?.();
        release = null;
        onConflict();
        return false;
      }
      return true;
    },
    wrote() {
      expected = read();
    },
    observe() {
      if (owned) this.writable();
    },
    release() {
      release?.();
      release = null;
      owned = false;
    },
    owns() {
      return owned && !blocked;
    },
  };
}
export const experienceKey = (key: string) => `${key}:experience:v1`;
export function writeExperience(
  storage: Store,
  key: string,
  experience: Experience,
) {
  storage.setItem(
    experienceKey(key),
    JSON.stringify({
      progress: storage.getItem(key),
      experience: validateExperience(experience),
    }),
  );
}
export function readExperience(storage: Store, key: string): Experience | null {
  try {
    const value = JSON.parse(storage.getItem(experienceKey(key)) ?? "null");
    return value && value.progress === storage.getItem(key)
      ? validateExperience(value.experience)
      : null;
  } catch {
    return null;
  }
}
