/**
 * No number field in the app accepts a negative value. This stops the minus key and pasted
 * negatives, and strips the sign if one still arrives (for example from the spinner arrows).
 */
const isNumberInput = (target: EventTarget | null): target is HTMLInputElement =>
  target instanceof HTMLInputElement && target.type === 'number';

document.addEventListener(
  'keydown',
  (event) => {
    if (isNumberInput(event.target) && event.key === '-') event.preventDefault();
  },
  true
);

document.addEventListener(
  'paste',
  (event) => {
    if (isNumberInput(event.target) && (event.clipboardData?.getData('text') ?? '').includes('-')) {
      event.preventDefault();
    }
  },
  true
);

const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

document.addEventListener(
  'input',
  (event) => {
    const input = event.target;
    if (!isNumberInput(input) || !input.value.startsWith('-') || !setNativeValue) return;
    setNativeValue.call(input, input.value.replace('-', ''));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  },
  true
);
