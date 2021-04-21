class Controller {
    static NO_CHANGE_THRESH = 1;

    type;

    thresh;

    lowerThresh;

    // type : 'yt' for YouTube, 'msstream' for MS Stream, 'vimeo' for Vimeo
    constructor(type) {
        this.type = type;
        this.thresh = 10;
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

    goto(time) {
        // give the target `time`
        const curt = this.getTime();

        if (Math.abs(time - curt) > this.thresh) {
            this.seek(time);
            return;
        }

        if (Math.abs(time - curt) < this.lowerThresh) {
            return;
        }

        const value = 2 ** ((time - curt) / this.thresh);
        this.speedup(value);
    }
}

window.Controller = Controller;
