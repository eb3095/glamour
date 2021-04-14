const emotionDetection = require('emotional_alert');

let validEmotions = [
    "joy",
    "worry",
    "sadness",
    "anger",
    "friendly",
    "delight",
    "disgust",
    "fear",
    "courage",
    "surprise",
    "calm",
    "depression",
    "danger",
    "relief",
    "neutral",
    "vulnerable"
];

exports.Emotion = class {

    constructor(trigger) {
        this.emotion = trigger.emotion;
        this.type = trigger.type;

        if (!validEmotions.includes(this.emotion)) {
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

        if (this.emotion == "vulnerable") {
            if (result.emotional >= this.value) {
                return true;
            }
            return false;
        }

        // For exclusion emotions
        if (this.emotion !== result.bayes.prediction && this.value == 0) {
            return true;
        }

        if (this.emotion !== result.bayes.prediction) {
            return false;
        }

        return result.bayes.proba >= this.value;
    }
};