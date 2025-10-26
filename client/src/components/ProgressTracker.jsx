import "./ProgressTracker.css";

function ProgressTracker({
  isTranscribing,
  transcriptProgress,
  isCreatingStream,
  streamProgress,
  isGeneratingScenes,
  status,
}) {
  const steps = [
    {
      label: "Transcribing Audio",
      active: isTranscribing,
      progress: transcriptProgress,
      icon: "📝",
    },
    {
      label: "Creating Video Stream",
      active: isCreatingStream,
      progress: streamProgress,
      icon: "🎬",
    },
    {
      label: "Generating Scenes",
      active: isGeneratingScenes,
      progress: 100,
      icon: "✨",
    },
  ];

  const anyActive = isTranscribing || isCreatingStream || isGeneratingScenes;

  return (
    <div className="progress-tracker fade-in">
      <div className="progress-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`progress-step ${step.active ? "active" : ""} ${
              step.progress === 100 ? "completed" : ""
            }`}
          >
            <div className="step-icon">{step.icon}</div>
            <div className="step-content">
              <div className="step-label">{step.label}</div>
              {step.active && (
                <div className="step-progress-bar">
                  <div
                    className="step-progress-fill"
                    style={{ width: `${step.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`status-message ${status.type}`}>
        {anyActive && <div className="loading-spinner" />}
        <span>{status.message}</span>
      </div>
    </div>
  );
}

export default ProgressTracker;
