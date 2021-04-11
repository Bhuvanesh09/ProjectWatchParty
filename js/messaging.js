async function sendTime(time) {
    console.log("I am at " + time);
}

async function recvTime() {
    return { time: 212 };
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
        case "createRoom":
            createRoom()
                .then((roomId) => {
                    sendResponse(roomId);
                });
            return true;
        case "joinRoom":
            joinRoomById(others.roomId)
                .then(() => {
                    sendResponse("success");
                });
            return true;
        case "hangup":
            hangUp((status) => {
                if (status) {
                    sendResponse("Exited!");
                } else {
                    sendResponse("Errored!");
                }
            });
            return true;
        case "sendTime":
            sendTime(others.time)
                .then(() => {
                    sendResponse("success");
                });
            return true;
        case "recvTime":
            recvTime().then((response) => {
                sendResponse(response);
            })
            return true;
        default:
            console.log("Invalid input");
    }
    return false;
});
