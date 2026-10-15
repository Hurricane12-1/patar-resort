import { useEffect } from 'react';

export function useReveal(dep: any = true) {
  useEffect(() => {
    if (!dep) return;

    let io: IntersectionObserver | null = null;

    const scanAndObserve = () => {
      const els = document.querySelectorAll('.reveal:not(.in)');
      if (!els.length) return;

      if (!io) {
        io = new IntersectionObserver((entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add('in');
              io?.unobserve(en.target);
            }
          });
        }, { threshold: 0.05, rootMargin: '80px' });
      }

      const vh = window.innerHeight || document.documentElement.clientHeight;
      els.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // If already in or close to viewport, reveal immediately to eliminate blank spaces
        if (rect.top < vh + 100 && rect.bottom > -100) {
          el.classList.add('in');
        } else {
          io?.observe(el);
        }
      });
    };

    scanAndObserve();

    // Observe asynchronous DOM additions (e.g. after api.rooms() or api.recentReviews() loads)
    const mo = new MutationObserver(() => {
      scanAndObserve();
    });

    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (io) io.disconnect();
      mo.disconnect();
    };
  }, [dep]);
}
