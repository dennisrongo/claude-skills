export const CHARS_PER_TOKEN = 4

export const tokens = (chars) => (chars < 0 ? -Math.ceil(-chars / CHARS_PER_TOKEN) : Math.ceil(chars / CHARS_PER_TOKEN))
