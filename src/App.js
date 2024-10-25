// src/App.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io.connect("http://localhost:5000", { transports: ["websocket"] }); // Update with backend server URL if necessary

const App = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const roomId = "testRoom";
  const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    // Initialize local video
    const init = async () => {
      if (navigator.mediaDevices) {
        if (navigator.mediaDevices.getUserMedia) {
          const localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          localVideoRef.current.srcObject = localStream;

          // Join room
          socket.emit("join-call", roomId);
          setUpSocketEvents(localStream);
        } else alert("getUserMedia() not supported in your browser.");
      } else alert("mediaDevices not supported in your browser.");
    };
    init();
  }, []);

  const setUpSocketEvents = (localStream) => {
    socket.on("user-joined", async (userId) => {
      const pc = new RTCPeerConnection(config);
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));
      pc.ontrack = (event) => {
        remoteVideoRef.current.srcObject = event.streams[0];
      };
      pc.onicecandidate = (event) => {
        if (event.candidate)
          socket.emit("signal", { to: userId, signal: event.candidate });
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", { to: userId, signal: offer });
      setPeerConnection(pc);
    });

    socket.on("signal", async (data) => {
      const pc = peerConnection || new RTCPeerConnection(config);
      setPeerConnection(pc);
      pc.ontrack = (event) => {
        remoteVideoRef.current.srcObject = event.streams[0];
      };
      pc.onicecandidate = (event) => {
        if (event.candidate)
          socket.emit("signal", { to: data.from, signal: event.candidate });
      };
      if (data.signal.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("signal", { to: data.from, signal: answer });
      } else if (data.signal.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
      } else if (data.signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.signal));
      }
    });
  };

  return (
    <div>
      <h1>Simple Video Call App</h1>
      <video
        ref={localVideoRef}
        autoPlay
        muted
        style={{ width: "45%", margin: "10px" }}
      ></video>
      <video
        ref={remoteVideoRef}
        autoPlay
        style={{ width: "45%", margin: "10px" }}
      ></video>
    </div>
  );
};

export default App;
