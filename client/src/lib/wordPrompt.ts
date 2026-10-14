/**
 * J & D Beach House — Word Prompt & AI Typewriter Script
 * 
 * Enables interactive word-to-prompt dispatching across the application.
 * When a guest or admin clicks a keyword, chip, amenity, or destination,
 * this utility opens the AI Concierge and smoothly types the prompt into the
 * input box using a realistic typewriter animation.
 */

export interface WordPromptOptions {
  autoSend?: boolean;
  template?: string; // e.g. "Tell me about {word}"
  category?: string;
}

/**
 * Dispatches a custom event to open the AI chatbot and type out the prompt.
 */
export function dispatchWordPrompt(word: string, options: WordPromptOptions = {}): void {
  if (!word || typeof window === 'undefined') return;

  let prompt = word;
  if (options.template) {
    prompt = options.template.replace(/\{word\}/g, word);
  }

  window.dispatchEvent(
    new CustomEvent('app:open-chat', {
      detail: {
        word,
        prompt,
        autoSend: Boolean(options.autoSend),
        category: options.category || 'general',
        timestamp: Date.now(),
      },
    })
  );
}

/**
 * Typewriter effect engine for animating text into an input or state setter.
 * 
 * @param text The full string to type out
 * @param onUpdate Callback fired on each character addition
 * @param onComplete Callback fired when typing completes
 * @param speedTypingMs Milliseconds between character strokes (default: dynamic 18-35ms)
 * @returns Cleanup function to stop animation early if needed
 */
export function animateTypewriterPrompt(
  text: string,
  onUpdate: (currentText: string) => void,
  onComplete?: () => void,
  speedTypingMs?: number
): () => void {
  if (!text) {
    onUpdate('');
    onComplete?.();
    return () => {};
  }

  let index = 0;
  const totalLength = text.length;
  // Calculate dynamic typing speed: longer text types slightly faster
  const strokeDelay = speedTypingMs ?? Math.max(12, Math.min(32, Math.floor(550 / Math.max(1, totalLength))));

  const timer = setInterval(() => {
    index++;
    const slice = text.slice(0, index);
    onUpdate(slice);

    if (index >= totalLength) {
      clearInterval(timer);
      onComplete?.();
    }
  }, strokeDelay);

  return () => clearInterval(timer);
}

/**
 * Initializes global delegation for elements tagged with data-prompt or data-word.
 */
export function initWordPromptTriggers(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest('[data-prompt], [data-word]');
    if (!target) return;

    const word = target.getAttribute('data-word') || target.textContent?.trim() || '';
    const template = target.getAttribute('data-prompt') || undefined;
    const autoSend = target.getAttribute('data-autosend') === 'true';

    if (word) {
      e.preventDefault();
      dispatchWordPrompt(word, { template, autoSend });
    }
  };

  document.addEventListener('click', handleClick);
  return () => document.removeEventListener('click', handleClick);
}
