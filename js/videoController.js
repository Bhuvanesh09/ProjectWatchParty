class VideoController {
    static NO_CHANGE_THRESH = 1;

    static TRACK_CLASS = "tracking-watch-party";

    type;

    upperThreshold;

    lowerThresh;

    static documentURLMatchPatterns = ["https://www.youtube.com/watch?v=*"];

    // type : 'yt' for YouTube, 'msstream' for MS Stream, 'vimeo' for Vimeo
    constructor(type) {
        this.type = type;
        this.upperThreshold = 3;
        this.lowerThresh = 1;
    }

    noFollow() {
        const elm = this.getElement();

        if (elm) {
            elm.classList.remove(VideoController.TRACK_CLASS);
        }
    }

    getElement() {
        if (this.type === "yt") {
            return document.querySelector(".html5-main-video");
        }

        if (this.type === "msstream" || this.type === "vimeo") {
            return document.querySelector("video");
        }

        return null;
    }

    /**
     * @param time {Number} time in seconds
     */
    seek(time) {
        const elm = this.getElement();

        if (elm) {
            elm.currentTime = time;
            elm.playbackRate = 1.0; // reset playback rate
        }
    }

    speedup(speed) {
        // speed : 1.0 by default
        if (!speed) {
            speed = 1.0;
        }
        const elm = this.getElement();

        if (elm) {
            elm.playbackRate = speed;
        }
    }

    getTime() {
        const elm = this.getElement();
        return elm ? elm.currentTime : -1;
    }

    goto(targetTime, targetPaused) {
        const elm = this.getElement(),
            // give the target `time`
            currentTime = this.getTime(),
            gap = targetTime - currentTime;

        if (!elm) {
            return;
        }

        elm.classList.add(VideoController.TRACK_CLASS);

        // VERY BAD IDEA: don't do this, creates jarring effect
        // // pause the element before doing computations
        // elm.pause();

        if (Math.abs(gap) > this.upperThreshold) {
            this.seek(targetTime);
            return;
        }

        if (Math.abs(gap) < this.lowerThresh) {
            return;
        }

        const value = 2 ** (gap / this.upperThreshold);
        this.speedup(value);

        // resume the element once computation is over
        if (targetPaused !== elm.paused) {
            if (targetPaused) {
                elm.pause();
            } else {
                elm.play();
            }
        }
    }

    getURL() {
        const elm = this.getElement();
        if (elm) {
            return elm.ownerDocument.documentURI;
        }
        return null;
    }

    getPaused() {
        const elm = this.getElement();
        if (elm) {
            return elm.paused;
        }
        return null;
    }

    getSendInfo() {
        const elm = this.getElement();

        if (elm) {
            const url = this.getURL(),
                time = this.getTime(),
                paused = this.getPaused();

            return {
                url,
                time,
                paused,
            };
        }

        return null;
    }
}

window.VideoController = VideoController;
