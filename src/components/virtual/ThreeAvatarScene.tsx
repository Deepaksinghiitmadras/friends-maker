// Types exported for use in VirtualAvatarCanvas and useVirtualCall
export type AvatarActionType =
  | 'idle'
  | 'speaking'
  | 'standing'
  | 'sitting'
  | 'cooking'
  | 'changing_clothes'
  | 'workout'
  | 'wave'
  | 'kiss';

export type OutfitStyle = 'casual' | 'formal' | 'cozy' | 'sporty';

// Actual 3D rendering is handled by VirtualAvatarCanvas using Canvas API + real photos.
export default function ThreeAvatarScene() {
  return null;
}
