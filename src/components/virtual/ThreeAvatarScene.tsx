'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VirtualPersona } from '@/lib/virtualPersonas';

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

interface ThreeAvatarSceneProps {
  persona: VirtualPersona;
  isSpeaking: boolean;
  audioLevel: number; // 0 to 1
  action: AvatarActionType;
  outfit: OutfitStyle;
}

export default function ThreeAvatarScene({
  persona,
  isSpeaking,
  audioLevel,
  action,
  outfit,
}: ThreeAvatarSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    isSpeaking,
    audioLevel,
    action,
    outfit,
    mouseX: 0,
    mouseY: 0,
  });

  // Keep stateRef up to date
  useEffect(() => {
    stateRef.current.isSpeaking = isSpeaking;
    stateRef.current.audioLevel = audioLevel;
    stateRef.current.action = action;
    stateRef.current.outfit = outfit;
  }, [isSpeaking, audioLevel, action, outfit]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── 1. SCENE & RENDERER SETUP ───────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f111a);
    scene.fog = new THREE.FogExp2(0x0f111a, 0.08);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.35, 2.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ── 2. LIGHTING RIG (STUDIO & CINEMATIC RIM) ─────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.2);
    keyLight.position.set(1.5, 3.5, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8eb6ff, 1.2);
    fillLight.position.set(-2, 1.5, 1.5);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0xff77aa, 3.5, 10, Math.PI / 4, 0.5, 1);
    rimLight.position.set(0, 3, -2);
    rimLight.target.position.set(0, 1.2, 0);
    scene.add(rimLight);
    scene.add(rimLight.target);

    // ── 3. COZY APARTMENT / STUDIO BACKDROP ──────────────────────────────────
    const roomGroup = new THREE.Group();

    // Back wall
    const wallGeo = new THREE.PlaneGeometry(10, 6);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x181a26,
      roughness: 0.85,
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 2, -2.5);
    backWall.receiveShadow = true;
    roomGroup.add(backWall);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(10, 10);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x12141c,
      roughness: 0.6,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    floor.receiveShadow = true;
    roomGroup.add(floor);

    // Ambient Warm Lamp on side
    const lampGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.4, 16);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffcc88,
      emissive: 0xffaa44,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(-1.8, 1.8, -1.8);
    roomGroup.add(lamp);

    const lampLight = new THREE.PointLight(0xffaa44, 2, 4);
    lampLight.position.copy(lamp.position);
    roomGroup.add(lampLight);

    scene.add(roomGroup);

    // ── 4. CONSTRUCT 3D AVATAR MODEL (HEAD, BODY, MORPH TARGETS) ─────────────
    const isFemale = persona.gender === 'woman';
    const avatarGroup = new THREE.Group();

    // Skin Tone Palette
    const skinColor = isFemale ? 0xfcd0ba : 0xdfb092;
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.55,
      metalness: 0.05,
    });

    // Hair Material
    const hairColor = isFemale ? 0x221714 : 0x1c1917;
    const hairMaterial = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.7,
    });

    // Outfit Materials by Style
    const getOutfitMaterial = (style: OutfitStyle) => {
      let color = 0x6366f1; // casual default indigo
      let roughness = 0.6;
      if (style === 'formal') {
        color = isFemale ? 0xbe123c : 0x0f172a; // elegant ruby or sleek black
        roughness = 0.3;
      } else if (style === 'cozy') {
        color = 0xd97706; // warm knitted amber
        roughness = 0.9;
      } else if (style === 'sporty') {
        color = 0x0284c7; // dynamic cyan athletic
        roughness = 0.4;
      }
      return new THREE.MeshStandardMaterial({ color, roughness });
    };

    const clothesMaterial = getOutfitMaterial(stateRef.current.outfit);

    // ── TORSO & SHOULDERS ──
    const torsoGeo = new THREE.CylinderGeometry(
      isFemale ? 0.24 : 0.3,
      isFemale ? 0.22 : 0.28,
      0.75,
      32
    );
    const torsoMesh = new THREE.Mesh(torsoGeo, clothesMaterial);
    torsoMesh.position.set(0, 0.65, 0);
    torsoMesh.castShadow = true;
    avatarGroup.add(torsoMesh);

    // Collar / Neck
    const neckGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.22, 24);
    const neckMesh = new THREE.Mesh(neckGeo, skinMaterial);
    neckMesh.position.set(0, 1.08, 0);
    avatarGroup.add(neckMesh);

    // ── HEAD GROUP ──
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.28, 0);

    // Head Base Shape
    const headGeo = new THREE.SphereGeometry(
      0.19,
      32,
      32
    );
    headGeo.scale(1, 1.18, 1.05);
    const headMesh = new THREE.Mesh(headGeo, skinMaterial);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Hair
    if (isFemale) {
      // Flowing Long Hair
      const hairTopGeo = new THREE.SphereGeometry(0.205, 32, 24);
      hairTopGeo.scale(1.04, 1.12, 1.08);
      const hairTop = new THREE.Mesh(hairTopGeo, hairMaterial);
      hairTop.position.set(0, 0.05, -0.02);
      headGroup.add(hairTop);

      const hairSidesGeo = new THREE.CylinderGeometry(0.21, 0.23, 0.6, 24);
      const hairSides = new THREE.Mesh(hairSidesGeo, hairMaterial);
      hairSides.position.set(0, -0.15, -0.06);
      headGroup.add(hairSides);
    } else {
      // Modern Styled Hair
      const hairGeo = new THREE.SphereGeometry(0.205, 24, 24);
      hairGeo.scale(1.02, 1.1, 1.06);
      const hairMesh = new THREE.Mesh(hairGeo, hairMaterial);
      hairMesh.position.set(0, 0.06, -0.02);
      headGroup.add(hairMesh);
    }

    // ── EYES ──
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const irisMat = new THREE.MeshStandardMaterial({
      color: 0x4b2a1a, // warm hazel/brown
      roughness: 0.2,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

    const createEye = (xPos: number) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(xPos, 0.04, 0.165);

      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 16), eyeWhiteMat);
      eyeGroup.add(eyeWhite);

      const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.005, 16), irisMat);
      iris.rotation.x = Math.PI / 2;
      iris.position.set(0, 0, 0.03);
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 16), pupilMat);
      pupil.rotation.x = Math.PI / 2;
      pupil.position.set(0, 0, 0.032);
      eyeGroup.add(pupil);

      return eyeGroup;
    };

    const leftEye = createEye(-0.065);
    const rightEye = createEye(0.065);
    headGroup.add(leftEye);
    headGroup.add(rightEye);

    // Eyelids (For natural blinking)
    const eyelidGeo = new THREE.SphereGeometry(0.034, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const leftEyelid = new THREE.Mesh(eyelidGeo, skinMaterial);
    leftEyelid.position.set(-0.065, 0.045, 0.166);
    leftEyelid.rotation.x = Math.PI / 2;
    leftEyelid.scale.set(1, 1, 0.05); // Closed when scale.z is 1
    headGroup.add(leftEyelid);

    const rightEyelid = new THREE.Mesh(eyelidGeo, skinMaterial);
    rightEyelid.position.set(0.065, 0.045, 0.166);
    rightEyelid.rotation.x = Math.PI / 2;
    rightEyelid.scale.set(1, 1, 0.05);
    headGroup.add(rightEyelid);

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.045, 0.008, 0.01);
    const browMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.8 });
    const leftBrow = new THREE.Mesh(browGeo, browMat);
    leftBrow.position.set(-0.065, 0.095, 0.175);
    leftBrow.rotation.z = 0.05;
    headGroup.add(leftBrow);

    const rightBrow = new THREE.Mesh(browGeo, browMat);
    rightBrow.position.set(0.065, 0.095, 0.175);
    rightBrow.rotation.z = -0.05;
    headGroup.add(rightBrow);

    // ── NOSE ──
    const noseGeo = new THREE.ConeGeometry(0.022, 0.06, 16);
    const noseMesh = new THREE.Mesh(noseGeo, skinMaterial);
    noseMesh.rotation.x = Math.PI / 6;
    noseMesh.position.set(0, -0.01, 0.19);
    headGroup.add(noseMesh);

    // ── MOUTH & LIPS (MORPH TARGETS FOR 60 FPS LIP-SYNC) ──
    const upperLipGeo = new THREE.CylinderGeometry(0.035, 0.038, 0.01, 16);
    upperLipGeo.scale(1, 0.4, 0.5);
    const lipColor = isFemale ? 0xcc4455 : 0xaa5555;
    const lipMat = new THREE.MeshStandardMaterial({ color: lipColor, roughness: 0.4 });
    const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
    upperLip.position.set(0, -0.075, 0.182);
    headGroup.add(upperLip);

    const lowerLipGeo = new THREE.CylinderGeometry(0.032, 0.036, 0.012, 16);
    lowerLipGeo.scale(1, 0.5, 0.5);
    const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat);
    lowerLip.position.set(0, -0.095, 0.18);
    headGroup.add(lowerLip);

    // Mouth Cavity / Smile
    const mouthCavityGeo = new THREE.BoxGeometry(0.04, 0.02, 0.02);
    const mouthCavityMat = new THREE.MeshBasicMaterial({ color: 0x220505 });
    const mouthCavity = new THREE.Mesh(mouthCavityGeo, mouthCavityMat);
    mouthCavity.position.set(0, -0.085, 0.175);
    mouthCavity.scale.set(0.1, 0.1, 0.1);
    headGroup.add(mouthCavity);

    avatarGroup.add(headGroup);

    // ── ARMS & HANDS (FOR WAVING / COFFEE / WORKOUT) ──
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.35, 0.95, 0);

    const leftArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.055, 0.55, 16),
      clothesMaterial
    );
    leftArm.position.set(0, -0.25, 0);
    leftArmGroup.add(leftArm);

    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), skinMaterial);
    leftHand.position.set(0, -0.55, 0);
    leftArmGroup.add(leftHand);

    avatarGroup.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.35, 0.95, 0);

    const rightArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.055, 0.55, 16),
      clothesMaterial
    );
    rightArm.position.set(0, -0.25, 0);
    rightArmGroup.add(rightArm);

    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), skinMaterial);
    rightHand.position.set(0, -0.55, 0);
    rightArmGroup.add(rightHand);

    // Coffee Mug Prop (Active during 'cooking' / 'making_coffee')
    const mugGroup = new THREE.Group();
    const mugBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.04, 0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    mugGroup.add(mugBody);
    const mugHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    mugHandle.position.set(0.045, 0, 0);
    mugHandle.rotation.z = -Math.PI / 2;
    mugGroup.add(mugHandle);
    mugGroup.position.set(0, -0.55, 0.08);
    mugGroup.visible = false;
    rightArmGroup.add(mugGroup);

    scene.add(avatarGroup);

    // ── 5. MOUSE / CAMERA TRACKING ───────────────────────────────────────────
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      stateRef.current.mouseX = THREE.MathUtils.clamp(x, -1, 1);
      stateRef.current.mouseY = THREE.MathUtils.clamp(y, -1, 1);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // ── 6. 60 FPS ANIMATION LOOP (LIP-SYNC, BLINKING, ACTIONS) ───────────────
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;
    let actionTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      const { isSpeaking: speaking, audioLevel: level, action: curAction, mouseX, mouseY, outfit: curOutfit } =
        stateRef.current;

      // Update Outfit Material dynamically
      const activeOutfitMat = getOutfitMaterial(curOutfit);
      torsoMesh.material = activeOutfitMat;
      leftArm.material = activeOutfitMat;
      rightArm.material = activeOutfitMat;

      // ── Natural Eye Gaze & Head Tilting (Damped Following) ──
      const targetHeadRotY = mouseX * 0.25;
      const targetHeadRotX = -mouseY * 0.15;
      headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetHeadRotY, 0.08);
      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetHeadRotX, 0.08);

      // Eye pupil tracking
      leftEye.rotation.y = mouseX * 0.2;
      leftEye.rotation.x = -mouseY * 0.15;
      rightEye.rotation.y = mouseX * 0.2;
      rightEye.rotation.x = -mouseY * 0.15;

      // ── Natural Breathing ──
      const breathing = Math.sin(time * 2.2) * 0.015;
      torsoMesh.scale.set(1 + breathing * 0.5, 1 + breathing, 1 + breathing * 0.5);
      headGroup.position.y = 1.28 + breathing * 0.3;

      // ── Natural Random Blinking ──
      blinkTimer += delta;
      if (blinkTimer > 3.2 + Math.random() * 2) {
        isBlinking = true;
        blinkTimer = 0;
      }
      if (isBlinking) {
        leftEyelid.scale.z = THREE.MathUtils.lerp(leftEyelid.scale.z, 1.2, 0.4);
        rightEyelid.scale.z = THREE.MathUtils.lerp(rightEyelid.scale.z, 1.2, 0.4);
        if (leftEyelid.scale.z > 1.1) isBlinking = false;
      } else {
        leftEyelid.scale.z = THREE.MathUtils.lerp(leftEyelid.scale.z, 0.05, 0.25);
        rightEyelid.scale.z = THREE.MathUtils.lerp(rightEyelid.scale.z, 0.05, 0.25);
      }

      // ── 60 FPS Audio-Synchronized Lip-Sync ──
      if (speaking) {
        const mouthOpenTarget = Math.min(1, Math.max(0.15, level * 2.5 + Math.sin(time * 18) * 0.35));
        lowerLip.position.y = THREE.MathUtils.lerp(lowerLip.position.y, -0.095 - mouthOpenTarget * 0.025, 0.35);
        mouthCavity.scale.set(1 + level * 0.5, mouthOpenTarget * 1.5, 1);
        headGroup.rotation.z = Math.sin(time * 6) * 0.025; // Subtle head cadence
      } else {
        lowerLip.position.y = THREE.MathUtils.lerp(lowerLip.position.y, -0.095, 0.2);
        mouthCavity.scale.set(0.1, 0.1, 0.1);
        headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, 0, 0.1);
      }

      // ── REAL-LIFE ACTIVITIES DISPATCHER ──
      actionTime += delta;
      mugGroup.visible = curAction === 'cooking';

      if (curAction === 'standing') {
        // Camera moves back, avatar stands up
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 3.4, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.2, 0.05);
        avatarGroup.position.y = THREE.MathUtils.lerp(avatarGroup.position.y, 0, 0.08);
      } else if (curAction === 'sitting') {
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 2.2, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.35, 0.05);
        avatarGroup.position.y = THREE.MathUtils.lerp(avatarGroup.position.y, -0.15, 0.08);
      } else if (curAction === 'wave') {
        // Waving right hand
        rightArmGroup.rotation.z = THREE.MathUtils.lerp(rightArmGroup.rotation.z, 2.4 + Math.sin(time * 10) * 0.35, 0.15);
        rightArmGroup.rotation.x = 0.3;
        leftBrow.position.y = 0.105;
        rightBrow.position.y = 0.105;
      } else if (curAction === 'cooking') {
        // Preparing/holding coffee mug
        rightArmGroup.rotation.z = THREE.MathUtils.lerp(rightArmGroup.rotation.z, 1.1, 0.1);
        rightArmGroup.rotation.x = THREE.MathUtils.lerp(rightArmGroup.rotation.x, -0.8 + Math.sin(time * 2) * 0.1, 0.1);
      } else if (curAction === 'workout') {
        // Workout situps / arm curls
        const workoutSin = Math.sin(time * 5);
        leftArmGroup.rotation.x = workoutSin * 0.8;
        rightArmGroup.rotation.x = -workoutSin * 0.8;
        avatarGroup.position.y = Math.abs(workoutSin) * 0.1;
      } else if (curAction === 'kiss') {
        // Leaning in close to camera with pucker
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 1.7, 0.08);
        lowerLip.position.z = 0.19;
        upperLip.position.z = 0.192;
        leftEye.rotation.x = 0.1;
        rightEye.rotation.x = 0.1;
      } else {
        // Default Idle
        rightArmGroup.rotation.z = THREE.MathUtils.lerp(rightArmGroup.rotation.z, 0, 0.1);
        rightArmGroup.rotation.x = THREE.MathUtils.lerp(rightArmGroup.rotation.x, 0, 0.1);
        leftArmGroup.rotation.z = THREE.MathUtils.lerp(leftArmGroup.rotation.z, 0, 0.1);
        leftArmGroup.rotation.x = THREE.MathUtils.lerp(leftArmGroup.rotation.x, 0, 0.1);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 2.2, 0.05);
      }

      renderer.render(scene, camera);
    };

    animate();

    // ── 7. RESIZE LISTENER ───────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [persona]);

  return <div ref={containerRef} className="w-full h-full relative overflow-hidden" />;
}
