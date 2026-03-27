import { DefaultTheme, type Theme } from '@react-navigation/native';

/** Navigation chrome: black on white only. */
export const monoNavigationTheme: Theme = {
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#000000',
    background: '#ffffff',
    card: '#ffffff',
    text: '#000000',
    border: '#000000',
    notification: '#000000',
  },
  fonts: DefaultTheme.fonts,
};
