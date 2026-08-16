// Types exported for use in VirtualAvatarCanvas and useVirtualCall
export type AvatarActionType =
  | 'idle'
  | 'speaking'
  | 'standing'
  | 'sitting'
  | 'coffee'
  | 'cooking'
  | 'changing_clothes'
  | 'workout'
  | 'wave'
  | 'kiss'
  | 'laugh'
  | 'blush'
  | 'cheers'
  | 'cozy'
  | 'lean_in'
  | 'thinking'
  | 'hair_flip'
  | 'wink'
  | 'heart_hands'
  | 'phone';

export type OutfitStyle = 'casual' | 'formal' | 'cozy' | 'sporty';

// Actual 3D rendering is handled by VirtualAvatarCanvas using Canvas API + real photos.
export default function ThreeAvatarScene() {
  return null;
}
