import '@angular/localize/init';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { PRIMARY_COLOR, PRIMARY_COLOR_DARK, PRIMARY_COLOR_LIGHT } from './app/shared/constants/theme.constants';

// Expose the brand color (from environment.primaryColor) as CSS custom properties
// before the app renders, so styles/_variables.scss can consume it via var().
const root = document.documentElement.style;
root.setProperty('--primary-color', PRIMARY_COLOR);
root.setProperty('--primary-color-dark', PRIMARY_COLOR_DARK);
root.setProperty('--primary-color-light', PRIMARY_COLOR_LIGHT);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
