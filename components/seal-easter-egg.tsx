'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SealStamp } from '@/components/seal-stamp';

const CODE = '1686';

/** Type 1686 anywhere on the landing page: Lloyd stamps the year it was born. */
export function SealEasterEgg() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let buffer = '';
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      buffer = (buffer + e.key).slice(-CODE.length);
      if (buffer === CODE) {
        setShow(true);
        window.setTimeout(() => setShow(false), 1600);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-ink/60"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="flex flex-col items-center gap-4">
            <SealStamp size={160} />
            <motion.p
              className="font-display text-xl text-parchment"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            >
              Underwriting since 1686.
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
