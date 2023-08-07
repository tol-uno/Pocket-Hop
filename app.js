let sensitivity = 0.5;
let airAcceleration = 0.1;
let gravity = 0.05;
let prevDateNow;

var midX = 0;
var midY = 0;

function startGame() { // Called on page load in HMTL

    touchHandler = new InputHandler;
    player = new Player(60 + 75, 150);
    map = new Map();
    map.start("original"); // canvasArea.start(); is called here 

}


var canvasArea = { //Canvas Object
    canvas : document.createElement("canvas"),
    
    start : function() { // EXECUTED BY startGame()
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        midX = canvasArea.canvas.width / 2;
        midY = canvasArea.canvas.height / 2;


        this.ctx = this.canvas.getContext("2d");
        document.body.insertBefore(this.canvas, document.body.childNodes[0]);
        
        prevDateNow = Date.now(); // For Delta Time
        this.interval = setInterval(updateGameArea, 10); // Number sets the taget frame rate. 1000/# = FPS
    },

    clear : function() { // CLEARS WHOLE CANVAS
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    },

    resize : function() {
        console.log("resized");
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        player.restart();
        UserInterface.restartTimer();
    }
}


var UserInterface = {
    
    timer : 0,
    timerStart : Date.now(),

    update : function() {
        this.timer = Date.now() - this.timerStart;
    },

    restartTimer : function() {
        this.timer = 0;
        this.timerStart = Date.now();
    },

    render : function(dt) {

        // DRAWING DEBUG TEXT
        var textX = 10
        canvasArea.ctx.font = "15px sans-serif";

        canvasArea.ctx.fillText("dragAmount: " + touchHandler.dragAmount, textX, 60);
        canvasArea.ctx.fillText("fps: " + Math.round(100/dt), textX, 80);
        canvasArea.ctx.fillText("delta time: " + Math.round(dt), textX, 100);
        canvasArea.ctx.fillText("speed: " + player.speed, textX, 120);
        canvasArea.ctx.fillText("angle: " + player.angle, textX, 140);
        canvasArea.ctx.fillText("timer: " + this.timer / 1000, textX, 160);
        canvasArea.ctx.fillText("jumpValue: " + player.jumpValue, textX, 180);
    }
}


class Map {
    platforms = [];

    start(name) {

        // PARSE JSON DATA. FUNCTION USED BY parsePlatforms()
        async function getJsonData() { // Taken from: https://www.javascripttutorial.net/javascript-fetch-api/
            let url = "assets/maps/" + name + ".json";
            try {
                let res = await fetch(url);
                return await res.json();
            } catch (error) {
                console.log(error);
            }
        }


        // LOOP THROUGH JSON DATA AND ADD NEW PLATFORM OBJECTS
        async function parsePlatforms() {
            let jsonData = await getJsonData(); // SEE ABOVE ^^

            var platforms = [];

            jsonData.platforms.forEach(platform => { // LOOP THROUGH DATA AND ADD EACH PLATFORM TO AN ARRAY
                platforms.push(platform);
            });

            return platforms;
        }

        parsePlatforms().then(value => { // WAITS FOR ASYNC FUNCTION 
            this.platforms = value;
            canvasArea.start();

        });
    }

    update() {
        // Figure out which platforms are in view
    }

    render() { // Render the platforms that are in view (all of them rn)
        const ctx = canvasArea.ctx;

        ctx.save();
        var border = 7;
        ctx.translate(-player.x + midX, -player.y + midY);

        this.platforms.forEach(platform => {
            
            ctx.fillStyle = "#16b144"  // DRAW PLATFORM WITH BORDER
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            ctx.fillStyle = "#128f38";
            ctx.fillRect(platform.x + border, platform.y + border, platform.width - border * 2, platform.height - border * 2);

        });

        ctx.restore();
    }

}


class InputHandler {
    dragAmount = 0;
    previousX = 0;
    touchX = 0
    pressing = false;

    constructor(){
        window.addEventListener("touchstart", e => {
            this.touchX = e.changedTouches[0].pageX;
            this.previousX = e.changedTouches[0].pageX;
            this.pressing = true;
        });

        window.addEventListener("touchmove", e => {
            this.touchX = e.changedTouches[0].pageX;
        });

        window.addEventListener("touchend", e => {
            this.dragAmount = 0;
            this.touchX = 0;
            this.previousX = 0;
            this.pressing = false;
        });
    }

    update() {
        if (this.pressing == true) {
            this.dragAmount = this.touchX - this.previousX;
            this.previousX = this.touchX;
        }
    }

}


class Player {
    angle = 0;
    speed = 0;
    jumpValue = 0;
    jumpVelocity = 2;

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.restartX = x;
        this.restartY = y;
    }

    render(dt) { // DT just getting passed for debug text
        
        const ctx = canvasArea.ctx;
        
        ctx.save(); // Saves the state of the canvas
        
        ctx.translate(midX, midY);

        // DRAWING SHADOW 
        ctx.rotate(this.angle * Math.PI/180); // rotating canvas

        ctx.fillStyle = "#00000040" ;
        var blurValue = player.jumpValue / 16 + 1
        ctx.filter = "blur(" + blurValue + "px)"; // 40 / 10 + 1-> 5  0 / 10 + 1 -> 1
        ctx.fillRect(-15, -15, 30, 30)
        ctx.filter = "none";

        ctx.rotate(-this.angle * Math.PI/180); // RE-rotating canvas


        // DRAWING PLAYER TOP
        ctx.translate(0, -this.jumpValue - 32); 
        ctx.rotate(this.angle * Math.PI/180); // rotating canvas
        ctx.drawImage(document.getElementById("playerTop"), -16, -16);

        ctx.restore();

        // SIDES OF PLAYER
        ctx.save();
        
        var angleRad = this.angle * (Math.PI/180);
        var loopedAngle = this.angle - (Math.round(this.angle/360) * 360);

        if (-90 < loopedAngle && loopedAngle < 90) { // BOT WALL
            ctx.fillStyle = "#B00C0A";
            ctx.beginPath();
            ctx.moveTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (0 < loopedAngle && loopedAngle < 180) { // RIGHT WALL
            ctx.fillStyle = "#800908";
            ctx.beginPath();
            ctx.moveTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (90 < loopedAngle || loopedAngle < -90) { // TOP WALL
            ctx.fillStyle = "#B00C0A";
            ctx.beginPath();
            ctx.moveTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (-180 < loopedAngle && loopedAngle < 0) { // LEFT WALL
            ctx.fillStyle = "#800908";
            ctx.beginPath();
            ctx.moveTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();


        // STRAFE OPTIMIZER HUD
        var strafeThreshold = 0.9 ** (0.08 * this.speed - 30);

        if (Math.abs(touchHandler.dragAmount) < (strafeThreshold * dt)) {
            if ((strafeThreshold * dt) - Math.abs(touchHandler.dragAmount) < strafeThreshold * dt * 0.2) {
                ctx.fillStyle = "#00FF00"; // GREEN
            } else {
                ctx.fillStyle = "#FFFFFF"; // WHITE
            }
        } else {
            ctx.fillStyle = "#FF0000"; // RED
        }

        ctx.fillRect(midX-8, midY + 28, 8, 4 * Math.abs(touchHandler.dragAmount)); // YOUR STRAFE
        ctx.fillRect(midX +4, midY + 28, 8, 4 * strafeThreshold * dt); // THRESHOLD
    
    }


    updatePos(dt) {  // NEEDS TO BE FPS INDEPENDENT
        this.angle += touchHandler.dragAmount * sensitivity; // gain calculation is independent of sensitivity BAD BAD BAD

        if (this.speed >= 0) { // PREVENTS GOING BACKWARDS
            this.speed += this.calculateGain(touchHandler.dragAmount, dt);
        } else {this.speed = 0}
    
        this.x += Math.cos(this.angle * (Math.PI / 180)) * this.speed/50 * dt; // MOVE FORWARD AT ANGLE BASED ON SPEED
        this.y += Math.sin(this.angle * (Math.PI / 180)) * this.speed/50 * dt;
    
        if (this.jumpValue < 0) { // JUMPING
            this.jumpValue = 0;
            this.jumpVelocity = 2;
        } else {
            this.jumpValue += this.jumpVelocity * dt;
            this.jumpVelocity -= gravity * dt;
        }
    }

    calculateGain(drag, dt) { // COULD MAYBE PUT THIS INSIDE OF updatePos() to avoid having to pass dt
        
        var strafeThreshold = 0.9 ** (0.08 * this.speed - 30); // THROW IN DESMOS

        if (Math.abs(drag) < strafeThreshold * dt) {
            return Math.abs(drag) * airAcceleration;
        } else {
            return -Math.abs(drag) * airAcceleration;
        }
    }

    restart() {
        this.x = this.restartX;
        this.y = this.restartY;
        this.angle = 0;
        this.speed = 0;
        this.jumpValue = 0;
        this.jumpVelocity = 2;
    }
}


class Vector {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }

    add = function(otherVec) {
        this.x += otherVec.x;
        this.y += otherVec.y;
    }

    length = function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    divide = function(scalar) {
        return new Vector(this.x / scalar, this.y / scalar);
    }

    multiply = function(scalar) {
        this.x *= scalar;
        this.y *= scalar;
    }

    normalize(multiplier) {
        if (this.length !== 0) {
            var n = this.divide(this.length()); // dont ever want to normalize when vector length is zero
            this.x = n.x * multiplier;
            this.y = n.y * multiplier;
        }
    }
}


function updateGameArea() { // CALLED EVERY FRAME

    var dt = (Date.now() - prevDateNow)/10; // Delta Time for FPS independence. dt = amount of milliseconds between frames
    prevDateNow = Date.now();
    
    touchHandler.update();
    player.updatePos(dt);
    UserInterface.update();

    canvasArea.clear();
    map.render();
    player.render(dt);
    UserInterface.render(dt);

}


//      :)