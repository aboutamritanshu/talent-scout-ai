"use client";

import { useEffect, useRef } from "react";

interface ScrollHeadlineProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ScrollHeadline drives a CSS custom property `--scroll` (0..1) on the heading
 * element from window.scrollY. The companion `.scroll-headline` style in
 * globals.css uses that value to shift the background-position of a soft blue
 * to cyan gradient, giving the text a premium, scroll-reactive shimmer without
 * any heavy animation library.
 */
export default function ScrollHeadline({ children, className }: ScrollHeadlineProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;

    const apply = () => {
      // Travel distance: ~one viewport. After that we cap at 1.
      const travel = Math.max(window.innerHeight * 0.9, 480);
      const t = Math.min(1, Math.max(0, window.scrollY / travel));
      node.style.setProperty("--scroll", t.toFixed(3));
      frame = 0;
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <h1 ref={ref} className={`scroll-headline ${className ?? ""}`}>
      {children}
    </h1>
  );
}
