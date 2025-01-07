const indicator = document.querySelector("#no");
const socket = io();
socket.on("totalUsers", (count) => {
  indicator.textContent = " " + count;
});

const form = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const messagesDiv = document.querySelector("#messages");

let roomname;

let dataChannel;

socket.emit("joinroom");

socket.on("joined", function (roomname) {
  room = roomname;
  console.log("Connection established to room:", roomname);
  initialize();
});

// WebRTC logic
let localStream;
let remoteStream;
let peerConnection;
let inCall = false;

const rtcSettings = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const initialize = async () => {
  socket.on("signalingMessage", handleSignalingMessage);

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    document.querySelector("#localVideo").srcObject = localStream;

    initiateOffer();
    inCall = true;
  } catch (err) {
    console.error("Rejected by browser", err);
  }
};

const initiateOffer = async () => {
  await createPeerConnection();
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("signalingMessage", {
      room,
      message: JSON.stringify({
        type: "offer",
        offer,
      }),
    });
  } catch (err) {
    console.error("Error creating offer", err);
  }
};

const createPeerConnection = () => {
  peerConnection = new RTCPeerConnection(rtcSettings);

  // Set up remote stream
  remoteStream = new MediaStream();
  document.querySelector("#remoteVideo").srcObject = remoteStream;
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    event.streams[0]
      .getTracks()
      .forEach((track) => remoteStream.addTrack(track));
  };

  // Data channel setup for messaging
  dataChannel = peerConnection.createDataChannel("chat");
  dataChannel.onmessage = handleMessage;
  dataChannel.onopen = () => console.log("Data channel opened");
  dataChannel.onclose = () => console.log("Data channel closed");

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onmessage = handleMessage;
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signalingMessage", {
        room,
        message: JSON.stringify({
          type: "candidate",
          candidate: event.candidate,
        }),
      });
    }
  };
};

const handleSignalingMessage = async (message) => {
  const { type, offer, answer, candidate } = JSON.parse(message);
  if (type === "offer") handleOffer(offer);
  if (type === "answer") handleAnswer(answer);
  if (type === "candidate" && peerConnection) {
    await peerConnection.addIceCandidate(candidate);
  }
};

const handleOffer = async (offer) => {
  await createPeerConnection();
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("signalingMessage", {
    room,
    message: JSON.stringify({ type: "answer", answer }),
  });
};

const handleAnswer = async (answer) => {
  await peerConnection.setRemoteDescription(answer);
};

const handleMessage = (event) => {
  const message = event.data;
  displayMessage("Remote", message);
  playBeep(); // Play beep sound when a message is received
};

const playBeep = () => {
  const beep = new Audio('sound.mp3'); // Replace with the actual path to your beep sound
  beep.play();
};

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (message && dataChannel?.readyState === "open") {
    dataChannel.send(message);
    displayMessage("You", message);
    messageInput.value = "";
  }
});

const displayMessage = (sender, message) => {
  const messageElement = document.createElement("div");
  messageElement.textContent = `${message}`;
  messageElement.classList.add(
    "p-2",
    "my-1",
    "rounded-md",
    sender === "You" ? "bg-blue-300" : "bg-zinc-300",
    sender === "You" ? "text-right" : "text-left"
  );
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

// skip feature

const skipbtn = document.querySelector("#skip");
skipbtn.addEventListener("click", () => {
  socket.emit("skip", room);
  // window.location.href = "/"; // redirect to home page after skipping
});
socket.on("skipped", () => {
  // alert("You have been skipped");
  window.location.href = "/";
});
