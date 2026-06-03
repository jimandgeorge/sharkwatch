"use client";

import { motion } from "framer-motion";

export function AnimatedTbody({ children }: { children: React.ReactNode }) {
  return (
    <motion.tbody
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
    >
      {children}
    </motion.tbody>
  );
}

export function AnimatedTr({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.tr
      className={className}
      onClick={onClick}
      variants={{
        hidden:  { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
      }}
    >
      {children}
    </motion.tr>
  );
}
