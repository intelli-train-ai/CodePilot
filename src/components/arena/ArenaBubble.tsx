'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import { Shield, Lightning } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { ArenaUIMessage } from './types';

interface ArenaBubbleProps {
  message: ArenaUIMessage;
  isStreaming?: boolean;
}

export const ArenaBubble = memo(function ArenaBubble({ message, isStreaming }: ArenaBubbleProps) {
  const isGatekeeper = message.role === 'gatekeeper';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        "flex gap-2 max-w-[80%]",
        isGatekeeper ? "self-start" : "self-end flex-row-reverse"
      )}
      aria-label={isGatekeeper ? 'Gatekeeper message' : 'Challenger message'}
    >
      {/* Role icon (D-04) */}
      <div className={cn(
        "shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
        isGatekeeper ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"
        // lint-allow-raw-color: Arena role differentiation requires specific blue/orange pairing per UI-SPEC
      )}>
        {isGatekeeper ? <Shield size={16} /> : <Lightning size={16} />}
      </div>
      {/* Message bubble (D-01) */}
      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm",
          isGatekeeper
            ? "bg-muted text-foreground rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-tr-sm",
        )}
        aria-busy={isStreaming}
      >
        {message.content}
        {isStreaming && (
          <span className="inline-block w-[2px] h-[14px] ml-0.5 bg-current animate-pulse align-text-bottom" />
        )}
      </div>
    </motion.div>
  );
});
