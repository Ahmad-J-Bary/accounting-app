import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type BarcodeSourceType = "camera" | "keyboard" | "usb" | "bluetooth" | "native" | "manual";

interface BarcodeSession {
  targetId: string;
  label: string;
  source: BarcodeSourceType;
  onDetected: (value: string) => void;
}

interface BarcodeScannerContextValue {
  activeSession: BarcodeSession | null;
  beginScan: (session: BarcodeSession) => void;
  submitScan: (value: string) => void;
  cancelScan: () => void;
}

const BarcodeScannerContext = createContext<BarcodeScannerContextValue | undefined>(undefined);

export function BarcodeScannerProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<BarcodeSession | null>(null);

  const beginScan = useCallback((session: BarcodeSession) => {
    setActiveSession(session);
  }, []);

  const submitScan = useCallback((value: string) => {
    if (!activeSession) return;
    activeSession.onDetected(value);
    setActiveSession(null);
  }, [activeSession]);

  const cancelScan = useCallback(() => {
    setActiveSession(null);
  }, []);

  const value = useMemo<BarcodeScannerContextValue>(
    () => ({
      activeSession,
      beginScan,
      submitScan,
      cancelScan,
    }),
    [activeSession, beginScan, cancelScan, submitScan],
  );

  return (
    <BarcodeScannerContext.Provider value={value}>
      {children}
    </BarcodeScannerContext.Provider>
  );
}

export function useBarcodeScanner() {
  const context = useContext(BarcodeScannerContext);
  if (!context) {
    throw new Error("useBarcodeScanner must be used within BarcodeScannerProvider");
  }
  return context;
}
