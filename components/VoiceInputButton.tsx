"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { useClientReady } from "@/lib/utils/clientReady";

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

interface VoiceInputButtonProps {
  language: Language;
  onTranscript: (value: string) => void;
}

function getRecognitionCtor() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    (window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    }).SpeechRecognition ??
    (window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    }).webkitSpeechRecognition
  );
}

export function VoiceInputButton({
  language,
  onTranscript,
}: VoiceInputButtonProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const clientReady = useClientReady();
  const recognition = clientReady ? getRecognitionCtor() : undefined;
  const supported = Boolean(recognition);

  useEffect(() => {
    if (!recognition) {
      return;
    }

    const instance = new recognition();
    instance.continuous = false;
    instance.interimResults = false;
    instance.lang = language === "hi" ? "hi-IN" : "en-IN";
    instance.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((item) => item[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (transcript) {
        onTranscript(transcript);
      }
    };
    instance.onerror = () => {
      setListening(false);
    };
    instance.onend = () => {
      setListening(false);
    };

    recognitionRef.current = instance;

    return () => {
      instance.stop();
      recognitionRef.current = null;
    };
  }, [language, onTranscript, recognition]);

  if (!supported) {
    return null;
  }

  function handleToggle() {
    if (!recognitionRef.current) {
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    recognitionRef.current.lang = language === "hi" ? "hi-IN" : "en-IN";
    recognitionRef.current.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
        listening
          ? "bg-rose-100 text-rose-700"
          : "bg-[var(--surface-muted)] text-[var(--slate-700)] hover:bg-[var(--surface-strong)]"
      }`}
      aria-label={translate(language, listening ? "voice.stop" : "voice.start")}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      <span>
        {translate(language, listening ? "voice.listening" : "voice.start")}
      </span>
    </button>
  );
}
