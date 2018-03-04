var requestAnimationFrame = window.requestAnimationFrame || 
                            window.mozRequestAnimationFrame || 
                            window.webkitRequestAnimationFrame || 
                            window.msRequestAnimationFrame;

var canvas = createCanvas(500, 250, 'white', 'gameArea');
var ctx = canvas.getContext("2d");

var players = [];
var stage;
var g = -5;

function main(){
    players.push(new Player("Player A", 0, "white"));
    players.push(new Player("Player B", 1, "green"));
    
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
        players[p].y += players[p].radius*2*0.08;
    }
}

function Stage(x, y, width, height, color){
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
}


// direction 'n' = neutral
function Player(name, id, color){
    this.name = name;
    this.id = id;
    this.color = color;
    this.x = 0;
    this.y = 0;

    this.direction = 'n'

    this.radius = 20;

    this.velocity = [0,0]; // velocity x and y

    this.move = function(direction){
        this.direction = direction;
    }

    this.jumping = false;
    this.jump = function(){
        this.velocity[1] = 100;
        this.jumping = true;
    }
}

function checkKey(e){
    e = e || window.event;
    if (e.keyCode == '32') players[0].jump();
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

    paintBackdrop();
    paintDanger();
    paintPlayers();
    paintStages();

    requestAnimationFrame(updateCanvas);
}

function movePlayers(){
    for (var p = 0; p < players.length; p++){
        players[p].y -= players[p].velocity[1];
        players[p].x -= players[p].velocity[0];
        if (players[p].y > stage.y-players[p].radius){
            players[p].jumping = false;
            players[p].velocity[1] = 0;
        } else{
            players[p].velocity[1] =+ g;
        }
    }
}

function paintStages(){
    ctx.beginPath();
    ctx.fillStyle=stage.color;
    ctx.fillRect(stage.x, stage.y, stage.width, stage.height);
    ctx.closePath();
}

function paintBackdrop(){
    ctx.beginPath();
    ctx.fillStyle="lightblue";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.closePath();
}

function paintDanger(){
    ctx.beginPath();
    ctx.fillStyle="red";
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

main();
