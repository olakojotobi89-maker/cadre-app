// ringtone-manager.js

class RingtoneManager {

    constructor() {

        this.audio = new Audio("Hip-hop_Alarm.mp3");

        this.audio.loop = true;

        this.audio.preload = "auto";

        this.isPlaying = false;
    }

    async play() {

        if(this.isPlaying) return;

        try {

            await this.audio.play();

            this.isPlaying = true;

        } catch(err) {

            console.warn(
                "Autoplay blocked",
                err
            );
        }
    }

    stop() {

        this.audio.pause();

        this.audio.currentTime = 0;

        this.isPlaying = false;
    }
}

export default new RingtoneManager();