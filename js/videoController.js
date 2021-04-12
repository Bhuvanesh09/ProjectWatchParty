class Controller {
    // type : 'yt' for YouTube, 'msstream' for MS Stream, 'vimeo' for Vimeo
    constructor(type) {
        this.type = type;
        this.thresh = 10;
        this.lowerThresh = 1;
    }

    seek(time) {
        // time : in seconds
        if (this.type === "yt") {
            document.getElementsByClassName("html5-main-video")[0].currentTime = time;
        }
        if (this.type === "msstream" || this.type === "vimeo") {
            document.querySelector("video").currentTime = time;
        }
    }

    speedup(speed) {
        // speed : 1.0 by default
        if (!speed) {
            speed = 1.0;
        }
        if (this.type === "yt") {
            document.getElementsByClassName("html5-main-video")[0].playbackRate = speed;
        }
        if (this.type === "msstream" || this.type === "vimeo") {
            document.querySelector("video").playbackRate = speed;
        }
    }

    gettime() {
        if (this.type === "yt") {
            return document.getElementsByClassName("html5-main-video")[0].currentTime;
        }
        if (this.type === "msstream" || this.type === "vimeo") {
            return document.querySelector("video").currentTime;
        }
    }

    goto(time) {
        // give the target `time`
        const curt = this.gettime();

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
