let sensitivity = 0.5;
let airAcceleration = 0.1;
let gravity = 0.05;
let prevDateNow;


function startGame() { // Called on page load in HMTL

    canvasArea.start();

    touchHandler = new InputHandler;
    player = new Player(100, 80);
}



var canvasArea = { //Canvas Object
    canvas : document.createElement("canvas"),
    
    start : function() { // EXECUTED BY startGame()
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext("2d");
        document.body.insertBefore(this.canvas, document.body.childNodes[0]);
        
        prevDateNow = Date.now(); // For Delta Time
        this.interval = setInterval(updateGameArea, 0);
    },

    clear : function() { // CLEARS WHOLE CANVAS
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    },

    resize : function() {
        console.log("resized");
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        player.speed = 0;
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



// PLAYER CLASS
class Player {
    angle = 0;
    speed = 0;
    jumpValue = 0;
    jumpVelocity = 2;

    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    redraw(dt) { // DT just getting passed for debug text

        const ctx = canvasArea.ctx;
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#ff0000"
        
        ctx.save(); // Saves the state of the canvas
        
        ctx.translate(this.x, this.y);

 
        ctx.ellipse(0, 0, 16, 12, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "#00000040";
        ctx.fill();

        ctx.beginPath();

        ctx.fillStyle = "#ff0000";

        ctx.translate(0, -this.jumpValue);
        ctx.rotate(this.angle * Math.PI/180);
        ctx.fillRect(-16, -16, 32, 32); // Bottom

        ctx.rotate(-this.angle * Math.PI/180); // Straiten out canvas
        ctx.translate(0, -32);
        ctx.rotate(this.angle * Math.PI/180); // Rerotating canvas

        ctx.drawImage(document.getElementById("playerTop"), -16, -16);
        // ctx.fillRect(-16, -16, 32, 32); // Top

        ctx.restore();



        // SIDES OF PLAYER
        ctx.save();
        
        var angleRad = this.angle * (Math.PI/180);
        var loopedAngle = this.angle - (Math.round(this.angle/360) * 360);

        if (-90 < loopedAngle && loopedAngle < 90) { // BOT WALL
            ctx.fillStyle = "#B00C0A";
            ctx.beginPath();
            ctx.moveTo(this.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), this.y - 32 - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), this.y - 32 - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), this.y - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), this.y - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (0 < loopedAngle && loopedAngle < 180) { // RIGHT WALL
            ctx.fillStyle = "#800908";
            ctx.beginPath();
            ctx.moveTo(this.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), this.y - 32 - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), this.y - 32 - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), this.y - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), this.y - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (90 < loopedAngle || loopedAngle < -90) { // TOP WALL
            ctx.fillStyle = "#B00C0A";
            ctx.beginPath();
            ctx.moveTo(this.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), this.y - 32 - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), this.y - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), this.y - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), this.y - 32 - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (-180 < loopedAngle && loopedAngle < 0) { // LEFT WALL
            ctx.fillStyle = "#800908";
            ctx.beginPath();
            ctx.moveTo(this.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), this.y - 32 - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), this.y - 32 - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), this.y - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(this.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), this.y - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }


        /*
        // DEBUG CORNER MARKERS
        ctx.fillStyle = "#0000FF";

        ctx.fillRect( // BOT BOT LEFT
            this.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
            , 
            this.y -this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
            , 5, 5)

        ctx.fillRect( // BOT BOT RIGHT
            this.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
            , 
            this.y - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
            , 5, 5)

        ctx.fillRect( // BOT TOP LEFT
            this.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
            , 
            this.y - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
            , 5, 5)

        ctx.fillRect( // BOT TOP RIGHT
            this.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
            , 
            this.y - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
            , 5, 5)
        */


        ctx.restore();


        // DRAWING DEBUG TEXT
        ctx.font = "15px sans-serif";
        canvasArea.ctx.fillText("angle: " + this.angle, 300, 40);
        canvasArea.ctx.fillText("dragAmount: " + touchHandler.dragAmount, 300, 60);
        canvasArea.ctx.fillText("fps: " + Math.round(100/dt), 300, 80);
        canvasArea.ctx.fillText("jumpValue: " + this.jumpValue, 300, 100);
        canvasArea.ctx.fillText("speed: " + this.speed, 300, 120);


        // STRAFE OPTIMIZER HUD

        if (Math.abs(touchHandler.dragAmount) < (0.9 ** (0.08 * this.speed - 30))) {
            ctx.fillStyle = "#FFFFFF";
        } else {
            ctx.fillStyle = "#FF0000";
        }

        ctx.fillRect(this.x-8, this.y + 16, 8, 4 * Math.abs(touchHandler.dragAmount)); // YOUR STRAFE
        ctx.fillRect(this.x +4, this.y + 16, 8, 4 *  (0.9 ** (0.08 * this.speed - 30))); // THRESHOLD
    
    }

    updatePos(dt) {  // NEEDS TO BE FPS INDEPENDENT
        this.angle += touchHandler.dragAmount * sensitivity; // gain calculation is independent of sensitivity BAD BAD BAD

        if (this.speed >= 0) { // PREVENTS GOING BACKWARDS
            this.speed += this.calculateGain(touchHandler.dragAmount) * dt;
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

    calculateGain(drag) { // SHOULD HAVE A NICE CURVE WHERE LOWER SPEEDS REQUIRE MORE AGGRESSIVE STRAFES
        
        var strafeThreshold = 0.9 ** (0.08 * this.speed - 30);

        if (Math.abs(drag) < strafeThreshold) {
            return Math.abs(drag) * airAcceleration;
        } else {
            return -Math.abs(drag) * airAcceleration;
        }
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

    canvasArea.clear();
    player.redraw(dt);
}


//              :)