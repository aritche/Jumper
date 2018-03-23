var requestAnimationFrame = window.requestAnimationFrame || 
                            window.mozRequestAnimationFrame || 
                            window.webkitRequestAnimationFrame || 
                            window.msRequestAnimationFrame;

var canvas = createCanvas(500, 250, 'white', 'gameArea');
var ctx = canvas.getContext("2d");

var stage;
var g = 1;
var ag = -2; // attack gravity. acceleration back to starting pos after an attack
var reward = 30; // reward for destroying enemy
var punishment = -30; // punishment for being destroyed or falling off edge
var timePunishment = 0;

var time = 0; // elapsed time in seconds
var generation = 0;
var mutateChance = 2;

var clouds = [];
var colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'];

var dangerImage  = new Image();
dangerImage.src = 'lava.gif';
var stageImage = new Image();
stageImage.src = 'stage.gif';

var contests = []; // a list of all current contests
var numContests = 20;
var playersPerContest = 2;
var networks = []; // a list of all current networks

function main(){
    setInterval(function(){time += 1}, 1000);
    resetWorld();
}

// resets the world and all its players
function resetWorld(){
    generation++;

    time = 0;

    // Update the list of networks
    if (generation == 1){
        // Generate networks
        for (var n = 0; n < numContests*playersPerContest; n++){
            networks.push(new Network([4,5,5]));
        }
    } else{
        // Reproduce networks;
        networks = reproduce(networks);
    }

    // Create contests
    networks = shuffle(networks);
    contests = [];
    for (var c = 0; c < numContests; c++){
        chosenNetworks = [];
        for (var n = 0; n < playersPerContest; n++){
            chosenNetworks.push(networks[c*playersPerContest+n]);    
        }
        contests.push(new Contest(chosenNetworks));
    }

    for (var n = 0; n < playersPerContest; n++){
        var canv = createCanvas(100,100,"white","network"+n);
        contests[0].networks[n].draw(canv); 
    }

    clouds = [];
    clouds.push(new Cloud(getRand(0,canvas.width*1.5,1),getRand(0,canvas.height,1),200,50,0.5));
    clouds.push(new Cloud(getRand(0,canvas.width*1.5,1),getRand(0,canvas.height,1),200,50,0.5));
    clouds.push(new Cloud(getRand(0,canvas.width*1.5,1),getRand(0,canvas.height,1),200,50,0.5));
    clouds.push(new Cloud(getRand(0,canvas.width*1.5,1),getRand(0,canvas.height,1),200,50,0.5));
    
    stage = new Stage(canvas.width*0.15,
                      canvas.height*0.9,
                      canvas.width*0.70,
                      canvas.height*0.1, 
                      "black");


    placePlayers();
    updateCanvas();
}

function cloneNetwork(n){
    return JSON.parse(JSON.stringify(n));
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

function reproduce(nets){
    // Make sure the scores of each network are zero before passing back
    var pop = [];
    var genes = [];
    for (var n = 0; n < nets.length; n++){
        genes.push(getGenes(nets[n]));
    }

    // Push the current best network
    var best = getBestNetwork();
    best.score = 0;
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
    return pop;
}


// Returns an array, where items are indexes of 'nets' array
// Number of times an index is in pool = score of network
function createSelectionPool(nets){
    var pool = [];

    for (var n = 0; n < nets.length; n++){
        if (nets[n].score == 0){ // negative scores only once
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

            winner.network.score += reward;
            loser.network.score += punishment;

            winners.push(winner);

            contest.isOver = true;
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
    var players = [];
    for (var c = 0; c < contests.length; c++){
        players.push.apply(players,contests[c].players);
    }
    for (var p = 0; p < players.length; p++){
        players[p].x = stage.x+players[p].radius+stage.width*(p/(players.length-1));
        
        //fix final player's position
        if (p == players.length-1){
            players[p].x -= players[p].radius*2;
        }
        players[p].y = canvas.height-(stage.height+players[p].radius);

        players[p].startX = players[p].x;
        players[p].startY = players[p].y;

        // sink player slightly into ground
        //players[p].y += players[p].radius*2*0.08;
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
    // whether the Contest has ended
    this.isOver = false;

    // A list of players in the contest
    this.players = [];
    for (var p = 0; p < networks.length; p++){
        this.players.push(new Player("Player " + p, 0, colors[p%colors.length], networks[p]));
    }

    this.networks = networks;

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
        // can only attack while not moving and not already attacking
        if (this.direction == 0 && !this.isAttacking){ 
            this.isAttacking = true;
            this.attackPos = [this.x,this.y];
            this.attackVelocity = [this.velocity[0],this.velocity[1]];
            this.velocity[0] += 20*this.directionFacing;
        }
        //this.radius *= 1.3;
    }

    // Neural network used by the player
    this.network = network;
}


// return true if player p can move in direction d
function canMove(p, d){

}

function checkKey(e){
    e = e || window.event;

    var players = contests[0].players;
    
    if (e.keyCode == '38') players[1].jump(); 
    if (e.keyCode == '66') players[1].attack();
    if (e.keyCode == '90') players[1].move(-1); 
    if (e.keyCode == '88') players[1].move(0);

    if (e.keyCode == '32') players[0].jump();
    if (e.keyCode == '39') players[0].move(1);
    if (e.keyCode == '37') players[0].move(-1);
    if (e.keyCode == '40') players[0].move(0);
    if (e.keyCode == '65') players[0].attack();
}
document.onkeydown = checkKey;

function createCanvas(w, h, color, id){
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
    document.body.appendChild(canvas);
    return canvas;
}


var requestID;
function updateCanvas(){
    requestID = undefined;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    for (var c = 0; c < contests.length; c++){
        if (!contests[c].isOver){
            collisions(contests[c]);
            movePlayers(contests[c]);
            firstPlayerAction(contests[c]);
            secondPlayerAction(contests[c]);
            updatePlayerScores(contests[c]);
        }
    }

    moveClouds();

    paintBackdrop();
    paintClouds();
    paintDanger();
    paintPlayers();
    paintStages();
    paintTime();

    if (time >= 5){
        console.log("Best Score: " + getBestNetwork().score + ", AVG: "+ getAverage());
        resetWorld();
    } else{
        requestAnimationFrame(updateCanvas);
    }
}


function secondPlayerAction(contest){
    var n = contest.networks[0];
    var out = n.feedforward([contest.players[0].x, contest.players[0].y, contest.players[1].x, contest.players[1].y]);
    takeAction(out, contest.players[1]);
}

function firstPlayerAction(contest){
    var n = contest.networks[0];
    var out = n.feedforward([contest.players[1].x, contest.players[1].y, contest.players[0].x, contest.players[0].y]);
    takeAction(out, contest.players[0]);
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
            if (players[p].directionFacing == 1){
                if (players[p].x >= players[p].attackPos[0]){
                    players[p].velocity[0] += ag;
                    players[p].x += players[p].velocity[0];
                } else{
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

function paintPlayers(){
    // paint the player tag
    //var players = contests[0].players;
    var players = [];
    for (var c = 0; c < contests.length; c++){
        players.push.apply(players,contests[c].players);
    }

    for (var p = 0; p < players.length; p++){
        paintTag(players[p],players[p].x-players[p].radius*2,players[p].y-players[p].radius*3);
        ctx.beginPath();
        ctx.arc(players[p].x,players[p].y,players[p].radius,0,2*Math.PI);
        ctx.fillStyle = players[p].color;
        ctx.fill();
        ctx.closePath();
    }
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

    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(p.name,x,y);
    if (p.network.score > 0)  ctx.fillStyle = "green";
    if (p.network.score == 0) ctx.fillStyle = "white";
    if (p.network.score < 0)  ctx.fillStyle = "red";
    ctx.fillText(p.network.score,x+fontWidth/2,y-fontHeight );
//    ctx.beginPath();
//    ctx.fillStyle = "rgba(0,0,0,0,0.5)"; 
//    ctx.fillRect()
//    ctx.closePath();
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


main();
