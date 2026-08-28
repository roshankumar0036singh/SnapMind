"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  className?: string;
}

export function ScrollReveal({ 
  children, 
  delay = 0, 
  direction = "up",
  className = "" 
}: ScrollRevealProps) {
  const ref = useRef(null);
  // trigger once when 10% of the component is visible
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  const getInitialY = () => {
    if (direction === "up") return 40;
    if (direction === "down") return -40;
    return 0;
  };

  const getInitialX = () => {
    if (direction === "left") return 40;
    if (direction === "right") return -40;
    return 0;
  };

  return (
    <motion.div
      ref={ref}
      initial={{ 
        opacity: 0, 
        y: getInitialY(), 
        x: getInitialX() 
      }}
      animate={isInView ? { 
        opacity: 1, 
        y: 0, 
        x: 0 
      } : {}}
      transition={{
        duration: 0.6,
        delay: delay,
        ease: [0.21, 0.47, 0.32, 0.98] // custom easing for a smooth premium feel
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
