function shuffle(array) {
    let index = array.length;
    let temp;
    let rIndex;

    while (0 !== index) {
        rIndex = Math.floor(Math.random() * index);
        index--;
        temp = array[index];
        array[index] = array[rIndex];
        array[rIndex] = temp;
    }

    return array;
}

function isCapitalized(word) {
    return word[0] === word[0].toUpperCase();
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

exports.Typo = class {

    constructor (config) {
        this.speechParts = config.speechParts;
        this.typoRate = config.typoRate;
        this.typoCommas = config.typoCommas;
        this.typoApostrophes = config.typoApostrophes;
        this.typoCase = config.typoCase;
    }

    introduceTypos (string) {
        let split = string.split(" ");
        let building = [];

        split.forEach(word => {
            if (!((Math.floor(Math.random() * 1000) + 1) <= this.typoRate)) {
                building.push(word);
                return;
            }

            let newWord;
            let wordLower = word.toLowerCase();

            shuffle(this.speechParts);
            this.speechParts.some(speechPart => {
                if (wordLower.includes(speechPart.string)) {
                    newWord = wordLower.replace(speechPart.string, speechPart.typos[Math.floor(Math.random() * speechPart.typos.length)]);
                    if (isCapitalized(word)) {
                        newWord = capitalize(newWord);
                    }
                    return true;
                }
            });

            if (!newWord) {
                newWord = word;
            }

            if (this.typoCommas
                && newWord.includes(",")
                && (Math.floor(Math.random() * 1000) + 1) >= this.typoRate) {
                newWord = newWord.replace(",", "");
            }

            if (this.typoApostrophes
                && newWord.includes("'")
                && (Math.floor(Math.random() * 1000) + 1) >= this.typoRate) {
                newWord = newWord.replace("'", "");
            }

            if (this.typoCase
                && (Math.floor(Math.random() * 1000) + 1) >= this.typoRate) {
                newWord = newWord.toLowerCase();
            }

            building.push(newWord);
        });

        return building.join(" ");
    }
};