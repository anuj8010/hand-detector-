"use client";
import { useEffect, useRef, useState } from "react";
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const gestureOutputRef = useRef(null);
  const demosSectionRef = useRef(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const [gestureRecognizer, setGestureRecognizer] = useState(null);
  const [runningMode, setRunningMode] = useState("IMAGE");
  const [isWebcamSupported, setIsWebcamSupported] = useState(false);
  const videoHeight = "360px";
  const videoWidth = "480px";

  useEffect(() => {
    const loadGestureRecognizer = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "detector/app/models/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: runningMode,
      });
      setGestureRecognizer(recognizer);
      if (demosSectionRef.current) {
        demosSectionRef.current.classList.remove("invisible");
      }
    };

    // Check for webcam support on the client side
    setIsWebcamSupported(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));

    loadGestureRecognizer();

    // Cleanup function to stop the video stream if the component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [runningMode]);

  const enableCam = () => {
    if (!gestureRecognizer) {
      alert("Please wait for gestureRecognizer to load");
      return;
    }

    setWebcamRunning(prevState => !prevState);

    const constraints = { video: true };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
      }
    });
  };

  const predictWebcam = async () => {
    const video = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");

    if (runningMode === "IMAGE") {
      setRunningMode("VIDEO");
      await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }

    let lastVideoTime = -1;
    let nowInMs = Date.now();

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = await gestureRecognizer.recognizeForVideo(video, nowInMs);

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      const drawingUtils = new DrawingUtils(canvasCtx);

      canvasElement.style.height = videoHeight;
      video.style.height = videoHeight;
      canvasElement.style.width = videoWidth;
      video.style.width = videoWidth;

      if (results.landmarks) {
        for (const landmarks of results.landmarks) {
          drawingUtils.drawConnectors(
            landmarks,
            GestureRecognizer.HAND_CONNECTIONS,
            {
              color: "#00FF00",
              lineWidth: 5,
            }
          );
          drawingUtils.drawLandmarks(landmarks, {
            color: "#FF0000",
            lineWidth: 2,
          });
        }
      }
      canvasCtx.restore();

      if (results.gestures.length > 0) {
        gestureOutputRef.current.style.display = "block";
        gestureOutputRef.current.style.width = videoWidth;
        const categoryName = results.gestures[0][0].categoryName;
        const categoryScore = parseFloat(results.gestures[0][0].score * 100).toFixed(2);
        const handedness = results.handednesses[0][0].displayName;
        gestureOutputRef.current.innerText = `GestureRecognizer: ${categoryName}\n Confidence: ${categoryScore} %\n Handedness: ${handedness}`;
      } else {
        gestureOutputRef.current.style.display = "none";
      }
    }

    if (webcamRunning) {
      window.requestAnimationFrame(predictWebcam);
    }
  };

  return (
    <div ref={demosSectionRef} id="demos" className="invisible">
      <h1>Gesture Recognition with WebCam</h1>
      {isWebcamSupported ? (
        <button id="webcamButton" onClick={enableCam}>
          {webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS"}
        </button>
      ) : (
        <p>getUserMedia() is not supported by your browser</p>
      )}
      <video
        id="webcam"
        ref={videoRef}
        autoPlay
        playsInline
      ></video>
      <canvas id="output_canvas" ref={canvasRef}></canvas>
      <div id="gesture_output" ref={gestureOutputRef}></div>
    </div>
  );
}
