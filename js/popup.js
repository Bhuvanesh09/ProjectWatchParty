function init() {
    const createRoomButton = document.getElementById("createRoom");
    createRoomButton.addEventListener("click", createRoom);

    const joinRoomButton = document.getElementById("joinRoom");
    joinRoomButton.addEventListener("click", joinRoom);

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
    const roomIdElm = document.getElementById("createdRoomId");
    roomIdElm.innerText = "Creating room...";

    chrome.runtime.sendMessage({ action: "createRoom" }, function (roomId) {
        if (chrome.runtime.lastError) {
            console.log("ERROR", chrome.runtime.lastError);
            roomIdElm.innerText = "Error creating room, check console logs";
        } else {
            roomIdElm.innerText = roomId;
        }
    });
}

function joinRoom(_clickEvent) {
    const statusElm = document.getElementById("createdRoomId");
    statusElm.innerText = "Joining room...";

    const roomIdElm = document.getElementById("roomCode"),
        roomId = roomIdElm.value;

    chrome.runtime.sendMessage({
        action: "joinRoom",
        roomId,
    }, function (status) {
        if (chrome.runtime.lastError) {
            console.log("ERROR", chrome.runtime.lastError);
            statusElm.innerText = "Error joining room, check console logs";
        } else {
            statusElm.innerText = status;
        }
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
