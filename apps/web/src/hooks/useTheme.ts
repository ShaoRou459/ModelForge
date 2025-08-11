import { useEffect } from 'react';
import { useAppearanceSettings } from '../stores/settings';

export const useTheme = () => {
  const { theme, accentColor, layoutDensity } = useAppearanceSettings();

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply accent color
    root.style.setProperty('--accent', accentColor);
    
    // Apply theme
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
    
    // Apply layout density
    const densityMap = {
      compact: '0.8',
      comfortable: '1',
      spacious: '1.2',
    };
    root.style.setProperty('--density-scale', densityMap[layoutDensity]);
    
  }, [theme, accentColor, layoutDensity]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return { theme, accentColor, layoutDensity };
};
