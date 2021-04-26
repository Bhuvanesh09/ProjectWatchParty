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
            };

            let tabFound = false;
            for (const tab of tabs) {
                const regex = new RegExp(escapeRegex(tab.url));
                if (regex.test(data.url)) {
                    tabFound = true;
                    chrome.tabs.sendMessage(tab.id, message);
                }
            }

            if (!tabFound) {
                chrome.tabs.create({ url: data.url }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Something went wrong while opening new tab", chrome.runtime.lastError);
                    } else {
                        console.log("Opened new tab because I don't have the tab required by controller open yet");
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
        if (!appState.isMyselfController()) {
            return false;
        }

        const {
            url,
            paused,
            time,
        } = data;

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
