import React from 'react';
import { motion } from 'motion/react';

interface MiraAvatarProps {
  size?: number;
  isThinking?: boolean;
  className?: string;
}

export default function MiraAvatar({ size = 48, isThinking = false, className = "" }: MiraAvatarProps) {
  // SVG Center is at (100, 100)
  // We have 8 petals arranged around the center.
  // We can vary the animations depending on the state.
  
  const petalCount = 8;
  const degrees = 360 / petalCount;

  // Let's create beautiful gradient definitions and modern glowing filters.
  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 select-none ${className}`} 
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main gradient for turquoise-blue petals */}
          <linearGradient id="petal-grad-1" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" /> {/* Turquoise */}
            <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.75" /> {/* Blue */}
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.9" /> {/* Indigo */}
          </linearGradient>

          {/* Secondary gradient for emerald-turquoise petals (alternating) */}
          <linearGradient id="petal-grad-2" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" /> {/* Emerald */}
            <stop offset="50%" stopColor="#0d9488" stopOpacity="0.7" /> {/* Teal */}
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.85" /> {/* Mint */}
          </linearGradient>

          {/* Accent golden gradient for soft glowing centers & borders */}
          <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" /> {/* Gold */}
            <stop offset="30%" stopColor="#10b981" stopOpacity="0.8" /> {/* Emerald */}
            <stop offset="70%" stopColor="#6366f1" stopOpacity="0.3" /> {/* Indigo */}
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>

          {/* Outer glowing filter for scientific aesthetic */}
          <filter id="mira-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Expansion Light Waves (Emitted in thinking state, gentle pulse in idle state) */}
        {isThinking ? (
          <>
            {/* Wave 1 */}
            <motion.circle
              cx="100"
              cy="100"
              r="45"
              fill="none"
              stroke="url(#center-glow)"
              strokeWidth="1.5"
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
            {/* Wave 2 */}
            <motion.circle
              cx="100"
              cy="100"
              r="45"
              fill="none"
              stroke="url(#center-glow)"
              strokeWidth="1.2"
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{
                duration: 2.2,
                delay: 1.1,
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
          </>
        ) : (
          /* Subtle ambient breathing aura in idle state */
          <motion.circle
            cx="100"
            cy="100"
            r="60"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="0.8"
            strokeDasharray="4 8"
            animate={{ 
              scale: [0.95, 1.05, 0.95],
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}

        {/* 2. Core Petals Orbit Group */}
        <motion.g
          animate={isThinking ? {
            rotate: 360
          } : {
            rotate: [0, 8, -8, 0]
          }}
          transition={isThinking ? {
            duration: 12,
            repeat: Infinity,
            ease: "linear"
          } : {
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ originX: "100px", originY: "100px" }}
        >
          {Array.from({ length: petalCount }).map((_, i) => {
            const angle = i * degrees;
            const useAltGradient = i % 2 === 1;

            return (
              <g 
                key={i} 
                transform={`rotate(${angle} 100 100)`}
              >
                {/* Petal Shape */}
                <motion.path
                  d="M 100,100 C 80,75 75,40 100,20 C 125,40 120,75 100,100 Z"
                  fill={useAltGradient ? "url(#petal-grad-2)" : "url(#petal-grad-1)"}
                  filter="url(#mira-glow)"
                  style={{ originX: "100px", originY: "100px" }}
                  animate={isThinking ? {
                    // Orbit axis rotation + individual axis rotation + expanding outwards
                    scaleY: [1, 1.15, 1],
                    scaleX: [1, 1.08, 1],
                    skewX: [0, 6, -6, 0],
                    opacity: [0.75, 0.95, 0.75],
                  } : {
                    // Breathing loop
                    scale: [0.98, 1.02, 0.98],
                    opacity: [0.8, 0.9, 0.8],
                  }}
                  transition={{
                    duration: isThinking ? 3 : 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * (isThinking ? 0.25 : 0.35)
                  }}
                />

                {/* Golden Accented central petal line for sleek futuristic alignment */}
                <motion.path
                  d="M 100,100 L 100,28"
                  stroke="#ef4444" // transparent fading to gold
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0"
                  animate={isThinking ? {
                    opacity: [0.1, 0.45, 0.1],
                    stroke: ["#10b981", "#fbbf24", "#3b82f6"]
                  } : {
                    opacity: [0.1, 0.25, 0.1],
                    stroke: ["#fbbf24", "#f59e0b", "#fbbf24"]
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.15
                  }}
                />
              </g>
            );
          })}
        </motion.g>

        {/* 3. Glowing Center Core */}
        {/* Outer neon halo for center */}
        <motion.circle
          cx="100"
          cy="100"
          r="26"
          fill="url(#center-glow)"
          animate={{
            scale: [0.85, 1.15, 0.85],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{
            duration: isThinking ? 1.5 : 3.2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Center glowing golden point */}
        <motion.circle
          cx="100"
          cy="100"
          r="9"
          fill="#fbbf24"
          filter="url(#mira-glow)"
          animate={{
            scale: [0.9, 1.1, 0.9],
            boxShadow: "0px 0px 8px #fbbf24"
          }}
          transition={{
            duration: isThinking ? 1 : 2.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Soft interactive white pinhead center to represent active core CPU/Intelligence */}
        <circle
          cx="100"
          cy="100"
          r="4.5"
          fill="#ffffff"
        />
      </svg>
    </div>
  );
}
