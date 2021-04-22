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
    let peerNames,
        controllerCurrent,
        requesterTableBody;

    displayRequestController = function (peerNameList) {
        while (requesterTableBody.firstChild) {
            requesterTableBody.removeChild(requesterTableBody.lastChild);
        }

        function replier(peerNameActual, status) {
            return function (_clickEvent) {
                // TODO: send msg to background
            };
        }

        for (const peerName of peerNames) {
            const span = document.createElement("span");
            span.innerText = peerName;

            const acceptButton = document.createElement("button"),
                rejectButton = document.createElement("button");

            acceptButton.classList.add("btn", "btn-success");
            rejectButton.classList.add("btn", "btn-danger");
            acceptButton.addEventListener("click", replier(peerName, true));
            rejectButton.addEventListener("click", replier(peerName, false));

            const tr = document.createElement("tr");

            let td = document.createElement("td");
            td.appendChild(span);
            tr.appendChild(td);

            td = document.createElement("td");
            td.appendChild(acceptButton);
            tr.appendChild(td);

            td = document.createElement("td");
            td.appendChild(rejectButton);
            tr.appendChild(td);

            requesterTableBody.appendChild(tr);
        }
    };

    displayCurrentController = function (peerName) {
        controllerCurrent.innerText = peerName;
        displayRequestController([]);
    };

    initDisplayController = function () {
        requesterTableBody = document.getElementById("controller-requester");
        controllerCurrent = document.getElementById("current-controller");
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
