class VideoController {
    static NO_CHANGE_THRESH = 1;

    static TRACK_CLASS = "tracking-watch-party";

    type;

    upperThreshold;

    lowerThresh;

    static documentURLMatchPatterns = ["https://www.youtube.com/watch?v=*",
        "https://vimeo.com/*",
        "https://web.microsoftstream.com/video/*",
        "https://www.dailymotion.com/video/*",
        "https://www.twitch.tv/videos/*"];

    static matchers = {
        yt: /\byoutube\.com/,
        msstream: /web\.microsoftstream\.com/,
        vimeo: /\bvimeo\.com/,
        twitch: /\btwitch\.tv/,
        dm: /\bdailymotion\.com/,
    };

    constructor() {
        this.type = null;

        for (const [key, reg] of Object.entries(VideoController.matchers)) {
            if (reg.test(window.location.href)) {
                this.type = key;
                break;
            }
        }

        if (!this.type) {
            console.error("Controller used on a page with no elements that I can control.");
            return;
        }

        this.setElement();

        this.upperThreshold = 1; // keep at 1
        this.lowerThresh = 0.2;
    }

    setHandlers(eventCallback) {
        const events = ["pause", "play", "seeked"];
        for (const event of events) {
            this.elm.addEventListener(event, (e) => {
                if (eventCallback) {
                    eventCallback();
                }
            });
        }
    }

    noFollow() {
        this.elm.classList.remove(VideoController.TRACK_CLASS);
    }

    setElement() {
        this.elm = document.querySelector("video");
    }

    /**
     * @param time {Number} time in seconds
     */
    seek(time) {
        this.elm.currentTime = time;
        this.elm.playbackRate = 1.0; // reset playback rate
    }

    speedup(speed) {
        // speed : 1.0 by default
        if (!speed) {
            speed = 1.0;
        }

        this.elm.playbackRate = speed;
    }

    getTime() {
        return this.elm.currentTime;
    }

    getTotalTime() {
        return this.elm.duration;
    }

    goto(targetTime, targetPaused) {
        const fixPausation = function () {
            // resume the element once computation is over
                if (targetPaused !== this.elm.paused) {
                    if (targetPaused) {
                        this.elm.pause();
                    } else {
                        this.elm.play();
                    }
                }
            }.bind(this),

            // give the target `time`
            currentTime = this.getTime(),
            gap = targetTime - currentTime;

        this.elm.classList.add(VideoController.TRACK_CLASS);

        if (Math.abs(gap) > this.upperThreshold) {
            this.seek(targetTime);
            fixPausation();
            return;
        }

        if (Math.abs(gap) < this.lowerThresh) {
            this.speedup(1);
            fixPausation();
            return;
        }

        let value;
        if (currentTime > targetTime) {
            value = 1 - gap / this.upperThreshold;
        } else {
            value = 1 + gap / this.upperThreshold;
            value = Math.min(value, 1 + gap);
        }
        this.speedup(value);

        fixPausation();
    }

    getURL() {
        return this.elm.ownerDocument.documentURI;
    }

    getPaused() {
        return this.elm.paused;
    }

    getSendInfo() {
        const url = this.getURL(),
            time = this.getTime(),
            paused = this.getPaused(),
            totalTime = this.getTotalTime();

        return {
            url,
            time,
            paused,
            totalTime,
        };
    }
}

window.VideoController = VideoController;
