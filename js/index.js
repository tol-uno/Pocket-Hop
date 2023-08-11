document.addEventListener("deviceready", onDeviceReady, false);

let sensitivity = 1;
let airAcceleration = 0.1;
let gravity = 0.05;
let prevDateNow;

var midX = 0;
var midY = 0;

function onDeviceReady() { // Called on page load in HMTL
    document.querySelector("body").onresize = function() {canvasArea.resize()};
    document.getElementById("menu").onclick = function() {UserInterface.menuPressed()};
    document.getElementById("restart").onclick = function() {UserInterface.restartPressed()};
    document.getElementById("jump").onclick = function() {UserInterface.jumpPressed()};

    touchHandler = new InputHandler;
    player = null; // Needs to be created by map
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
        console.log("resized :)");

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        midX = canvasArea.canvas.width / 2;
        midY = canvasArea.canvas.height / 2;

    }
}


var UserInterface = {
    
    timer : 0,
    timerStart : Date.now(),

    update : function() {
        this.timer = Date.now() - this.timerStart;
    },

    restartPressed : function() {
        this.timer = 0;
        this.timerStart = Date.now();
        player.restart();
    },

    render : function(dt) {

        // DRAWING DEBUG TEXT
        var textX = canvasArea.canvas.width * 0.17; 
        canvasArea.ctx.font = "15px sans-serif";

        canvasArea.ctx.fillText("dragAmount: " + touchHandler.dragAmount, textX, 60);
        canvasArea.ctx.fillText("fps: " + Math.round(100/dt), textX, 80);
        canvasArea.ctx.fillText("delta time: " + Math.round(dt), textX, 100);
        canvasArea.ctx.fillText("speed: " + player.speed, textX, 120);
        canvasArea.ctx.fillText("angle: " + player.angle, textX, 140);
        canvasArea.ctx.fillText("timer: " + this.timer / 1000, textX, 160);
        canvasArea.ctx.fillText("renderedPlatforms Count: " + map.renderedPlatforms.length, textX, 180);
        canvasArea.ctx.fillText("player x: " + player.x, textX, 200);
    }
}


class Map {
    platforms = [];
    mapData = [];
    renderedPlatforms = [];

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


            var playerStart = jsonData.playerStart; // 3 temporary vars that get combined into mapData and pushed out of async function
            var endZone = jsonData.endZone;
            var platforms = [];

            jsonData.platforms.forEach(platform => { // LOOP THROUGH DATA AND ADD EACH PLATFORM TO AN ARRAY
                platforms.push(platform);
            });

            var mapData = [playerStart, endZone, platforms]; // all the data to be sent out from this async function (platforms, player start, end zone)

            return mapData;
        }

        parsePlatforms().then(mapData => { // WAITS FOR ASYNC FUNCTION 
            this.playerStart = mapData[0];
            this.endZone = mapData[1];
            this.platforms = mapData[2];

            // console.log(mapData)
            player = new Player(mapData[0].x, mapData[0].y, mapData[0].angle);

            canvasArea.start();

        });
    }

    update() { // Figure out which platforms are in view

        this.renderedPlatforms = [];

        this.platforms.forEach(platform => { // Loop through platforms
            if (
                (platform.x + platform.width > player.x - midX) && // left
                (platform.x < player.x + midX) && // right
                (platform.y + platform.height > player.y - midY) && // top
                (platform.y < player.y + midY) // bottom
            ) {
                this.renderedPlatforms.push(platform); // ADD platform to renderedPlatforms
            }

        });
    }

    render() { // Render the platforms that are in view 
        const ctx = canvasArea.ctx;

        ctx.save();
        var border = 7;
        ctx.translate(-player.x + midX, -player.y + midY); // move canvas when drawing platforms then restore. midX is center of canvas width

        this.renderedPlatforms.forEach(platform => { // LOOP THROUGH RENDERABLE PLATFORMS
            
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
    speed = 0;
    jumpValue = 0;
    jumpVelocity = 2;

    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.restartX = x;
        this.restartY = y;
        this.angle = angle;
        this.restartAngle = angle;
    }

    render(dt) { // DT just getting passed for strafe optimizer
        
        const ctx = canvasArea.ctx;
        
        ctx.save(); // Saves the state of the canvas
        
        ctx.translate(midX, midY);

        // DRAWING SHADOW 
        ctx.rotate(this.angle * Math.PI/180); // rotating canvas

        ctx.fillStyle = "#00000040" ;
        var blurValue = player.jumpValue / 16 + 1
        ctx.filter = "blur(" + blurValue + "px)";
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


        // STRAFE OPTIMIZER HUD (PUT THIS IN UserInterface object)
        var strafeThreshold = 0.9 ** (0.08 * this.speed - 30); // ALSO PRESENT IN calculateGain() -- change both

        if (Math.abs(touchHandler.dragAmount) * sensitivity < (strafeThreshold * dt)) { // CHANGING UI COLOR BASED OFF STRAFE QUALITY
            if ((strafeThreshold * dt) - Math.abs(touchHandler.dragAmount) * sensitivity < strafeThreshold * dt * 0.4) {
                ctx.fillStyle = "#00FF00"; // GREEN
            } else {
                ctx.fillStyle = "#FFFFFF"; // WHITE
            }
        } else {
            ctx.fillStyle = "#FF0000"; // RED
        }

        ctx.fillRect(midX-8, midY + 28, 8, 4 * Math.abs(touchHandler.dragAmount) * sensitivity); // YOUR STRAFE
        ctx.fillRect(midX +4, midY + 28, 8, 4 * strafeThreshold * dt); // THE THRESHOLD
    
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
             if (!this.checkCollision()) {
                // this.restart() taken care of by user interface
                UserInterface.restartPressed();
            }
        } else {
            this.jumpValue += this.jumpVelocity * dt;
            this.jumpVelocity -= gravity * dt;
        }
    }

    calculateGain(drag, dt) { // COULD MAYBE PUT THIS INSIDE OF updatePos() to avoid having to pass dt
        
        var strafeThreshold = 0.9 ** (0.08 * this.speed - 30); // ALSO PRESENT IN strafe optimizer code -- change both

        if (Math.abs(drag) * sensitivity < strafeThreshold * dt) {
            return Math.abs(drag) * sensitivity * airAcceleration;
        } else {
            return -Math.abs(drag) * sensitivity * airAcceleration;
        }
    }

    checkCollision() { // called every time player hits the floor
        var collision = 0;
        map.renderedPlatforms.forEach(platform => { // LOOP THROUGH RENDERABLE PLATFORMS
            

            class Rectangle{
                constructor(x,y,width,height,angle){
                    this.x = x;
                    this.y = y;
                    this.width = width;
                    this.height = height;
                    this.angle = angle;
                }
            }

            let rectangleStore = [
                new Rectangle(player.x-16, player.y-16, 32, 32, player.angle),
                new Rectangle(platform.x, platform.y, platform.width, platform.height, 0)
            ]

            canvasArea.ctx.fillRect(rectangleStore[0].x, rectangleStore[0].y, rectangleStore[0].width, rectangleStore[0].height)

            function workOutNewPoints(cx, cy, vx, vy, rotatedAngle){ //From a rotated object
                //cx,cy are the centre coordinates, vx,vy is the point to be measured against the center point
                    //Convert rotated angle into radians
                    rotatedAngle = rotatedAngle * Math.PI / 180;
                    let dx = vx - cx;
                    let dy = vy - cy;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    let originalAngle = Math.atan2(dy,dx);
                    let rotatedX = cx + distance * Math.cos(originalAngle + rotatedAngle);
                    let rotatedY = cy + distance * Math.sin(originalAngle + rotatedAngle);
                
                    return {
                        x: rotatedX,
                        y: rotatedY
                    }
            }
            
            //Get the rotated coordinates for the square
            function getRotatedSquareCoordinates(square){
                let centerX = square.x + (square.width / 2);
                let centerY = square.y + (square.height / 2);
                //Work out the new locations
                let topLeft = workOutNewPoints(centerX, centerY, square.x, square.y, square.angle);
                let topRight = workOutNewPoints(centerX, centerY, square.x + square.width, square.y, square.angle);
                let bottomLeft = workOutNewPoints(centerX, centerY, square.x, square.y + square.height, square.angle);
                let bottomRight = workOutNewPoints(centerX, centerY, square.x + square.width, square.y + square.height, square.angle);
                return{
                    tl: topLeft,
                    tr: topRight,
                    bl: bottomLeft,
                    br: bottomRight
                }
            }
            
            //Functional objects for the Seperate Axis Theorum (SAT)
            //Single vertex
            function xy(x,y){
                this.x = x;
                this.y = y;
            };
            //The polygon that is formed from vertices and edges.
            function polygon(vertices, edges){
                this.vertex = vertices;
                this.edge = edges;
            };

            //The actual Seperate Axis Theorum function
            function sat(polygonA, polygonB){
                var perpendicularLine = null;
                var dot = 0;
                var perpendicularStack = [];
                var amin = null;
                var amax = null;
                var bmin = null;
                var bmax = null;
                //Work out all perpendicular vectors on each edge for polygonA
                for(var i = 0; i < polygonA.edge.length; i++){
                    perpendicularLine = new xy(-polygonA.edge[i].y,
                                                polygonA.edge[i].x);
                    perpendicularStack.push(perpendicularLine);
                }
                //Work out all perpendicular vectors on each edge for polygonB
                for(var i = 0; i < polygonB.edge.length; i++){
                    perpendicularLine = new xy(-polygonB.edge[i].y,
                                                polygonB.edge[i].x);
                    perpendicularStack.push(perpendicularLine);
                }
                //Loop through each perpendicular vector for both polygons
                for(var i = 0; i < perpendicularStack.length; i++){
                    //These dot products will return different values each time
                    amin = null;
                    amax = null;
                    bmin = null;
                    bmax = null;
                    /*Work out all of the dot products for all of the vertices in PolygonA against the perpendicular vector
                    that is currently being looped through*/
                    for(var j = 0; j < polygonA.vertex.length; j++){
                        dot = polygonA.vertex[j].x *
                                perpendicularStack[i].x +
                                polygonA.vertex[j].y *
                                perpendicularStack[i].y;
                        //Then find the dot products with the highest and lowest values from polygonA.
                        if(amax === null || dot > amax){
                            amax = dot;
                        }
                        if(amin === null || dot < amin){
                            amin = dot;
                        }
                    }
                    /*Work out all of the dot products for all of the vertices in PolygonB against the perpendicular vector
                    that is currently being looped through*/
                    for(var j = 0; j < polygonB.vertex.length; j++){
                        dot = polygonB.vertex[j].x *
                                perpendicularStack[i].x +
                                polygonB.vertex[j].y *
                                perpendicularStack[i].y;
                        //Then find the dot products with the highest and lowest values from polygonB.
                        if(bmax === null || dot > bmax){
                            bmax = dot;
                        }
                        if(bmin === null || dot < bmin){
                            bmin = dot;
                        }
                    }
                    //If there is no gap between the dot products projection then we will continue onto evaluating the next perpendicular edge.
                    if((amin < bmax && amin > bmin) ||
                        (bmin < amax && bmin > amin)){
                        continue;
                    }
                    //Otherwise, we know that there is no collision for definite.
                    else {
                        return false;
                    }
                }
                /*If we have gotten this far. Where we have looped through all of the perpendicular edges and not a single one of there projections had
                a gap in them. Then we know that the 2 polygons are colliding for definite then.*/
                return true;
            }

            //Detect for a collision between the 2 rectangles
            function detectRectangleCollision(index){
                // let thisRect = rectangleStore[index];
                // let otherRect = index === 0 ? rectangleStore[1] : rectangleStore[0];

                let thisRect = rectangleStore[0];
                let otherRect = rectangleStore[1];

                //Get rotated coordinates for both rectangles
                let tRR = getRotatedSquareCoordinates(thisRect);
                let oRR = getRotatedSquareCoordinates(otherRect);
                //Vertices & Edges are listed in clockwise order. Starting from the top right
                let thisTankVertices = [
                    new xy(tRR.tr.x, tRR.tr.y),
                    new xy(tRR.br.x, tRR.br.y),
                    new xy(tRR.bl.x, tRR.bl.y),
                    new xy(tRR.tl.x, tRR.tl.y),
                ];
                let thisTankEdges = [
                    new xy(tRR.br.x - tRR.tr.x, tRR.br.y - tRR.tr.y),
                    new xy(tRR.bl.x - tRR.br.x, tRR.bl.y - tRR.br.y),
                    new xy(tRR.tl.x - tRR.bl.x, tRR.tl.y - tRR.bl.y),
                    new xy(tRR.tr.x - tRR.tl.x, tRR.tr.y - tRR.tl.y)
                ];
                let otherTankVertices = [
                    new xy(oRR.tr.x, oRR.tr.y),
                    new xy(oRR.br.x, oRR.br.y),
                    new xy(oRR.bl.x, oRR.bl.y),
                    new xy(oRR.tl.x, oRR.tl.y),
                ];
                let otherTankEdges = [
                    new xy(oRR.br.x - oRR.tr.x, oRR.br.y - oRR.tr.y),
                    new xy(oRR.bl.x - oRR.br.x, oRR.bl.y - oRR.br.y),
                    new xy(oRR.tl.x - oRR.bl.x, oRR.tl.y - oRR.bl.y),
                    new xy(oRR.tr.x - oRR.tl.x, oRR.tr.y - oRR.tl.y)
                ];
                let thisRectPolygon = new polygon(thisTankVertices, thisTankEdges);
                let otherRectPolygon = new polygon(otherTankVertices, otherTankEdges);

                if(sat(thisRectPolygon, otherRectPolygon)){
                    collision += 1;
                    
                }else{
                    
                    //Because we are working with vertices and edges. This algorithm does not cover the normal un-rotated rectangle
                    //algorithm which just deals with sides
                    if(thisRect.angle === 0 && otherRect.angle === 0){
                        if(!(
                            thisRect.x>otherRect.x+otherRect.width || 
                            thisRect.x+thisRect.width<otherRect.x || 
                            thisRect.y>otherRect.y+otherRect.height || 
                            thisRect.y+thisRect.height<otherRect.y
                        )){
                            collision += 1;
                        }
                    }
                }
            }

            detectRectangleCollision(platform);
        
        });
        if (collision > 0) {return true} else {return false}
    }

    restart() { // Called when player hits water
        this.x = this.restartX;
        this.y = this.restartY;
        this.angle = this.restartAngle;
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
    
    // UPDATING OBJECTS
    touchHandler.update(); 
    map.update();
    player.updatePos(dt);
    UserInterface.update();

    // RENDERING OBJECTS
    canvasArea.clear();
    map.render();
    player.render(dt);
    UserInterface.render(dt);

}


//      :)