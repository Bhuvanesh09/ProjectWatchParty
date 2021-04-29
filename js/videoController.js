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

    constructor(eventCallback) {
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

        this.upperThreshold = 3;
        this.lowerThresh = 1;
    }

    setHandlers(eventCallback) {
        const events = ["pause", "play", "seeked"];
        for (const event of events) {
            this.elm.addEventListener(event, (e) => {
                if (eventCallback) {
                    eventCallback(e.type, this.getSendInfo());
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
        // give the target `time`
        const currentTime = this.getTime(),
            gap = targetTime - currentTime;

        this.elm.classList.add(VideoController.TRACK_CLASS);

        // VERY BAD IDEA: don't do this, creates jarring effect
        // // pause the element before doing computations
        // elm.pause();

        if (Math.abs(gap) > this.upperThreshold) {
            this.seek(targetTime);
            return;
        }

        if (Math.abs(gap) < this.lowerThresh) {
            this.speedup(1);
            return;
        }

        const value = 2 ** (gap / this.upperThreshold);
        this.speedup(value);

        // resume the element once computation is over
        if (targetPaused !== this.elm.paused) {
            if (targetPaused) {
                this.elm.pause();
            } else {
                this.elm.play();
            }
        }
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
