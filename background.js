/* global firebase */

(function () {
    self.importScripts("firebase/firebase-app.js", "firebase/firebase-analytics.js", "firebase/firebase-auth.js", "firebase/firebase-firestore.js");
}());

console.log(firebase); // should be truthy

chrome.runtime.onInstalled.addListener(() => {
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
    const firebaseConfig = {
        apiKey: "AIzaSyAymlhRxTn9Vpc5BYC7xrT7iOJ-wtbX5ec",
        authDomain: "simulated-hangouts.firebaseapp.com",
        projectId: "simulated-hangouts",
        storageBucket: "simulated-hangouts.appspot.com",
        messagingSenderId: "17379851992",
        appId: "1:17379851992:web:a4f7e957c910926c58a1ad",
        measurementId: "G-RNGS5Q6MQ3",
    };
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    // firebase.analytics(); cannot initialize analytics from service worker as there is no DOM
});

chrome.runtime.onMessage.addListener(function ({ action }) {
    switch (action) {
    case "createRoom":
        createRoom();
        break;
    default:
        console.log("Invalid input");
    }
});

// ICE configuration ig
const configuration = {
    iceServers: [
        {
            urls: "turn:felicity.iiit.ac.in:3478",
            username: "felicity",
            credential: "5xXJa5rwSafFTpjQEWDdPfRSdFaeKmIy",
        },
    ],
    iceCandidatePoolSize: 10,
};

let peerConnection = null,
    roomDialog = null,
    roomId = null,
    dataChannel = null,
    interval = null;

async function createRoom() {
    console.log(firebase);

    const db = firebase.firestore(),
        roomRef = await db.collection("rooms")
            .doc();
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    console.log("Create PeerConnection with configuration: ", configuration);
    sendData();

    // Code for collecting ICE candidates below
    const callerCandidatesCollection = roomRef.collection("callerCandidates");

    peerConnection.addEventListener("icecandidate", (event) => {
        if (!event.candidate) {
            console.log("Got final candidate!");
            return;
        }
        console.log("Got candidate: ", event.candidate);
        callerCandidatesCollection.add(event.candidate.toJSON());
    });
    // Code for collecting ICE candidates above

    // Code for creating a room below
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log("Created offer:", offer);

    const roomWithOffer = {
        offer: {
            type: offer.type,
            sdp: offer.sdp,
        },
    };
    await roomRef.set(roomWithOffer);
    roomId = roomRef.id;
    console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
    document.querySelector(
        "#roomCode",
    ).value = `${roomRef.id} (!C)`;
    // Code for creating a room above

    // Listening for remote session description below
    roomRef.onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
            console.log("Got remote description: ", data.answer);
            const rtcSessionDescription = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
    });
    // Listening for remote session description above

    // Listen for remote ICE candidates below
    roomRef.collection("calleeCandidates")
        .onSnapshot((snapshot) => {
            snapshot.docChanges()
                .forEach(async (change) => {
                    if (change.type === "added") {
                        const data = change.doc.data();
                        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                    }
                });
        });
    // Listen for remote ICE candidates above
}

function registerPeerConnectionListeners() {
    peerConnection.addEventListener("icegatheringstatechange", () => {
        console.log(
            `ICE gathering state changed: ${peerConnection.iceGatheringState}`,
        );
    });

    peerConnection.addEventListener("connectionstatechange", () => {
        console.log(`Connection state change: ${peerConnection.connectionState}`);
    });

    peerConnection.addEventListener("signalingstatechange", () => {
        console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener("iceconnectionstatechange ", () => {
        console.log(
            `ICE connection state change: ${peerConnection.iceConnectionState}`,
        );
    });
}

function sendData() {
    dataChannel = peerConnection.createDataChannel("TimestampDataChannel");
    dataChannel.addEventListener("open", (_event) => {
        if (interval == null) {
            interval = setInterval(() => {
                console.log("Sending Data from Server");
                dataChannel.send("PICA-PIKA");
            }, 2000);
        }
    });
}
