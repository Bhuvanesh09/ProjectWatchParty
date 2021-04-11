/* global firebase */

let firebaseAppInited = false;

function initFirebaseApp() {
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
    /*
     Firebase Analytics is not supported in this environment. Wrap initialization of analytics in
     analytics.isSupported() to prevent initialization in unsupported environments.
     Details: (1) This is a browser extension environment
     firebase.analytics();
    */

    firebaseAppInited = true;
}

chrome.runtime.onMessage.addListener(function ({
    action,
    ...others
}, _sender, sendResponse) {
    if (!firebaseAppInited) {
        initFirebaseApp();
    }

    switch (action) {
        case "createRoom":
            createRoom()
                .then((roomId) => {
                    sendResponse(roomId);
                });
            return true;
        case "joinRoom":
            joinRoomById(others.roomId)
                .then(() => {
                    sendResponse("success");
                });
            return true;
        case "hangup":
            hangUp((status) => {
                if (status) {
                    sendResponse("Exited!");
                } else {
                    sendResponse("Errored!");
                }
            });

            return true;
    }

    return false;
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

// TODO: Will peerconnection stay alive while data is being sent? Or will the event page die midway killing the connection?
let peerConnection = null,
    dataChannel = null,
    sendChannelIsReady = false,
    recvChannelIsReady = false,
    getRoomId,
    setRoomId;

(function () {
    // any possibly persistent information needs to be stored like this as this is an event page
    const ROOM_ID_KEY = "roomId";

    getRoomId = (callback) => {
        chrome.storage.local.get([ROOM_ID_KEY], function (result) {
            let joinedRoomId;
            if (typeof result[ROOM_ID_KEY] === "undefined") {
                joinedRoomId = result[ROOM_ID_KEY];
            } else {
                joinedRoomId = undefined;
            }
            callback(joinedRoomId);
        });
    };

    setRoomId = (value) => {
        chrome.storage.local.set({ ROOM_ID_KEY: value }, function () {
            if (chrome.runtime.lastError) {
                console.log("Whoops! What went wrong?", chrome.runtime.lastError);
            }
        });
    };
}());

async function createRoom() {
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    console.log("Create PeerConnection with configuration: ", configuration);
    dataChannel = peerConnection.createDataChannel("TimestampDataChannel");
    if (!sendChannelIsReady) {
        dataChannel.addEventListener("open", (_event) => {
            sendChannelIsReady = true;
        });
    }

    const db = firebase.firestore(),
        roomRef = await db.collection("rooms")
            .doc(),
        // Code for collecting ICE candidates below
        callerCandidatesCollection = roomRef.collection("callerCandidates");

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
    const roomId = roomRef.id;

    console.log(`New room created with SDP offer. Room ID: ${roomId}`);
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

    setRoomId(roomId);
    return roomId;
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

async function sendData(object) {
    while (!sendChannelIsReady);
    packet = JSON.stringify(object);
    console.log("rtc> Sending message: " + packet);
    dataChannel.send(packet);
}

async function joinRoomById(roomId) {
    const db = firebase.firestore(),
        roomRef = db.collection("rooms")
            .doc(`${roomId}`),
        roomSnapshot = await roomRef.get();
    console.log("Got room:", roomSnapshot.exists);

    if (roomSnapshot.exists) {
        setRoomId(roomId);

        console.log("Create PeerConnection with configuration: ", configuration);
        peerConnection = new RTCPeerConnection(configuration);
        registerPeerConnectionListeners();

        recvData();

        // Code for collecting ICE candidates below
        const calleeCandidatesCollection = roomRef.collection("calleeCandidates");
        peerConnection.addEventListener("icecandidate", (event) => {
            if (!event.candidate) {
                console.log("Got final candidate!");
                return;
            }
            console.log("Got candidate: ", event.candidate);
            calleeCandidatesCollection.add(event.candidate.toJSON());
        });
        // Code for collecting ICE candidates above

        // Code for creating SDP answer below
        const { offer } = roomSnapshot.data();
        console.log("Got offer:", offer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        console.log("Created answer:", answer);
        await peerConnection.setLocalDescription(answer);

        const roomWithAnswer = {
            answer: {
                type: answer.type,
                sdp: answer.sdp,
            },
        };
        await roomRef.update(roomWithAnswer);
        // Code for creating SDP answer above

        // Listening for remote ICE candidates below
        roomRef.collection("callerCandidates")
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
        // Listening for remote ICE candidates above
    }
}

function recvData() {
    peerConnection.addEventListener("datachannel", (event) => {
        const dataChannelRecv = event.channel;

        dataChannelRecv.addEventListener("message", (eventMessage) => {
            console.log("rtc> Receiving Message: " + eventMessage.data);
            const message = JSON.parse(eventMessage.data);
            recvTime(message);
        });
    });
}

function hangUp(callback) {
    if (peerConnection) {
        peerConnection.close();
    }

    getRoomId(async (roomId) => { // Delete room on hangup
        if (roomId) {
            const db = firebase.firestore(),
                roomRef = db.collection("rooms")
                    .doc(roomId),
                calleeCandidates = await roomRef.collection("calleeCandidates")
                    .get();
            calleeCandidates.forEach(async (candidate) => {
                await candidate.ref.delete();
            });
            const callerCandidates = await roomRef.collection("callerCandidates")
                .get();
            callerCandidates.forEach(async (candidate) => {
                await candidate.ref.delete();
            });
            await roomRef.delete();
        }

        callback(true);
    });
}
