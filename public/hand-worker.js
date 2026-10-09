/* Classic worker: MediaPipe's WASM loader uses importScripts. All assets are local. */
let landmarker;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      importScripts("/mediapipe/vision_bundle.js");
      const files =
        await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      landmarker = await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "/models/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.65,
        minHandPresenceConfidence: 0.65,
        minTrackingConfidence: 0.6,
      });
      self.postMessage({ type: "ready" });
    } else if (data.type === "check") {
      const canvas = new OffscreenCanvas(640, 480);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#eeeeee";
      ctx.fillRect(0, 0, 640, 480);
      const frame = canvas.transferToImageBitmap();
      try {
        const result = landmarker.detectForVideo(frame, performance.now());
        self.postMessage({ type: "checked", hands: result.landmarks.length });
      } finally {
        frame.close();
      }
    } else if (data.type === "frame") {
      const start = performance.now();
      try {
        const result = landmarker.detectForVideo(data.frame, data.timestamp);
        self.postMessage({
          type: "result",
          points: result.landmarks,
          handedness: result.handedness,
          ms: performance.now() - start,
          session: data.session,
        });
      } finally {
        data.frame.close();
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
