import { useRef } from "react";
import "./UploadSection.css";

function UploadSection({ onFileUpload }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="upload-section fade-in">
      <div className="upload-card glass">
        <div className="upload-icon">🎙️</div>
        <h2>Upload Your Bedtime Story</h2>
        <p className="upload-description">
          Record or select an audio file of your favorite bedtime story.
          <br />
          We'll bring it to life with magical AI-generated visuals!
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <button className="upload-button" onClick={handleClick}>
          <span className="button-icon">📁</span>
          Choose Audio File
        </button>

        <div className="upload-hints">
          <div className="hint">
            <span className="hint-icon">✨</span>
            <span>Best with clear narration</span>
          </div>
          <div className="hint">
            <span className="hint-icon">⏱️</span>
            <span>1-10 minutes recommended</span>
          </div>
          <div className="hint">
            <span className="hint-icon">🎵</span>
            <span>MP3, WAV, M4A supported</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UploadSection;
