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
        'relative rounded-2xl border border-white/40 dark:border-white/10',
        'bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl',
        'shadow-[0_8px_32px_rgba(30,64,175,0.08)]',
        'transition-all duration-300',
        hover && 'hover:shadow-[0_12px_40px_rgba(30,64,175,0.15)] hover:border-white/60 hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
};

export default GlassCard;
