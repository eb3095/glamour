const Emotion = require('./triggers/emotion.js').Emotion;
const Phrase = require('./triggers/phrase.js').Phrase;
const Sentiment = require('./triggers/sentimentTrigger.js').SentimentTrigger;

function inlineRandomized(string) {
    let newString = string;
    var arr = string.match(/{.*?}/g);
    if (arr) {
        arr.forEach(match => {
            let choices = match.replace("{", "").replace("}", "").split("|");
            newString = newString.replace(match, choices[Math.floor(Math.random() * choices.length)]);
        });
    }

    return newString;
}

exports.Reply = class {

    constructor (rep, typo) {
        this.name = rep.name;
        this.typo = typo;
        this.replyDelay = rep.replyDelay * 60000;
        this.delayFuzz = rep.delayFuzz * 1000;
        this.cooldown = rep.cooldown * 60000;
        this.subreddits = rep.subreddits;
        this.bannedSubreddits = rep.bannedSubreddits;
        this.bannedUsers = rep.bannedUsers;
        this.prefaces = rep.prefaces;
        this.details = rep.details;
        this.conclusions = rep.conclusions;
        this.detailCount = rep.detailCount;
        this.typos = rep.typos;
        this.oncePerUser = rep.oncePerUser;
        this.oncePerSubmission = rep.oncePerSubmission;
        this.triggers = [];


        if (this.details < this.detailCount) {
            throw new Error(`Error in config for reply ${this.name}, detailsCount can not be less than details`);
        }

        rep.triggers.forEach(trig => {
            let trigger;
            switch (trig.type) {
                case "emotion":
                    trigger = new Emotion(trig);
                    break;
                case "phrase":
                    trigger = new Phrase(trig);
                    break;
                case "sentiment":
                    trigger = new Sentiment(trig);
                    break;
                default:
                    throw new Error(`Bad trigger type, ${trig.type}, for the reply ${this.name}`);
            }
            this.triggers.push(trigger);
        });
    }

    isTriggered (event) {
        let date = new Date();
        let triggered = true;
        let sub = event.comment.subreddit.display_name.toLowerCase();

        if (!this.subreddits.includes(event.subreddit.name)) {
            return false;
        }

        if (this.bannedSubreddits.includes(sub)) {
            return false;
        }

        if (this.bannedUsers.includes(event.comment.author.name.toLowerCase())) {
            return false;
        }

        if (date.getTime() < this.cooldownExpires) {
            return false;
        }

        this.triggers.some(trigger => {
            if (!trigger.isTriggered(event.comment.body)) {
                triggered = false;
                return true;
            }
        });

        return triggered;
    };

    generateMessage () {
        let message = [];

        if (this.prefaces.length > 0) {
            let preface;

            if (this.prefaces.length === 1) {
                preface = this.prefaces[0];
            } else {
                preface = this.prefaces[Math.floor(Math.random() * this.prefaces.length)];
            }

            preface = inlineRandomized(preface);

            if (this.typos) {
                preface = this.typo.introduceTypos(preface);
            }

            message.push(preface);
        }

        if (this.details.length > 0) {
            let details = [];

            if (this.details.length === 1) {
                details.push(this.details[0]);
            } else {
                let clone = this.details.slice(0);
                while (details.length < this.detailCount) {
                    let pick = Math.floor(Math.random() * clone.length);
                    details.push(clone[pick]);
                    clone.splice(pick, 1);
                }
            }

            for (let ctr = 0; ctr < details.length; ctr++) {
                details[ctr] = inlineRandomized(details[ctr]);
                if (this.typos) {
                    details[ctr] = this.typo.introduceTypos(details[ctr]);
                }
                message.push(details[ctr])
            }
        }

        if (this.conclusions.length > 0) {
            let conclusion;

            if (this.conclusions.length === 1) {
                conclusion = this.conclusions[0];
            } else {
                conclusion = this.conclusions[Math.floor(Math.random() * this.conclusions.length)];
            }

            conclusion = inlineRandomized(conclusion);

            if (this.typos) {
                conclusion = this.typo.introduceTypos(conclusion);
            }

            message.push(conclusion);
        }

        return message.join(" ");
    };

    putOnCooldown () {
        let date = new Date();
        this.cooldownExpires = date.getTime() + this.cooldown;
    };

};