let textArray = ["good", "nice", "merong", "babo"];

let pos = thisLayer.position;

seedRandom(pos[0] + pos[1], true);
let randomIndex = Math.floor(random(textArray.length));
let randomText = textArray[randomIndex];

randomText;