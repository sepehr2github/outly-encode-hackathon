import * as THREE from "three";

class AudioEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = null; // Don't initialize context yet
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.source = null;
    this.audioElement = null;
    this.isListening = false;
    this.isPlaying = false;
    this.levels = { low: 0, mid: 0, high: 0, overall: 0 };

    this.initThreeJS() || this.initFallback();
    this.animate();
  }

  initThreeJS() {
    try {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(
        75,
        this.canvas.width / this.canvas.height,
        0.1,
        1000
      );
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
      });
      this.renderer.setSize(this.canvas.width, this.canvas.height);
      this.renderer.setClearColor(0x0a0a1e);

      this.createObjects();
      this.camera.position.z = 5;
      return true;
    } catch (e) {
      console.warn("Three.js init failed, using fallback");
      return false;
    }
  }

  createObjects() {
    // Create dreamy night sky elements
    this.moonGroup = new THREE.Group();

    // Moon
    const moonGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const moonMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      emissive: 0xffe4b5,
      emissiveIntensity: 0.5,
    });
    this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
    this.moon.position.set(-2, 1, 0);
    this.moonGroup.add(this.moon);

    // Stars
    this.stars = [];
    for (let i = 0; i < 50; i++) {
      const starGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const starMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
      });
      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 5 - 2
      );
      this.stars.push(star);
      this.moonGroup.add(star);
    }

    this.scene.add(this.moonGroup);

    // Audio-reactive sphere
    this.geometry = new THREE.SphereGeometry(1.2, 64, 64);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x9d4edd,
      metalness: 0.7,
      roughness: 0.3,
      transparent: true,
      opacity: 0.8,
    });
    this.sphere = new THREE.Mesh(this.geometry, this.material);
    this.sphere.visible = false;
    this.scene.add(this.sphere);
    this.originalPos = this.geometry.attributes.position.array.slice();

    // Lighting
    this.scene.add(new THREE.AmbientLight(0x404060, 0.5));
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(5, 5, 5);
    this.scene.add(light);
  }

  initFallback() {
    this.fallback = true;
    // Initialize 2D context only for fallback
    if (!this.ctx) {
      this.ctx = this.canvas.getContext("2d");
    }
  }

  async initAudio() {
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async loadAudioFile(file) {
    try {
      await this.initAudio();

      this.audioElement = new Audio();
      this.audioElement.src = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        this.audioElement.onloadedmetadata = resolve;
        this.audioElement.onerror = reject;
      });

      this.source = this.audioContext.createMediaElementSource(
        this.audioElement
      );
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      return true;
    } catch (e) {
      console.error("Audio load failed:", e);
      return false;
    }
  }

  startVisualization() {
    this.isListening = true;
  }

  analyzeAudio() {
    if (!this.analyser) return;
    this.analyser.getByteFrequencyData(this.dataArray);

    const len = this.dataArray.length;
    const lowEnd = Math.floor(len * 0.2);
    const midEnd = Math.floor(len * 0.7);

    let low = 0,
      mid = 0,
      high = 0,
      overall = 0;

    for (let i = 0; i < len; i++) {
      const val = this.dataArray[i] / 255;
      overall += val;
      if (i < lowEnd) low += val;
      else if (i < midEnd) mid += val;
      else high += val;
    }

    this.levels = {
      low: low / lowEnd,
      mid: mid / (midEnd - lowEnd),
      high: high / (len - midEnd),
      overall: overall / len,
    };
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.isListening) {
      this.analyzeAudio();
      if (this.fallback) this.drawFallback();
      else this.updateThreeJS();
    } else {
      if (!this.fallback) this.animateDefault();
      else this.drawDefault();
    }

    if (!this.fallback) this.renderer.render(this.scene, this.camera);
  }

  updateThreeJS() {
    this.moonGroup.visible = false;
    this.sphere.visible = true;

    // Deform sphere based on audio
    const pos = this.geometry.attributes.position.array;
    const time = Date.now() * 0.001;
    for (let i = 0; i < pos.length; i += 3) {
      const orig = this.originalPos;
      const deform = this.levels.overall * 0.4;
      pos[i] = orig[i] * (1 + deform);
      pos[i + 1] = orig[i + 1] * (1 + deform);
      pos[i + 2] = orig[i + 2] * (1 + deform);
    }
    this.geometry.attributes.position.needsUpdate = true;

    this.sphere.rotation.x += 0.005;
    this.sphere.rotation.y += 0.01;

    const hue = (this.levels.overall * 0.3 + time * 0.05) % 1;
    this.material.color.setHSL(hue, 0.8, 0.6);
  }

  animateDefault() {
    this.moonGroup.visible = true;
    this.sphere.visible = false;

    const time = Date.now() * 0.0005;

    // Gentle moon movement
    this.moon.rotation.y += 0.002;

    // Twinkling stars
    this.stars.forEach((star, i) => {
      const twinkle = Math.sin(time * 2 + i) * 0.5 + 0.5;
      star.material.opacity = twinkle * 0.8 + 0.2;
    });
  }

  drawFallback() {
    this.ctx.fillStyle = "#0a0a1e";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const centerY = this.canvas.height / 2;
    const amplitude = this.levels.overall * 100;

    this.ctx.strokeStyle = `hsl(${
      (this.levels.overall * 270 + 240) % 360
    }, 80%, 60%)`;
    this.ctx.lineWidth = 3 + this.levels.overall * 5;
    this.ctx.beginPath();

    for (let x = 0; x < this.canvas.width; x += 2) {
      const wave =
        Math.sin((x / this.canvas.width) * Math.PI * 10 + Date.now() * 0.002) *
        amplitude;
      const y = centerY + wave;
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
  }

  drawDefault() {
    this.ctx.fillStyle = "#0a0a1e";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw moon
    const time = Date.now() * 0.001;
    this.ctx.fillStyle = "#fff8dc";
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = "#ffe4b5";
    this.ctx.beginPath();
    this.ctx.arc(100, 100, 40, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    // Draw stars
    this.ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 30; i++) {
      const x = (i * 37) % this.canvas.width;
      const y = (i * 53) % this.canvas.height;
      const twinkle = Math.sin(time * 2 + i) * 0.5 + 0.5;
      this.ctx.globalAlpha = twinkle * 0.8 + 0.2;
      this.ctx.fillRect(x, y, 2, 2);
    }
    this.ctx.globalAlpha = 1;
  }
}

export default AudioEngine;
