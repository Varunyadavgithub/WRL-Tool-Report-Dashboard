import { useState, useRef, useCallback, useEffect } from "react";

export const usePhotoCapture = () => {
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      // Reset previous states
      setErrorMessage(null);

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access not supported");
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCapturing(true);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMessage(
        err.message || "Failed to access camera. Please check permissions."
      );
      setIsCapturing(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        throw new Error("Video or Canvas not available");
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not get canvas context");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to high-quality JPEG
      const photoDataUrl = canvas.toDataURL("image/jpeg", 0.9);

      // Stop video stream
      const stream = video.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());

      // Update state
      setCapturedPhoto(photoDataUrl);
      setIsCapturing(false);

      return photoDataUrl;
    } catch (err) {
      console.error("Photo capture error:", err);
      setErrorMessage(err.message || "Failed to capture photo");
      return null;
    }
  }, []);

  const retakePhoto = useCallback(() => {
    // Reset photo and restart camera
    setCapturedPhoto(null);
    setErrorMessage(null);
    startCamera();
  }, [startCamera]);

  // Cleanup stream when component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        const stream = videoRef.current.srcObject;

        if (stream) {
          const tracks = stream.getTracks();
          tracks.forEach((track) => track.stop());
        }
      }
    };
  }, []);

  return {
    capturedPhoto,
    isCapturing,
    videoRef,
    canvasRef,
    startCamera,
    capturePhoto,
    retakePhoto,
    errorMessage,
  };
};
