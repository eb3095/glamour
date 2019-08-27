const emotionDetection = require('emotional_alert');

exports.Emotion = class {

    constructor (trigger) {
        this.emotion = trigger.emotion;
        this.type = trigger.type;

        if (this.emotion !== "joy"
            && this.emotion !== "worry"
            && this.emotion !== "sadness"
            && this.emotion !== "anger"
            && this.emotion !== "friendly"
            && this.emotion !== "delight"
            && this.emotion !== "disgust"
            && this.emotion !== "fear"
            && this.emotion !== "courage"
            && this.emotion !== "surprise"
            && this.emotion !== "calm"
            && this.emotion !== "depression"
            && this.emotion !== "danger"
            && this.emotion !== "relief"
            && this.emotion !== "neutral"
            && this.emotion !== "vulnerable") {
            throw new Error(`${this.emotion} is not a valid emotion for the emotional trigger`);
        }

        this.value = trigger.value;
    }

    isTriggered(message) {
        let rebuild = [];

        message.split(" ").forEach(word => {
            if (word.length < 3) {
                return;
            }
            if (word.includes("/r/")
                || word.includes("/u/")
                || word.includes("://")) {
                return;
            }
            rebuild.push(word);
        });

        let naturalized = rebuild.join(" ");

        let result = emotionDetection(naturalized);
        let emote;
        let val = 0;
        switch (this.emotion) {
            case "vulnerable":
                val = result.emotional;
                if (val >= this.value) {
                    return true;
                }
                break;
            default:
                emote = result.bayes.prediction;
                val = result.bayes.proba;
                if (this.emotion !== emote && this.value === 0) {
                    return true;
                }
                return val >= this.value;

        }
    }
};