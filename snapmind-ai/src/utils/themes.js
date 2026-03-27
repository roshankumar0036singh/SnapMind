import chalk from 'chalk';
import config from './config.js';

const THEMES = {
  default: {
    scholar: chalk.cyan,
    coder: chalk.blueBright,
    analyst: chalk.green,
    writer: chalk.magenta,
    primary: chalk.bold.white,
    secondary: chalk.gray,
    error: chalk.red,
    success: chalk.green
  },
  cyberpunk: {
    scholar: chalk.hex('#00ffea'),
    coder: chalk.hex('#ff003c'),
    analyst: chalk.hex('#fcee0a'),
    writer: chalk.hex('#05ffa1'),
    primary: chalk.hex('#fcee0a'),
    secondary: chalk.hex('#00ffea'),
    error: chalk.red,
    success: chalk.green
  },
  matrix: {
    scholar: chalk.green,
    coder: chalk.greenBright,
    analyst: chalk.hex('#00FF41'),
    writer: chalk.hex('#008F11'),
    primary: chalk.green,
    secondary: chalk.hex('#003B00'),
    error: chalk.red,
    success: chalk.hex('#00FF41')
  }
};

export function getTheme() {
  const themeName = config.get('theme') || 'default';
  return THEMES[themeName] || THEMES.default;
}

export function listThemes() {
  return Object.keys(THEMES);
}
