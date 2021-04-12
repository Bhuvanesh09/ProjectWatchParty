async function sendTime(time) {
    sendData({ time });
}

async function recvTime(data) {
    chrome.tabs.query({}, function (tabs) {
        const message = {
            action: "recvTime",
            time: data.time,
        };

        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, message);
        }
    });
}

// message listeners {{{
chrome.runtime.onMessage.addListener(function ({
    action,
    ...others
}, _sender, sendResponse) {
    if (!firebaseAppInited) {
        initFirebaseApp();
    }

    switch (action) {
    case "sendTime":
        sendTime(others.time)
            .then(() => {
                sendResponse("success");
            });
        return true;
    default:
        console.log("Action unknown!");
    }

    return false;
});
