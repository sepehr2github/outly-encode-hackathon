# 🌙 Outly - Bedtime Stories with AI

Transform bedtime stories into magical visual experiences using AI. Upload a voice recording of any bedtime story, and watch as AI generates beautiful, synchronized visuals that bring the narrative to life.

3. **Start the development servers:**

```bash
# 1. Install dependencies
npm run install:all

# 2. Start the app (both client and server)
npm run dev

This starts both:

- Server on http://localhost:3000
- Client on http://localhost:5173

4. **Open your browser:**

Navigate to http://localhost:5173

## 📖 How It Works

### 1. Upload Audio

- User uploads a bedtime story audio file
- Audio is loaded into the audio engine for playback

### 2. Parallel Processing

The system performs two operations simultaneously:

**A. Transcription:**

- Audio is uploaded to AssemblyAI
- System polls for transcription completion
- Transcript is returned with timing information

**B. Stream Creation:**

- Video stream is created via Livepeer API
- WebRTC connection is established
- Audio-reactive canvas begins streaming

### 3. Scene Generation

- Once transcription is complete, it's sent to OpenAI GPT Model
- GPT analyzes the story and creates 6-12 magical scenes

### 4. Synchronized Playback

- User presses play
- SceneScheduler precisely synchronizes audio and video
- Scenes are applied to the video stream at exact timestamps
- Drift correction ensures perfect sync
- Audio-reactive canvas responds to voice dynamics

Made with 💜 for magical bedtime stories

**Sweet Dreams! 🌙✨**
