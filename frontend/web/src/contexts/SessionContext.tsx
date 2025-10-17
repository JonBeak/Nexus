import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface SessionContextType {
  isSessionExpired: boolean;
  showSessionExpiredModal: () => void;
  hideSessionExpiredModal: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

// Global callback for api.ts to trigger session expired modal
let globalShowSessionExpired: (() => void) | null = null;

export const triggerSessionExpired = () => {
  if (globalShowSessionExpired) {
    globalShowSessionExpired();
  }
};

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [hasShownModal, setHasShownModal] = useState(false);

  const showSessionExpiredModal = useCallback(() => {
    // Only show modal once to prevent duplicates
    if (!hasShownModal) {
      setIsSessionExpired(true);
      setHasShownModal(true);
    }
  }, [hasShownModal]);

  const hideSessionExpiredModal = useCallback(() => {
    setIsSessionExpired(false);
    // Note: hasShownModal stays true to prevent re-showing
  }, []);

  // Register the global callback
  useEffect(() => {
    globalShowSessionExpired = showSessionExpiredModal;
    return () => {
      globalShowSessionExpired = null;
    };
  }, [showSessionExpiredModal]);

  return (
    <SessionContext.Provider
      value={{
        isSessionExpired,
        showSessionExpiredModal,
        hideSessionExpiredModal,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
