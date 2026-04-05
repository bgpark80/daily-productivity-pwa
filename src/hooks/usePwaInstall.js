import { useEffect, useState } from 'react';

const isStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function usePwaInstall() {
  const [installEvent, setInstallEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return isStandaloneMode();
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setIsInstalled(true);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (event) => {
      setIsInstalled(event.matches || window.navigator.standalone === true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const promptInstall = async () => {
    if (!installEvent) {
      return false;
    }

    installEvent.prompt();
    const outcome = await installEvent.userChoice;

    if (outcome.outcome === 'accepted') {
      setInstallEvent(null);
      return true;
    }

    return false;
  };

  return {
    canInstall: Boolean(installEvent) && !isInstalled,
    isInstalled,
    promptInstall
  };
}

export default usePwaInstall;
