// Export all animation variants
export * from './variants';

// Export all animated components
export {
  FadeIn,
  SlideIn,
  ScaleIn,
  AnimatedList,
  AnimatedListItem,
  AnimatedCard,
  LoadingSpinner,
  LoadingPulse,
  LoadingBounce,
  AnimatedPage,
  AnimatedModal,
  AnimatedNavItem,
  AnimatedNavIcon,
  CustomAnimated,
} from './components';

// Export all animation hooks
export {
  useAnimationPreference,
  useStaggeredAnimation,
  useLoadingAnimation,
  useScrollAnimation,
  useHoverAnimation,
  useAnimationSequence,
  useExitAnimation,
  useAnimationPerformance,
  useFocusAnimation,
  useAnimationCoordinator,
} from './hooks';

// Re-export commonly used Framer Motion components and utilities
export { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
