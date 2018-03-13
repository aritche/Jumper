var requestAnimationFrame = window.requestAnimationFrame || 
                            window.mozRequestAnimationFrame || 
                            window.webkitRequestAnimationFrame || 
                            window.msRequestAnimationFrame;

var canvas = createCanvas(500, 250, 'white', 'gameArea');
var ctx = canvas.getContext("2d");

var players = [];
var stage;
var g = 1;
var ag = -2; // attack gravity. acceleration back to starting pos after an attack
var reward = 30; // reward for destroying enemy
var punishment = -30; // punishment for being destroyed or falling off edge
var timePunishment = 0;

var gameOver = false;
var time = 0; // elapsed time in seconds

var clouds = [];

var dangerImage  = new Image();
dangerImage.src = 'lava.gif';
var stageImage = new Image();
stageImage.src = 'stage.gif';

function main(){
    resetWorld();
}

// resets the world and all its players
function resetWorld(){
    players = [];
    players.push(new Player("Player A", 0, "white"));
    players.push(new Player("Player B", 1, "green"));

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

    time = 0;
    gameOver = false;

    placePlayers();
    updateCanvas();
}

function collisions(){
    contests = []; // handle all collision contests
    for (var p = 0; p < players.length; p++){
        if (players[p].isAttacking){
            for (var e = 0; e < players.length; e++){
                if (e != p){
                    if (overlap(players[p],players[e])){
                        contests.push([players[p],players[e]]);
                    }
                }
            }
        }
    }

    if (contests.length != 0){
        var winners = [];
        var winner;
        var loser;
        for (var i = 0; i < contests.length; i++){
            var a = contests[i][0];
            var b = contests[i][1];
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

            winner.score += reward;
            loser.score += punishment;

            winners.push(winner);

            gameOver = true;
        }
        players = winners;
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


// direction 'n' = neutral
function Player(name, id, color){
    this.name = name;
    this.id = id;
    this.color = color;
    this.x = 0;
    this.y = 0;
    this.startX = 0;
    this.startY = 0;

    this.score = 0;

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
}


// return true if player p can move in direction d
function canMove(p, d){

}

function checkKey(e){
    e = e || window.event;
    
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


function updateCanvas(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    collisions();
    movePlayers();
    botAction();
    updatePlayerScores();
    moveClouds();

    paintBackdrop();
    paintClouds();
    paintDanger();
    paintPlayers();
    paintStages();

    if (gameOver || time == 5){
        resetWorld();
    } else{
        requestAnimationFrame(updateCanvas);
    }
}

function botAction(){
    if (players.length >= 2){
        players[1].move(-1);
    }
}

function updatePlayerScores(){
    for (var p = 0; p < players.length; p++){
        players[p].score += timePunishment;
    }
}

function movePlayers(){
    for (var p = 0; p < players.length; p++){
        // if we will reach the ground on the next velocity step
        // or also applies if we are currently on the ground due to gravity
        if (players[p].y + players[p].velocity[1] + players[p].radius >= stage.y){
            // check if fell off fighting stage
            if (players[p].x < stage.x || players[p].x > stage.x+stage.width){
                players[p].score += punishment;
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
    if (p.score > 0)  ctx.fillStyle = "green";
    if (p.score == 0) ctx.fillStyle = "white";
    if (p.score < 0)  ctx.fillStyle = "red";
    ctx.fillText(p.score,x+fontWidth/2,y-fontHeight );
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

main();
