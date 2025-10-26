import { useState, useEffect, useRef } from "react";
import "./App.css";
import AudioEngine from "./utils/AudioEngine";
import SceneScheduler from "./utils/SceneScheduler";
import Header from "./components/Header";
import UploadSection from "./components/UploadSection";
import ProgressTracker from "./components/ProgressTracker";
import VideoDisplay from "./components/VideoDisplay";
import SceneTimeline from "./components/SceneTimeline";
import PlaybackControls from "./components/PlaybackControls";

const API_BASE_URL = "/api";

function App() {
  const [apiKey, setApiKey] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [status, setStatus] = useState({
    message: "Upload a bedtime story to begin",
    type: "info",
  });

  // Processing state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptProgress, setTranscriptProgress] = useState(0);
  const [isCreatingStream, setIsCreatingStream] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);

  // Data state
  const [transcript, setTranscript] = useState(null);
  const [streamId, setStreamId] = useState(null);
  const [playbackId, setPlaybackId] = useState(null);
  const [scenePlan, setScenePlan] = useState(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);

  // Refs
  const audioEngineRef = useRef(null);
  const schedulerRef = useRef(null);
  const canvasRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Load API key from server on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Initialize audio engine when canvas is ready
  useEffect(() => {
    if (canvasRef.current && !audioEngineRef.current) {
      console.log("🎨 Initializing AudioEngine...");
      audioEngineRef.current = new AudioEngine(canvasRef.current);
      console.log("✅ AudioEngine initialized:", audioEngineRef.current);
    }
  }, [canvasRef.current]);

  const loadConfig = async () => {
    try {
      const res = await fetch("/config");
      if (res.ok) {
        const config = await res.json();
        if (config.apiKey) {
          setApiKey(config.apiKey);
          updateStatus("Ready! Upload a bedtime story audio file.", "success");
        }
      }
    } catch (e) {
      console.warn("Could not load config:", e.message);
    }
  };

  const updateStatus = (message, type = "info") => {
    setStatus({ message, type });
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;

    setAudioFile(file);
    updateStatus("Processing your bedtime story...", "info");

    // Wait a moment to ensure AudioEngine is initialized
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Load audio into engine
    if (!audioEngineRef.current) {
      console.error("❌ AudioEngine not initialized yet!");
      updateStatus("Initializing audio engine...", "warning");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (audioEngineRef.current) {
      console.log("=== Loading Audio File ===");
      console.log("File:", file.name, file.size, "bytes");
      console.log("AudioEngine exists:", !!audioEngineRef.current);

      try {
        const success = await audioEngineRef.current.loadAudioFile(file);
        console.log("Load success:", success);
        console.log(
          "Audio element after load:",
          audioEngineRef.current.audioElement
        );

        if (success && audioEngineRef.current.audioElement) {
          const duration = audioEngineRef.current.audioElement.duration;
          setDuration(duration);
          console.log("✅ Duration set to:", duration, "seconds");
        } else {
          console.error("❌ Failed to load audio file - success:", success);
          updateStatus("Failed to load audio. Please try again.", "error");
          return;
        }
      } catch (error) {
        console.error("❌ Error loading audio:", error);
        updateStatus("Error loading audio: " + error.message, "error");
        return;
      }
      console.log("========================");
    } else {
      console.error("❌ AudioEngine still not available!");
      updateStatus("Audio engine initialization failed", "error");
      return;
    }

    // Start parallel operations
    Promise.all([transcribeAudio(file), createStream()])
      .then(() => {
        // Don't update status here - let generateScenes handle the final message
        console.log("All processing complete!");
      })
      .catch((err) => {
        updateStatus(`Error: ${err.message}`, "error");
      });
  };

  // Transcribe audio
  const transcribeAudio = async (file) => {
    setIsTranscribing(true);
    setTranscriptProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();

      setTranscriptProgress(20);
      updateStatus("Uploading audio for transcription...", "info");

      const uploadRes = await fetch("/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: arrayBuffer,
      });

      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

      const { transcript_id } = await uploadRes.json();
      setTranscriptProgress(40);
      updateStatus("Transcribing story (this may take a minute)...", "info");

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempts++;
        setTranscriptProgress(40 + (attempts / maxAttempts) * 40);

        const statusRes = await fetch(`/transcribe/${transcript_id}`);
        const result = await statusRes.json();

        if (result.status === "completed") {
          setTranscript({
            text: result.text,
            duration: result.audio_duration,
            id: transcript_id,
          });
          setTranscriptProgress(100);
          setIsTranscribing(false);
          updateStatus("Transcript ready!", "success");

          // Generate scenes
          await generateScenes(transcript_id, result.audio_duration);
          return;
        } else if (result.status === "error") {
          throw new Error(result.error || "Transcription failed");
        }
      }

      throw new Error("Transcription timeout");
    } catch (error) {
      console.error("Transcription error:", error);
      setIsTranscribing(false);
      updateStatus(`Transcription failed: ${error.message}`, "error");
      throw error;
    }
  };

  // Create video stream
  const createStream = async () => {
    if (!apiKey) {
      updateStatus("API key missing", "error");
      throw new Error("API key missing");
    }

    setIsCreatingStream(true);
    setStreamProgress(0);
    updateStatus("Creating AI video stream...", "info");

    try {
      setStreamProgress(20);

      const res = await fetch(`${API_BASE_URL}/v1/streams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ pipeline_id: "pip_qpUgXycjWF6YMeSL" }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setStreamId(data.id);
      setPlaybackId(data.output_playback_id);
      setStreamProgress(60);

      // Setup WebRTC
      await setupWebRTC(data.whip_url);
      setStreamProgress(100);
      setIsCreatingStream(false);
      updateStatus("Video stream ready!", "success");

      // Apply default prompt after stream is fully ready
      setTimeout(
        () =>
          updateStreamParams("magical starry night sky, soft clouds, peaceful"),
        3000
      );
    } catch (error) {
      console.error("Stream creation error:", error);
      setIsCreatingStream(false);
      updateStatus(`Stream failed: ${error.message}`, "error");
      throw error;
    }
  };

  // Setup WebRTC for canvas streaming
  const setupWebRTC = async (whipUrl) => {
    try {
      // Wait a moment for canvas to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const canvasStream = canvasRef.current.captureStream(30);
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      canvasStream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, canvasStream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const res = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!res.ok) throw new Error(`WHIP ${res.status}`);

      const answer = await res.text();
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answer,
      });

      peerConnectionRef.current = peerConnection;
      updateStatus("Streaming active!", "success");
    } catch (error) {
      console.error("WebRTC error:", error);
      throw error;
    }
  };

  // Update stream parameters
  const updateStreamParams = async (
    prompt,
    negativePrompt = "blurry, dark, scary, violent",
    steps = 40,
    controlnets = null
  ) => {
    if (!streamId) return;

    const params = {
      model_id: "streamdiffusion",
      pipeline: "live-video-to-video",
      params: {
        model_id: "stabilityai/sd-turbo",
        prompt: prompt,
        negative_prompt: negativePrompt,
        num_inference_steps: steps,
        seed: 42,
        t_index_list: [0, 8, 17],
        controlnets: controlnets || [
          {
            conditioning_scale: 0.22,
            enabled: true,
            model_id: "thibaud/controlnet-sd21-openpose-diffusers",
            preprocessor: "pose_tensorrt",
          },
          {
            conditioning_scale: 0.18,
            enabled: true,
            model_id: "thibaud/controlnet-sd21-canny-diffusers",
            preprocessor: "canny",
          },
        ],
      },
    };

    try {
      const res = await fetch(`${API_BASE_URL}/v1/streams/${streamId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(params),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      console.error("Update params error:", error);
    }
  };

  // Generate scenes from transcript
  const generateScenes = async (transcriptId, audioDuration) => {
    setIsGeneratingScenes(true);
    updateStatus("Generating magical scenes with AI...", "info");

    try {
      const res = await fetch("/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_id: transcriptId,
          durationSec: audioDuration,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Scene generation failed");
      }

      const plan = await res.json();
      setScenePlan(plan);
      setIsGeneratingScenes(false);
      updateStatus(
        `${plan.scenes.length} magical scenes ready! Press play to begin.`,
        "success"
      );
    } catch (error) {
      console.error("Scene generation error:", error);
      setIsGeneratingScenes(false);
      updateStatus(`Scene generation failed: ${error.message}`, "error");
    }
  };

  // Playback controls
  const handlePlay = async () => {
    console.log("=== PLAY BUTTON CLICKED ===");
    console.log("audioEngineRef.current:", audioEngineRef.current);
    console.log("audioElement:", audioEngineRef.current?.audioElement);
    console.log("audioElement.src:", audioEngineRef.current?.audioElement?.src);
    console.log("===========================");

    if (!audioEngineRef.current?.audioElement) {
      console.error("❌ Audio element is missing!");
      updateStatus("Audio not loaded yet. Please wait...", "warning");
      return;
    }

    if (!scenePlan) {
      updateStatus("Scene generation in progress. Please wait...", "warning");
      return;
    }

    if (!streamId) {
      updateStatus("Video stream not ready. Please wait...", "warning");
      return;
    }

    try {
      // Create or resume scheduler
      if (!schedulerRef.current) {
        schedulerRef.current = new SceneScheduler(
          audioEngineRef.current.audioElement,
          scenePlan,
          applyScene,
          setCurrentScene
        );
      }

      await schedulerRef.current.start();
      setIsPlaying(true);
      updateStatus("Playing your bedtime story...", "success");

      // Update time periodically
      const interval = setInterval(() => {
        if (audioEngineRef.current?.audioElement) {
          setCurrentTime(audioEngineRef.current.audioElement.currentTime);
        }
      }, 100);

      audioEngineRef.current.audioElement.onended = () => {
        setIsPlaying(false);
        clearInterval(interval);
        updateStatus("Story finished! Sweet dreams! 🌙", "success");
      };
    } catch (error) {
      console.error("Play error:", error);
      updateStatus(`Playback failed: ${error.message}`, "error");
    }
  };

  const handlePause = () => {
    if (schedulerRef.current) {
      schedulerRef.current.pause();
      setIsPlaying(false);
      updateStatus("Paused", "info");
    }
  };

  const handleSeek = (time) => {
    if (audioEngineRef.current?.audioElement) {
      audioEngineRef.current.audioElement.currentTime = time;
      setCurrentTime(time);
      if (schedulerRef.current) {
        schedulerRef.current.seek();
      }
    }
  };

  // Apply scene settings to stream
  const applyScene = async (scene) => {
    await updateStreamParams(
      scene.prompt,
      scene.negativePrompt,
      scene.steps,
      scene.controlnets
    );
  };

  const canPlay =
    !isTranscribing &&
    !isCreatingStream &&
    !isGeneratingScenes &&
    scenePlan &&
    streamId &&
    audioFile;

  // Debug logging to see what's preventing play
  useEffect(() => {
    console.log("=== Play Button Status ===");
    console.log("isTranscribing:", isTranscribing);
    console.log("isCreatingStream:", isCreatingStream);
    console.log("isGeneratingScenes:", isGeneratingScenes);
    console.log("scenePlan:", scenePlan ? "✅ Ready" : "❌ Missing");
    console.log("streamId:", streamId ? "✅ Ready" : "❌ Missing");
    console.log("audioFile:", audioFile ? "✅ Ready" : "❌ Missing");
    console.log("canPlay:", canPlay ? "✅ ENABLED" : "❌ DISABLED");
    console.log("========================");
  }, [
    isTranscribing,
    isCreatingStream,
    isGeneratingScenes,
    scenePlan,
    streamId,
    audioFile,
    canPlay,
  ]);

  return (
    <div className="app">
      <Header />

      <div className="container">
        {!audioFile ? (
          <UploadSection onFileUpload={handleFileUpload} />
        ) : (
          <>
            <ProgressTracker
              isTranscribing={isTranscribing}
              transcriptProgress={transcriptProgress}
              isCreatingStream={isCreatingStream}
              streamProgress={streamProgress}
              isGeneratingScenes={isGeneratingScenes}
              status={status}
            />

            <div className="content-grid">
              <div className="video-section">
                <VideoDisplay
                  canvasRef={canvasRef}
                  playbackId={playbackId}
                  audioEngine={audioEngineRef.current}
                />

                {canPlay && (
                  <PlaybackControls
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeek={handleSeek}
                    canPlay={canPlay}
                  />
                )}
              </div>

              {scenePlan && (
                <SceneTimeline
                  scenes={scenePlan.scenes}
                  currentScene={currentScene}
                  currentTime={currentTime}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
