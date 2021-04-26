class Time {
    static async send(data) {
        sendData({
            ...data,
            action: "synctime",
        });
    }

    static async receive(data) {
        chrome.tabs.query({}, function (tabs) {
            const message = {
                    action: "recvTime",
                    time: data.time,
                    paused: data.paused,
                },
                { url } = data;

            // eslint-disable-next-line no-undef
            appState.setVideo(url);

            let tabFound = false;
            for (const tab of tabs) {
                const regex = new RegExp(escapeRegex(tab.url));
                if (regex.test(url)) {
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
    case "sendTime": {
        const {
            url,
            paused,
            time,
        } = data;

        if (!appState.shouldSendToPeers(url)) {
            return false;
        }

        Time.send({
            url,
            paused,
            time,
        })
            .then(() => {
                sendResponse("success");
            });
    }
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
    default:
        console.log(`Action ${action} unknown!`);
    }

    return false;
});
