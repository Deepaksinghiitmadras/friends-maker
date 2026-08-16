declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    constructor(node: HTMLElement, options?: Record<string, any>);
    showAvatar(avatar: Record<string, any>, onprogress?: ((progress: number) => void) | null): Promise<void>;
    speakText(text: string, opt?: Record<string, any>, onsubtitles?: ((s: string) => void) | null): void;
    speakAudio(audio: Record<string, any>, opt?: Record<string, any>, onsubtitles?: ((s: string) => void) | null): void;
    streamStart(opt?: Record<string, any>, onAudioStart?: (() => void) | null, onAudioEnd?: (() => void) | null, onSubtitles?: ((s: string) => void) | null, onMetrics?: ((m: any) => void) | null): Promise<void>;
    streamAudio(audio: ArrayBuffer): void;
    streamNotifyEnd(): void;
    streamInterrupt(): void;
    streamStop(): void;
    setView(view: 'full' | 'mid' | 'upper' | 'head', opt?: Record<string, any>): void;
    setMood(mood: 'neutral' | 'happy' | 'angry' | 'sad' | 'fear' | 'disgust' | 'love' | 'sleep'): void;
    setLighting(opt: Record<string, any>): void;
    lookAt(x: number, y: number, t: number): void;
    lookAtCamera(t: number): void;
    lookAhead(t: number): void;
    makeEyeContact(t: number): void;
    playAnimation(url: string, onprogress?: ((p: number) => void) | null, dur?: number, ndx?: number, scale?: number): Promise<void>;
    stopAnimation(): void;
    playBackgroundAudio(url: string): void;
    stopBackgroundAudio(): void;
    speakBreak(t: number): void;
    speakEmoji(e: string): void;
    speakMarker(onmarker: () => void): void;
    setMixerGain(speech: number, background?: number | null, fadeSecs?: number): void;
  }
}
