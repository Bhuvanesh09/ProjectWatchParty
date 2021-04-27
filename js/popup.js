/* global $ */

const StateKinds = Object.freeze({
    ALONE: 0,
    UNFOLLOW: 1,
    FOLLOW: 2,
});

let ROOMID,
    currState,
    currentControllerGlobal;

function modifyDisplayOnState() {
    if (currState === StateKinds.ALONE) {
        $("#hangUp")
            .addClass("hide");
        $("#toggle-follow-btn")
            .addClass("hide");
        $("#controller-elements")
            .addClass("hide");
        $("#openChatWindow")
            .addClass("hide");
        $("#syncBar")
            .addClass("hide");
    } else {
        document.getElementById("roomInfoValue").innerHTML = ROOMID;
        $("#joinSession")
            .addClass("hide");
        document.getElementById("usernameInput").disabled = true;
        $("#hangUp")
            .removeClass("hide");
        $("#controller-elements")
            .removeClass("hide");
        $("#openChatWindow")
            .removeClass("hide");
        $("#toggle-follow-btn")
            .removeClass("hide");

        if (currState === StateKinds.FOLLOW) {
            $("#syncBar")
                .addClass("hide");
        } else {
            $("#syncBar")
                .removeClass("hide");
        }
    }

    if (document.getElementById("usernameInput").value === currentControllerGlobal) {
        $("#passControllerToOthers")
            .removeClass("hide");
        $("#request-controller")
            .addClass("hide");
        $("#myRequestStatus")
            .addClass("hide");
        $("#toggle-follow-btn")
            .addClass("hide");
        $("#request-controller-status")
            .addClass("hide");
    } else {
        $("#passControllerToOthers")
            .addClass("hide");
        $("#request-controller")
            .removeClass("hide");
        $("#toggle-follow-btn")
            .removeClass("hide");
        $("#myRequestStatus")
            .removeClass("hide");
        $("#request-controller-status")
            .removeClass("hide");
    }
}

function initMessaging() {
    chrome.runtime.onMessage.addListener(function ({
        action,
        ...message
    }, _sender, sendResponse) {
        switch (action) {
        case "controllerRequest": {
            const { requesterList } = message;
            displayRequestController(requesterList, (isAccepted) => {
                sendResponse(isAccepted);
            });
        }
            return true;
        case "controllerName": {
            const { controllerName } = message;
            displayCurrentController(controllerName);
        }
            break;
        case "deniedController":
            document.getElementById("request-controller-status").innerText = "Request denied!";
            break;
            // TODO: use for profile picture, roomId, etc.
        case "sessionInfo": {
            // @bhuvanesh
            const {
                roomId,
                state,
                url,
            } = message;
            console.debug("Received data", roomId, state, url);
            ROOMID = roomId;
            currState = state;
            modifyDisplayOnState();
        }
            break;
        case "backToPopCurrentTime": {
            const {
                time,
                totalTime,
            } = message;
            console.log(`changing time to ${time}, ${totalTime}`);
            updateProgressBar(time, totalTime);
        }
            break;
        default:
            console.log(`Unknown action: ${action}`);
        }

        return false;
    });

    chrome.runtime.sendMessage({ action: "sendSessionInfo" });
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

    const openChatBtn = document.getElementById("openChatWindow");
    openChatBtn.addEventListener("click", openChatWindow);

    const toggleFollow = document.getElementById("toggle-follow-btn");
    toggleFollow.addEventListener("click", toggleFollowHandler);
}

function toggleFollowHandler(_clickEvent) {
    chrome.runtime.sendMessage({ action: "toggleFollow" }, (response) => {
        currState = response;
    });
}

function checkAlreadySet(currentName) {
    console.log(`current name =${currentName}`);
    if (currentName != null) {
        document.getElementById("usernameInput").value = currentName;
    } else {
        usernameChanged(document.getElementById("usernameInput").value);
    }
    document.getElementById("usernameInput").onchange = function () {
        usernameChanged(document.getElementById("usernameInput").value);
    };
}

function initUsername() {
    return new Promise((resolve, _reject) => {
        chrome.storage.local.get("username", (res) => {
            resolve(res.username);
        });
    });
}

function initSyncBar(time, totalTime) {
    let barStringHtml = "<h6> Controller's Time </h6>";
    barStringHtml += "<div class=\"progress\" id=\"netProgress\">";

    barStringHtml += `
    <div class="progress-bar progress-bar-success" id="bar" >${0}%</div>
`; // Master's Done bar
    barStringHtml += "</div>"; // Closing the progress div

    document.getElementById("syncBar").innerHTML = barStringHtml;

    updateProgressBar(time, totalTime);
}

function usernameChanged(newUsername) {
    chrome.storage.local.set({
        username: newUsername,
    });
    console.log(`Local username changed to:${newUsername}`);
    chrome.runtime.sendMessage({
        action: "updateUsername",
    });
}

function openChatWindow(_clickEvent) {
    chrome.windows.create({
        url: chrome.runtime.getURL("../html/chat.html"),
        type: "popup",
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
            roomIdElm.innerText = `Room ID: ${roomId}; copied to clipboard`;
            window.navigator.clipboard.writeText(roomId);
        }
    });
}

function requestController(_clickEvent) {
    const controllerElm = document.getElementById("request-controller-status");
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
}

function exitRoom(_clickEvent) {
    const statusElm = document.getElementById("createdRoomId");
    statusElm.innerText = "Exiting room...";

    // TODO: give error if not joined any room yet

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

function formatFromSeconds(time) {
    // Hours, minutes and seconds
    const hrs = Math.floor(time / 3600),
        mins = Math.floor((time % 3600) / 60),
        secs = Math.floor(time % 60);

    // Output like "1:01" or "4:03:59" or "123:03:59"
    let ret = "";
    if (hrs > 0) {
        ret += `${hrs}:${mins < 10 ? "0" : ""}`;
    }
    ret += `${mins}:${secs < 10 ? "0" : ""}`;
    ret += `${secs}`;
    return ret;
}

function updateProgressBar(time, totalTime) {
    if (time == null) {
        time = 0;
    }

    const perc = (parseFloat(time) * 100) / parseFloat(totalTime);
    document.getElementById("bar").style.width = `${perc}%`;
    document.getElementById("bar").innerText = `${formatFromSeconds(time.toFixed(0))} / ${formatFromSeconds(totalTime.toFixed(0))}`;
}

let displayRequestController,
    initDisplayController,
    displayCurrentController;

(function () {
    let controllerCurrent,
        peerRequestList,
        denyAllButton;

    displayRequestController = function (peerRequestIncomingNames) {
        while (peerRequestList.firstChild) {
            peerRequestList.removeChild(peerRequestList.lastChild);
        }

        function accepterHandler(peerName) {
            return function (_clickEvent) {
                chrome.runtime.sendMessage({
                    action: "peerRequestAcceptedOne",
                    peerName,
                });
            };
        }

        for (const peerName of peerRequestIncomingNames) {
            const acceptButton = document.createElement("button");
            acceptButton.innerText = peerName;

            acceptButton.classList.add("btn", "btn-success");
            acceptButton.addEventListener("click", accepterHandler(peerName));

            const li = document.createElement("li");
            li.appendChild(acceptButton);

            peerRequestList.appendChild(li);
        }
    };

    displayCurrentController = function (peerName) {
        controllerCurrent.innerText = peerName;
        currentControllerGlobal = peerName;
    };

    initDisplayController = function () {
        peerRequestList = document.getElementById("peerRequestList");
        denyAllButton = document.getElementById("denyAllRequests");
        controllerCurrent = document.getElementById("current-controller");

        denyAllButton.addEventListener("click", function () {
            chrome.runtime.sendMessage({ action: "peerRequestDeniedAll" });
        });
    };
}());

function init() {
    initControls();
    initMessaging();
    initDisplayController();
    initUsername()
        .then((currentName) => {
            checkAlreadySet(currentName);
        });
    initSyncBar();
}

(function checkInit() {
    if (document.readyState === "complete") {
        init();
    } else {
        setTimeout(checkInit, 100);
    }
}());
