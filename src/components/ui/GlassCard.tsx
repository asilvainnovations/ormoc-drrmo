import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, onClick, hover = true }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border border-line/70',
        'bg-surface/70 backdrop-blur-xl',
        'shadow-raised',
        'transition-all duration-300',
        hover && 'hover:shadow-sheet hover:border-sky/50 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-surface/40 via-transparent to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
};

export default GlassCard;
