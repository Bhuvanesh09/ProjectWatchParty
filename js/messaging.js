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

            for (const tab of tabs) {
                const regex = new RegExp(escapeRegex(tab.url));
                if (regex.test(data.url)) {
                    chrome.tabs.sendMessage(tab.id, message);
                }
            }
        });
    }
}

async function sendTextMessage(data) {
    sendData({
        ...data,
        action: "textMessage",
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
        break;
    case "textMessageSending":
        const { 
            stringMessage
        } = data;
        
        sendTextMessage({
            stringMessage
        })
            .then(() => {
                sendResponse("success");
            });
        return true;
        break;
    default:
        console.log(`Action ${action} unknown!`);
    }

    return false;
});
