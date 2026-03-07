import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Plus } from 'lucide-react';

export const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Check if user has dismissed it before in this session
      const isDismissed = sessionStorage.getItem('pwa-banner-dismissed');
      
      if (!isDismissed) {
        // Show after a short delay
        const timer = setTimeout(() => setIsVisible(true), 3000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa-banner-dismissed', 'true');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsVisible(false);
    } else {
      console.log('User dismissed the install prompt');
    }

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  if (!deferredPrompt && !isVisible) return null;

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
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-neon-cyan/20 blur-2xl" />
            
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neon-cyan/20 text-neon-cyan">
                <Smartphone size={24} />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-white uppercase tracking-tighter">Instalar Neon Dash</h3>
                <p className="text-xs text-gray-400">
                  Adicione à tela inicial para jogar em tela cheia e offline!
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
                onClick={handleInstall}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon-cyan py-2.5 text-sm font-bold text-black transition-all hover:bg-white active:scale-95 uppercase tracking-widest"
              >
                <Plus size={16} />
                Instalar App
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
