class Controller {
    static NO_CHANGE_THRESH = 1;

    type;

    upperThreshold;

    lowerThresh;

    // type : 'yt' for YouTube, 'msstream' for MS Stream, 'vimeo' for Vimeo
    constructor(type) {
        this.type = type;
        this.upperThreshold = 3;
        this.lowerThresh = 1;
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

    goto(targetTime) {
        // give the target `time`
        const currentTime = this.getTime(),
            gap = targetTime - currentTime;

        if (Math.abs(gap) > this.upperThreshold) {
            this.seek(targetTime);
            return;
        }

        if (Math.abs(gap) < this.lowerThresh) {
            return;
        }

        const value = 2 ** (gap / this.lowerThresh);
        this.speedup(value);
    }
}

window.Controller = Controller;
