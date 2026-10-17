"use client";

import { useState, useEffect } from "react";
import { Onboarding } from "@/components/onboarding";

export function OnboardingWrapper() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem("uv-visualizer-onboarded");
    if (!onboarded) setShow(true);
  }, []);

  if (!show) return null;
  return <Onboarding onDismiss={() => setShow(false)} />;
}
