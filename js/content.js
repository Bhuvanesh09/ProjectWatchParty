/* global VideoController */

let eventCount = 0,
    lastEventCount = 0,
    pendingRequest = false;

const controller = new VideoController(function incrementCountOnEvent() {
    eventCount++;
});

function sendTime() {
    const data = controller.getSendInfo();

    chrome.runtime.sendMessage({
        action: "sendTime",
        ...data,
    }, function (_response) {
        if (chrome.runtime.lastError) {
            console.log("This went wrong", chrome.runtime.lastError);
        }
    });
}

setInterval(function () {
    if (pendingRequest || eventCount > lastEventCount) {
        pendingRequest = false;
        lastEventCount = eventCount;
        sendTime();
    }
}, 200);

chrome.runtime.onMessage.addListener(function ({
    action,
    ...data
}, _sender, sendResponse) {
    switch (action) {
    case "recvTime":
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
    case "sendTimeData":
        pendingRequest = true;
        break;
    default:
        console.log("Unknown message!");
    }
    return false;
});
