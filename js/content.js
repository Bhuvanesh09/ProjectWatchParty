/* global VideoController */

const controller = new VideoController("yt");

let lastSynced = Date.now();

function forceSynchronize() {
    const data = controller.getSendInfo();

    // remove orange border if not followed for 2000 seconds
    if (Date.now() - lastSynced > 2000) {
        controller.elm.classList.remove(VideoController.TRACK_CLASS);
    }

    chrome.runtime.sendMessage({
        action: "sendTime",
        ...data,
    }, function (_response) {
        if (chrome.runtime.lastError) {
            console.log("This went wrong", chrome.runtime.lastError);
        }
    });
}

setInterval(forceSynchronize, 1000);

controller.setHandlers(forceSynchronize);

chrome.runtime.onMessage.addListener(function ({
    action,
    ...data
}, _sender, sendResponse) {
    switch (action) {
    case "recvTime":
        lastSynced = Date.now();
        console.log(`Received: ${JSON.stringify(data)}`);
        controller.goto(data.time, data.paused);
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
    default:
        console.log("Unknown message!");
    }
    return false;
});
