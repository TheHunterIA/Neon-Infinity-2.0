import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone } from 'lucide-react';

const APK_URL = import.meta.env.VITE_APK_DOWNLOAD_URL || '#';

export const InstallBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if on Android
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    // Check if already in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    // Check if user has dismissed it before in this session
    const isDismissed = sessionStorage.getItem('apk-banner-dismissed');

    if (isAndroid && !isStandalone && !isDismissed && APK_URL !== '#') {
      // Show after a short delay to not be too intrusive
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('apk-banner-dismissed', 'true');
  };

  const handleDownload = () => {
    window.location.href = APK_URL;
    handleDismiss();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-4 right-4 z-[100] md:left-auto md:right-6 md:w-96"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-xl shadow-2xl">
            {/* Background Glow */}
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-cyan-500/20 blur-2xl" />
            
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                <Smartphone size={24} />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-white">Experiência Nativa</h3>
                <p className="text-xs text-gray-400">
                  Baixe o APK para melhor performance e suporte a controles!
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="absolute right-2 top-2 text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDownload}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 text-sm font-bold text-black transition-all hover:bg-cyan-400 active:scale-95"
              >
                <Download size={16} />
                Baixar APK
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
