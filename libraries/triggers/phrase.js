exports.Phrase = class {

    constructor(trigger) {
        this.phrases = trigger.phrases;
        this.included = trigger.included;
        this.type = trigger.type;
    }

    isTriggered(message) {
        let messageLower = message.toLowerCase();
        let result = false;
        this.phrases.some(phrase => {
            if (messageLower.includes(phrase)) {
                result = true;
                return true;
            }
        });
        if (result) {
            return this.included;
        } else {
            return !this.included;
        }
    }
};