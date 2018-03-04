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

var clouds = [];

var dangerImage  = new Image();
dangerImage.src = 'lava.gif';
var stageImage = new Image();
stageImage.src = 'stage.gif';

function main(){
    players.push(new Player("Player A", 0, "white"));
    players.push(new Player("Player B", 1, "green"));

    clouds.push(new Cloud(canvas.width+getRand(0,canvas.width/2,1),getRand(0,canvas.height,1),125,50,0.5));
    clouds.push(new Cloud(canvas.width+getRand(0,canvas.width/2,1),getRand(0,canvas.height,1),200,50,0.5));
    clouds.push(new Cloud(canvas.width+getRand(0,canvas.width/2,1),getRand(0,canvas.height,1),200,50,0.5));
    
    stage = new Stage(canvas.width*0.15,
                      canvas.height*0.9,
                      canvas.width*0.70,
                      canvas.height*0.1, 
                      "black");
    placePlayers();
    updateCanvas();
}

function placePlayers(){
    for (var p = 0; p < players.length; p++){
        players[p].x = stage.x+players[p].radius+stage.width*(p/(players.length-1));
        
        //fix final player's position
        if (p == players.length-1){
            players[p].x -= players[p].radius*2;
        }
        players[p].y = canvas.height-(stage.height+players[p].radius);

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

    this.radius = 20;

    this.velocity = [0,0]; // velocity x and y

    this.move = function(direction){
        this.direction = direction;
    }

    this.isJumping = false;

    this.jump = function(){
        this.isJumping = true;
        this.velocity[1] = -20;
    }
    
    // 1 = right, -1 = left, 0 = neutral
    this.direction = 0; // direction of movement
    this.directionFacing = 0; // direction of facing currently

    this.move = function(d){
        this.velocity[0] = 5*d;
        this.direction = d;
        if (d != 0){
            this.directionFacing = d;
        }
    }

    this.isAttacking = false;
    this.attackPos = [0,0]; // pullback coordinates after an attack
    this.attackVelocity = [0,0]; // original velocity before attack 
    this.attack = function(){
        if (this.direction == 0){ // can only attack while not moving
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
    if (e.keyCode == '32' && !(players[0].isJumping)) players[0].jump();
    if (e.keyCode == '38' && !(players[1].isJumping)) players[1].jump();
    if (e.keyCode == '39' && !(players[0].isAttacking)) players[0].move(1);
    if (e.keyCode == '37' && !(players[0].isAttacking)) players[0].move(-1);
    if (e.keyCode == '40' && !(players[0].isAttacking)) players[0].move(0);
    if (e.keyCode == '65' && !(players[0].isAttacking)) players[0].attack();
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
    
    movePlayers();
    moveClouds();

    paintBackdrop();
    paintClouds();
    paintDanger();
    paintPlayers();
    paintStages();

    requestAnimationFrame(updateCanvas);
}

function movePlayers(){
    for (var p = 0; p < players.length; p++){
        // if we will reach the ground on the next velocity step
        // or also applies if we are currently on the ground due to gravity
        if (players[p].y + players[p].velocity[1] + players[p].radius >= stage.y){
            // place player on the ground
            players[p].y = stage.y - players[p].radius;
            // stop movement
            players[p].velocity[1] = 0;
            players[p].isJumping = false;

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
    for (var p = 0; p < players.length; p++){
        ctx.beginPath();
        ctx.arc(players[p].x,players[p].y,players[p].radius,0,2*Math.PI);
        ctx.fillStyle = players[p].color;
        ctx.fill();
        ctx.closePath();
    }
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
