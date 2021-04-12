/* global Controller */

const controller = new Controller("yt");

setInterval(function () {
    chrome.runtime.sendMessage({
        action: "sendTime",
        time: controller.gettime(),
    }, function (_response) {
        if (chrome.runtime.lastError) {
            console.log("This went wrong", chrome.runtime.lastError);
        }
    });
}, 1000);

chrome.runtime.onMessage.addListener(function ({
    action,
    ...others
}, _sender, sendResponse) {
    switch (action) {
    case "recvTime":
        console.log(`Received timestamp at: ${others.time}`);
        controller.seek(others.time);
        sendResponse({ done: true });
        return true;
    default:
        console.log("Unknown message!");
    }
    return false;
});
