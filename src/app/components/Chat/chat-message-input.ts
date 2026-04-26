export function canSubmitChatMessage(value: string, image?: File) {
  return Boolean(value.trim() || image)
}
