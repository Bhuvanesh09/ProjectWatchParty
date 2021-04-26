function getRandom(arr, n) {
    let len = arr.length;

    const result = new Array(n),
        taken = new Array(len);

    if (n > len) {
        throw new RangeError("getRandom: more elements taken than available");
    }
    while (n--) {
        const x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}

window.generateUniqInviteLink = function () {
    /*
    Pronounceable dictionary words based keyphrase
    Total possible keyphrases = 1000**4 ~ 1e12
    */

    const adjs = getRandom(window.ADJECTIVES, 2),
        nouns = getRandom(window.NOUNS, 1),
        inviteLink = adjs.concat(nouns);

    return inviteLink.join("-");
};
