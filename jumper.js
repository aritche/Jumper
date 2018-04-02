// HTML properties
var requestAnimationFrame = window.requestAnimationFrame || 
                            window.mozRequestAnimationFrame || 
                            window.webkitRequestAnimationFrame || 
                            window.msRequestAnimationFrame;
// determine if using touch events (mobile), or click events (desktop)
document.getElementById('toggle_test').addEventListener('click', toggleTesting);

// Canvas Properties
var canvas = createCanvas(500, 250, 'white', 'gameArea', 'game');
var ctx = canvas.getContext("2d");

// Simulation Properties
var time = 0; // elapsed time in seconds
var maxTime = 5; // time until world resets in seconds
var g = 1;    // gravity
var ag = -2;  // attack gravity. acceleration back to starting pos after an attack

// Simulation Assets
var stage;    // the fighting stage
var clouds = [];
var colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'];
var dangerImage  = new Image();
dangerImage.src = 'lava.gif';
var stageImage = new Image();
stageImage.src = 'stage.gif';

// Player score values
var reward = +50;       // reward for actions like destroying an enemy 
var punishment = -1;   // punishment for events like being destroyed
var timePunishment = 0; // punishment applied every second. Used to deter stationary agents
var stationaryPunishment = -0.001;

// Genetic Algorithm Properties
var generation = 0;   // current generation
var mutateChance = 1; // integer representing percentage from 0 to 100

// Gameplay properties
var contests = [];          // a list of all current contests
                            //  the last item will be a human contest
                            //  where a human player vs. AIs
var numContests = 80;      // number of simultaneous contests (not including the human contest)
var playersPerContest = 2;  // number of players per contest
var networks = [];          // a list of all current networks
var testing = true;        // When true, only one contest will be visualised
                            // 'Player 0' in that contest will also be controlled
                            // by the human player

// Neural network properties
var numNodes = [6,5,5] // number of nodes in each layer

// Other Visualisations
var graphAvg;
var graphBest;
var avgScores = [];
var bestScores = [];
graphAvg = createGraph("graphAvg", "Population Avgerage Scores", "Gen", "Score", 400,400, 'vis');
graphBest = createGraph("graphBest", "Best Individual Scores", "Gen", "Score",100,100, 'vis');
var bestNetworkVis = createCanvas(200, 200, "white", "bestNetwork", 'vis'); // the canvas for the best network;
bestNetworkVis.style.marginTop = 10;

function main(){
    // Increment the timer
    setInterval(function(){time += 1}, 1000);

    // Ininitate the simulation
    resetWorld();
}

// Resets the world and begins the simulation
function resetWorld(){
    generation++;

    time = 0;

    // Update the list of networks
    if (generation == 1){
        // Generate networks
        for (var n = 0; n < numContests*playersPerContest; n++){
            networks.push(new Network(numNodes));
        }
        
        // Paint a random network as the best network, since none have
        //   been tested yet.
        networks[0].draw(bestNetworkVis);
    } else{
        // Draw the best network
        var bestNetwork = getBestNetwork();
        bestNetwork.draw(bestNetworkVis);

        // Reproduce networks;
        networks = reproduce(networks);
    }

    // Create contests
    networks = shuffle(networks);
    contests = [];
    for (var c = 0; c < numContests+1; c++){
        chosenNetworks = [];
        for (var n = 0; n < playersPerContest; n++){
            chosenNetworks.push(networks[c*playersPerContest+n]);    
        }
        contests.push(new Contest(chosenNetworks));
    }
    
    // Adjust the last contest (the human contest)
    var humanContestNetworks = [];
    var bestNetwork = getBestNetwork();
    for (var p = 0; p < playersPerContest; p++){
        humanContestNetworks.push(genNetwork(getGenes(bestNetwork)));
    }
    contests[contests.length-1] = new Contest(humanContestNetworks);
    contests[contests.length-1].players[0].name = "Human";
    for (var p = 1; p < playersPerContest; p++){
        contests[contests.length-1].players[p].name = "Bot Player";
    }

    // Create the clouds
    clouds = [];
    clouds.push(new Cloud(getRand(0,canvas.width*1.5,1),getRand(0,canvas.height,1),200,50,0.5));
    clouds.push(new Cloud(getRand(0,canvas.width*1.5,1),getRand(0,canvas.height,1),200,50,0.5));
    clouds.push(new Cloud(getRand(0,canvas.width*1.5,1),getRand(0,canvas.height,1),200,50,0.5));
    clouds.push(new Cloud(getRand(0,canvas.width*1.5,1),getRand(0,canvas.height,1),200,50,0.5));
    
    // Create the stage
    stage = new Stage(canvas.width*0.15,
                      canvas.height*0.9,
                      canvas.width*0.70,
                      canvas.height*0.1, 
                      "black");


    placePlayers();
    updateCanvas();
}

// Get the population average score
function getAverage(){
    var total = 0;
    for (var n = 0; n < networks.length; n++){
        total += networks[n].score;
    }
    return total/networks.length;
}

// shuffle array via Fisher-Yates shuffle
function shuffle(a){
    var index = a.length;
    while (index != 0){
        r = getRand(0,index,1);
        index--;

        // Swap item at index 'r' with item at index 'index'
        temp = a[index];
        a[index] = a[r];
        a[r] = temp;
    }
    return a;
}

// Get the minimum score out of all the networks
function minScore(){
    var min = networks[0].score;
    for (var n = 0; n < networks.length; n++){
        if (networks[n].score < min) min = networks[n].score;
    }
    return min;
}

function maxScore(){
    var max = networks[0].score;
    for (var n = 0; n < networks.length; n++){
        if (networks[n].score > max) max = networks[n].score;
    }
    return max;
}

// Shift all network scores into positive scores by adding minimum score
function conditionScores(){
    // Treat all negative scores as zero
    for (var n = 0; n < networks.length; n++){
        if (networks[n].score < 0) networks[n].score = 0;
    }
    
    // Make all scores positive
    /*var min = minScore();
    for (var n = 0; n < networks.length; n++){
        networks[n].score += Math.abs(min);
    }*/
    
    // Scores are now in the range [0,max]
    var max = maxScore()+1; // '+1' is in case max score is 0
    for (var n = 0; n < networks.length; n++){
        // Normalise into range [0,~5] (note '~5' since max = maxScore + 1
        networks[n].score = 5*networks[n].score/max;

        // Create exponential shape to higher scores are much more likely
        //   to be selected
        // New range is [0,~25]
        networks[n].score = Math.pow(networks[n].score,2);
    }
}

function reproduce(nets){
    // Make sure the scores of each network are zero before passing back
    var pop = [];
    var genes = [];
    for (var n = 0; n < nets.length; n++){
        genes.push(getGenes(nets[n]));
    }

    // Condition scores (normalise, exponential, etc.)
    conditionScores();

    // Push the current best network
    // but do not disqualify it from reproduction
    var best = getBestNetwork();
    pop.push(best);

    while (pop.length < nets.length){
        // Select two parents via roulette-wheel selection
        var pool = createSelectionPool(nets);
        var parents = [];
        parents.push(getGenes(nets[pool[getRand(0,pool.length,1)]]));
        parents.push(getGenes(nets[pool[getRand(0,pool.length,1)]]));

        // Select random point in random parent's genes
        // NOTE: Assumes parents have same num layers and layer sizes
        var selectedParent = getRand(0, 2, 1);
        var otherParent = selectedParent == 0 ? 1 : 0;
        var point = getRand(0, parents[selectedParent].length, 1);
        var child = parents[selectedParent].slice(0, point+1);
        if (child.length != parents[selectedParent].length){
            child.push.apply(child, parents[otherParent].slice(point+1,parents[otherParent].length+1));
        }

        // Iterate over each gene component and randomly mutate given chance
        for (var g = child[0]+1; g < child.length; g++){
            if (getRand(0, 100, 1) < mutateChance){
                child[g] = getRand(-1, 1, 0);
            }
        }

        pop.push(genNetwork(child));
    }

    // Set the first AI's score to zero (since it was the AI that
    //  was the best in the previous generation and was just transferred
    //  without mutation or reproduction
    pop[0].score = 0;
    return pop;
}

// Returns an array, where items are indexes of 'nets' array
// Number of times an index is in pool = score of network
function createSelectionPool(nets){
    var pool = [];

    for (var n = 0; n < nets.length; n++){
        if (nets[n].score <= 0){ // neutral or negative scores only once
            pool.push(n);
            continue;
        }
        for (var repeat = 0; repeat < nets[n].score; repeat++){
            pool.push(n);
        }
    }

    return pool;
}

function getBestNetwork(){
    var bestScore;
    var bestNetwork;
    for (var n = 0; n < networks.length; n++){
        if (bestScore == null || networks[n].score >= bestScore){
            bestScore = networks[n].score;
            bestNetwork = networks[n];
        }
    }

    return bestNetwork;
}

function collisions(contest){
    disputes = []; // handle all collision disputes
    var players = contest.players;
    for (var p = 0; p < players.length; p++){
        if (players[p].isAttacking){
            for (var e = 0; e < players.length; e++){
                if (e != p){
                    if (overlap(players[p],players[e])){
                        disputes.push([players[p],players[e]]);
                    }
                }
            }
        }
    }

    if (disputes.length != 0){
        var winners = [];
        var winner;
        var loser;
        for (var i = 0; i < disputes.length; i++){
            var a = disputes[i][0];
            var b = disputes[i][1];
            // player which attacks first will win if 2 players attack at once
            // player that attacks first will have lowest speed (since speed starts high)
            if (a.isAttacking && b.isAttacking){
                winner = Math.abs(a.velocity[0]) < Math.abs(b.velocity[0]) ? a : b;

                // The following code handles the case:
                /*
                    A attacks first, but is now turning around. 
                    Then B attacks. Ideally B should win since it is on the offensive.
                    However due to rubberband acceleration, A might have higher speed
                    and could thus be declared the winner.
                */
                // if B is on rebound and A is not, A should win regardless of speed
                if (Math.sign(a.velocity[0]) == Math.sign(a.directionFacing)
                    && (Math.sign(b.velocity[0] != Math.sign(b.directionFacing)))){
                    winner = a;

                // if A is on rebound and B is not, B should win regardless of speed
                } else if (Math.sign(b.velocity[0]) == Math.sign(b.directionFacing)
                    && (Math.sign(a.velocity[0] != Math.sign(a.directionFacing)))){
                    winner = b;
                }
            }
            else winner = a.isAttacking ? a : b;
            loser = winner == a ? b : a;

            // Bonus reward for killing an enemy faster
            var timeDiff = time-contest.prevWin; // number of seconds since previous win
            var finalReward = reward*(1+(maxTime-timeDiff)/maxTime)
            
            // Update previous win time
            contest.prevWin = time;

            winner.network.score += finalReward;
            loser.network.score += punishment;

            winners.push(winner);

            loser.resetProperties();

            contest.winner = winner;
        }
        //players = winners;
    }
    
}

// return True if there is an overlap between player a and b
// Collision equation inspired by https://stackoverflow.com/a/3269471
function overlap(a, b){
    startAX = a.x-a.radius;
    startAY = a.y-a.radius;
    endAX   = a.x+a.radius;
    endAY   = a.y+a.radius;

    startBX = b.x-b.radius;
    startBY = b.y-b.radius;
    endBX   = b.x+b.radius;
    endBY   = b.y+b.radius;


    return (startAX <= endBX && startBX <= endAX) 
        && (startAY <= endBY && startBY <= endAY);
}

function placePlayers(){
    for (var c = 0; c < contests.length; c++){
        var players = contests[c].players;
        for (var p = 0; p < players.length; p++){
            players[p].x = stage.x+players[p].radius+stage.width*(p/(players.length-1));
            
            //fix final player's position
            if (p == players.length-1){
                players[p].x -= players[p].radius*2;
            }
            players[p].y = canvas.height-(stage.height+players[p].radius);

            players[p].startX = players[p].x;
            players[p].startY = players[p].y;
        }
    }
}

function Stage(x, y, width, height, color){
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.img = stageImage;
}

function Cloud(x, y, width, height, alpha){
    this.x = x;
    this.y = y
    this.width = width;
    this.height = height;
    this.alpha = alpha;
    this.velocity = -1;
}

// A Contest (competition, game, etc.) between networks.length players
// networks is an array of neural networks. e.g. player 0 is assigned networks[0]
function Contest(networks){
    // A list of players in the contest
    this.players = [];
    for (var p = 0; p < networks.length; p++){
        this.players.push(new Player("Player " + p, 0, colors[p%colors.length], networks[p]));
    }

    this.networks = networks;


    this.prevWin = 0; // time value that the previous win occurred
    
    // Who won the contest
    this.winner;
}


// direction 'n' = neutral
function Player(name, id, color, network){
    this.name = name;
    this.id = id;
    this.color = color;
    this.x = 0;
    this.y = 0;
    this.startX = 0;
    this.startY = 0;

    this.radius = 20;

    this.velocity = [0,0]; // velocity x and y

    this.move = function(direction){
        this.direction = direction;
    }

    this.isJumping = false;

    this.jump = function(){
        if (!this.isJumping && !this.isAttacking){
            this.isJumping = true;
            this.velocity[1] = -14;
        }
    }
    
    // 1 = right, -1 = left, 0 = neutral
    this.direction = 0; // direction of movement
    this.directionFacing = 0; // direction of facing currently

    this.move = function(d){
        if (!this.isAttacking){
            this.velocity[0] = 5*d;
            this.direction = d;
            if (d != 0){
                this.directionFacing = d;
            }
        }
    }

    this.isAttacking = false;
    this.attackPos = [0,0]; // pullback coordinates after an attack
    this.attackVelocity = [0,0]; // original velocity before attack 
    this.attack = function(){
        // can only attack while not moving, not already attacking, and not facing down
        if (this.direction == 0 && !this.isAttacking && this.directionFacing != 0){ 
            this.isAttacking = true;
            this.attackPos = [this.x,this.y];
            this.attackVelocity = [this.velocity[0],this.velocity[1]];
            this.velocity[0] += 20*this.directionFacing;
        }
        //this.radius *= 1.3;
    }

    // Neural network used by the player
    this.network = network;

    // Resets all properties of the player but keeps score intact
    this.resetProperties = function(){
        this.x = getRand(stage.x+this.radius,stage.x+this.radius+stage.width,1);
        this.y = this.startY;
        this.velocity = [0,0];
        this.isJumping = false;
        this.direction = 0;
        this.directionFacing = 0;
        this.isAttacking = false;
        this.attackPos = [0,0];
    }
}


// return true if player p can move in direction d
function canMove(p, d){

}

function checkKey(e){
    e = e || window.event;

    var players = contests[contests.length-1].players;
    
    if (e.keyCode == '32'){
        players[0].jump();
        e.preventDefault();
    }
    if (e.keyCode == '39'){
        players[0].move(1);
        e.preventDefault();
    }
    if (e.keyCode == '37'){
        players[0].move(-1);
        e.preventDefault();
    }
    if (e.keyCode == '40'){
        players[0].move(0);
        e.preventDefault();
    }
    if (e.keyCode == '65') players[0].attack();
}
document.onkeydown = checkKey;

function createCanvas(w, h, color, id, div){
    var canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.className = 'canvas';
    canvas.width = w*2; //resolution
    canvas.height = h*2; //resolution
    canvas.style.width = w; //actual width
    canvas.style.height = h; //actual height
    canvas.style.backgroundColor = color;
    canvas.style.marginBottom = '20px';
    canvas.style.marginTop = '20px';
    document.getElementById(div).appendChild(canvas);
    return canvas;
}


var requestID;
function updateCanvas(){
    requestID = undefined;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    // For each contest (including human contest)
    for (var c = 0; c < contests.length; c++){
        collisions(contests[c]);
        movePlayers(contests[c]);
        firstPlayerAction(contests[c],c);
        secondPlayerAction(contests[c]);
        updatePlayerScores(contests[c]);
    }


    moveClouds();

    paintBackdrop();
    paintClouds();
    paintDanger();
    paintPlayers();
    paintStages();
    paintTime();
    paintGen();

    if (testing) paintNetwork(contests[contests.length-1]);

    if (time >= maxTime){
        // Update the graph
        avgScores.push([generation,getAverage()]);
        bestScores.push([generation,getBestNetwork().score]);
        graphAvg.updateOptions({'file': avgScores});
        graphBest.updateOptions({'file': bestScores});

        resetWorld();
    } else{
        requestAnimationFrame(updateCanvas);
    }
}

function paintNetwork(c){
    ctx.beginPath();
    ctx.font = "22px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    var out = c.players[1].network.feedforward([c.players[0].x, c.players[0].y, c.players[1].x, c.players[1].y, c.players[1].directionFacing, c.players[1].direction]);
    var max = out[0];
    var maxI = 0;
    var min = out[0];
    var minI = 0;
    var total = 0;
    for (var i = 0; i < out.length; i++){
        weightCircle(canvas.width*0.5+i*30-2*30,canvas.height*0.05,10,out[i]);
        if (out[i] > max){
            max = out[i];
            maxI = i;
        }
        if (out[i] < min){
            min = out[i];
            minI = i;
        }
        total += out[i];
    }

    var a;
    if (maxI == 0) a = 'Moving Left';
    if (maxI == 1) a = 'Moving Right';
    if (maxI == 2) a = 'Stationary';
    if (maxI == 3) a = 'Jumping';
    if (maxI == 4) a = 'Attacking';
    a += ' ' + Math.round(max/total*100) + '%';


    ctx.fillStyle = "blue";
    ctx.fillText(a, c.players[1].x, c.players[1].y-110);
    ctx.closePath();
}


function secondPlayerAction(contest){
    var n = contest.networks[1];
    var out = n.feedforward([contest.players[0].x, contest.players[0].y, contest.players[1].x, contest.players[1].y, contest.players[1].directionFacing, contest.players[1].direction]);
    takeAction(out, contest.players[1]);
}

// n == current contest number
function firstPlayerAction(contest,n){
    // if not the human contest
    if (!(n == contests.length-1)){
        var n = contest.networks[0];
        var out = n.feedforward([contest.players[1].x, contest.players[1].y, contest.players[0].x, contest.players[0].y, contest.players[0].directionFacing, contest.players[0].direction]);
        takeAction(out, contest.players[0]);
    }
}

function updatePlayerScores(contest){
    var players = contest.players;
    for (var p = 0; p < players.length; p++){
        players[p].network.score += timePunishment;
    }
}

// given an output of a neural network, make player do an action
function takeAction(output, player){
    var max = 0;
    var maxI = 0;
    for (var i = 0; i < output.length; i++){
        if (output[i] >= max){
            max = output[i];
            maxI = i;
        }   
    }

    if (maxI == 0){
        player.move(-1);
    } else if (maxI == 1){
        player.move(1);
    } else if (maxI == 2){
        player.move(0);
    } else if (maxI == 3){
        player.jump();
    } else{
        player.attack();
    }
}

function movePlayers(contest){
    var players = contest.players;

    for (var p = 0; p < players.length; p++){
        if (players[p].velocity[0] == 0 && players[p].velocity[1] == 0) players[p].network.score += stationaryPunishment;
        // if we will reach the ground on the next velocity step
        // or also applies if we are currently on the ground due to gravity
        if (players[p].y + players[p].velocity[1] + players[p].radius >= stage.y){
            // check if fell off fighting stage
            if (players[p].x < stage.x || players[p].x > stage.x+stage.width){
                players[p].network.score += punishment;
                players[p].x = players[p].startX;
            } else{
                // place player on the ground
                players[p].y = stage.y - players[p].radius;
                // stop movement
                players[p].velocity[1] = 0;
                players[p].isJumping = false;
            }
        } else{
            // update velocity due to gravity
            players[p].velocity[1] += g;
            // update position based on new velocity
            players[p].y += players[p].velocity[1];


        }
        // update x-position
        if (players[p].isAttacking && players[p].direction == 0){
            // If attacking, stationary, and facing left or right
            if (players[p].directionFacing == 1){
                if (players[p].x >= players[p].attackPos[0]){
                    // If still beyond starting pos of attack
                    players[p].velocity[0] += ag;
                    players[p].x += players[p].velocity[0];
                } else{
                    // If
                    players[p].x = players[p].attackPos[0];
                    players[p].isAttacking = false;
                    players[p].velocity[0] = players[p].attackVelocity[0];
                }
            } else{
                if (players[p].x <= players[p].attackPos[0]){
                    players[p].velocity[0] -= ag;
                    players[p].x += players[p].velocity[0];
                } else{
                    players[p].x = players[p].attackPos[0];
                    players[p].isAttacking = false;
                    players[p].velocity[0] = players[p].attackVelocity[0];
                }
            }
        } else{
            players[p].x += players[p].velocity[0];
        }
    }
}

function moveClouds(){
    for (var c = 0; c < clouds.length; c++){
        clouds[c].x += clouds[c].velocity;
        if (clouds[c].x+clouds[c].width < 0){
            clouds[c].x = canvas.width+getRand(0,canvas.width/2,1);
        }
    }
}

function paintStages(){
    ctx.beginPath();
    ctx.fillStyle = ctx.createPattern(stage.img,"repeat");
    ctx.fillRect(stage.x, stage.y, stage.width, stage.height);
    ctx.closePath();
}

function paintGen(){
    ctx.beginPath();
    ctx.font = "30px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Generation: " + generation,canvas.width*0.02, canvas.height*0.02);
    ctx.closePath();
} 

function paintTime(){
    ctx.beginPath();
    ctx.font = "30px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("Time: " + time,canvas.width*0.98, canvas.height*0.02);
    ctx.closePath();
}

function paintClouds(){
    for (var c = 0; c < clouds.length; c++){
        ctx.beginPath();
        ctx.fillStyle= "rgba(255,255,255," + clouds[c].alpha + ")";
        ctx.fillRect(clouds[c].x,clouds[c].y,clouds[c].width,clouds[c].height);
        ctx.closePath();
    }
}

function paintBackdrop(){
    ctx.beginPath();
    ctx.fillStyle="lightblue";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.closePath();
}

function paintDanger(){
    ctx.beginPath();
    ctx.fillStyle = ctx.createPattern(dangerImage,"repeat");
    ctx.fillRect(0,canvas.height*0.95,canvas.width,canvas.height);
    ctx.closePath();
}

function toggleTesting(){
    testing = testing ? false : true;
}

function paintPlayers(){
    var players = [];
    // If current round is a testing session, only paint the human contest
    // Otherwise paint every contest beside the human contest
    if (testing){
        players = contests[contests.length-1].players;
    } else{
        for (var c = 0; c < numContests; c++){
            players.push.apply(players,contests[c].players);
        }
    }

    for (var p = 0; p < players.length; p++){
        // paint the player's tag
        paintTag(players[p],players[p].x-players[p].radius*2,players[p].y-players[p].radius*3);

        // paint the player's body
        paintBody(players[p]);
    }
}

function paintBody(p){
    ctx.beginPath();
    
    ctx.moveTo(p.x+40,p.y);
    if (p.directionFacing == -1){
        ctx.moveTo(p.x-p.radius, p.y);
        ctx.lineTo(p.x+p.radius*3/4,p.y-p.radius*5/4);
        ctx.lineTo(p.x+p.radius*3/4,p.y+p.radius*5/4);
    } else if (p.directionFacing == 1){
        ctx.moveTo(p.x+p.radius, p.y);
        ctx.lineTo(p.x-p.radius*3/4,p.y-p.radius*5/4);
        ctx.lineTo(p.x-p.radius*3/4,p.y+p.radius*5/4);
    } else{
        ctx.moveTo(p.x, p.y+p.radius);
        ctx.lineTo(p.x-p.radius,p.y-p.radius);
        ctx.lineTo(p.x+p.radius,p.y-p.radius);
    }
    
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.closePath();
}

function weightCircle(x, y, r, a){
    ctx.beginPath();
    ctx.arc(x,y,r,0,2*Math.PI);
    ctx.fillStyle = "rgba(0,0,0," + a + ")";
    ctx.fill();
    ctx.closePath();
}

// x and y are coordinates of center
function paintTag(p, x,y){
    // paint the text
    ctx.font = p.radius + "px Arial";
    var fontWidth = ctx.measureText(p.name).width;
    var fontHeight = p.radius * 1.286;

    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x-fontWidth*0.05,y-fontHeight*0.05,fontWidth*1.1,fontHeight*1.1);
    ctx.closePath();

    // Paint player's name
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(p.name,x,y);

    // Paint player's score
    if (p.network.score > 0)  ctx.fillStyle = "green";
    if (p.network.score == 0) ctx.fillStyle = "white";
    if (p.network.score < 0)  ctx.fillStyle = "red";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(p.network.score*100)/100,x+fontWidth/2,y-fontHeight );
}

// Returns a random number in range min (incl.) max (excl.)
// Third parameter specifies if you want an integer
function getRand(min, max, wantInt){
    if (wantInt){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min;
    } else{
        return Math.random() * (max - min) + min;
    }
}





// =============== NEURAL NETWORKS =================
// =================================================

// numNodes = [a, b, c] where a = number of nodes in layer 0, etc.
function Network(numNodes){
    this.score = 0; // value of the network (for genetic algorithm)
    this.nodes       = genNodes(numNodes);

    // Generate weights for the nodes
    genWeights(this.nodes);

    this.numLayers   = numNodes.length;
    this.numNodes    = numNodes;
    this.feedforward = function(inputs){
        // adjust value for all nodes in first layer to the input value
        for (var n = 0; n < this.nodes[0].length; n++){
            this.nodes[0][n].value = inputs[n];
        }

        // for all layers (except for final layer)
        for (var l = 0; l < this.numLayers-1;  l++){
            // for all nodes in next layer
            for (var n = 0; n < this.numNodes[l+1]; n++){
                var total = 0;
                // for all nodes in current layer
                for (var np = 0; np < this.numNodes[l]; np++){
                    total += this.nodes[l][np].value * this.nodes[l][np].weights[n];
                }
                this.nodes[l+1][n].value = sigmoid(total);
            }
        }

        // for each node in the last layer
        var output = [];
        for (var n = 0; n < this.nodes[this.numLayers-1].length; n++){
            output.push(this.nodes[this.numLayers-1][n].value);
            //console.log("Output: " + this.nodes[this.numLayers-1][n].value);
        }
        return output;
    }

    // Set the weight between node in:
    //  layer = aLayer, node = aNode AND layer = aLayer+1, node = bNode
    this.setWeight = function(aLayer, aNode, bNode, w){
        this.nodes[aLayer][aNode].weights[bNode] = w;
    }

    
    this.draw = function(canv){

        this.locations = [];
        var locations = this.locations;
        var context = canv.getContext("2d");
        var nn = this; 

        // Clear the canvas
        context.clearRect(0,0,canv.width,canv.height);

        // Draw the nodes
        for (var layer = 0; layer < nn.nodes.length; layer++){
            if (!locations[layer]) locations[layer] = [];
            for (var node = 0; node < nn.nodes[layer].length; node++){
                locations[layer].push([(canv.width*0.1)+(canv.width*0.8)*(layer/(nn.nodes.length-1)),(canv.height*0.15)+(canv.height*0.7)*(node/(nn.nodes[layer].length-1))]);
                drawNode((canv.width*0.1)+(canv.width*0.8)*(layer/(nn.nodes.length-1)),(canv.height*0.15)+(canv.height*0.7)*(node/(nn.nodes[layer].length-1)),10,context);
            }
        }

        var max;
        var min;
        for (var layer = 0; layer < nn.numLayers; layer++){
            for (var n = 0; n < nn.nodes[layer].length; n++){
                for (var w = 0; w < nn.nodes[layer][n].weights.length; w++){
                    if (!max || nn.nodes[layer][n].weights[w] >= max) max = nn.nodes[layer][n].weights[w];
                    if (!min || nn.nodes[layer][n].weights[w] <= min) min = nn.nodes[layer][n].weights[w];
                }
            }
        }
        
        // Draw the connections
        for (var layer = 0; layer < nn.numLayers-1; layer++){
            var adj = layer+1;
            for (var a = 0; a < nn.nodes[layer].length; a++){
                for (var b = 0; b < nn.nodes[adj].length; b++){
                    // adding 0.03 at the end so min weight isn't invisible
                    var alpha = (nn.nodes[layer][a].weights[b]-min)/(max-min)+0.03;
                    //console.log("Alpha = " + alpha);
                    drawConnection(locations[layer][a][0],locations[layer][a][1],locations[adj][b][0], locations[adj][b][1],alpha, context);
                }
            }
        }
        
        // Draw the score
        context.beginPath();
        context.font = "22px Arial";
        context.fillStyle = "black";
        context.textAlign = "right";
        context.textBaseline = "top";
        context.fillText("Score: " + Math.round(this.score*1000)/1000,canv.width*0.98, canv.height*0.02);
        context.closePath();

        // Draw the title
        context.beginPath();
        context.font = "bold 22px Arial";
        context.fillStyle = "black";
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillText("Best Net (Prev Gen)",canv.width*0.02, canv.height*0.02);
        context.closePath();
    }
}

function drawNode(x,y,radius, context){
    context.beginPath();
    context.arc(x,y,radius,0,2*Math.PI);
    context.fillStyle = "red";
    context.fill();
    context.closePath();
}

function drawConnection(ax,ay,bx,by,intensity, context){
    context.beginPath();
    context.strokeStyle= "rgba(0,0,0," + intensity + ")";
    context.moveTo(ax,ay);
    context.lineTo(bx,by);
    context.stroke();
    context.closePath();
}

function sigmoid(x){
    return 1/(1+Math.pow(Math.E,-x)); 
}

function Node(layer){
    this.layer = layer;
    this.weights = []; 
    this.value = 0;
    this.ID = []; //ID = [a, b]; a = layer, b = node number
}

function genNodes(numNodes){
    var nodes = [];
    for (var layer = 0; layer < numNodes.length; layer++){
        if (!nodes[layer]) nodes[layer] = [];
        for (var node = 0; node < numNodes[layer]; node++){
            nodes[layer].push(new Node(layer));
        }
    }
    return nodes;
}

function genWeights(nodes){
    // for all layers except for last layer
    for (var l = 0; l < nodes.length-1; l++){
        // for all nodes in current layer
        for (var n = 0; n < nodes[l].length; n++){
            // for all nodes in next layer
            for (var nl = 0; nl < nodes[l+1].length; nl++){
                // push weight between n and nl;
                nodes[l][n].weights.push(getRand(-1,1,0));
            }
        }
    }
}

function randWeights(numNodes){
    var w = [];
    for (var layer = 0; layer < numNodes.length; layer++){
        if (!w[layer]) w[layer] = [];
        for (var node = 0; node < numNodes[layer]; node++){
            w[layer].push(0);
        }
    }
    return w;
}

/*
    Get the genes for a network 'n'
    GENE STRUCTURE:
    Network = [2, 3, 2]
    Nodes:
        Layer 0: 00, 01
        Layer 1: 10, 11, 12
        Layer 2: 20, 21

             Layer Sizes                      Weights between nodes
              v------v  v-----------------------------------------------------------------v
    Genes: [3, 2, 3, 2, 00->10, 00->11, 00->12, 01->10, 01->11, 01->12, ..., 12->20, 12->21]
            ^num layers
        where 'a->b' indicates the weight between node a to b
*/
function getGenes(n){
    var layerSizes = n.numNodes; // number of nodes in each layer [a, b, c] 
    var numLayers = layerSizes.length;
    var genes = [numLayers];
    for (var l = 0; l < numLayers; l++){
        genes.push(layerSizes[l]);
    }

    var nodes = n.nodes;
    for (var l = 0; l < numLayers; l++){
        for (var n = 0; n < layerSizes[l]; n++){
            genes.push.apply(genes, nodes[l][n].weights);
        }
    }

    return genes;
}

// Generate a network given its genes
function genNetwork(genes){
    var numLayers = genes.shift();
    var layerSizes = [];
    for (var l = 0; l < numLayers; l++){
        layerSizes.push(genes.shift()); 
    }

    var net = new Network(layerSizes);
    var pos = 0;
    for (var l = 0; l < numLayers-1; l++){
        for (var n = 0; n < layerSizes[l]; n++){
            for (var n_dest = 0; n_dest < layerSizes[l+1]; n_dest++){
                net.setWeight(l, n, n_dest, genes[pos++]) ;   
            }
        }
    }

    return net;
}


function createGraph(id, title, xLabel, yLabel, w, h, parentDiv){
    // Create div for graph
    var div = document.createElement("div");
    div.id = id;
    div.className = 'graph';

    // Add the div to the parent div (if one exists)
    // Otherwise just append to HTML body
    if (parentDiv) document.getElementById(parentDiv).appendChild(div);
    else document.body.appendChild(div);

    // Create actual graph (goes into the div with id = id)
    var dataArray = [[0,0]];
    var graph = new Dygraph(document.getElementById(id), dataArray,
        {
            // Options go here
            animatedZooms: true,
            title: title,
            titleHeight: 25,
            labels: [xLabel, yLabel],
            height: 200,
            width: 300,
            showLabelsOnHighlight: false,
            rightGap: 30,
        }
    );
    return graph;
}

main();
