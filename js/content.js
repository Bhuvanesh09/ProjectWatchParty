Controller = function (type) {
    // type : 'yt' for YouTube, 'msstream' for MS Stream, 'vimeo' for Vimeo
    this.type = type;
    this.thresh = 10;
    this.lowerThresh = 1;
};

Controller.prototype.seek = function (time) {
    // time : in seconds
    if (this.type == "yt") {
        document.getElementsByClassName("html5-main-video")[0].currentTime = time;
    }
    if (this.type == "msstream" || this.type == "vimeo") {
        document.querySelector("video").currentTime = time;
    }
};

Controller.prototype.speedup = function (speed) {
    // speed : 1.0 by default
    if (!speed) { speed = 1.0; }
    if (this.type == "yt") { document.getElementsByClassName("html5-main-video")[0].playbackRate = speed; }
    if (this.type == "msstream" || this.type == "vimeo") {
        document.querySelector("video").playbackRate = speed;
    }
};

Controller.prototype.gettime = function () {
    if (this.type == "yt") { return document.getElementsByClassName("html5-main-video")[0].currentTime; }
    if (this.type == "msstream" || this.type == "vimeo") {
        return document.querySelector("video").currentTime;
    }
};

Controller.prototype.goto = function (time) {
    // give the target `time`
    const curt = this.gettime();
    if (Math.abs(time - curt) > this.thresh) {
        this.seek(time);
        return;
    }
    if (Math.abs(time - curt) < this.lowerThresh) {
        return;
    }
    const value = Math.pow(2, (time - curt) / this.thresh);
    this.speedup(value);
};

const controller = new Controller("yt");

setInterval(function () {
    chrome.runtime.sendMessage({
        action: "sendTime",
        time: controller.gettime(),
    }, function (_response) {
    });
}, 1000);

chrome.runtime.onMessage.addListener(function ({
    action,
    ...others
}, _sender, sendResponse) {
    switch (action) {
    case "recvTime":
        console.log(`Recieved timestamp at: ${others.time}`);
        controller.seek(others.time);
        sendResponse({ done: true });
        return true;
    }
    return false;
});
