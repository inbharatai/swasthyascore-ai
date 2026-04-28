"use client";

import { useEffect, useState } from "react";

export function useClientReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return ready;
}
