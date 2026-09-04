/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#16191D',
    background: '#ECEEF1',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E8F1FE',
    textSecondary: '#5C636B',
    primary: '#4285F4',
    primaryPressed: '#3275E4',
    primarySoft: '#E8F1FE',
    accent: '#E7B75B',
    border: '#D6DADF',
    danger: '#B84444',
    dangerSoft: '#FBE9E7',
  },
  dark: {
    text: '#F2F5EF',
    background: '#111713',
    backgroundElement: '#1B241E',
    backgroundSelected: '#29382E',
    textSecondary: '#ABB7AE',
    primary: '#79C998',
    primaryPressed: '#65B887',
    primarySoft: '#243D2D',
    accent: '#E7B75B',
    border: '#334138',
    danger: '#FF9A92',
    dangerSoft: '#442724',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  seven: 80,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
