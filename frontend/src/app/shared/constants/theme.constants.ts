import { environment } from '../../../environments/environment';
import { deriveThemeColors } from '../utils/color.util';

/**
 * Centralized brand colors for use in TypeScript (SweetAlert2 buttons, inline
 * styles, Excel exports, etc.). Sourced from `environment.primaryColor` — set
 * it in `src/environments/environment.ts` / `environment.prod.ts` to re-theme
 * the app; falls back to the original brand color when unset or invalid.
 *
 * For SCSS, use the equivalent variables in `src/styles/_variables.scss`
 * ($primary-color and friends), which pick up the same value at runtime via
 * CSS custom properties set in `main.ts` — no need to edit SCSS separately.
 */
const theme = deriveThemeColors(environment.primaryColor);

export const PRIMARY_COLOR = theme.primary;
export const PRIMARY_COLOR_DARK = theme.primaryDark;
export const PRIMARY_COLOR_LIGHT = theme.primaryLight;
