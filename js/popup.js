function init() {
    const createRoomButton = document.getElementById("createRoom");
    createRoomButton.addEventListener("click", createRoom);

    const joinRoomButton = document.getElementById("joinRoom");
    joinRoomButton.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: createRoom,
        });
    });

    const hangUp = document.getElementById("hangUp");
    hangUp.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: hangUp,
        });
    });
}

function createRoom(_clickEvent) {
    // document.querySelector("#createBtn").disabled = true;
    // document.querySelector("#joinBtn").disabled = true;
    // document.querySelector("#hangUp").disabled = false;
    // document.querySelector("#roomCode").disabled = true;

    chrome.runtime.sendMessage({ action: "createRoom" }, function (_response) {
        console.log(chrome.runtime.lastError);
        // TODO: check if response is successful
    });
}

function joinRoom() {
    document.querySelector("#createBtn").disabled = true;
    document.querySelector("#joinBtn").disabled = true;
    document.querySelector("#hangUp").disabled = false;
    document.querySelector("#roomCode").disabled = true;

    document.querySelector("#confirmJoinBtn")
        .addEventListener("click", async () => {
            roomId = document.querySelector("#roomCode").value;
            console.log("Join room: ", roomId);
            console.log(`Current room is ${roomId} - You are the callee!`);
            await joinRoomById(roomId);
        }, { once: true });
    roomDialog.open();
}

async function joinRoomById(roomId) {
    const db = firebase.firestore(),
        roomRef = db.collection("rooms")
            .doc(`${roomId}`),
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

    document.location.reload(true);
}

init();
