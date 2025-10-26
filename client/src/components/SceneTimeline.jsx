import "./SceneTimeline.css";

function SceneTimeline({ scenes, currentScene, currentTime }) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="scene-timeline glass-dark">
      <h3>🎬 Scene Timeline</h3>
      <div className="scenes-list">
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            className={`scene-item ${index === currentScene ? "active" : ""}`}
          >
            <div className="scene-header">
              <span className="scene-number">Scene {index + 1}</span>
              <span className="scene-time">
                {formatTime(scene.startSec)} - {formatTime(scene.endSec)}
              </span>
            </div>
            <div className="scene-prompt">{scene.prompt}</div>
            {index === currentScene && (
              <div className="scene-progress">
                <div
                  className="scene-progress-fill"
                  style={{
                    width: `${
                      ((currentTime - scene.startSec) /
                        (scene.endSec - scene.startSec)) *
                      100
                    }%`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SceneTimeline;
