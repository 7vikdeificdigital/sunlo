/** LIKE search ke liye user ke text mein % aur _ ko escape karo (value hamesha parameter ke roop mein jaati hai) */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
