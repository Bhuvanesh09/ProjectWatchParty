function initMessaging() {
    chrome.runtime.onMessage.addListener(function ({
        action,
        ...message
    }, _sender, sendResponse) {
        switch (action) {
        case "controllerRequest": {
            const { requester } = message;
            displayRequestController(requester, (isAccepted) => {
                sendResponse(isAccepted);
            });
        }
            return true;
        case "controllerName": {
            const { controllerName } = message;
            displayCurrentController(controllerName);
        }
            break;
        default:
            console.log(`Unknown action: ${action}`);
        }

        return false;
    });
}

function initControls() {
    // INIT For the control panel
    const createRoomButton = document.getElementById("createRoom");
    createRoomButton.addEventListener("click", createRoom);

    const joinRoomButton = document.getElementById("joinRoom");
    joinRoomButton.addEventListener("click", joinRoom);

    const hangUpButton = document.getElementById("hangUp");
    hangUpButton.addEventListener("click", exitRoom);

    const requestContBtn = document.getElementById("request-controller");
    requestContBtn.addEventListener("click", requestController);
}

function initSyncBar(pplData) {
    // Init for the progress bar.
    // const bar = $("#syncBar");
    const bar = document.getElementById("syncBar");

    let barStringHtml = "<div class=\"progress\" id=\"netProgress\">";

    for (const name in pplData) {
        if (name === "master") {
            continue;
        } else {
            barStringHtml += `
            <div class="bar-step" id="${name}_barstep">
                <div class="label-line"></div>
                <div class="label-txt">${name}</div>
            </div>
            `;
        }
    }

    barStringHtml += `
    <div class="progress-bar progress-bar-success" id="bar" >${pplData.master}%</div>
    `; // Master's Done bar
    barStringHtml += "</div>"; // Closing the progress div

    document.getElementById("syncBar").innerHTML = barStringHtml;

    updateProgress(pplData);
}

function updateProgress(pplData) {
    document.getElementById("bar").style.width = `${pplData.master}%`;
    document.getElementById("bar").innerText = `${pplData.master}%`;
    for (const name in pplData) {
        if (name === "master") {
            continue;
        } else {
            document.getElementById(`${name}_barstep`).style.left = `${pplData[name]}%`;
        }
    }
}

function createRoom(_clickEvent) {
    const roomIdElm = document.getElementById("createdRoomId");
    roomIdElm.innerText = "Creating room...";

    chrome.runtime.sendMessage({ action: "createRoom" }, function (roomId) {
        if (chrome.runtime.lastError) {
            console.log("ERROR", chrome.runtime.lastError);
            roomIdElm.innerText = "Error creating room, check console logs";
        } else {
            roomIdElm.innerText = `${roomId}; copied to clipboard`;
            window.navigator.clipboard.writeText(roomId);
        }
    });
}

function requestController(_clickEvent) {
    const controllerElm = document.getElementById("current-controller");
    controllerElm.innerText = "Sending request....";

    chrome.runtime.sendMessage({ action: "requestController" }, function (ret) {
        if (chrome.runtime.lastError) {
            console.log("ERROR", chrome.runtime.lastError);
            controllerElm.innerText = "Error accessing controller, check console logs";
        } else {
            controllerElm.innerText = ret;
        }
    });
}

function joinRoom(_clickEvent) {
    const statusElm = document.getElementById("createdRoomId");
    statusElm.innerText = "Joining room...";

    const roomIdElm = document.getElementById("roomCode"),
        roomId = roomIdElm.value.trim();

    if (roomId === "") {
        statusElm.innerText = "Please enter the Room ID you want to join.";
        return;
    }

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

    // Will get
}

function exitRoom(_clickEvent) {
    const statusElm = document.getElementById("createdRoomId");
    statusElm.innerText = "Exiting room...";

    // TODO: give error if not joined any roomt yet

    chrome.runtime.sendMessage({
        action: "hangup",
    }, function (status) {
        if (chrome.runtime.lastError) {
            console.log("ERROR", chrome.runtime.lastError);
            statusElm.innerText = "Error exiting room, check console logs";
        } else {
            statusElm.innerText = status;
        }
    });
}

// TODO: integrate progress bar with actual time values
function testProgressBar() {
    const pplDat = {
        master: 50,
        A: 20,
        B: 60,
    };

    initSyncBar(pplDat);

    const event = setInterval(function () {
        pplDat.master += 2;
        pplDat.A += 3;
        pplDat.B += 1;
        updateProgress(pplDat);

        if (pplDat.master >= 100) {
            window.clearInterval(event);
        }
    }, 200);
}

let displayRequestController,
    initDisplayController,
    displayCurrentController;

(function () {
    let peerNameCurrent,
        callbackCurrent,
        controllerCurrent,
        acceptButton,
        rejectButton,
        spanRequesterName;

    displayRequestController = function (peerName, callback) {
        peerNameCurrent = peerName;
        callbackCurrent = callback;
        spanRequesterName.innerText = peerName;
    };

    displayCurrentController = function (peerName) {
        controllerCurrent.innerText = peerName;
        spanRequesterName.innerText = "";
        peerNameCurrent = callbackCurrent = null;
    };

    initDisplayController = function () {
        acceptButton = document.getElementById("allowRequest");
        rejectButton = document.getElementById("denyRequest");
        spanRequesterName = document.getElementById("controller-requester");
        controllerCurrent = document.getElementById("current-controller");

        function replier(status) {
            return function (_clickEvent) {
                if (peerNameCurrent) {
                    callbackCurrent(status);
                    peerNameCurrent = false;
                }
            };
        }

        acceptButton.addEventListener("click", replier(true));
        rejectButton.addEventListener("click", replier(false));
    };
}());

function init() {
    initControls();
    initMessaging();
    initDisplayController();
}

(function checkInit() {
    if (document.readyState === "complete") {
        init();
    } else {
        setTimeout(checkInit, 100);
    }
}());
