require("dotenv").config({ path: "../.env" });

const http = require("http");
const https = require("https");
const url = require("url");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

// Resolve API keys with fallbacks
const LIVEPEER_API_KEY =
  process.env.LivePeer_API_Key || process.env.LIVEPEER_API_KEY;
const OPENAI_API_KEY = process.env.OpenAI_Api_key || process.env.OPENAI_API_KEY;
const ASSEMBLY_API_KEY =
  process.env.AssemblyAI_key ||
  process.env.ASSEMBLYAI_API_KEY ||
  process.env.AssemblyAI_API_Key;

// JSON response helpers
function json(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(obj));
}

const json400 = (res, m) => json(res, 400, { error: m });
const json409 = (res, m) => json(res, 409, { error: m });
const json422 = (res, m, issues) => json(res, 422, { error: m, issues });
const json500 = (res, m) => json(res, 500, { error: m });

const server = http.createServer((req, res) => {
  // Enable CORS for all origins
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === "/health") {
    return json(res, 200, { ok: true });
  }

  // Config endpoint - returns Livepeer key for client auth
  if (req.url === "/config") {
    return json(res, 200, { apiKey: LIVEPEER_API_KEY || "" });
  }

  // Transcription endpoint - handles audio transcription with AssemblyAI
  if (req.url === "/transcribe" && req.method === "POST") {
    let body = [];
    req.on("data", (chunk) => {
      body.push(chunk);
    });
    req.on("end", async () => {
      try {
        if (!ASSEMBLY_API_KEY) {
          return json500(res, "AssemblyAI_key not set");
        }
        const audioBuffer = Buffer.concat(body);

        // Upload audio to AssemblyAI
        const uploadOptions = {
          hostname: "api.assemblyai.com",
          path: "/v2/upload",
          method: "POST",
          headers: {
            authorization: ASSEMBLY_API_KEY,
            "Content-Type": "application/octet-stream",
            "Content-Length": audioBuffer.length,
          },
        };

        const uploadUrl = await new Promise((resolve, reject) => {
          const uploadReq = https.request(uploadOptions, (uploadRes) => {
            let data = "";
            uploadRes.on("data", (chunk) => (data += chunk));
            uploadRes.on("end", () => {
              const result = JSON.parse(data);
              resolve(result.upload_url);
            });
          });
          uploadReq.on("error", reject);
          uploadReq.write(audioBuffer);
          uploadReq.end();
        });

        // Start transcription
        const transcriptOptions = {
          hostname: "api.assemblyai.com",
          path: "/v2/transcript",
          method: "POST",
          headers: {
            authorization: ASSEMBLY_API_KEY,
            "Content-Type": "application/json",
          },
        };

        const transcriptData = JSON.stringify({
          audio_url: uploadUrl,
          speech_model: "best",
        });

        const transcriptId = await new Promise((resolve, reject) => {
          const transcriptReq = https.request(
            transcriptOptions,
            (transcriptRes) => {
              let data = "";
              transcriptRes.on("data", (chunk) => (data += chunk));
              transcriptRes.on("end", () => {
                const result = JSON.parse(data);
                resolve(result.id);
              });
            }
          );
          transcriptReq.on("error", reject);
          transcriptReq.write(transcriptData);
          transcriptReq.end();
        });

        // Return the transcript ID for polling
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ transcript_id: transcriptId }));
      } catch (error) {
        console.error("Transcription error:", error.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Poll transcription status
  if (req.url.startsWith("/transcribe/") && req.method === "GET") {
    if (!ASSEMBLY_API_KEY) {
      return json500(res, "AssemblyAI_key not set");
    }

    const transcriptId = req.url.split("/transcribe/")[1];

    const options = {
      hostname: "api.assemblyai.com",
      path: `/v2/transcript/${transcriptId}`,
      method: "GET",
      headers: {
        authorization: ASSEMBLY_API_KEY,
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = "";
      proxyRes.on("data", (chunk) => (data += chunk));
      proxyRes.on("end", () => {
        res.writeHead(proxyRes.statusCode, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(data);
      });
    });

    proxyReq.on("error", (error) => {
      console.error("Polling error:", error.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    });

    proxyReq.end();
    return;
  }

  // POST /scenes - Generate scene timeline from transcript
  if (req.url === "/scenes" && req.method === "POST") {
    let body = [];
    req.on("data", (chunk) => body.push(chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(Buffer.concat(body).toString());
        let transcriptText = payload.transcriptText;
        let durationSec = payload.durationSec;

        // If transcript_id provided, fetch from AssemblyAI
        if (payload.transcript_id) {
          if (!ASSEMBLY_API_KEY) {
            return json500(res, "AssemblyAI_key not set");
          }

          const options = {
            hostname: "api.assemblyai.com",
            path: `/v2/transcript/${payload.transcript_id}`,
            method: "GET",
            headers: { authorization: ASSEMBLY_API_KEY },
          };

          const transcriptData = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
              let data = "";
              res.on("data", (chunk) => (data += chunk));
              res.on("end", () => resolve(JSON.parse(data)));
            });
            req.on("error", reject);
            req.end();
          });

          if (transcriptData.status !== "completed") {
            return json409(res, `Transcript status: ${transcriptData.status}`);
          }

          transcriptText = transcriptData.text;
          durationSec = transcriptData.audio_duration || durationSec;
        }

        if (!transcriptText || !transcriptText.trim()) {
          return json400(res, "Empty transcript text");
        }

        if (!durationSec || durationSec <= 0) {
          return json400(res, "Invalid or missing durationSec");
        }

        if (!OPENAI_API_KEY) {
          return json500(res, "OpenAI_Api_key not set");
        }

        // Build GPT prompt for bedtime story scenes
        const systemPrompt =
          "You are generating a magical scene timeline for an AI-powered bedtime story video. Create vivid, dreamy, child-friendly scenes that sync perfectly to narration. Output STRICT JSON only matching the provided schema. No extra text.";

        const userPrompt = `Bedtime story narration transcript:
---
${transcriptText}
---

Total audio duration (seconds): ${durationSec}

Task:
- Segment narration into 6–12 coherent, magical scenes that cover the whole duration.
- Each scene needs startSec and endSec in whole seconds, continuous with no overlaps.
- Write vivid, dreamy, child-friendly positive prompts suitable for Stable Diffusion video-to-video.
- Focus on whimsical, calming, fantastical imagery (stars, clouds, forests, magical creatures, gentle colors).
- Include negativePrompt to avoid scary or dark elements.
- Set steps between 30-50 for quality.
- Use minimal controlnets (pose_tensorrt or canny) only when helpful for character poses or scene structure.

Schema:
{
  "durationSec": number,
  "scenes": [
    {
      "id": "uuid-v4",
      "startSec": number,
      "endSec": number,
      "prompt": "string (vivid, dreamy, child-friendly)",
      "negativePrompt": "string (avoid dark/scary elements)",
      "steps": number (30-50),
      "controlnets": [
        {
          "conditioning_scale": number (0.1-0.6),
          "enabled": boolean,
          "model_id": "string",
          "preprocessor": "pose_tensorrt|canny"
        }
      ] (optional)
    }
  ]
}

Output rules:
- JSON only. No markdown.
- startSec of first scene = 0; endSec of last scene = ${durationSec}.
- endSec of scene i == startSec of scene i+1.
- Keep prompts magical, calming, and appropriate for bedtime stories.`;

        // Call OpenAI
        const requestBody = JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });

        const openaiOptions = {
          hostname: "api.openai.com",
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Length": Buffer.byteLength(requestBody),
          },
        };

        const gptResponse = await new Promise((resolve, reject) => {
          const req = https.request(openaiOptions, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(JSON.parse(data)));
          });
          req.on("error", reject);
          req.write(requestBody);
          req.end();
        });

        if (gptResponse.error) {
          return json500(res, gptResponse.error.message || "OpenAI API error");
        }

        const planText = gptResponse.choices[0].message.content;
        let plan;

        try {
          plan = JSON.parse(planText);
        } catch (e) {
          return json422(res, "Invalid JSON from GPT", {
            parseError: e.message,
          });
        }

        // Validate and normalize
        if (!plan.scenes || !Array.isArray(plan.scenes)) {
          return json422(res, "Missing or invalid scenes array");
        }

        // Sort by startSec
        plan.scenes.sort((a, b) => a.startSec - b.startSec);

        // Validate and normalize scenes
        const normalized = [];
        for (let i = 0; i < plan.scenes.length && i < 24; i++) {
          const scene = plan.scenes[i];

          // Generate ID if missing
          if (!scene.id) {
            scene.id = crypto.randomUUID();
          }

          // Clamp times
          scene.startSec = Math.max(0, Math.floor(scene.startSec));
          scene.endSec = Math.min(durationSec, Math.ceil(scene.endSec));

          // Ensure valid range
          if (scene.startSec >= scene.endSec) {
            continue; // Skip invalid scenes
          }

          // Clamp steps
          if (scene.steps !== undefined) {
            scene.steps = Math.max(1, Math.min(100, scene.steps));
          }

          // Validate controlnets
          if (scene.controlnets) {
            scene.controlnets = scene.controlnets.filter((cn) => {
              if (cn.conditioning_scale !== undefined) {
                cn.conditioning_scale = Math.max(
                  0.1,
                  Math.min(0.6, cn.conditioning_scale)
                );
              }
              return cn.model_id && cn.preprocessor;
            });
          }

          normalized.push(scene);
        }

        // Ensure coverage and no overlaps
        if (normalized.length > 0) {
          normalized[0].startSec = 0;
          for (let i = 1; i < normalized.length; i++) {
            normalized[i - 1].endSec = normalized[i].startSec;
          }
          normalized[normalized.length - 1].endSec = durationSec;
        }

        const finalPlan = {
          durationSec: durationSec,
          scenes: normalized,
        };

        return json(res, 200, finalPlan);
      } catch (error) {
        console.error("Scene generation error:", error);
        return json500(res, error.message || "Scene generation failed");
      }
    });
    return;
  }

  // Only proxy requests to /api/*
  if (!req.url.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found. Use /api/* endpoints");
    return;
  }

  // Remove /api prefix and build target URL
  const targetPath = req.url.replace("/api", "");
  const targetUrl = `https://api.daydream.live${targetPath}`;

  console.log(`[${req.method}] Proxying: ${targetUrl}`);

  // Parse the target URL
  const options = url.parse(targetUrl);
  options.method = req.method;
  options.headers = { ...req.headers };

  // Remove host header to avoid conflicts
  delete options.headers.host;

  // Make request to Daydream API
  const proxyReq = https.request(options, (proxyRes) => {
    // Forward status code
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      "Access-Control-Allow-Origin": "*",
    });

    // Stream response back to client
    proxyRes.pipe(res);
  });

  // Handle errors
  proxyReq.on("error", (error) => {
    console.error("Proxy error:", error.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Proxy error: " + error.message }));
  });

  // Stream request body to target
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log("🌙 Outly Bedtime Stories Server");
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🎯 Proxying to: https://api.daydream.live`);
  console.log("");

  // Check which API keys are loaded
  console.log("🔑 API Key Status:");
  if (LIVEPEER_API_KEY) {
    console.log(`   ✅ Livepeer key loaded`);
  } else {
    console.log(`   ⚠️  Missing LivePeer_API_Key`);
  }

  if (OPENAI_API_KEY) {
    console.log(`   ✅ OpenAI key loaded`);
  } else {
    console.log(`   ⚠️  Missing OpenAI_Api_key (needed for /scenes)`);
  }

  if (ASSEMBLY_API_KEY) {
    console.log(`   ✅ AssemblyAI key loaded`);
  } else {
    console.log(`   ⚠️  Missing AssemblyAI_key (needed for transcription)`);
  }

  console.log("");
  console.log("💡 API Endpoints:");
  console.log(`   Health:   http://localhost:${PORT}/health`);
  console.log(`   Config:   http://localhost:${PORT}/config`);
  console.log(`   Scenes:   http://localhost:${PORT}/scenes`);
  console.log(`   Transcribe: http://localhost:${PORT}/transcribe`);
  console.log(`   Proxy:    http://localhost:${PORT}/api/*`);
  console.log("");
  console.log("Press Ctrl+C to stop");
});
