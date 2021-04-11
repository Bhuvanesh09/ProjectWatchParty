async function sendTime(time) {
    sendData({ time: time });
}

async function recvTime(data) {
    chrome.runtime.sendMessage({
        action: "recvTime",
        time: data.time
    }, function (_response) {
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
    }
    return false;
});
