import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';
import {
  fadeVariants,
  slideVariants,
  scaleVariants,
  staggerVariants,
  interactiveVariants,
  loadingVariants,
  pageVariants,
  modalVariants,
  navVariants,
} from './variants';

// Base animated component props
interface AnimatedProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
  className?: string;
  as?: keyof HTMLElementTagNameMap;
}

// Fade In Component
export const FadeIn = forwardRef<HTMLDivElement, AnimatedProps>(
  ({ children, className, as = 'div', ...props }, ref) => {
    const Component = (motion as any)[as] as any;
    return (
      <Component
        ref={ref}
        className={className}
        variants={fadeVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        {...props}
      >
        {children}
      </Component>
    );
  }
);
FadeIn.displayName = 'FadeIn';

// Slide In Components
interface SlideInProps extends AnimatedProps {
  direction?: 'up' | 'down' | 'left' | 'right';
}

export const SlideIn = forwardRef<HTMLDivElement, SlideInProps>(
  ({ children, direction = 'up', className, as = 'div', ...props }, ref) => {
    const Component = (motion as any)[as] as any;
    return (
      <Component
        ref={ref}
        className={className}
        variants={slideVariants[direction]}
        initial="hidden"
        animate="visible"
        exit="exit"
        {...props}
      >
        {children}
      </Component>
    );
  }
);
SlideIn.displayName = 'SlideIn';

// Scale In Component
export const ScaleIn = forwardRef<HTMLDivElement, AnimatedProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={scaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      {...props}
    >
      {children}
    </motion.div>
  )
);
ScaleIn.displayName = 'ScaleIn';

// Animated List with staggered children
interface AnimatedListProps extends AnimatedProps {
  staggerDelay?: number;
}

export const AnimatedList = forwardRef<HTMLDivElement, AnimatedListProps>(
  ({ children, className, staggerDelay, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerVariants.container}
      initial="hidden"
      animate="visible"
      exit="exit"
      {...props}
    >
      {children}
    </motion.div>
  )
);
AnimatedList.displayName = 'AnimatedList';

export const AnimatedListItem = forwardRef<HTMLDivElement, AnimatedProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerVariants.item}
      {...props}
    >
      {children}
    </motion.div>
  )
);
AnimatedListItem.displayName = 'AnimatedListItem';

// Interactive Card Component
interface AnimatedCardProps extends AnimatedProps {
  hover?: boolean;
  press?: boolean;
  lift?: boolean;
}

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ children, hover = true, press = true, lift = false, className, ...props }, ref) => {
    const hoverVariant = lift ? interactiveVariants.lift : interactiveVariants.hover;
    
    return (
      <motion.div
        ref={ref}
        className={className}
        whileHover={hover ? hoverVariant : undefined}
        whileTap={press ? interactiveVariants.press : undefined}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
AnimatedCard.displayName = 'AnimatedCard';

// Loading Components
interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export const LoadingSpinner = ({ size = 20, className = '' }: LoadingSpinnerProps) => (
  <motion.div
    className={`inline-block border-2 border-current border-t-transparent rounded-full ${className}`}
    style={{ width: size, height: size }}
    variants={loadingVariants.spin}
    animate="animate"
  />
);

export const LoadingPulse = forwardRef<HTMLDivElement, AnimatedProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={loadingVariants.pulse as any}
      animate="animate"
      {...props}
    >
      {children}
    </motion.div>
  )
);
LoadingPulse.displayName = 'LoadingPulse';

export const LoadingBounce = forwardRef<HTMLDivElement, AnimatedProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={loadingVariants.bounce as any}
      animate="animate"
      {...props}
    >
      {children}
    </motion.div>
  )
);
LoadingBounce.displayName = 'LoadingBounce';

// Page Transition Component
interface AnimatedPageProps extends AnimatedProps {
  mode?: 'wait' | 'sync' | 'popLayout';
}

export const AnimatedPage = ({ children, mode = 'wait', className, ...props }: AnimatedPageProps) => (
  <AnimatePresence mode={mode}>
    <motion.div
      className={className}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      {...props}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

// Modal Components
interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
}

export const AnimatedModal = ({
  isOpen,
  onClose,
  children,
  className = '',
  backdropClassName = '',
}: AnimatedModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          className={`fixed inset-0 bg-black/50 z-40 ${backdropClassName}`}
          variants={modalVariants.backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        />
        <motion.div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}
          variants={modalVariants.modal}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// Navigation Components
interface AnimatedNavItemProps extends AnimatedProps {
  isActive?: boolean;
}

export const AnimatedNavItem = forwardRef<HTMLDivElement, AnimatedNavItemProps>(
  ({ children, isActive = false, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={navVariants.item}
      initial="rest"
      whileHover="hover"
      animate={isActive ? "active" : "rest"}
      {...props}
    >
      {children}
    </motion.div>
  )
);
AnimatedNavItem.displayName = 'AnimatedNavItem';

export const AnimatedNavIcon = forwardRef<HTMLDivElement, AnimatedProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={navVariants.icon}
      initial="rest"
      whileHover="hover"
      {...props}
    >
      {children}
    </motion.div>
  )
);
AnimatedNavIcon.displayName = 'AnimatedNavIcon';

// Utility component for custom animations
interface CustomAnimatedProps extends AnimatedProps {
  variants?: any;
  initial?: string;
  animate?: string;
  exit?: string;
}

export const CustomAnimated = forwardRef<HTMLDivElement, CustomAnimatedProps>(
  ({ children, variants, initial = 'hidden', animate = 'visible', exit = 'exit', className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={variants}
      initial={initial}
      animate={animate}
      exit={exit}
      {...props}
    >
      {children}
    </motion.div>
  )
);
CustomAnimated.displayName = 'CustomAnimated';
