'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { AvatarActionType, OutfitStyle } from './ThreeAvatarScene';

// ── ReadyPlayerMe avatar URLs (half-body, with ARKit + Oculus visemes) ──────
// Format: https://models.readyplayer.me/{id}.glb?morphTargets=ARKit,Oculus Visemes
export const RPM_AVATAR_URLS: Record<string, string> = {
  // Female avatars
  'elena-rostova':   'https://models.readyplayer.me/6499c42e5a8d1a8d51e8c17e.glb?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024&lod=0',
  'aria-chen':       'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024&lod=0',
  'sophia-martinez': 'https://models.readyplayer.me/638df693d72bffc6fa17943c.glb?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024&lod=0',
  'chloe-bennett':   'https://models.readyplayer.me/6399c4e3d2c73e2dae2a3ab2.glb?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024&lod=0',
  // Male avatars
  'alex-vance':      'https://models.readyplayer.me/6639b7f02a57ec67d82fdf43.glb?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024&lod=0',
  'marcus-cole':     'https://models.readyplayer.me/664de748c3d1f54d86abb1c4.glb?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024&lod=0',
  'leo-sterling':    'https://models.readyplayer.me/6639b7ee2a57ec67d82fdf41.glb?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024&lod=0',
  'ethan-reed':      'https://models.readyplayer.me/6639b7f32a57ec67d82fdf45.glb?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024&lod=0',
};

// ── Oculus Viseme → morph target name mapping ────────────────────────────────
const OCULUS_VISEMES = [
  'viseme_sil','viseme_PP','viseme_FF','viseme_TH','viseme_DD',
  'viseme_kk','viseme_CH','viseme_SS','viseme_nn','viseme_RR',
  'viseme_aa','viseme_E','viseme_ih','viseme_oh','viseme_ou',
];

// ── Action → viseme sequence for activities ──────────────────────────────────
const SPEECH_VISEME_PATTERNS: string[][] = [
  ['viseme_aa', 'viseme_E'],
  ['viseme_oh', 'viseme_ou'],
  ['viseme_PP', 'viseme_aa'],
  ['viseme_FF', 'viseme_E'],
  ['viseme_nn', 'viseme_ih'],
  ['viseme_DD', 'viseme_aa'],
  ['viseme_kk', 'viseme_oh'],
];

interface RealisticAvatarSceneProps {
  personaId: string;
  gender: 'man' | 'woman';
  isSpeaking: boolean;
  isListening: boolean;
  audioLevel: number;
  action: AvatarActionType;
  outfit: OutfitStyle;
  onLoaded?: () => void;
  onError?: () => void;
}

export default function RealisticAvatarScene({
  personaId,
  gender,
  isSpeaking,
  isListening,
  audioLevel,
  action,
  outfit,
  onLoaded,
  onError,
}: RealisticAvatarSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const morphMeshesRef = useRef<THREE.SkinnedMesh[]>([]);
  const bonesRef = useRef<Map<string, THREE.Bone>>(new Map());
  const mousePosRef = useRef({ x: 0, y: 0 });
  const stateRef = useRef({ isSpeaking, audioLevel, action, isListening });
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  // Keep stateRef current without re-triggering setup
  useEffect(() => {
    stateRef.current = { isSpeaking, audioLevel, action, isListening };
  }, [isSpeaking, audioLevel, action, isListening]);

  // Mouse tracking for gaze
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    mousePosRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // ── Helper: safely set morph target influence ───────────────────────────────
  const setMorph = useCallback((name: string, value: number) => {
    for (const mesh of morphMeshesRef.current) {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;
      const idx = mesh.morphTargetDictionary[name];
      if (idx !== undefined) {
        mesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(value, 0, 1);
      }
    }
  }, []);

  const lerpMorph = useCallback((name: string, target: number, alpha: number) => {
    for (const mesh of morphMeshesRef.current) {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;
      const idx = mesh.morphTargetDictionary[name];
      if (idx !== undefined) {
        mesh.morphTargetInfluences[idx] = THREE.MathUtils.lerp(
          mesh.morphTargetInfluences[idx],
          THREE.MathUtils.clamp(target, 0, 1),
          alpha,
        );
      }
    }
  }, []);

  // ── Helper: get bone by name ────────────────────────────────────────────────
  const getBone = (name: string) => bonesRef.current.get(name);

  // ── Main Three.js setup ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = null; // transparent, parent div handles BG
    scene.fog = new THREE.FogExp2(0x0a0a14, 0.08);
    sceneRef.current = scene;

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(28, W / H, 0.01, 100);
    camera.position.set(0, 1.62, 1.4);
    camera.lookAt(0, 1.62, 0);
    cameraRef.current = camera;

    // ── Lights ────────────────────────────────────────────────────────────────
    // Warm key light (left side, like window light)
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 3.5);
    keyLight.position.set(-1.5, 2.5, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    // Cool fill light (right, softer)
    const fillLight = new THREE.DirectionalLight(0xd0e8ff, 1.2);
    fillLight.position.set(1.5, 1.5, 1);
    scene.add(fillLight);

    // Rim / back light (cinematic rim)
    const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // Ambient (very slight, keep scene from being too dark)
    const ambient = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambient);

    // Subtle upward bounce (like reflected light from a table)
    const bounceLight = new THREE.DirectionalLight(0xffe8c0, 0.4);
    bounceLight.position.set(0, -1, 1);
    scene.add(bounceLight);

    // ── Background environment (simple desk scene) ────────────────────────────
    // Bokeh-style blurred backdrop panel
    const bgGeo = new THREE.PlaneGeometry(6, 4);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x0d1117,
      transparent: true,
      opacity: 0.0,
    });
    const bgPlane = new THREE.Mesh(bgGeo, bgMat);
    bgPlane.position.set(0, 1.5, -1.5);
    scene.add(bgPlane);

    // ── Load ReadyPlayerMe GLB avatar ────────────────────────────────────────
    let cancelled = false;

    const loadAvatar = async () => {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js' as any);
        const loader = new GLTFLoader();

        const avatarUrl = RPM_AVATAR_URLS[personaId] || (
          gender === 'woman'
            ? 'https://models.readyplayer.me/6499c42e5a8d1a8d51e8c17e.glb?morphTargets=ARKit,Oculus%20Visemes'
            : 'https://models.readyplayer.me/6639b7f02a57ec67d82fdf43.glb?morphTargets=ARKit,Oculus%20Visemes'
        );

        loader.load(
          avatarUrl,
          (gltf: any) => {
            if (cancelled) return;
            const avatar = gltf.scene;
            scene.add(avatar);

            // Center and position avatar (RPM avatars are full-body, ~1.8m tall)
            const box = new THREE.Box3().setFromObject(avatar);
            const center = box.getCenter(new THREE.Vector3());
            avatar.position.sub(center);
            avatar.position.y = box.min.y * -1 - center.y;
            // Move avatar slightly back so face fills the camera nicely
            avatar.position.z = -0.1;
            // Slight angle (not perfectly forward-facing — more natural)
            avatar.rotation.y = gender === 'woman' ? 0.08 : -0.06;

            // Collect all SkinnedMesh with morph targets
            const skinnedMeshes: THREE.SkinnedMesh[] = [];
            avatar.traverse((node: THREE.Object3D) => {
              if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
                const mesh = node as THREE.SkinnedMesh;
                mesh.castShadow = true;
                if (mesh.morphTargetDictionary) {
                  skinnedMeshes.push(mesh);
                }
              }
              if ((node as THREE.Bone).isBone) {
                bonesRef.current.set(node.name, node as THREE.Bone);
              }
            });
            morphMeshesRef.current = skinnedMeshes;

            // Set default rest expression — slight smile
            setMorph('mouthSmileLeft', 0.18);
            setMorph('mouthSmileRight', 0.18);
            setMorph('browInnerUp', 0.05);

            // Animation mixer
            if (gltf.animations && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(avatar);
              mixerRef.current = mixer;
              const idleClip = gltf.animations[0];
              const action = mixer.clipAction(idleClip);
              action.play();
            }

            setLoadStatus('loaded');
            onLoaded?.();
          },
          undefined,
          (_err: any) => {
            if (cancelled) return;
            console.warn('RPM avatar load failed, using fallback');
            setLoadStatus('error');
            onError?.();
          },
        );
      } catch (e) {
        if (cancelled) return;
        setLoadStatus('error');
        onError?.();
      }
    };

    loadAvatar();

    // ── Animation state ───────────────────────────────────────────────────────
    let blinkTimer = 0;
    let blinkState = 0; // 0=open, 1=closing, 2=opening
    let blinkProgress = 0;
    let blinkInterval = 3 + Math.random() * 4;
    let visemeTimer = 0;
    let visemePatternIdx = 0;
    let visemeStepIdx = 0;
    const BASE_CAMERA_Y = 1.62;
    const BASE_CAMERA_Z = 1.4;
    let cameraTargetY = BASE_CAMERA_Y;
    let cameraTargetZ = BASE_CAMERA_Z;

    // ── Main render loop ──────────────────────────────────────────────────────
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = clockRef.current.getDelta();
      const t = clockRef.current.getElapsedTime();
      const { isSpeaking: speaking, audioLevel: level, action: act } = stateRef.current;

      // ── Camera target based on action ──────────────────────────────────────
      if (act === 'standing') {
        cameraTargetY = 1.2; cameraTargetZ = 2.2; // zoom out to show body
      } else if (act === 'sitting') {
        cameraTargetY = 1.3; cameraTargetZ = 2.0;
      } else if (act === 'kiss') {
        cameraTargetY = 1.72; cameraTargetZ = 0.9; // tight close-up on face
      } else if (act === 'cooking') {
        cameraTargetY = 1.4; cameraTargetZ = 1.8; // show upper body with arms
      } else {
        cameraTargetY = BASE_CAMERA_Y; cameraTargetZ = BASE_CAMERA_Z;
      }
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraTargetY, 0.04);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, cameraTargetZ, 0.04);
      camera.lookAt(0, cameraTargetY - 0.02, 0);

      // ── Head gaze tracking ─────────────────────────────────────────────────
      const headBone = getBone('Head') || getBone('head');
      if (headBone) {
        const targetRotX = -mousePosRef.current.y * 0.18;
        const targetRotY = mousePosRef.current.x * 0.22;
        headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, targetRotX, 0.05);
        headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, targetRotY, 0.05);
      }

      // ── Breathing animation (Spine bones) ─────────────────────────────────
      const breathAmt = Math.sin(t * 0.4) * 0.008;
      const spine2 = getBone('Spine2') || getBone('spine2');
      if (spine2) spine2.rotation.x = breathAmt;
      const neck = getBone('Neck') || getBone('neck');
      if (neck) {
        neck.rotation.x = Math.sin(t * 0.4) * 0.003;
        // Subtle head tilt bob
        neck.rotation.z = Math.sin(t * 0.28) * 0.012;
      }

      // ── Eye blinking ──────────────────────────────────────────────────────
      blinkTimer += dt;
      if (blinkState === 0 && blinkTimer >= blinkInterval) {
        blinkState = 1; blinkProgress = 0; blinkTimer = 0;
        blinkInterval = 3 + Math.random() * 5;
      }
      if (blinkState === 1) {
        blinkProgress += dt * 14;
        const v = Math.min(blinkProgress, 1);
        setMorph('eyeBlinkLeft', v);
        setMorph('eyeBlinkRight', v + (Math.random() < 0.1 ? 0.05 : 0));
        if (blinkProgress >= 1) { blinkState = 2; blinkProgress = 0; }
      } else if (blinkState === 2) {
        blinkProgress += dt * 12;
        const v = Math.max(1 - blinkProgress, 0);
        setMorph('eyeBlinkLeft', v);
        setMorph('eyeBlinkRight', v);
        if (blinkProgress >= 1) { blinkState = 0; blinkProgress = 0; }
      }

      // ── Eye gaze (subtle follow mouse with bone-less morph fallback) ───────
      const gazeX = mousePosRef.current.x * 0.15;
      const gazeY = -mousePosRef.current.y * 0.08;
      lerpMorph('eyeLookInLeft',   Math.max(0, -gazeX) * 0.5, 0.06);
      lerpMorph('eyeLookOutLeft',  Math.max(0,  gazeX) * 0.5, 0.06);
      lerpMorph('eyeLookInRight',  Math.max(0,  gazeX) * 0.5, 0.06);
      lerpMorph('eyeLookOutRight', Math.max(0, -gazeX) * 0.5, 0.06);
      lerpMorph('eyeLookUpLeft',   Math.max(0,  gazeY) * 0.4, 0.06);
      lerpMorph('eyeLookUpRight',  Math.max(0,  gazeY) * 0.4, 0.06);
      lerpMorph('eyeLookDownLeft', Math.max(0, -gazeY) * 0.4, 0.06);
      lerpMorph('eyeLookDownRight',Math.max(0, -gazeY) * 0.4, 0.06);

      // ── Lip sync / visemes ────────────────────────────────────────────────
      if (speaking) {
        // jawOpen driven by audio amplitude
        lerpMorph('jawOpen', level * 0.72 + Math.sin(t * 12) * 0.06, 0.25);

        // Cycle through viseme patterns for natural look
        visemeTimer += dt;
        if (visemeTimer >= 0.14) {
          visemeTimer = 0;
          // Clear previous visemes
          for (const v of OCULUS_VISEMES) lerpMorph(v, 0, 0.5);

          // Pick next viseme from pattern
          const pattern = SPEECH_VISEME_PATTERNS[visemePatternIdx % SPEECH_VISEME_PATTERNS.length];
          const viseme = pattern[visemeStepIdx % pattern.length];
          lerpMorph(viseme, 0.6 + level * 0.4, 0.4);

          visemeStepIdx++;
          if (visemeStepIdx >= pattern.length) {
            visemeStepIdx = 0;
            visemePatternIdx = (visemePatternIdx + 1) % SPEECH_VISEME_PATTERNS.length;
          }
        }

        // Subtle expression lift when speaking (raised brows, wider eyes)
        lerpMorph('browInnerUp', 0.1 + level * 0.2, 0.08);
        lerpMorph('eyeWideLeft', level * 0.12, 0.1);
        lerpMorph('eyeWideRight', level * 0.12, 0.1);
      } else {
        // Return mouth to rest
        lerpMorph('jawOpen', 0, 0.15);
        for (const v of OCULUS_VISEMES) lerpMorph(v, 0, 0.12);
        lerpMorph('browInnerUp', 0.05, 0.08);
        lerpMorph('eyeWideLeft', 0, 0.08);
        lerpMorph('eyeWideRight', 0, 0.08);

        // Resting micro-smile
        lerpMorph('mouthSmileLeft', 0.18, 0.05);
        lerpMorph('mouthSmileRight', 0.18, 0.05);
      }

      // ── Listening expression ──────────────────────────────────────────────
      if (stateRef.current.isListening) {
        lerpMorph('browInnerUp', 0.2, 0.06);
        lerpMorph('mouthSmileLeft', 0.22, 0.06);
        lerpMorph('mouthSmileRight', 0.22, 0.06);
      }

      // ── Activity-based bone animations ────────────────────────────────────
      const rightArm = getBone('RightArm') || getBone('mixamorigRightArm');
      const rightForeArm = getBone('RightForeArm') || getBone('mixamorigRightForeArm');
      const rightHand = getBone('RightHand') || getBone('mixamorigRightHand');
      const hips = getBone('Hips') || getBone('mixamorigHips');
      const leftArm = getBone('LeftArm') || getBone('mixamorigLeftArm');

      if (act === 'wave' && rightArm && rightForeArm) {
        rightArm.rotation.z = -1.0 + Math.sin(t * 5) * 0.1;
        rightArm.rotation.x = -0.3;
        rightForeArm.rotation.z = Math.sin(t * 8) * 0.55; // waving
        lerpMorph('mouthSmileLeft', 0.5, 0.06);
        lerpMorph('mouthSmileRight', 0.5, 0.06);
      } else if (act === 'cooking' && rightArm && rightForeArm) {
        rightArm.rotation.x = -0.6 + Math.sin(t * 1.5) * 0.05;
        rightArm.rotation.z = -0.4;
        rightForeArm.rotation.x = -0.5;
        // Stirring motion on hand
        if (rightHand) rightHand.rotation.z = Math.sin(t * 3) * 0.4;
      } else if (act === 'workout') {
        // Pump arms alternately
        if (rightArm) rightArm.rotation.x = -1.0 + Math.sin(t * 5) * 0.8;
        if (leftArm) leftArm.rotation.x = -1.0 - Math.sin(t * 5) * 0.8;
        if (hips) hips.position.y = Math.abs(Math.sin(t * 4)) * 0.03;
        lerpMorph('browDownLeft', 0.3, 0.05);
        lerpMorph('browDownRight', 0.3, 0.05);
      } else if (act === 'kiss') {
        // Pucker expression
        lerpMorph('mouthPucker', 0.8, 0.08);
        lerpMorph('mouthSmileLeft', 0, 0.08);
        lerpMorph('mouthSmileRight', 0, 0.08);
        lerpMorph('cheekPuff', 0.2, 0.08);
      } else if (act === 'changing_clothes') {
        // Arms move as if adjusting outfit
        if (rightArm) rightArm.rotation.x = Math.sin(t * 2) * 0.4 - 0.3;
        if (leftArm) leftArm.rotation.x = Math.sin(t * 2 + Math.PI) * 0.4 - 0.3;
      } else {
        // Return arms to rest position
        if (rightArm) {
          rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, 0.04);
          rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, 0.04);
        }
        if (leftArm) {
          leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, 0.04);
        }
        if (hips) hips.position.y = THREE.MathUtils.lerp(hips.position.y, 0, 0.04);
        if (rightHand) {
          rightHand.rotation.z = THREE.MathUtils.lerp(rightHand.rotation.z, 0, 0.04);
        }
        // Return morphs to neutral in all other actions
        lerpMorph('mouthPucker', 0, 0.06);
        lerpMorph('cheekPuff', 0, 0.06);
        lerpMorph('browDownLeft', 0, 0.05);
        lerpMorph('browDownRight', 0, 0.05);
      }

      // ── Mixer update (idle animations if loaded) ──────────────────────────
      if (mixerRef.current) mixerRef.current.update(dt * 0.3);

      renderer.render(scene, camera);
    };

    animate();

    // ── Resize handler ────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current?.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry?.dispose();
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else (mat as THREE.Material)?.dispose();
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId, gender]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: 'transparent' }}
    >
      {loadStatus === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black z-10">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-pink-400 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
          </div>
          <p className="mt-4 text-purple-300 text-sm font-medium animate-pulse">
            Loading 3D Avatar…
          </p>
          <p className="mt-1 text-gray-500 text-xs">
            Powered by ReadyPlayerMe + Three.js
          </p>
        </div>
      )}
    </div>
  );
}
