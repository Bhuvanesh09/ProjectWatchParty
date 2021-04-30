/* global VideoController */

const controller = new VideoController("yt");
let receivedState;

function forceSynchronize() {
    const data = controller.getSendInfo();

    chrome.runtime.sendMessage({
        action: "sendTime",
        ...data,
    }, function (meController) {
        if (chrome.runtime.lastError) {
            console.log("This went wrong", chrome.runtime.lastError);
        }

        if (meController) {
            // reset state when I am no longer the controller
            // or a different video is being synced
            receivedState = null;
        }
    });
}

// setInterval(forceSynchronize, 1000);

controller.setHandlers(forceSynchronize);

function selfSynchronize() {
    if (receivedState) {
        const gotoTime = receivedState[1]
            ? receivedState[0] : receivedState[0] + (Date.now() - receivedState[2]) / 1000;
        controller.goto(gotoTime, receivedState[1]);
    }
}

setInterval(selfSynchronize, 50);

chrome.runtime.onMessage.addListener(function ({
    action,
    ...data
}, _sender, sendResponse) {
    switch (action) {
    case "recvTime":
        console.log(`Received: ${JSON.stringify(data)}`);
        receivedState = [data.time, data.paused, Date.now()];
        sendResponse({ done: true });
        break;
    case "showError":
        // eslint-disable-next-line no-undef
        swal("You're not the controller",
            "You need to be the controller of this party to sync videos", "error");
        break;
    case "noFollow":
        controller.noFollow();
        break;
    case "sendTimeToBg":
        forceSynchronize();
        break;
    default:
        console.log("Unknown message!");
    }
    return false;
});
