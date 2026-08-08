// Utility: count words in a string
export function getWordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(Boolean).length
}
