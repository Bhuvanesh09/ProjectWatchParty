class Time {
    static async send(data, callback) {
        const {
            url,
            paused,
            time,
            totalTime,
        } = data;

        if (!appState.shouldSendToPeers(url)) {
            return false;
        }

        sendData({
            url,
            paused,
            time,
            totalTime,
            action: "synctime",
        })
            .then(() => {
                callback("success");
            });
    }

    static tellNoFollow(data) {
        const message = {
                action: "noFollow",
            },
            { url } = data;

        chrome.tabs.query({}, function (tabs) {
            for (const tab of tabs) {
                if (tab.url === url) {
                    chrome.tabs.sendMessage(tab.id, message);
                }
            }
        });
    }

    static async receive(data, delay) {
        const message = {
                action: "recvTime",
                time: data.time + (data.paused ? 0 : delay / 1000),
                paused: data.paused,
            },
            { url } = data;

        // eslint-disable-next-line no-undef
        appState.setVideo(url);

        chrome.tabs.query({}, function (tabs) {
            let tabFound = false;
            for (const tab of tabs) {
                if (tab.url === url) {
                    tabFound = true;
                    chrome.tabs.sendMessage(tab.id, message);
                }
            }

            if (!tabFound) {
                chrome.tabs.create({ url }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Something went wrong while opening new tab",
                            chrome.runtime.lastError);
                    } else {
                        console.log("Opened new tab: as tab sent by controller isn't open yet");
                    }
                });
            }
        });
    }
}

async function sendTextMessage(text) {
    sendData({
        action: "textMessage",
        messageString: text,
    });
}

function escapeRegex(string) {
    return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// message listeners {{{
chrome.runtime.onMessage.addListener(function ({
    action,
    ...data
}, _sender, sendResponse) {
    if (!firebaseAppInited) {
        initFirebaseApp();
    }

    switch (action) {
    case "sendTime":
        Time.send(data, (res) => {
            sendResponse(res);
        });
        return true;
    case "textMessageSending": {
        const stringMessage = data.messageString;
        addToHistory("self", stringMessage);
        sendTextMessage(stringMessage)
            .then(() => {
                sendResponse("success");
            });
    }
        return true;
    case "populateChatWindow":
        populateChatWindow();
        break;
    case "createRoom":
        createRoom()
            .then((roomId) => {
                sendResponse(roomId);
            });
        return true;
    case "joinRoom":
        joinRoomById(data.roomId)
            .then(() => {
                sendResponse("success");
            });
        return true;
    case "hangup":
        appState.hangUp((status) => {
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
    case "sendSessionInfo":
        appState.sendSessionInfoPopup();

        break;
    case "peerRequestDeniedAll":
        Controller.clearRequestList();
        break;
    case "peerRequestAcceptedOne": {
        const { peerName } = data;
        Controller.setController(peerName, true);
        Controller.clearRequestList();
    }
        break;
    case "updateUsername":
        // eslint-disable-next-line no-undef
        updateUsername();
        break;
    case "toggleFollow":
        appState.followToggle((newValue) => {
            sendResponse(newValue);
        });
        break;
    default:
        console.debug(`Unknown action: ${action} requested!`);
    }

    return false;
});
