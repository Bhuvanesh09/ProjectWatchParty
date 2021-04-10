/* global firebase */

// TODO: reorder functions logically

// TODO: aggressively delete offer as soon as an answer is received.
//        even if this is handled, there might be some race conditions

// firebase init {{{
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
// }}}

const ICEConfiguration = {
        iceServers: [
            {
                urls: "turn:felicity.iiit.ac.in:3478",
                username: "felicity",
                credential: "5xXJa5rwSafFTpjQEWDdPfRSdFaeKmIy",
            },
        ],
        iceCandidatePoolSize: 10,
    },
    // TODO: link peerconnection and datachannel. maybe a "class"?
    peers = [],
    dataChannels = [];

let interval = null,
    getRoomId,
    setRoomId,
    MY_NAME;

// TODO: add an interface to allow the user to set this
chrome.storage.local.get("username", (username) => { MY_NAME = username.username; });

{ // TODO: fix: @sigmag {{{
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
} // }}}

async function advertiseOfferForPeers(selfRef) { // {{{
    const peerConnection = new RTCPeerConnection(ICEConfiguration);
    registerPeerConnectionListeners(peerConnection);
    console.debug("Create PeerConnection with configuration: ", ICEConfiguration);
    initializeDataChannel(peerConnection);

    const callerCandidatesCollection = await selfRef.collection("callerCandidates");
    let iceCandidateSendCount = 0;

    // collecting ICE candidates {{{
    peerConnection.addEventListener("icecandidate", (event) => {
        if (!event.candidate) {
            console.debug("Got final candidate!");
            callerCandidatesCollection.add({ type: "end", data: iceCandidateSendCount });
            return;
        }

        console.debug("Got candidate: ", event.candidate);
        iceCandidateSendCount++;
        const payload = { type: "candidate", data: event.candidate.toJSON() };
        callerCandidatesCollection.add(payload);
    });
    // }}}

    // creating an offer {{{
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.debug("Created offer:", offer);

    const roomWithOffer = {
        offer: {
            type: offer.type,
            sdp: offer.sdp,
        },
    };

    await selfRef.set(roomWithOffer);
    // }}}

    // listening for remote session description {{{
    selfRef.onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
            console.debug("Got remote description: ", data.answer);
            const rtcSessionDescription = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
    });
    // }}}

    // listening for remote ICE candidates {{{
    {
    // to handle out of order messages
    // this ensures that we always receive all candidates
        let iceCandidateReceivedCount = 0,
            expectedCandidateCount = Number.POSITIVE_INFINITY;
        selfRef.collection("calleeCandidates")
            .onSnapshot((snapshot) => {
                snapshot.docChanges()
                    .forEach(async (change) => {
                        if (change.type === "added") {
                            const { type, data } = change.doc.data();

                            if (type === "end") {
                                expectedCandidateCount = data;
                            } else {
                                console.debug(`new remote ICE candidate: ${JSON.stringify(data)}`);
                                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                                iceCandidateReceivedCount++;
                            }
                        }

                        if (expectedCandidateCount === iceCandidateReceivedCount) {
                            peers.push(peerConnection);
                            advertiseOfferForPeers(selfRef);
                        }
                    });
            });
    }
    // }}}
} // }}}

async function createRoom() { // {{{
    console.log("MY_NAME", MY_NAME);

    const roomRef = await firebase.firestore().collection("rooms").doc(),
        // TODO: dup [MARKER:1]
        selfRef = await roomRef.collection("peers").doc(MY_NAME);

    advertiseOfferForPeers(selfRef);

    setRoomId(roomRef.id);
    return roomRef.id;
} // }}}

function registerPeerConnectionListeners(peerConnection) { // {{{
    peerConnection.addEventListener("icegatheringstatechange", () => {
        console.debug(
            `ICE gathering state changed: ${peerConnection.iceGatheringState}`,
        );
    });

    peerConnection.addEventListener("connectionstatechange", () => {
        console.debug(`Connection state change: ${peerConnection.connectionState}`);
    });

    peerConnection.addEventListener("signalingstatechange", () => {
        console.debug(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener("iceconnectionstatechange ", () => {
        console.debug(
            `ICE connection state change: ${peerConnection.iceConnectionState}`,
        );
    });
} // }}}

function initializeDataChannel(peerConnection) { // {{{
    const dataChannel = peerConnection.createDataChannel("TimestampDataChannel");
    dataChannel.addEventListener("open", (_event) => {
        if (interval == null) {
            interval = setInterval(() => {
                console.log("Sending Data from Server");
                dataChannel.send("PICA-PIKA");
            }, 2000);
        }
    });

    dataChannels.push(dataChannel);
} // }}}

async function processOffer(peerRef) { // {{{
    console.debug("Create PeerConnection with configuration: ", ICEConfiguration);
    const peerConnection = new RTCPeerConnection(ICEConfiguration);
    registerPeerConnectionListeners();

    recvData(peerConnection);

    // collecting ICE candidates {{{
    const calleeCandidatesCollection = peerRef.collection("calleeCandidates");
    let iceCandidateSendCount = 0;

    peerConnection.addEventListener("icecandidate", (event) => {
        if (!event.candidate) {
            console.debug("Got final candidate!");
            calleeCandidatesCollection.add({ type: "end", data: iceCandidateSendCount });
            return;
        }

        console.debug("Got candidate: ", event.candidate);
        iceCandidateSendCount++;
        const payload = { type: "candidate", data: event.candidate.toJSON() };
        calleeCandidatesCollection.add(payload);
    });
    // }}}

    // creating SDP answer {{{
    const { offer } = peerRef.data();
    console.debug("Got offer:", offer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    console.debug("Created answer:", answer);
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
        answer: {
            type: answer.type,
            sdp: answer.sdp,
        },
    };
    await peerRef.update(roomWithAnswer);
    // }}}

    // listening for remote ICE candidates {{{
    {
    // to handle out of order messages
    // this ensures that we always receive all candidates
        let iceCandidateReceivedCount = 0,
            expectedCandidateCount = Number.POSITIVE_INFINITY;
        peerRef.collection("callerCandidates")
            .onSnapshot((snapshot) => {
                snapshot.docChanges()
                    .forEach(async (change) => {
                        if (change.type === "added") {
                            const { type, data } = change.doc.data();

                            if (type === "end") {
                                expectedCandidateCount = data;
                            } else {
                                console.debug(`new remote ICE candidate: ${JSON.stringify(data)}`);
                                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                                iceCandidateReceivedCount++;
                            }
                        }

                        if (expectedCandidateCount === iceCandidateReceivedCount) {
                            peers.push(peerConnection);
                        }
                    });
            });
    }
    // }}}
} // }}}

async function joinRoomById(roomId) { // {{{
    console.log(`Joining room: '${roomId}'`);
    const db = await firebase.firestore(),
        roomRef = await db.collection("rooms").doc(roomId),
        roomSnapshot = await roomRef.get(),
        peerSnapshot = await roomRef.collection("peers").get();
    console.log("Got room? ", roomSnapshot.exists);

    if (!roomSnapshot.exists) {
        return;
    }
    setRoomId(roomId);

    peerSnapshot.forEach(async (peer) => { await processOffer(peer.ref); });

    // TODO: dup [MARKER:1]
    const selfRef = await roomRef.collection("peers").doc(MY_NAME);
    advertiseOfferForPeers(selfRef);
} // }}}

function recvData(peerConnection) { // {{{
    peerConnection.addEventListener("datachannel", (event) => {
        const dataChannelRecv = event.channel;

        dataChannelRecv.addEventListener("message", (eventMessage) => {
            console.log("Receiving Data on Client");
            const message = eventMessage.data;
            console.log(message);
        });

        dataChannels.push(dataChannelRecv);
    });
} // }}}

function hangUp(callback) { // {{{
    for (const peerConnection of peers) {
        peerConnection.close();
    }

    // remove self from peers on hangup {{{
    getRoomId(async (roomId) => {
        if (roomId) {
            const db = firebase.firestore(),
                selfRef = db.collection("rooms").doc(roomId).collection("peers").doc(MY_NAME),
                calleeCandidates = await selfRef.collection("calleeCandidates").get();

            calleeCandidates.forEach(async (candidate) => {
                await candidate.ref.delete();
            });

            const callerCandidates = await selfRef.collection("callerCandidates").get();
            callerCandidates.forEach(async (candidate) => {
                await candidate.ref.delete();
            });
            await selfRef.delete();
        }

        callback(true);
    });
    // }}}
} // }}}

// message listeners {{{
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
    default:
        console.log("Invalid input");
    }

    return false;
});
// }}}

// vim: fdm=marker ts=4 sts=4 sw=4
