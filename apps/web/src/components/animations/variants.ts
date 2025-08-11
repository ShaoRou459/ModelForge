import { Variants, Transition } from 'framer-motion';

// Function to get speed-adjusted duration
export const getAdjustedDuration = (baseDuration: number, speedMultiplier: number = 1): number => {
  return baseDuration * speedMultiplier;
};

// Get CSS custom property values
const getCustomProperty = (property: string): string => {
  if (typeof window !== 'undefined') {
    return getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  }
  return '';
};

// Animation durations from design tokens
export const durations = {
  quick: 0.12, // --dur-quick: 120ms
  base: 0.2,   // --dur-base: 200ms
  slow: 0.32,  // --dur-slow: 320ms
} as const;

// Easing curves from design tokens
export const easings = {
  standard: [0.2, 0.8, 0.2, 1] as const,    // --ease-standard
  emphasized: [0.2, 0.0, 0, 1] as const,    // --ease-emphasized
} as const;

// Base transition configurations
export const transitions = {
  quick: {
    duration: durations.quick,
    ease: easings.standard,
  },
  base: {
    duration: durations.base,
    ease: easings.standard,
  },
  slow: {
    duration: durations.slow,
    ease: easings.emphasized,
  },
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  },
  springGentle: {
    type: 'spring',
    stiffness: 200,
    damping: 25,
  },
} as const;

// Fade animations
export const fadeVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: transitions.base,
  },
  exit: {
    opacity: 0,
    transition: transitions.quick,
  },
};

// Slide animations
export const slideVariants = {
  up: {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: transitions.base,
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: transitions.quick,
    },
  },
  down: {
    hidden: {
      opacity: 0,
      y: -20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: transitions.base,
    },
    exit: {
      opacity: 0,
      y: 10,
      transition: transitions.quick,
    },
  },
  left: {
    hidden: {
      opacity: 0,
      x: 20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: transitions.base,
    },
    exit: {
      opacity: 0,
      x: -10,
      transition: transitions.quick,
    },
  },
  right: {
    hidden: {
      opacity: 0,
      x: -20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: transitions.base,
    },
    exit: {
      opacity: 0,
      x: 10,
      transition: transitions.quick,
    },
  },
} as const;

// Scale animations
export const scaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.base,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitions.quick,
  },
};

// Stagger animations for lists
export const staggerVariants = {
  container: {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
    exit: {
      transition: {
        staggerChildren: 0.02,
        staggerDirection: -1,
      },
    },
  },
  item: {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: transitions.base,
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: transitions.quick,
    },
  },
} as const;

// Interactive hover/press states
export const interactiveVariants = {
  hover: {
    scale: 1.02,
    y: -2,
    transition: transitions.quick,
  },
  press: {
    scale: 0.98,
    transition: transitions.quick,
  },
  lift: {
    y: -4,
    transition: transitions.spring,
  },
} as const;

// Loading animations
export const loadingVariants = {
  pulse: {
    animate: {
      opacity: [1, 0.5, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
  spin: {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      },
    },
  },
  bounce: {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
} as const;

// Page transition variants
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: transitions.slow,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: transitions.base,
  },
};

// Modal/overlay variants
export const modalVariants = {
  backdrop: {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: transitions.base,
    },
    exit: {
      opacity: 0,
      transition: transitions.quick,
    },
  },
  modal: {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: transitions.slow,
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 20,
      transition: transitions.base,
    },
  },
} as const;

// Navigation variants
export const navVariants = {
  item: {
    rest: {
      scale: 1,
      transition: transitions.quick,
    },
    hover: {
      scale: 1.05,
      transition: transitions.spring,
    },
    active: {
      scale: 1,
      transition: transitions.quick,
    },
  },
  icon: {
    rest: {
      rotate: 0,
      transition: transitions.quick,
    },
    hover: {
      rotate: 5,
      transition: transitions.spring,
    },
  },
} as const;
