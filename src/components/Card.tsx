import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function Card({ children, className = '', delay = 0 }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {children}
    </motion.div>
  );
}
