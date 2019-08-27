const Sentiment = require('sentiment');
const sentiment = new Sentiment();

exports.SentimentTrigger = class {

    constructor (trigger) {
        this.value = trigger.value;
        this.type = trigger.type;
        if (this.value !== "positive"
            && this.value !== "negative"
            && this.value !== "neutral"
            && this.value !== "notNegative"
            && this.value !== "notPositive") {
            throw new Error(`${this.value} is not a valid value for the Sentiment trigger`);
        }
        this.overrides = trigger.overrides;
    }

    isTriggered (message) {
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
        let options = {
            extras: this.overrides
        };
        let result = sentiment.analyze(naturalized, options);
        switch(this.value) {
            case "positive":
                if (result.comparative > 0) {
                    return true;
                }
                break;
            case "negative":
                if (result.comparative < 0) {
                    return true;
                }
                break;
            case "neutral":
                if (result.comparative === 0) {
                    return true;
                }
                break;
            case "notNegative":
                if (result.comparative >= 0) {
                    return true;
                }
                break;
            case "notPositive":
                if (result.comparative <= 0) {
                    return true;
                }
                break;
        }
        return false;
    }

};