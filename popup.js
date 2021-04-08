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

function init() {
    const createRoomButton = document.getElementById("createRoom");
    createRoomButton.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: createRoom,
        });
    });

    const joinRoomButton = document.getElementById("joinRoom");
    joinRoomButton.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: createRoom,
        });
    });

    const hangUp = document.getElementById("hangUp");
    hangUp.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: hangUp,
        });
    });
}

async function createRoom() {
    document.querySelector("#createBtn").disabled = true;
    document.querySelector("#joinBtn").disabled = true;
    document.querySelector("#hangUp").disabled = false;
    document.querySelector("#roomCode").disabled = true;

    const db = firebase.firestore(),
        roomRef = await db.collection("rooms").doc();

    console.log("Create PeerConnection with configuration: ", configuration);

    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
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
    roomRef.collection("calleeCandidates").onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
    // Listen for remote ICE candidates above
}

function joinRoom() {
    document.querySelector("#createBtn").disabled = true;
    document.querySelector("#joinBtn").disabled = true;
    document.querySelector("#hangUp").disabled = false;
    document.querySelector("#roomCode").disabled = true;

    document.querySelector("#confirmJoinBtn").addEventListener("click", async () => {
        roomId = document.querySelector("#roomCode").value;
        console.log("Join room: ", roomId);
        console.log(`Current room is ${roomId} - You are the callee!`);
        await joinRoomById(roomId);
    }, { once: true });
    roomDialog.open();
}

async function joinRoomById(roomId) {
    const db = firebase.firestore(),
        roomRef = db.collection("rooms").doc(`${roomId}`),
        roomSnapshot = await roomRef.get();
    console.log("Got room:", roomSnapshot.exists);

    if (roomSnapshot.exists) {
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
        roomRef.collection("callerCandidates").onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
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

function sendData() {
    dataChannel = peerConnection.createDataChannel("TimestampDataChannel");
    dataChannel.addEventListener("open", (event) => {
        if (interval == null) {
            interval = setInterval(() => {
                console.log("Sending Data from Server");
                dataChannel.send("PICA-PIKA");
            }, 2000);
        }
    });
}

function recvData() {
    peerConnection.addEventListener("datachannel", (event) => {
        const dataChannel = event.channel;

        dataChannel.addEventListener("message", (event) => {
            console.log("Recieving Data on Client");
            console.log(event.data);
            const message = event.data;
        });
    });
}

async function hangUp(e) {
    document.querySelector("#createBtn").disabled = false;
    document.querySelector("#joinBtn").disabled = false;
    document.querySelector("#hangUp").disabled = true;
    document.querySelector("#roomCode").disabled = false;

    if (peerConnection) {
        peerConnection.close();
    }

    // Delete room on hangup
    if (roomId) {
        const db = firebase.firestore(),
            roomRef = db.collection("rooms").doc(roomId),
            calleeCandidates = await roomRef.collection("calleeCandidates").get();
        calleeCandidates.forEach(async (candidate) => {
            await candidate.ref.delete();
        });
        const callerCandidates = await roomRef.collection("callerCandidates").get();
        callerCandidates.forEach(async (candidate) => {
            await candidate.ref.delete();
        });
        await roomRef.delete();
    }

    document.location.reload(true);
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
