"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

import { createCameraSnapshot, type CameraSnapshot } from "@horizon/toolkit/camera";

import { createFrameSignal, type FrameSignal } from "./overlay-canvas";

type SceneView = { camera: CameraSnapshot; frames: FrameSignal };

const SceneContext = createContext<SceneView | null>(null);

/**
 * One camera snapshot per mounted observatory, shared by its canvas and projected overlays,
 * and the signal of the engine's drawn frames that those overlays follow.
 */
export function SceneCameraProvider({ children }: { children: ReactNode }) {
  const [view] = useState<SceneView>(() => ({
    camera: createCameraSnapshot(),
    frames: createFrameSignal(),
  }));
  return <SceneContext.Provider value={view}>{children}</SceneContext.Provider>;
}

function useSceneView() {
  const view = useContext(SceneContext);
  if (!view) throw new Error("SceneCameraProvider is required");
  return view;
}

export const useSceneCamera = () => useSceneView().camera;
export const useSceneFrames = () => useSceneView().frames;
