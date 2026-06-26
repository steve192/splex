export const CALCULATOR_FULLSCREEN_MAX_WIDTH = 600;
export const CALCULATOR_CONTENT_PADDING = 20;
export const CALCULATOR_KEY_GAP = 8;
export const CALCULATOR_POPUP_MAX_WIDTH = 420;
export const CALCULATOR_POPUP_WIDTH = 0.94;
export const CALCULATOR_POPUP_RESULT_MIN_HEIGHT = 92;
export const CALCULATOR_RESULT_MIN_HEIGHT = 120;
export const CALCULATOR_POPUP_MAX_HEIGHT = 0.94;
export const CALCULATOR_HEADER_HEIGHT = 48;
export const CALCULATOR_DISPLAY_TOP_MARGIN = 16;
export const CALCULATOR_KEYPAD_TOP_MARGIN = 16;
export const CALCULATOR_APPLY_TOP_MARGIN = 12;
export const CALCULATOR_APPLY_HEIGHT = 40;

export const CALCULATOR_HORIZONTAL_PADDING = CALCULATOR_CONTENT_PADDING * 2;
const CALCULATOR_KEY_ROWS = 5;
const CALCULATOR_KEYPAD_ROW_GAPS = (CALCULATOR_KEY_ROWS - 1) * CALCULATOR_KEY_GAP;

function calculatorVerticalChrome(resultHeight: number): number {
  return (
    CALCULATOR_CONTENT_PADDING * 2 +
    CALCULATOR_HEADER_HEIGHT +
    CALCULATOR_DISPLAY_TOP_MARGIN +
    resultHeight +
    CALCULATOR_KEYPAD_TOP_MARGIN +
    CALCULATOR_KEYPAD_ROW_GAPS +
    CALCULATOR_APPLY_TOP_MARGIN +
    CALCULATOR_APPLY_HEIGHT
  );
}

export const CALCULATOR_FULLSCREEN_VERTICAL_CHROME = calculatorVerticalChrome(CALCULATOR_RESULT_MIN_HEIGHT);
export const CALCULATOR_POPUP_VERTICAL_CHROME = calculatorVerticalChrome(CALCULATOR_POPUP_RESULT_MIN_HEIGHT);

export function isCalculatorFullscreen(windowWidth: number): boolean {
  return windowWidth < CALCULATOR_FULLSCREEN_MAX_WIDTH;
}

export function calculatorKeySize(windowWidth: number, windowHeight: number, fullScreen: boolean): number {
  const calculatorWidth = fullScreen
    ? windowWidth
    : Math.min(windowWidth * CALCULATOR_POPUP_WIDTH, CALCULATOR_POPUP_MAX_WIDTH);
  const widthBound = (calculatorWidth - CALCULATOR_HORIZONTAL_PADDING - CALCULATOR_KEY_GAP * 3) / 4;
  const heightBudget = fullScreen ? windowHeight : windowHeight * CALCULATOR_POPUP_MAX_HEIGHT;
  const verticalChrome = fullScreen
    ? CALCULATOR_FULLSCREEN_VERTICAL_CHROME
    : CALCULATOR_POPUP_VERTICAL_CHROME;
  const heightBound = (heightBudget - verticalChrome) / CALCULATOR_KEY_ROWS;
  return Math.max(0, Math.min(widthBound, heightBound));
}
