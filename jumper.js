var requestAnimationFrame = window.requestAnimationFrame || 
                            window.mozRequestAnimationFrame || 
                            window.webkitRequestAnimationFrame || 
                            window.msRequestAnimationFrame;

var canvas = createCanvas(500, 250, 'white', 'gameArea');
var ctx = canvas.getContext("2d");
function main(){
    updateCanvas();
}

function createCanvas(w, h, color, id){
    var canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.className = 'canvas';
    canvas.width = w;
    canvas.height = h;
    canvas.style.backgroundColor = color;
    canvas.style.marginBottom = '20px';
    canvas.style.marginTop = '20px';
    document.body.appendChild(canvas);
    return canvas;
}


function updateCanvas(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    paintBackdrop();
    paintDanger();
    paintFloor();

    requestAnimationFrame(updateCanvas);
}

function paintFloor(){
    ctx.beginPath();
    ctx.fillStyle="black";
    ctx.fillRect(canvas.width*0.15,canvas.height * 0.8, canvas.width*0.7, canvas.height);
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

function paintPlayer(){

}

main();
