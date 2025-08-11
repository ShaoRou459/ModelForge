import { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useAppearanceSettings } from '../../stores/settings';

// Hook to check if user prefers reduced motion
export const useAnimationPreference = () => {
  const systemReducedMotion = useReducedMotion();
  const { animationsEnabled, reducedMotion, animationSpeed } = useAppearanceSettings();

  const shouldReduceMotion = reducedMotion || !animationsEnabled || systemReducedMotion;

  // Speed multipliers based on user preference
  const speedMultiplier = animationSpeed === 'fast' ? 0.5 : animationSpeed === 'slow' ? 2 : 1;

  return {
    shouldReduceMotion,
    animationsEnabled,
    speedMultiplier,
    // Provide instant alternatives for reduced motion
    duration: shouldReduceMotion ? 0.01 : undefined,
    transition: shouldReduceMotion ? { duration: 0.01 } : undefined,
  };
};

// Hook for staggered animations with dynamic delay calculation
export const useStaggeredAnimation = (itemCount: number, baseDelay = 0.05) => {
  const { shouldReduceMotion, speedMultiplier } = useAnimationPreference();

  const adjustedDelay = baseDelay * speedMultiplier;

  const getStaggerDelay = (index: number) => {
    if (shouldReduceMotion) return 0;
    return adjustedDelay * index;
  };

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : adjustedDelay,
        delayChildren: shouldReduceMotion ? 0 : 0.1 * speedMultiplier,
      },
    },
  };

  return {
    containerVariants,
    getStaggerDelay,
    shouldReduceMotion,
    speedMultiplier,
  };
};

// Hook for managing loading states with animation
export const useLoadingAnimation = (isLoading: boolean, minDuration = 500) => {
  const [showLoading, setShowLoading] = useState(isLoading);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isLoading) {
      setShowLoading(true);
    } else {
      // Keep loading state for minimum duration to prevent flashing
      timeoutRef.current = setTimeout(() => {
        setShowLoading(false);
      }, minDuration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, minDuration]);

  return showLoading;
};

// Hook for scroll-triggered animations
export const useScrollAnimation = (threshold = 0.1) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsInView(true);
          // Once in view, stop observing to prevent re-triggering
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold]);

  return { ref, isInView };
};

// Hook for hover animations with proper cleanup
export const useHoverAnimation = () => {
  const [isHovered, setIsHovered] = useState(false);
  
  const hoverProps = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  };

  return { isHovered, hoverProps };
};

// Hook for managing animation sequences
export const useAnimationSequence = (steps: string[], autoStart = true) => {
  const [currentStep, setCurrentStep] = useState(autoStart ? 0 : -1);
  const [isComplete, setIsComplete] = useState(false);

  const nextStep = () => {
    setCurrentStep(prev => {
      const next = prev + 1;
      if (next >= steps.length) {
        setIsComplete(true);
        return prev;
      }
      return next;
    });
  };

  const reset = () => {
    setCurrentStep(autoStart ? 0 : -1);
    setIsComplete(false);
  };

  const start = () => {
    setCurrentStep(0);
    setIsComplete(false);
  };

  return {
    currentStep: currentStep >= 0 ? steps[currentStep] : null,
    stepIndex: currentStep,
    isComplete,
    nextStep,
    reset,
    start,
  };
};

// Hook for managing exit animations
export const useExitAnimation = (isVisible: boolean, exitDelay = 0) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else if (exitDelay > 0) {
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false);
      }, exitDelay);
    } else {
      setShouldRender(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, exitDelay]);

  return shouldRender;
};

// Hook for performance monitoring of animations
export const useAnimationPerformance = (animationName: string) => {
  const startTimeRef = useRef<number>();
  const { shouldReduceMotion } = useAnimationPreference();

  const startMeasure = () => {
    if (!shouldReduceMotion && performance.mark) {
      startTimeRef.current = performance.now();
      performance.mark(`${animationName}-start`);
    }
  };

  const endMeasure = () => {
    if (!shouldReduceMotion && performance.mark && startTimeRef.current) {
      performance.mark(`${animationName}-end`);
      const duration = performance.now() - startTimeRef.current;
      
      // Log slow animations in development
      if (import.meta.env?.MODE === 'development' && duration > 100) {
        console.warn(`Slow animation detected: ${animationName} took ${duration.toFixed(2)}ms`);
      }
    }
  };

  return { startMeasure, endMeasure };
};

// Hook for managing focus animations
export const useFocusAnimation = () => {
  const [isFocused, setIsFocused] = useState(false);
  
  const focusProps = {
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  };

  return { isFocused, focusProps };
};

// Hook for coordinating multiple animations
export const useAnimationCoordinator = () => {
  const [activeAnimations, setActiveAnimations] = useState<Set<string>>(new Set());

  const startAnimation = (id: string) => {
    setActiveAnimations(prev => new Set(prev).add(id));
  };

  const endAnimation = (id: string) => {
    setActiveAnimations(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const isAnimating = (id?: string) => {
    if (id) return activeAnimations.has(id);
    return activeAnimations.size > 0;
  };

  return {
    startAnimation,
    endAnimation,
    isAnimating,
    activeCount: activeAnimations.size,
  };
};

// Hook for settings-aware transitions
export const useSettingsAwareTransition = (baseDuration: number = 0.2) => {
  const { shouldReduceMotion, speedMultiplier } = useAnimationPreference();

  if (shouldReduceMotion) {
    return { duration: 0.01 };
  }

  return {
    duration: baseDuration * speedMultiplier,
    ease: [0.2, 0.8, 0.2, 1] as const,
  };
};
