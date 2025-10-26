import { useEffect } from "react";
import "./VideoDisplay.css";

function VideoDisplay({ canvasRef, playbackId, audioEngine }) {
  useEffect(() => {
    // Start canvas animation when audio engine is ready
    if (audioEngine && canvasRef.current) {
      audioEngine.startVisualization();
    }
  }, [audioEngine, canvasRef]);

  return (
    <div className="video-display">
      <div className="canvas-container glass-dark">
        <h3>🎨 Audio-Reactive Canvas</h3>
        <canvas
          ref={canvasRef}
          width={512}
          height={384}
          className="audio-canvas"
        />
      </div>

      {playbackId && (
        <div className="stream-container glass-dark">
          <h3>✨ AI-Generated Visuals</h3>
          <iframe
            src={`https://lvpr.tv/?v=${playbackId}&lowLatency=force`}
            className="stream-iframe"
            allow="autoplay"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

export default VideoDisplay;
