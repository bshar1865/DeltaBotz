type AutoEmbedSwitchState = {
  authorId: string;
  provider: string;
  candidates: string[];
  currentIndex: number;
  template: "auto" | "plain";
  createdAt: number;
};

const TTL_MS = 15 * 60 * 1000;
const states = new Map<string, AutoEmbedSwitchState>();

function cleanup(): void {
  const now = Date.now();
  for (const [messageId, state] of states) {
    if (now - state.createdAt > TTL_MS) states.delete(messageId);
  }
}

export function setAutoEmbedSwitchState(
  messageId: string,
  input: Omit<AutoEmbedSwitchState, "createdAt">
): void {
  cleanup();
  states.set(messageId, { ...input, createdAt: Date.now() });
}

export function getAutoEmbedSwitchState(messageId: string): AutoEmbedSwitchState | null {
  cleanup();
  return states.get(messageId) ?? null;
}

export function deleteAutoEmbedSwitchState(messageId: string): void {
  states.delete(messageId);
}
