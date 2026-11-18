import { useEffect } from 'react';

export function useReveal(dep: any = true) {
  useEffect(() => {
    if (!dep) return;

    let io: IntersectionObserver | null = null;
    let rafId: number | null = null;

    const setupObserver = () => {
      if (!io) {
        io = new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (en.isIntersecting) {
                en.target.classList.add('in');
                io?.unobserve(en.target);
              }
            });
          },
          { threshold: 0.01, rootMargin: '120px' }
        );
      }

      const els = document.querySelectorAll('.reveal:not(.in)');
      els.forEach((el) => {
        io?.observe(el);
      });
    };

    const scheduleScan = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setupObserver();
      });
    };

    scheduleScan();

    // Batch asynchronous DOM additions into GPU animation frames to prevent layout thrashing
    const mo = new MutationObserver(() => {
      scheduleScan();
    });

    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (io) io.disconnect();
      mo.disconnect();
    };
  }, [dep]);
}
