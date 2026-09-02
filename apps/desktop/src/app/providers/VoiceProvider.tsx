import React, { createContext, useContext, useMemo, useState } from "react";
import { useCommands } from "@app/providers/CommandProvider";

export type VoiceState =
  | "idle"
  | "recording"
  | "transcribing"
  | "analyzing"
  | "confirmation"
  | "executing"
  | "success"
  | "error"
  | "ambiguous";

interface VoiceCandidate {
  commandId: string;
  label: string;
}

interface VoiceContextValue {
  state: VoiceState;
  transcript: string;
  candidates: VoiceCandidate[];
  errorMessage: string | null;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setState: (state: VoiceState) => void;
  setTranscript: (value: string) => void;
  setCandidates: (candidates: VoiceCandidate[]) => void;
  confirmCommand: (commandId: string) => void;
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { executeCommand } = useCommands();
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [candidates, setCandidates] = useState<VoiceCandidate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<VoiceContextValue>(
    () => ({
      state,
      transcript,
      candidates,
      errorMessage,
      isOpen,
      open: () => {
        setIsOpen(true);
        setState("recording");
        setErrorMessage(null);
      },
      close: () => {
        setIsOpen(false);
        setState("idle");
        setTranscript("");
        setCandidates([]);
        setErrorMessage(null);
      },
      setState,
      setTranscript,
      setCandidates,
      confirmCommand: (commandId: string) => {
        try {
          setState("executing");
          executeCommand(commandId);
          setState("success");
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Voice command failed");
          setState("error");
        }
      },
    }),
    [candidates, errorMessage, executeCommand, isOpen, state, transcript],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error("useVoice must be used within VoiceProvider");
  }
  return context;
}
