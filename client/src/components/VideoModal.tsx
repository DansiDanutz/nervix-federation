import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, X, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

const VIDEO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/gwIIZYPIWOFnFOwN.mp4";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VideoModal({ isOpen, onClose }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    const container = videoRef.current?.parentElement?.parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / video.duration) * 100);
    };
    const onLoadedMetadata = () => setDuration(video.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("ended", onEnded);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      if (e.key === "m") toggleMute();
      if (e.key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, togglePlay, toggleMute, toggleFullscreen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Video Container */}
          <motion.div
            className="relative w-[90vw] max-w-5xl aspect-video rounded-2xl overflow-hidden border border-red-500/30 shadow-2xl shadow-red-500/20"
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover cursor-pointer"
              onClick={togglePlay}
              playsInline
              preload="auto"
            >
              <source src={VIDEO_URL} type="video/mp4" />
            </video>

            {/* Play Overlay (when paused) */}
            <AnimatePresence>
              {!isPlaying && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                  onClick={togglePlay}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="w-20 h-20 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg shadow-red-500/40"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls Bar */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-4 pt-12"
              initial={false}
              animate={{ opacity: showControls ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Progress Bar */}
              <div
                ref={progressRef}
                className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group hover:h-2.5 transition-all"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full relative transition-all"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Controls Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="p-1.5 text-white/90 hover:text-white transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" fill="white" />
                    ) : (
                      <Play className="w-5 h-5" fill="white" />
                    )}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="p-1.5 text-white/90 hover:text-white transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-xs text-white/70 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/50 hidden sm:inline">
                    Space to play/pause · M to mute · F for fullscreen
                  </span>
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 text-white/90 hover:text-white transition-colors"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5" />
                    ) : (
                      <Maximize className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default VideoModal;
