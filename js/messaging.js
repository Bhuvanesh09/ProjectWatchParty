async function sendTime(data) {
    sendData({
        ...data,
        action: "synctime",
    });
}

async function controllerRequested(message) {
    console.debug(`Received request to controller: ${message}`);
}

function escapeRegex(string) {
    return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

async function recvTime(data) {
    chrome.tabs.query({}, function (tabs) {
        const message = {
            action: "recvTime",
            time: data.time,
            paused: data.paused,
        };

        for (const tab of tabs) {
            const regex = new RegExp(escapeRegex(tab.url));
            if (regex.test(data.url)) {
                chrome.tabs.sendMessage(tab.id, message);
            }
        }
    });
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
        const {
            url,
            paused,
            time,
        } = data;

        sendTime({
            url,
            paused,
            time,
        })
            .then(() => {
                sendResponse("success");
            });
        return true;
    default:
        console.log("Action unknown!");
    }

    return false;
});
