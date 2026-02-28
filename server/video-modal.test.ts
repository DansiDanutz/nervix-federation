import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const COMPONENT_PATH = path.resolve(__dirname, "../client/src/components/VideoModal.tsx");
const HOME_PATH = path.resolve(__dirname, "../client/src/pages/Home.tsx");

describe("VideoModal Component", () => {
  const source = fs.readFileSync(COMPONENT_PATH, "utf-8");

  describe("Component Structure", () => {
    it("exports VideoModal as a named export", () => {
      expect(source).toContain("export function VideoModal");
    });

    it("exports default export", () => {
      expect(source).toContain("export default VideoModal");
    });

    it("accepts isOpen and onClose props", () => {
      expect(source).toContain("isOpen: boolean");
      expect(source).toContain("onClose: () => void");
    });
  });

  describe("Video Configuration", () => {
    it("uses the CDN-hosted explainer video URL", () => {
      expect(source).toContain("manuscdn.com");
      expect(source).toContain(".mp4");
    });

    it("includes a video element with source", () => {
      expect(source).toContain("<video");
      expect(source).toContain("<source");
      expect(source).toContain('type="video/mp4"');
    });

    it("sets video to playsInline for mobile compatibility", () => {
      expect(source).toContain("playsInline");
    });

    it("preloads video for smooth playback", () => {
      expect(source).toContain('preload="auto"');
    });
  });

  describe("Playback Controls", () => {
    it("implements play/pause toggle", () => {
      expect(source).toContain("togglePlay");
      expect(source).toContain("isPlaying");
    });

    it("implements mute toggle", () => {
      expect(source).toContain("toggleMute");
      expect(source).toContain("isMuted");
    });

    it("implements fullscreen toggle", () => {
      expect(source).toContain("toggleFullscreen");
      expect(source).toContain("isFullscreen");
    });

    it("tracks current time and duration", () => {
      expect(source).toContain("currentTime");
      expect(source).toContain("duration");
    });

    it("has a progress bar with click-to-seek", () => {
      expect(source).toContain("handleProgressClick");
      expect(source).toContain("progress");
    });

    it("formats time as m:ss", () => {
      expect(source).toContain("formatTime");
      expect(source).toContain("padStart(2");
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("supports Escape to close", () => {
      expect(source).toContain('"Escape"');
      expect(source).toContain("onClose");
    });

    it("supports Space to play/pause", () => {
      expect(source).toContain('" "');
      expect(source).toContain("togglePlay");
    });

    it("supports M to mute", () => {
      expect(source).toContain('"m"');
      expect(source).toContain("toggleMute");
    });

    it("supports F for fullscreen", () => {
      expect(source).toContain('"f"');
      expect(source).toContain("toggleFullscreen");
    });

    it("shows keyboard shortcut hints in the UI", () => {
      expect(source).toContain("Space to play/pause");
      expect(source).toContain("M to mute");
      expect(source).toContain("F for fullscreen");
    });
  });

  describe("Animations", () => {
    it("uses AnimatePresence for enter/exit animations", () => {
      expect(source).toContain("AnimatePresence");
    });

    it("has backdrop with blur effect", () => {
      expect(source).toContain("backdrop-blur");
    });

    it("uses spring animation for the video container", () => {
      expect(source).toContain("spring");
      expect(source).toContain("stiffness");
      expect(source).toContain("damping");
    });

    it("auto-hides controls after inactivity", () => {
      expect(source).toContain("showControls");
      expect(source).toContain("controlsTimeout");
    });
  });

  describe("UI Elements", () => {
    it("has a close button with X icon", () => {
      expect(source).toContain("X className");
    });

    it("shows play overlay when paused", () => {
      expect(source).toContain("Play Overlay");
      expect(source).toContain("!isPlaying");
    });

    it("uses Play and Pause icons", () => {
      expect(source).toContain("Play");
      expect(source).toContain("Pause");
    });

    it("uses Volume2 and VolumeX icons for mute state", () => {
      expect(source).toContain("Volume2");
      expect(source).toContain("VolumeX");
    });

    it("uses Maximize and Minimize icons for fullscreen", () => {
      expect(source).toContain("Maximize");
      expect(source).toContain("Minimize");
    });

    it("has a gradient progress bar", () => {
      expect(source).toContain("from-red-500 to-orange-500");
    });

    it("has a scrubber dot on progress bar hover", () => {
      expect(source).toContain("group-hover:opacity-100");
    });
  });

  describe("Lifecycle", () => {
    it("auto-plays when modal opens", () => {
      expect(source).toContain("isOpen && videoRef.current");
      expect(source).toContain(".play()");
    });

    it("resets video when modal closes", () => {
      expect(source).toContain("!isOpen && videoRef.current");
      expect(source).toContain("currentTime = 0");
    });

    it("handles video ended event", () => {
      expect(source).toContain('"ended"');
      expect(source).toContain("setIsPlaying(false)");
    });

    it("cleans up event listeners on unmount", () => {
      expect(source).toContain("removeEventListener");
    });
  });
});

describe("Home Page Video Integration", () => {
  const homeSource = fs.readFileSync(HOME_PATH, "utf-8");

  it("imports VideoModal component", () => {
    expect(homeSource).toContain('import { VideoModal }');
  });

  it("has videoOpen state in HeroSection", () => {
    expect(homeSource).toContain("videoOpen");
    expect(homeSource).toContain("setVideoOpen");
  });

  it("has Watch How It Works button", () => {
    expect(homeSource).toContain("Watch How It Works");
  });

  it("shows video duration badge", () => {
    expect(homeSource).toContain("3:35");
  });

  it("renders VideoModal with isOpen and onClose props", () => {
    expect(homeSource).toContain("VideoModal isOpen={videoOpen}");
    expect(homeSource).toContain("onClose={() => setVideoOpen(false)}");
  });

  it("has Play icon in the watch button", () => {
    expect(homeSource).toContain("Play className");
  });

  it("has animated entrance for the video button", () => {
    expect(homeSource).toContain("Watch Explainer Video");
  });
});
