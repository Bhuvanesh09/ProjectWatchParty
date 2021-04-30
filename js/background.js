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

    resetAppStateOnDisconnect();
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
};
let appState;

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
            controllerName: appState.getCurrentControllerName(),
        });
    }
} // }}}

class Controller { // {{{
    static REQUEST_TYPE = "requestController";

    static GIVE_TYPE = "giveController";

    static DENY_TYPE = "denyController";

    static requests = [];

    static setController(newControllerName, notifyPeer = false) {
        if (!newControllerName) {
            return;
        }

        appState.setNewController(newControllerName, notifyPeer);
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
            if (peerObj.peerName !== appState.getCurrentControllerName()) {
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
        appState.requestController(callback);
    }
} // }}}

class AppState { // {{{
    static STATE = Object.freeze({
        ALONE: 0,
        UNFOLLOW: 1,
        FOLLOW: 2,
    });

    static ROOM_ID_KEY = "roomId";

    state;

    roomData;

    personalData;

    shouldFollow() {
        return this.state === AppState.STATE.FOLLOW;
    }

    isMyselfController() {
        return this.getMyName() === this.getCurrentControllerName();
    }

    setVideo(url) {
        this.roomData.videoURL = url;
    }

    shouldSendToPeers(url) {
        const { videoURL } = this.roomData;
        return this.isMyselfController() && videoURL === url;
    }

    // when sending to a newly joined peer
    prepareInitInfo() {
        return {
            action: "initInfo",
            controllerName: this.getCurrentControllerName(),
        };
    }

    // when receiving from a peer after joining a new connection
    static receiveInitInfo(message) {
        const { controllerName } = message;
        Controller.setController(controllerName);
    }

    addPeer(newPeer) {
        this.roomData.peers.push(newPeer);
    }

    // when joining room, creating room, etc.
    startFollowing() {
        this.state = AppState.STATE.FOLLOW;
    }

    meController() {
        console.debug("Setting myself the controller");
        this.roomData.currentController = new Peer(this.getMyName());
        this.startFollowing();

        // broadcast my being the new controller to all my peers
        for (const peer of this.roomData.peers) {
            peer.sendNewController();
        }
    }

    notifyOfCurrentController() {
        chrome.runtime.sendMessage({
            action: "controllerName",
            controllerName: this.getCurrentControllerName(),
        });
    }

    setNewController(newControllerName, notifyPeer = false) {
        console.debug(`AppState: setting new controller to ${newControllerName}`);

        if (newControllerName === this.getMyName()) {
            this.meController();
        } else {
            let found = false;

            for (const peer of this.roomData.peers) {
                if (peer.peerName === newControllerName) {
                    found = true;

                    this.roomData.currentController = peer;
                    if (notifyPeer) {
                        peer.sendNewController();
                    }
                    break;
                }
            }

            if (!found) {
                console.error(`Controller: Received name ${newControllerName}
but not found in peer list`);
                return;
            }
        }

        this.notifyOfCurrentController();
    }

    getMyNameFromStorage() {
        chrome.storage.local.get("username", ({ username }) => {
            this.setMyName(username);
        });
    }

    static setMyNameIntoStorage(username) {
        chrome.storage.local.set({ username });
    }

    setMyName(username) {
        this.personalData.username = username;
    }

    getMyName() {
        return this.personalData.username;
    }

    getCurrentControllerName() {
        const cont = this.roomData.currentController;
        return cont ? cont.peerName : "No controller yet";
    }

    requestController(callback) {
        if (this.isMyselfController()) {
            callback("You are already a controller");
        } else {
            const msg = { action: Controller.REQUEST_TYPE },
                cont = this.roomData.currentController;

            console.debug(`Sending request ${msg} to controller: ${cont.getDescription()}`);

            cont.send(msg);

            callback("Request sent");
        }
    }

    getRoomId() {
        return this.roomData.roomId;
    }

    setRoomId(value) {
        this.roomData.roomId = value;
    }

    addMessage(msg) {
        this.roomData.messageHistory.push(msg);
    }

    constructor() {
        this.state = AppState.STATE.ALONE;
        this.roomData = {
            roomId: null,
            peers: [],
            currentController: null,
            videoURL: "",
            messageHistory: [],
        };
        this.personalData = {
            username: "",
            profilePicture: "",
        };

        this.getMyNameFromStorage();
    }

    async hangUp(callback) {
        for (const peerConnection of this.roomData.peers) {
            peerConnection.close();
        }

        // remove self from peers on hangup
        if (this.getRoomId()) {
            const db = firebase.firestore(),
                selfRef = db.collection("rooms")
                    .doc(this.getRoomId())
                    .collection("peers")
                    .doc(this.getMyName()),
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

        appState = new AppState();

        callback(true);
    }

    sendSessionInfoPopup() {
        appState.notifyOfCurrentController();
        Controller.notifyOfRequestList();

        const dataSend = {
            action: "sessionInfo",
            state: this.state,
            roomId: this.getRoomId(),
            url: this.roomData.videoURL,
        };
        chrome.runtime.sendMessage(dataSend);
    }

    followToggle(callback) {
        if (!this.isMyselfController()) {
            if (this.state === AppState.STATE.FOLLOW) {
                this.state = AppState.STATE.UNFOLLOW;
            } else if (this.state === AppState.STATE.UNFOLLOW) {
                this.state = AppState.STATE.FOLLOW;
            }

            if (this.state === AppState.STATE.UNFOLLOW) {
                // eslint-disable-next-line no-undef
                Time.tellNoFollow({ url: this.roomData.videoURL });
            }
        }

        callback(this.state);
    }

    roomJoined(roomId) {
        this.setRoomId(roomId);
        this.roomData.videoURL = "";
    }
} // }}}

appState = new AppState();

function resetAppStateOnDisconnect() {
    firebase.firestore()
        .collection("connectivity")
        .onSnapshot({
            includeMetadataChanges: true,
        }, (snapshot) => {
            if (snapshot.metadata.fromCache) {
                // definitely offline if this is true
                // reset appState
                appState = new AppState();
            }
        });
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
    // }}}
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

                peerObject.send(appState.prepareInitInfo());
            }
        };
    }());

    const peerConnection = new RTCPeerConnection(ICEConfiguration);
    registerPeerConnectionListeners(peerConnection);
    console.debug("Create PeerConnection with configuration: ", ICEConfiguration);

    const dataChannel = peerConnection.createDataChannel("TimestampDataChannel");

    dataChannel.addEventListener("open", (_event) => {
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
        peerName: appState.getMyName(),
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
                            const newPeer = new Peer(remotePeerName,
                                peerConnection, dataChannel, Peer.SENDER_TYPE);
                            appState.addPeer(newPeer);

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

function updateUsername() {
    appState.getMyNameFromStorage();
}

async function createRoom() { // {{{
    const roomRef = firebase.firestore()
        .collection("rooms")
        // eslint-disable-next-line no-undef
        .doc(generateUniqInviteLink());
    // firestore doesnt like empty documents.
    // fill dummy data to actually create the document
    // [firestore web ui will display the document name in italics if it doesn't actually exist]
    await roomRef.set({ exists: true });

    // TODO: dup [MARKER:1]
    const selfRef = await roomRef.collection("peers")
        .doc(appState.getMyName());

    // the creator of the room is its initial controller
    Controller.setController(appState.getMyName());
    advertiseOfferForPeers(selfRef);

    appState.roomJoined(roomRef.id);
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

        function isPeerDisconnected(peer) {
            return peer.peerConnection.connectionState !== "connected";
        }

        const currentControllerName = appState.getCurrentControllerName(),
            peersSortedByName = appState.roomData.peers.map((peer) => peer.peerName)
                // There were only two users in the meeting and the
                // controller (the other peer) has left
                .concat(appState.getMyName())
                .sort(
                    (peerNameA, peerNameB) => peerNameA.localeCompare(peerNameB),
                );

        let wasControllerDisconnected = false;

        appState.roomData.peers = appState.roomData.peers.filter(
            (peer) => {
                if (!isPeerDisconnected(peer)) {
                    return true;
                }

                if (peer.peerName === currentControllerName) {
                    wasControllerDisconnected = true;
                }

                return false;
            },
        );

        if (wasControllerDisconnected) {
            if (peersSortedByName[0] === currentControllerName) {
                peersSortedByName.shift();
            }

            const newControllerName = peersSortedByName[0];

            // now, peersSortedByName[0] should become the new peer
            if (appState.getMyName() === newControllerName) {
                appState.setNewController(appState.getMyName());
            }
        }
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
        peerName: appState.getMyName(),
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
    appState.setRoomId(roomId);
    appState.startFollowing();

    peerSnapshot.forEach(async (peer) => {
        await processOffer(peer.ref);
    });

    // TODO: dup [MARKER:1]
    const selfRef = await roomRef.collection("peers")
        .doc(appState.getMyName());
    advertiseOfferForPeers(selfRef);
} // }}}

// eslint-disable-next-line no-unused-vars
async function sendData(object) {
    const packet = JSON.stringify(object);

    for (const peer of appState.roomData.peers) {
        if (peer.isSendable()) {
            peer.sendStringified(packet);
        }
    }
} // }}}

function receiveDataHandler(peerObject) {
    const remoteName = peerObject.peerName,
        RTT_SEND = "rttSend",
        RTT_RESULT = "rttResult",
        RTT_RECEIVE = "rttReceive",
        MAX_ROUNDS = 5;

    let times,
        peerDelay; // assuming symmetrical data channel

    function roundTripTime() {
        if (times.length === MAX_ROUNDS) {
            peerDelay = 0;
            for (const [a, c] of times) {
                peerDelay += c - a;
            }
            peerDelay /= 2 * MAX_ROUNDS;

            console.debug("Final peer delay", peerDelay);

            peerObject.send({
                action: RTT_RESULT,
                peerDelay,
            });
        } else {
            times.push([Date.now()]);
            peerObject.send({ action: RTT_SEND });
        }
    }

    function startCalculatingRTT() {
        times = []; // each element is 3-elm: [time sent, time he received, time I received back]
        roundTripTime();
    }

    return (eventMessage) => {
        console.log(`rtc> Received Message: ${eventMessage.data} from ${remoteName}`);

        const {
            action,
            ...message
        } = JSON.parse(eventMessage.data);

        switch (action) {
        case RTT_RESULT:
            peerDelay = message.peerDelay;
            console.debug("Final peer delay", peerDelay);
            break;
        case RTT_SEND:
            peerObject.send({
                action: RTT_RECEIVE,
            });
            break;
        case RTT_RECEIVE: {
            const last = times[times.length - 1];
            last.push(Date.now());
            console.debug(`Latest RTT calculation (${times.length}): ${last}`);
        }
            roundTripTime();
            break;
            // TODO: profile picture and names go here
        case "initInfo":
            startCalculatingRTT();
            // eslint-disable-next-line no-fallthrough
        case Controller.GIVE_TYPE:
            AppState.receiveInitInfo(message);
            break;
        case "synctime":
            if (appState.shouldFollow()) {
                // eslint-disable-next-line no-undef
                Time.receive(message, peerDelay);
            } else {
                chrome.runtime.sendMessage({
                    action: "backToPopCurrentTime",
                    time: message.time,
                    totalTime: message.totalTime,
                });
            }
            break;
        case Controller.REQUEST_TYPE:
            Controller.receivedRequest(peerObject);
            break;
        case Controller.DENY_TYPE:
            chrome.runtime.sendMessage({ action: "deniedController" });
            break;
        case "textMessage": {
            const messageText = message.messageString;
            addToHistory(remoteName, messageText);
            receivedTextMessage(messageText, remoteName);
        }
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

        appState.addPeer(newPeer);
        dataChannelRecv.addEventListener("message", receiveDataHandler(newPeer));
    });
} // }}}

function addToHistory(sender, messageString) {
    appState.addMessage({
        sender,
        messageString,
    });
}

// eslint-disable-next-line no-unused-vars
function populateChatWindow() {
    for (const message of appState.roomData.messageHistory) {
        chrome.runtime.sendMessage({
            action: "textMessageReceiving",
            senderName: message.sender,
            messageString: message.messageString,
        }, () => {
            console.log("Message was received here.");
        });
    }
}

function receivedTextMessage(message, remoteName) {
    console.log(`${message} from ${remoteName}`);

    chrome.notifications.create(appState.roomData.messageHistory.length.toString(), {
        message,
        title: `New Watch Party Message from ${remoteName}!`,
        type: "basic",
        iconUrl: "/images/get_started16.png",
    });

    chrome.browserAction.getBadgeText({}, function (text) {
        if (text === "") {
            chrome.browserAction.setBadgeText({ text: "1" });
        } else {
            chrome.browserAction.setBadgeText({ text: (1 + Number.parseInt(text, 10)).toString() });
        }
    });

    chrome.runtime.sendMessage({
        action: "textMessageReceiving",
        senderName: remoteName,
        messageString: message,
    }, () => {
        console.log("Message was received here.");
    });
}

chrome.contextMenus.create({
    // eslint-disable-next-line no-undef
    documentUrlPatterns: VideoController.documentURLMatchPatterns,
    onclick: (_info, tab) => {
        const { url } = tab;
        if (appState.isMyselfController()) {
            appState.setVideo(url);
        } else {
            chrome.tabs.sendMessage(tab.id, { action: "showError" });
        }
    },
    title: "Sync this video",
});

chrome.notifications.onClicked.addListener(() => {
    chrome.windows.create({
        url: chrome.runtime.getURL("../html/chat.html"),
        type: "popup",
    });
});

// SENDING THE CURRENT STATE EACH SECOND

setInterval(() => {
    appState.sendSessionInfoPopup();
}, 400);

// vim: fdm=marker ts=4 sts=4 sw=4
