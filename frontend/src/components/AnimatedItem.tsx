import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export interface AnimatedItemProps {
  children: React.ReactNode;
  delay?: number;
  index?: number;
  className?: string;
}

export const AnimatedItem: React.FC<AnimatedItemProps> = ({ children, delay = 0, index = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.1, once: false });
  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.2, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
