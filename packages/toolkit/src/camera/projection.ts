/** Each scene owns a snapshot. Per-frame writes reuse the object. */

export function createCameraSnapshot() {
  return {
    posX: 0,
    posY: 0,
    posZ: 0,
    fwdX: 0,
    fwdY: 0,
    fwdZ: -1,
    rightX: 1,
    rightY: 0,
    rightZ: 0,
    upX: 0,
    upY: 1,
    upZ: 0,
    dist: 0,
    fov: Math.PI / 2,
  };
}
export type CameraSnapshot = ReturnType<typeof createCameraSnapshot>;

export function writeCameraSnapshot(
  cam: CameraSnapshot,
  pos: { x: number; y: number; z: number },
  fwd: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
  up: { x: number; y: number; z: number },
  dist: number,
  fov: number,
) {
  cam.posX = pos.x;
  cam.posY = pos.y;
  cam.posZ = pos.z;
  cam.fwdX = fwd.x;
  cam.fwdY = fwd.y;
  cam.fwdZ = fwd.z;
  cam.rightX = right.x;
  cam.rightY = right.y;
  cam.rightZ = right.z;
  cam.upX = up.x;
  cam.upY = up.y;
  cam.upZ = up.z;
  cam.dist = dist;
  cam.fov = fov;
}

/**
 * The snapshot from a column-major camera-to-world matrix (`writeCameraMatrix`, or three's
 * `camera.matrixWorld.elements`): columns right, up, back and the position.
 */
export function writeCameraSnapshotFromMatrix(
  cam: CameraSnapshot,
  m: { readonly [index: number]: number },
  dist: number,
  fov: number,
) {
  cam.rightX = m[0]!;
  cam.rightY = m[1]!;
  cam.rightZ = m[2]!;
  cam.upX = m[4]!;
  cam.upY = m[5]!;
  cam.upZ = m[6]!;
  cam.fwdX = -m[8]!;
  cam.fwdY = -m[9]!;
  cam.fwdZ = -m[10]!;
  cam.posX = m[12]!;
  cam.posY = m[13]!;
  cam.posZ = m[14]!;
  cam.dist = dist;
  cam.fov = fov;
}

export type ScreenPt = { x: number; y: number; visible: boolean };

/** Matches height-normalized shader UVs: (fragCoord - resolution / 2) / height.
 * The scale is tan(fov/2), NOT a conventional full vertical perspective FOV.
 * Pass an orthonormal camera basis; near cutoff and label padding are configurable.
 */
export function projectWorld(
  cam: CameraSnapshot,
  wx: number,
  wy: number,
  wz: number,
  width: number,
  height: number,
  options: { near?: number; padding?: number } = {},
): ScreenPt {
  if (width < 8 || height < 8) return { x: 0, y: 0, visible: false };
  const relX = wx - cam.posX;
  const relY = wy - cam.posY;
  const relZ = wz - cam.posZ;
  const depth = relX * cam.fwdX + relY * cam.fwdY + relZ * cam.fwdZ;
  if (depth < (options.near ?? 0.4)) return { x: 0, y: 0, visible: false };
  const rx = relX * cam.rightX + relY * cam.rightY + relZ * cam.rightZ;
  const ry = relX * cam.upX + relY * cam.upY + relZ * cam.upZ;
  const tanFov = Math.tan(cam.fov * 0.5);
  const uvx = rx / depth / tanFov;
  const uvy = ry / depth / tanFov;
  const x = 0.5 * width + uvx * height;
  const y = 0.5 * height - uvy * height;
  const padding = options.padding ?? 48;
  return {
    x,
    y,
    visible: x > -padding && x < width + padding && y > -padding && y < height + padding,
  };
}
