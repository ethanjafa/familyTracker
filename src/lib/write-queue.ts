/**
 * Saves for the same thing (one box on the Assign page, say) go to the server one at a time, in
 * the order they were tapped. Without this, two quick taps race: the second can reach the server
 * first, or collide with the first, and the box ends up wrong or shows an error.
 */
const tails = new Map<string, Promise<unknown>>();

export function inOrder<T>(key: string, task: () => Promise<T>): Promise<T> {
  const run = (tails.get(key) ?? Promise.resolve()).then(task, task);
  // The next save waits for this one whether it worked or not.
  const tail = run.catch(() => {});
  tails.set(key, tail);
  tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}

/** Whether saves for anything under this prefix are still on their way. */
export const hasPending = (prefix: string) => [...tails.keys()].some((k) => k.startsWith(prefix));
