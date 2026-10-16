"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

import { createCameraSnapshot, type CameraSnapshot } from "@horizon/toolkit/camera";
const CameraContext = createContext<CameraSnapshot | null>(null);

/** One snapshot per mounted observatory, shared by its canvas and projected overlays. */
export function SceneCameraProvider({ children }: { children: ReactNode }) {
  const [camera] = useState(createCameraSnapshot);
  return <CameraContext.Provider value={camera}>{children}</CameraContext.Provider>;
}
export function useSceneCamera() {
  const camera = useContext(CameraContext);
  if (!camera) throw new Error("SceneCameraProvider is required");
  return camera;
}
