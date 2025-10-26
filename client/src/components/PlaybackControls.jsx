import "./PlaybackControls.css";

function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onSeek,
  canPlay = true,
}) {
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeekChange = (e) => {
    const time = parseFloat(e.target.value);
    onSeek(time);
  };

  return (
    <div className="playback-controls glass-dark">
      <button
        className="play-button"
        onClick={isPlaying ? onPause : onPlay}
        disabled={!canPlay}
      >
        {isPlaying ? (
          <>
            <span className="button-icon">⏸️</span>
            Pause Story
          </>
        ) : (
          <>
            <span className="button-icon">▶️</span>
            Play Story
          </>
        )}
      </button>

      <div className="seek-section">
        <div className="time-display">
          <span className="time-current">{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span className="time-total">{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          className="seek-slider"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeekChange}
          step="0.1"
        />
      </div>
    </div>
  );
}

export default PlaybackControls;
