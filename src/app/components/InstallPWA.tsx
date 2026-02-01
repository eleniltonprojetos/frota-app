import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If installed, hide button
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    } else {
      console.log('PWA: Checking install capability...');
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        toast.info('Para instalar no iOS: toque em Compartilhar e depois em "Adicionar à Tela de Início"');
      }
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsVisible(false);
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
  };

  if (!isVisible && !isIOS) return null;

  // Don't show if running in standalone mode (already installed)
  if (isStandalone) return null;

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleInstallClick}
      className="gap-2 text-xs h-8 border-dashed border-blue-200 text-blue-700 hover:text-blue-800 hover:bg-blue-50"
    >
      <Download className="h-3.5 w-3.5" />
      {isIOS ? 'Instalar App' : 'Instalar Aplicativo'}
    </Button>
  );
}
