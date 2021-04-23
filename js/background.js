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
    },
    peers = [];

let MY_NAME,
    currentControllerPeerObject = null;

class Peer { // {{{
    static SENDER_TYPE = "sender";

    static RECEIVER_TYPE = "receiver";

    peerConnection;

    dataChannel;

    type;

    peerName;

    constructor(peerName, peerConnection, dataChannel, type) {
        this.peerName = peerName;
        this.peerConnection = peerConnection;
        this.dataChannel = dataChannel;
        this.type = type;
    }

    close() {
        this.peerConnection.close();
    }

    isSendable() {
        return this.dataChannel.readyState === "open";
    }

    getDescription() {
        return this.peerName;
    }

    sendStringified(packet) {
        console.log(`rtc> Sending message: ${packet} to ${this.getDescription()}`);
        this.dataChannel.send(packet);
    }

    send(packet) {
        this.sendStringified(JSON.stringify(packet));
    }

    sendNewController() {
        this.send({
            action: Controller.GIVE_TYPE,
            controllerName: currentControllerPeerObject.peerName,
        });
    }
} // }}}

class Controller {
    static REQUEST_TYPE = "requestController";

    static GIVE_TYPE = "giveController";

    static DENY_TYPE = "denyController";

    static requests = [];

    static notifyOfCurrentController() {
        chrome.runtime.sendMessage({
            action: "controllerName",
            controllerName: currentControllerPeerObject ? currentControllerPeerObject.peerName : "No controller yet",
        });
    }

    static setController(newControllerName, notifyPeer = false) {
        if (!newControllerName) {
            return;
        }

        console.debug(`Controller: setting new controller to ${newControllerName}`);

        if (newControllerName === MY_NAME) {
            this.meController();
        } else {
            let found = false;

            for (const peer of peers) {
                if (peer.peerName === newControllerName) {
                    found = true;

                    currentControllerPeerObject = peer;
                    if (notifyPeer) {
                        currentControllerPeerObject.sendNewController();
                    }
                    break;
                }
            }

            if (!found) {
                console.error(`Controller: Received name ${newControllerName} but not found in peer list`);
                return;
            }
        }

        this.notifyOfCurrentController();
    }

    static meController() {
        console.debug("Setting myself the controller");
        currentControllerPeerObject = new Peer(MY_NAME);

        // broadcast my being the new controller to all my peers
        for (const peer of peers) {
            peer.sendNewController();
        }
    }

    static addNewRequest(peerObject) {
        Controller.requests.push(peerObject);
    }

    static notifyOfRequestList() {
        chrome.runtime.sendMessage({
            action: "controllerRequest",
            requesterList: Controller.requests.map((peerObj) => peerObj.peerName),
        });
    }

    static clearRequestList() {
        for (const peerObj of this.requests) {
            if (peerObj.peerName !== currentControllerPeerObject.peerName) {
                peerObj.send({ action: Controller.DENY_TYPE });
            }
        }
        this.requests = [];
        this.notifyOfRequestList();
    }

    static async receivedRequest(peerObject) {
        for (const peerReqs of this.requests) {
            if (peerReqs.peerName === peerObject.peerName) {
                return;
            }
        }
        const remoteDesc = peerObject.getDescription();

        console.debug(`Controller: Received request from: ${remoteDesc}`);

        this.addNewRequest(peerObject);
        this.notifyOfRequestList();
    }

    static async requestControllerAccess(callback) {
        if (currentControllerPeerObject.peerName === MY_NAME) {
            callback("You are already a controller");
        } else {
            const msg = { action: Controller.REQUEST_TYPE };

            console.debug(`Sending request ${msg} to controller: ${currentControllerPeerObject.getDescription()}`);

            currentControllerPeerObject.send(msg);

            callback("Request sent");
        }
    }
}

// TODO: add an interface to allow the user to set this
chrome.storage.local.get("username", (username) => {
    MY_NAME = username.username;
});

class ROOM_ID {
    ROOM_ID_KEY = "roomId";

    static get(callback) {
        chrome.storage.local.get([ROOM_ID.ROOM_ID_KEY], function (result) {
            let joinedRoomId;
            if (typeof result[ROOM_ID.ROOM_ID_KEY] === "undefined") {
                joinedRoomId = result[ROOM_ID.ROOM_ID_KEY];
            } else {
                joinedRoomId = undefined;
            }
            callback(joinedRoomId);
        });
    }

    static set(value) {
        chrome.storage.local.set({ ROOM_ID_KEY: value }, function () {
            if (chrome.runtime.lastError) {
                console.log("Whoops! What went wrong?", chrome.runtime.lastError);
            }
        });
    }
}

function iceCandidateCollector(peerConnection, candidateCollection) {
    let iceCandidateSendCount = 0;

    // collecting ICE candidates {{{
    peerConnection.addEventListener("icecandidate", (event) => {
        if (!event.candidate) {
            console.debug("Got final candidate!");
            candidateCollection.add({
                type: "end",
                data: iceCandidateSendCount,
            });
            return;
        }

        console.debug("Got candidate: ", event.candidate);
        iceCandidateSendCount++;
        const payload = {
            type: "candidate",
            data: event.candidate.toJSON(),
        };
        candidateCollection.add(payload);
    });
}

async function advertiseOfferForPeers(selfRef) { // {{{
    let sendPrepData;

    (function closureForPrepData() {
        let initCount = 0,
            peerObject = null,
            dataChannel = null;

        sendPrepData = function (peerObjectRecv, dataChannelRecv) {
            if (peerObjectRecv) {
                peerObject = peerObjectRecv;
            }
            if (dataChannelRecv) {
                dataChannel = dataChannelRecv;
            }

            initCount++;

            if (initCount === 2) {
                dataChannel.addEventListener("message", receiveDataHandler(peerObject));

                peerObject.send({
                    action: "initInfo",
                    controllerName: currentControllerPeerObject.peerName,
                });
            }
        };
    }());

    const peerConnection = new RTCPeerConnection(ICEConfiguration);
    registerPeerConnectionListeners(peerConnection);
    console.debug("Create PeerConnection with configuration: ", ICEConfiguration);

    const dataChannel = peerConnection.createDataChannel("TimestampDataChannel");

    dataChannel.addEventListener("open", (_event) => {
        console.log(_event, "Datachannel opened");
        sendPrepData(undefined, dataChannel);
    });

    const callerCandidatesCollection = await selfRef.collection("callerCandidates");

    iceCandidateCollector(peerConnection, callerCandidatesCollection);

    // creating an offer {{{
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.debug("Created offer:", offer);

    const roomWithOffer = {
        offer: {
            type: offer.type,
            sdp: offer.sdp,
        },
        peerName: MY_NAME,
    };

    await selfRef.set(roomWithOffer);
    // }}}

    let remotePeerName = null;

    // listening for remote session description {{{
    selfRef.onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
            remotePeerName = data.peerName;
            console.debug("Got remote description: ", data.answer, "from", remotePeerName);
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
                // prevent listener from being fired if it has been invalidated
                if (expectedCandidateCount < 0) {
                    return;
                }

                snapshot.docChanges()
                    .forEach(async (change) => {
                        if (change.type === "added") {
                            const {
                                type,
                                data,
                            } = change.doc.data();

                            if (type === "end") {
                                expectedCandidateCount = data;
                            } else {
                                console.debug(`new remote ICE candidate: ${JSON.stringify(data)}`);
                                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                                iceCandidateReceivedCount++;
                            }
                        }

                        if (expectedCandidateCount === iceCandidateReceivedCount) {
                            console.debug("Collected all remote ice candidates");
                            const newPeer = new Peer(remotePeerName, peerConnection, dataChannel, Peer.SENDER_TYPE);
                            peers.push(newPeer);

                            sendPrepData(newPeer);

                            advertiseOfferForPeers(selfRef);

                            const calleeCandidates = await selfRef.collection("calleeCandidates")
                                .get();

                            // invalidate this snapshot listener since this peer connection
                            // has been established successfully.
                            expectedCandidateCount = Number.NEGATIVE_INFINITY;

                            // invalidate before deletion so that this listener doesn't fire again
                            calleeCandidates.forEach(async (candidate) => {
                                await candidate.ref.delete();
                            });
                        }
                    });
            });
    }
    // }}}
} // }}}

async function createRoom() { // {{{
    const roomRef = firebase.firestore()
        .collection("rooms")
        .doc();
    // firestore doesnt like empty documents.
    // fill dummy data to actually create the document
    // [firestore web ui will display the document name in italics if it doesn't actually exist]
    await roomRef.set({ exists: true });

    // TODO: dup [MARKER:1]
    const selfRef = await roomRef.collection("peers")
        .doc(MY_NAME);

    // the creator of the room is its initial controller
    Controller.setController(MY_NAME);
    advertiseOfferForPeers(selfRef);

    ROOM_ID.set(roomRef.id);
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
        // TODO: listen for disconnected here and drop controller accordingly
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState
    });
} // }}}

async function processOffer(peerRef) { // {{{
    console.debug("Create PeerConnection with configuration: ", ICEConfiguration);
    const peerConnection = new RTCPeerConnection(ICEConfiguration);
    registerPeerConnectionListeners(peerConnection);

    // collecting ICE candidates {{{
    const calleeCandidatesCollection = peerRef.collection("calleeCandidates");
    iceCandidateCollector(peerConnection, calleeCandidatesCollection);

    // creating SDP answer {{{
    const peerSnapshot = await peerRef.get(),
        {
            offer,
            peerName,
        } = peerSnapshot.data();

    console.debug("Got offer:", offer, "from", peerName);

    recvData(peerConnection, peerName);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    console.debug("Created answer:", answer);
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
        answer: {
            type: answer.type,
            sdp: answer.sdp,
        },
        peerName: MY_NAME,
    };
    await peerRef.update(roomWithAnswer);
    // }}}

    // listening for remote ICE candidates {{{
    // to handle out of order messages
    // this ensures that we always receive all candidates
    peerRef.collection("callerCandidates")
        .onSnapshot((snapshot) => {
            snapshot.docChanges()
                .forEach(async (change) => {
                    if (change.type === "added") {
                        const {
                            type,
                            data,
                        } = change.doc.data();

                        if (type !== "end") {
                            console.debug(`new remote ICE candidate: ${JSON.stringify(data)}`);
                            await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                        }
                    }
                });
        });
    // }}}
} // }}}

async function joinRoomById(roomId) { // {{{
    console.log(`Joining room: '${roomId}'`);
    const db = await firebase.firestore(),
        roomRef = await db.collection("rooms")
            .doc(roomId),
        roomSnapshot = await roomRef.get(),
        peerSnapshot = await roomRef.collection("peers")
            .get();
    console.log("Got room? ", roomSnapshot.exists);

    if (!roomSnapshot.exists) {
        return;
    }
    ROOM_ID.set(roomId);

    peerSnapshot.forEach(async (peer) => {
        await processOffer(peer.ref);
    });

    // TODO: dup [MARKER:1]
    const selfRef = await roomRef.collection("peers")
        .doc(MY_NAME);
    advertiseOfferForPeers(selfRef);
} // }}}

async function sendData(object) {
    const packet = JSON.stringify(object);

    for (const peer of peers) {
        if (peer.isSendable()) {
            peer.sendStringified(packet);
        }
    }
}

function receiveDataHandler(peerObject) {
    const remoteName = peerObject.peerName;

    return (eventMessage) => {
        console.log(`rtc> Received Message: ${eventMessage.data} from ${remoteName}`);

        const {
            action,
            ...message
        } = JSON.parse(eventMessage.data);

        switch (action) {
        case "initInfo":
            // TODO: profile picture and names go here

        case Controller.GIVE_TYPE: {
            const { controllerName } = message;
            Controller.setController(controllerName);
        }
            break;
        case "synctime":
            Time.receive(message);
            break;
        case Controller.REQUEST_TYPE:
            Controller.receivedRequest(peerObject);
            break;
        case Controller.DENY_TYPE:
            chrome.runtime.sendMessage({ action: "deniedController" });
            break;
        default:
            console.debug(`Action ${action} not matched`);
        }
    };
}

function recvData(peerConnection, remoteName) { // {{{
    peerConnection.addEventListener("datachannel", (event) => {
        const dataChannelRecv = event.channel,
            newPeer = new Peer(remoteName, peerConnection, dataChannelRecv, Peer.RECEIVER_TYPE);

        peers.push(newPeer);

        dataChannelRecv.addEventListener("message", receiveDataHandler(newPeer));
    });
} // }}}

function hangUp(callback) { // {{{
    for (const peerConnection of peers) {
        peerConnection.close();
    }

    // remove self from peers on hangup {{{
    ROOM_ID.get(async (roomId) => {
        if (roomId) {
            const db = firebase.firestore(),
                selfRef = db.collection("rooms")
                    .doc(roomId)
                    .collection("peers")
                    .doc(MY_NAME),
                calleeCandidates = await selfRef.collection("calleeCandidates")
                    .get();

            calleeCandidates.forEach(async (candidate) => {
                await candidate.ref.delete();
            });

            const callerCandidates = await selfRef.collection("callerCandidates")
                .get();
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
    case "requestController":
        Controller.requestControllerAccess((status) => {
            sendResponse(status);
        });

        return true;
    case "sendStartupInfo":
        Controller.notifyOfCurrentController();
        Controller.notifyOfRequestList();

        break;
    case "peerRequestDeniedAll":
        Controller.clearRequestList();
        break;
    case "peerRequestAcceptedOne": {
        const { peerName } = others;
        Controller.setController(peerName, true);
        Controller.clearRequestList();
    }
        break;
    default:
        console.debug(`Unknown action: ${action} requested!`);
    }

    return false;
});
// }}}

// TODO: "sync this video" browser action only for the controller
// chrome.contextMenus.create();

// vim: fdm=marker ts=4 sts=4 sw=4
