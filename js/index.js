document.addEventListener("deviceready", onDeviceReady, false);

let sensitivity = 1;
let airAcceleration = 0.1;
let gravity = 0.05;
let prevDateNow;

var midX = 0;
var midY = 0;

function onDeviceReady() { // Called on page load in HMTL
    document.querySelector("body").onresize = function() {canvasArea.resize()};

    touchHandler = new InputHandler;
    UserInterface.start();
    AudioHandler.setVolumes();

    player = null; // Needs to be created by map
    canvasArea.start();
}


var canvasArea = { //Canvas Object
    canvas : document.createElement("canvas"),
    
    start : function() { // called in deviceReady
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

    },

     
    convexHull: function (points) {

        function cross(a, b, o) {
            return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
         }

        points.sort(function(a, b) {
           return a[0] == b[0] ? a[1] - b[1] : a[0] - b[0];
        });
     
        var lower = [];
        for (var i = 0; i < points.length; i++) {
           while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
              lower.pop();
           }
           lower.push(points[i]);
        }
     
        var upper = [];
        for (var i = points.length - 1; i >= 0; i--) {
           while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
              upper.pop();
           }
           upper.push(points[i]);
        }
     
        upper.pop();
        lower.pop();
        return lower.concat(upper);
    }
}


var UserInterface = {
    
    gamestate : 1,
    // 1: main menu
    // 2: level select
    // 3: settings
    // 4: store
    // 5: loading map page
    // 6: in level

    debugText : false,
    strafeHUD : false,
    volume : 0.1,
    
    timer : 0,
    timerStart : Date.now(), // dont need to pull date here
    levelState : 1, // 1 = pre-start, 2 = playing level, 3 = in endzone

    start : function() {

        // CREATING THE BUTTONS
        btn_levelSelect = new Button(200, 150, 200, 100, "PLAY", function() { 
            UserInterface.gamestate = 2;
            UserInterface.renderedButtons = [btn_level_original, btn_level_noob, btn_level_hellscape]
        })

        btn_settings = new Button(420, 150, 200, 100, "Clear Records", function() {
            window.localStorage.removeItem("record_original")
            window.localStorage.removeItem("record_noob")
            console.log("records cleared")
        })

        btn_level_original = new Button(100, 50, 100, 80, "Original", function() { 
            map = new Map("original");
            UserInterface.gamestate = 5;
            UserInterface.renderedButtons = [btn_mainMenu];

        })

        btn_level_noob = new Button(220, 50, 100, 80, "Noob", function() { 
            map = new Map("noob");
            UserInterface.gamestate = 5;
            UserInterface.renderedButtons = [btn_mainMenu];
        })

        btn_level_hellscape = new Button(340, 50, 100, 80, "Hellscape", function() { 
            map = new Map("hellscape");
            UserInterface.gamestate = 5;
            UserInterface.renderedButtons = [btn_mainMenu];
        })

        btn_mainMenu = new Button(30, 40, 80, 60, "menu", function() { 
            UserInterface.gamestate = 1;
            UserInterface.timer = 0;
            UserInterface.levelState = 1;
            player = null;
            map = null;
            UserInterface.renderedButtons = [btn_levelSelect, btn_settings];
        })

        btn_restart = new Button(30, 200, 80, 60, "restart", function() { 
            UserInterface.timer = 0;
            UserInterface.levelState = 1;
            player.restart();
        })

        btn_jump = new Button(30, 300, 80, 60, "jump", function() { 
            if (UserInterface.levelState == 1) {
                UserInterface.timerStart = Date.now();
                UserInterface.levelState = 2;
                player.startLevel();
            }
        })

        this.renderedButtons = [btn_levelSelect, btn_settings]; 

    },

    update : function() {
        if (this.levelState == 2) {
            this.timer = Date.now() - this.timerStart;
        }
    },

    mapLoaded : function() { // called by map.start()
        UserInterface.gamestate = 6;
        UserInterface.renderedButtons = [btn_mainMenu, btn_restart, btn_jump];
    },

    handleRecord : function() {
        if (map.record) {
            if (UserInterface.timer < map.record) {
                window.localStorage.setItem("record_" + map.name, UserInterface.timer)
                map.record = UserInterface.timer
            }
        } else { // IF THERE'S NO RECORD
            window.localStorage.setItem("record_" + map.name, UserInterface.timer)
            map.record = UserInterface.timer
        }
    },

    touchReleased : function(x,y) { // TRIGGERED BY InputHandler

        this.renderedButtons.forEach(button => {
            if ( // if x and y touch is within button
                x >= button.x && x <= button.x + button.width &&
                y >= button.y && y <= button.y + button.height
            ) {
                button.pressed();
            }
        });
    },

    render : function(dt) {

        this.renderedButtons.forEach(button => { // LOOP RENDERED BUTTONS AND RUN THEIR .render()
            button.render();
        });

        if (this.gamestate == 1) { // Main Menu
            // not doing anything
        }

        if (this.gamestate == 6) { // In Level

            if (this.debugText) { // DRAWING DEBUG TEXT
                var textX = canvasArea.canvas.width * 0.17; 
                canvasArea.ctx.font = "15px sans-serif";
                canvasArea.ctx.fillStyle = "#FFFFFF"; // WHITE
    
                canvasArea.ctx.fillText("dragAmount: " + touchHandler.dragAmount, textX, 60);
                canvasArea.ctx.fillText("fps: " + Math.round(100/dt), textX, 80);
                canvasArea.ctx.fillText("delta time: " + Math.round(dt), textX, 100);
                canvasArea.ctx.fillText("speed: " + player.speed, textX, 120);
                canvasArea.ctx.fillText("angle: " + player.angle, textX, 140);
                canvasArea.ctx.fillText("timer: " + this.timer / 1000, textX, 160);
                canvasArea.ctx.fillText("renderedPlatforms Count: " + map.renderedPlatforms.length, textX, 180);
                canvasArea.ctx.fillText("touch x: " + touchHandler.touchX, textX, 200);
                canvasArea.ctx.fillText("touch y: " + touchHandler.touchY, textX, 220);
                canvasArea.ctx.fillText("currentDragID: " + touchHandler.currentDragID, textX, 240);
                canvasArea.ctx.fillText("dragging: " + touchHandler.dragging, textX, 260);
                canvasArea.ctx.fillText("endZoneIsRendered: " + map.endZoneIsRendered, textX, 280);
                
            }
    
    
            if (this.strafeHUD) { // STRAFE OPTIMIZER HUD
                var strafeThreshold = 0.9 ** (0.08 * player.speed - 30); // ALSO PRESENT IN calculateGain() -- change both
    
                if (Math.abs(touchHandler.dragAmount) * sensitivity < (strafeThreshold * dt)) { // CHANGING UI COLOR BASED OFF STRAFE QUALITY
                    if ((strafeThreshold * dt) - Math.abs(touchHandler.dragAmount) * sensitivity < strafeThreshold * dt * 0.4) {
                        canvasArea.ctx.fillStyle = "#00FF00"; // GREEN
                    } else {
                        canvasArea.ctx.fillStyle = "#FFFFFF"; // WHITE
                    }
                } else {
                    canvasArea.ctx.fillStyle = "#FF0000"; // RED
                }
    
                canvasArea.ctx.fillRect(midX-8, midY + 28, 8, 4 * Math.abs(touchHandler.dragAmount) * sensitivity); // YOUR STRAFE
                canvasArea.ctx.fillRect(midX +4, midY + 28, 8, 4 * strafeThreshold * dt); // THE THRESHOLD
            }

            if (player.endSlow == 0) { // level name, your time, best time, strafe efficiency

                // END SCREEN BOX
                canvasArea.ctx.strokeStyle = "#BBBBBB";
                canvasArea.ctx.lineWidth = 6;
                canvasArea.ctx.fillStyle = "#FFFFFF";
                canvasArea.ctx.beginPath();

                // canvasArea.ctx.roundRect(midX - 150, midY - 100, 300, 200, 10); // DOESNT WORK ON IOS
                // https://stackoverflow.com/questions/1255512/how-to-draw-a-rounded-rectangle-using-html-canvas
                // ^ alternative way to do rounded rectangles

                canvasArea.ctx.rect(midX - 150, midY - 100, 300, 200)

                canvasArea.ctx.save();
                canvasArea.ctx.shadowColor = "rgba(0, 0, 0, 0.5)"; 
                canvasArea.ctx.shadowBlur = 20;
                canvasArea.ctx.fill();
                canvasArea.ctx.restore();
                
                canvasArea.ctx.stroke();

                // END SCREEN TEXT
                canvasArea.ctx.font = "25px sans-serif";

                canvasArea.ctx.fillStyle = "#555555"; // GRAY

                canvasArea.ctx.fillText("Level: " + map.name, midX - 120, midY - 50);
                canvasArea.ctx.fillText("Time: " + UserInterface.timer / 1000, midX - 120, midY - 0);
                canvasArea.ctx.fillText("Record: " + map.record / 1000, midX - 120, midY + 30);

                if (UserInterface.timer == map.record) {canvasArea.ctx.fillText("New Record!", midX - 120, midY + 65)}

            }
        }
    }
}


var AudioHandler = {
    successAudio : document.getElementById("successAudio"),
    splashAudio : document.getElementById("splashAudio"),
    jumpAudio : document.getElementById("jumpAudio"),
    setVolumes : function() {
        this.successAudio.volume = 0.5 * UserInterface.volume;
        this.splashAudio.volume = 0.4 * UserInterface.volume;
        this.jumpAudio.volume = 0.5 * UserInterface.volume;
    },
    success : function() {this.successAudio.play()},
    splash : function() {this.splashAudio.play()},
    jump : function() {this.jumpAudio.play()},
}


class Button {
    constructor(x, y, width, height, image, func) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = image
        this.func = func;
    }

    render() {

        canvasArea.ctx.strokeStyle = "#BBBBBB";
        canvasArea.ctx.lineWidth = 6;
        canvasArea.ctx.fillStyle = "#FFFFFF";
        canvasArea.ctx.beginPath();

        canvasArea.ctx.rect(this.x, this.y, this.width, this.height);

        canvasArea.ctx.save();
        canvasArea.ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        canvasArea.ctx.shadowBlur = 10;
        canvasArea.ctx.fill();
        canvasArea.ctx.restore();

        canvasArea.ctx.stroke();


        // this should be drawing an image not text. text is placholder
        canvasArea.ctx.font = "15px sans-serif";
        canvasArea.ctx.fillStyle = "black";
        canvasArea.ctx.fillText(this.image, this.x + 10, this.y + this.height / 2)
    }

    pressed() {
        this.func();
    }
}


class Map {
    platforms = [];
    mapData = [];
    renderedPlatforms = [];
    endZoneIsRendered = false;
    name;
    record;
    upperShadowClip = new Path2D();
    endZone;


    calculateShadedColor(sideNormalVector, color) {

        var darkness = 180 - (sideNormalVector.angleDifference(map.style.lightAngleVector) * (180/Math.PI));
    
        // MAP TO RANGE: https://stackoverflow.com/questions/10756313/javascript-jquery-map-a-range-of-numbers-to-another-range-of-numbers
        // (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
        darkness = (darkness) * (this.style.shadowContrastDark - this.style.shadowContrastLight) / 180 + this.style.shadowContrastLight;

        return this.RGB_Linear_Shade(darkness, color)
    }

    // USED TO BRIGHTEN AND DARKEN COLORS. p = percent to brighten/darken. c = color in rgba
    // https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
    RGB_Linear_Shade(p,c) {
        var i=parseInt,r=Math.round,[a,b,c,d]=c.split(","),P=p<0,t=P?0:255*p,P=P?1+p:1-p;
        return"rgb"+(d?"a(":"(")+r(i(a[3]=="a"?a.slice(5):a.slice(4))*P+t)+","+r(i(b)*P+t)+","+r(i(c)*P+t)+(d?","+d:")");
    }

    constructor(name) {
        this.name = name;

        // PARSE JSON DATA. FUNCTION USED BY parsePlatforms()
        async function getJsonData() { // Taken from: https://www.javascripttutorial.net/javascript-fetch-api/
            // let mapURL = "https://cdn.jsdelivr.net/gh/tol-uno/Pocket-Hop@main/assets/maps/" + name + ".json"
            // OLD LOCAL STORAGE
            let mapURL = "assets/maps/" + name + ".json";
            // could eventually be "pockethop.com/maps/original.json"

            try {
                let response = await fetch(mapURL);
                return await response.json();
            } catch (error) {
                console.log(error);
            }
        }


        // LOOP THROUGH JSON DATA AND ADD NEW PLATFORM OBJECTS
        async function parsePlatforms() {
            let jsonData = await getJsonData(); // SEE ABOVE ^^


            var playerStart = jsonData.playerStart; // 3 temporary vars that get combined into mapData and pushed out of async function
            var platforms = [];
            var style = jsonData.style;


            jsonData.platforms.forEach(platform => { // LOOP THROUGH DATA AND ADD EACH PLATFORM TO AN ARRAY
                platforms.push(platform);
            });

            var mapData = [playerStart, platforms, style]; // all the data to be sent out from this async function (platforms, player start, end zone)

            return mapData;
        }


        parsePlatforms().then(mapData => { // WAITS FOR ASYNC FUNCTION. Big function that handles setting up the map and pre rendering calculations
            this.playerStart = mapData[0];
            this.platforms = mapData[1];
            this.style = mapData[2];


            // Calculate lighting for each platform and the endzone
            this.style.lightAngleVector =  new Vector(Math.cos(this.style.lightAngle * (Math.PI/180)), Math.sin(this.style.lightAngle * (Math.PI/180)))
            var shadowX = this.style.lightAngleVector.x * this.style.shadowLength;
            var shadowY = this.style.lightAngleVector.y * this.style.shadowLength;

            var platformIndex = 1 // kinda debug for map making
            this.platforms.forEach(platform => { // CALCULATE PLATFORMS COLORS and SHADOW POLYGON

                var colorToUse = this.style.platformSideColor;
                if(platform.endzone) {
                    colorToUse = this.style.endZoneSideColor;
                    this.endZone = platform;
                }

                platform.index = platformIndex; // asigns an index to each platform for debugging
                platformIndex ++;

                // COLORS
                platform.side1Vec = new Vector(-1,0).rotate(platform.angle) // !! DONT need to be properties of platform. only made properties for debug
                platform.side2Vec = new Vector(0,1).rotate(platform.angle)
                platform.side3Vec = new Vector(1,0).rotate(platform.angle)

                platform.sideColor1 = this.calculateShadedColor(platform.side1Vec, colorToUse) // COULD OPTIMIZE. Some sides arent visible at certain platfotm rotations. Those sides dont need to be calculated
                platform.sideColor2 = this.calculateShadedColor(platform.side2Vec, colorToUse)
                platform.sideColor3 = this.calculateShadedColor(platform.side3Vec, colorToUse)

                // SHADOW POLYGON
                var angleRad = platform.angle * (Math.PI/180);
    
                platform.shadowPoints = [ // ALL THE POSSIBLE POINTS TO INPUT IN CONVEX HULL FUNCTION
                
                    // bot left corner
                    [
                    -((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)),
                    -((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight
                    ],

                    // bot right corner
                    [
                    ((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)),
                    ((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight
                    ],

                    // top right corner
                    [
                    ((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)),
                    ((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight
                    ],

                    // bot left corner
                    [
                    -((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)),
                    -((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight
                    ],

                    // bot left SHADOW
                    [
                    -((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)) + shadowX,
                    -((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight + shadowY
                    ],

                    // bot right SHADOW
                    [
                    ((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)) + shadowX,
                    ((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight + shadowY
                    ],

                    // top right SHADOW
                    [
                    ((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)) + shadowX,
                    ((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight + shadowY
                    ],

                    // bot left SHADOW
                    [
                    -((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)) + shadowX,
                    -((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight + shadowY
                    ],

                ]; // end of shadowPoints array

                platform.shadowPoints = canvasArea.convexHull(platform.shadowPoints)


                // SHADOW CLIP FOR UPPER PLAYER SHADOW
                this.upperShadowClip.moveTo( // bot left
                    platform.x + platform.width/2 -((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)),
                    platform.y + platform.height/2 -((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad))
                    )
                this.upperShadowClip.lineTo( // bot right
                    platform.x + platform.width/2 + ((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)),
                    platform.y + platform.height/2 + ((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad))
                )

                this.upperShadowClip.lineTo( // top right
                    platform.x + platform.width/2 + ((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)),
                    platform.y + platform.height/2 + ((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad))
                )

                this.upperShadowClip.lineTo( // top left
                    platform.x + platform.width/2 -((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)),
                    platform.y + platform.height/2 -((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad))
                )

                this.upperShadowClip.closePath()

            });

            canvasArea.canvas.style.backgroundColor = this.style.backgroundColor;
            document.body.style.backgroundColor = this.style.backgroundColor;
            player = new Player(this.playerStart.x, this.playerStart.y, this.playerStart.angle);

            // Get map record from local storage
            this.record = window.localStorage.getItem("record_" + map.name)

            UserInterface.mapLoaded(); // moves onto gamestate 6
        });
    }

    update() { // Figure out which platforms are in view. This is probably were I should check endZoneIsRendered but it's done in render(). Saves an if(){} i guess...

        this.renderedPlatforms = [];

        this.platforms.forEach(platform => { // Loop through platforms
            var hypotenuse = Math.sqrt(platform.width * platform.width + platform.height * platform.height)/2

            if (
                (platform.x + platform.width/2 + hypotenuse + this.style.shadowLength > player.x - midX) && // coming into frame on left side
                (platform.x + platform.width/2 - hypotenuse - this.style.shadowLength < player.x + midX) && // right side
                (platform.y + platform.height/2 + hypotenuse + this.style.shadowLength + this.style.platformHeight > player.y - midY) && // top side
                (platform.y + platform.height/2 - hypotenuse - this.style.shadowLength < player.y + midY) // bottom side
            ) {
                this.renderedPlatforms.push(platform); // ADD platform to renderedPlatforms
            }
        });
    }

    render() { // Render the platforms that are in view (and player lower shadow)
    
        this.endZoneIsRendered = false; // resets every frame. if the endzone is being rendered it activates it. otherwise it stays false

        const ctx = canvasArea.ctx;

        ctx.save();
        ctx.translate(-player.x + midX, -player.y + midY); // move canvas when drawing platforms then restore. midX is center of canvas width
    


        // DRAWING LOWER PLAYER SHADOW
        ctx.save(); // Saves the state of the canvas for drawing player shadow. Weird to draw it here but whatever. Could also put this above the first translate ^^
        ctx.translate(player.x , player.y + this.style.platformHeight)
        ctx.rotate(player.angle * Math.PI/180); // rotating canvas

        ctx.fillStyle = this.style.shadowColor;
        // ctx.fillStyle = "green";
        // var blurValue = player.jumpValue / 16 + 1
        // ctx.filter = "blur(" + blurValue + "px)";
        ctx.fillRect(-15, -15, 30, 30)
        // ctx.filter = "none";
        ctx.restore(); // restore back to top corner of map for drawing the platforms


        this.renderedPlatforms.forEach(platform => { // LOOP THROUGHT TO DRAW SHADOWS FIRST. This prevents shadows getting on top of other platforms

            ctx.save();
            ctx.translate(platform.x + platform.width/2, platform.y + platform.height/2);

            ctx.fillStyle = this.style.shadowColor;

            // ctx.filter = "blur(2px)"; // start blur
            ctx.beginPath();
            
            ctx.moveTo(platform.shadowPoints[0][0], platform.shadowPoints[0][1]);
            for (let i = platform.shadowPoints.length - 1; i > 0; i --) {
                ctx.lineTo(platform.shadowPoints[i][0], platform.shadowPoints[i][1]);
            }

            ctx.closePath();
            ctx.fill();

            // ctx.filter = "none"; // end blur

            ctx.restore();
        })



        this.renderedPlatforms.forEach(platform => { // LOOP THROUGH RENDERABLE PLATFORMS (DRAW ACTUAL PLATFORMS)

            // DRAW PLATFORM TOP
            ctx.save(); // ROTATING 
            ctx.translate(platform.x + platform.width/2, platform.y + platform.height/2);
            ctx.rotate(platform.angle * Math.PI/180);

            // Change to endzone color if needed. Also where its determined if endzone is being rendered
            if (platform.endzone) {
                ctx.fillStyle = this.style.endZoneTopColor;
                this.endZoneIsRendered = true;
            } else {
                ctx.fillStyle = this.style.platformTopColor;
            }
            
            ctx.fillRect(-platform.width/2, -platform.height/2, platform.width, platform.height);

            ctx.restore();


            // SIDES OF PLATFORMS
            ctx.save();
            ctx.translate(platform.x + platform.width/2, platform.y + platform.height/2);

            var angleRad = platform.angle * (Math.PI/180);
            
            // platform angles should only be max of 90 and -90 in mapData
            // calculating shading works with any angle but sides arent draw because drawing "if statements" are hardcoded to 90 degrees


            if (-90 < platform.angle && platform.angle < 90) { // ALMOST ALWAYS RENDER BOTTOM SIDE. side2
                ctx.fillStyle = platform.sideColor2; // sideColor2

                ctx.beginPath();
                ctx.moveTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad))); // bot right
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad))); // bot left
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
                ctx.lineTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
                ctx.closePath();
                ctx.fill();
            }


            if (0 < platform.angle && platform.angle <= 90) { // side3

                ctx.fillStyle = platform.sideColor3; // sideColor3
                ctx.beginPath();
                ctx.moveTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad))); // bot right
                ctx.lineTo(platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad))); // top right
                ctx.lineTo(platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
                ctx.lineTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
                ctx.closePath();
                ctx.fill();
            }

            if (-90 <= platform.angle && platform.angle < 0) { // side1

                ctx.fillStyle = platform.sideColor1; // sideColor1  
                ctx.beginPath();
                ctx.moveTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad))); // bot left
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad))); // top left
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
                ctx.closePath();
                ctx.fill();
            }

            // PLAFORM RENDERING DEBUG TEXT
            // ctx.fillStyle = "#FFFFFF";
            // ctx.fillText("index: " + platform.index, 0, -40);
            // ctx.fillText("angle: " + platform.angle, 0,-20);
            // ctx.fillText("side1Vec: " + platform.side1Vec.x + ", " + platform.side1Vec.y, 0, 0);
            // ctx.fillText("side2Vec: " + platform.side2Vec.x + ", " + platform.side2Vec.y, 0, 20);
            // ctx.fillText("side3Vec: " + platform.side3Vec.x + ", " + platform.side3Vec.y, 0, 40);
            
            // ctx.fillText("side1: " + platform.sideColor1, 0, 60);
            // ctx.fillText("side2: " + platform.sideColor2, 0, 80);
            // ctx.fillText("side3: " + platform.sideColor3, 0, 100);

            ctx.restore();
        });

        ctx.restore(); // RESTORING VIEW FOLLOWING PLAYER I THINK
    }
}


class InputHandler {
    dragAmount = 0;
    previousX = 0;
    touchX = 0;
    touchY = 0;
    dragging = false;
    touchIDs = []; // first elements are the oldest touches
    currentDragID = null;


    getReferencedTouchID(touchEventsID) { // figures out which object within touchIDs[] the current event is referencing
        return this.touchIDs.filter(function(touch) { // filter touchIDs to find touch that has ID that matches the event's ID
            return touch.id == touchEventsID
        })[0] // result is a filtered array but should only give one match. hense -> [0]
    }


    constructor(){
        window.addEventListener("touchstart", e => {

            for (let i = 0; i < e.changedTouches.length; i++){ // for loop needed incase multiple touches are sent in the same frame

                if (this.dragging == false) { // if this should be the new dragging touch
                    this.currentDragID = e.changedTouches[i].identifier;
                    this.dragging = true;

                    this.touchX = e.changedTouches[i].pageX;
                    this.touchY = e.changedTouches[i].pageY;
                    this.previousX = e.changedTouches[i].pageX;

                }
            }
        });


        window.addEventListener("touchmove", e => {
            for (let i = 0; i < e.changedTouches.length; i++){ // for loop needed incase multiple touches are sent in the same frame

                if (e.changedTouches[i].identifier == this.currentDragID) { // if this touch is the dragging touch
                    this.touchX = e.changedTouches[i].pageX;
                    this.touchY = e.changedTouches[i].pageY;
                }

                if (this.dragging == false) { // if main drag is released but theres another to jump to
                    this.currentDragID = e.changedTouches[i].identifier;
                }
            }

        });


        window.addEventListener("touchcancel", e => { // Fixes tripple tap bugs by reseting everything
            this.currentDragID = null;
            this.dragging = false;
        });

        window.addEventListener("touchend", e => {

            for (let i = 0; i < e.changedTouches.length; i++){ // for loop needed incase multiple touches are sent in the same frame

                if (this.dragging && e.changedTouches[i].identifier == this.currentDragID) { // might not need to check if dragging is true here
                    
                    if (e.touches.length == 0) {

                        this.currentDragID = null;
                        this.dragAmount = 0;
                        this.touchX = 0;
                        this.touchY = 0;
                        this.previousX = 0;
                        this.dragging = false;

                    } else {
                        this.currentDragID = e.touches[0].identifier
                        this.touchX = e.touches[0].pageX;
                        this.touchY = e.touches[0].pageY;
                        this.previousX = e.touches[0].pageX;
                    }
                }

                UserInterface.touchReleased(e.changedTouches[i].pageX, e.changedTouches[i].pageY); // sends touchRealease for every release
            
            }

            // if (e.touches.length == 0) {this.currentDragID = null;} // Not Needed?

        });
    }

    update() {
        if (this.dragging == true) {
            this.dragAmount = this.touchX - this.previousX;
            this.previousX = this.touchX;
        }

        // FOR TESTING
        // this.dragAmount = 5;
    }

}


class Player {
    speed = 0;
    jumpValue = 0;
    jumpVelocity = 2;
    endSlow = 1;

    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.restartX = x;
        this.restartY = y;
        this.angle = angle;
        this.restartAngle = angle;
    }

    render() {
        
        const ctx = canvasArea.ctx;
        
        ctx.save(); // Saves the state of the canvas
        
        ctx.translate(midX, midY);


        // LOWER SHADOW IS DRAWN BY MAP
        // DRAWING UPPER SHADOW HERE \/
        ctx.save()
        
        ctx.translate(-player.x, -player.y)
        ctx.clip(map.upperShadowClip);
        ctx.translate(player.x , player.y);
    
        ctx.rotate(this.angle * Math.PI/180); // rotating canvas

        ctx.fillStyle = map.style.shadowColor;
        // var blurValue = player.jumpValue / 16 + 1
        // ctx.filter = "blur(" + blurValue + "px)";
        ctx.fillRect(-15, -15, 30, 30)
        // ctx.filter = "none";

        ctx.restore() // clears upperShadowClip

        // DRAWING PLAYER TOP
        ctx.translate(0, -this.jumpValue - 32); 
        ctx.rotate(this.angle * Math.PI/180); // rotating canvas
        ctx.fillStyle = map.style.playerColor;
        ctx.fillRect(-16,-16,32,32)
        // ctx.drawImage(document.getElementById("playerTop"), -16, -16);

        ctx.restore();

        // SIDES OF PLAYER
        ctx.save();
        
        var angleRad = this.angle * (Math.PI/180);
        var loopedAngle = this.angle - (Math.round(this.angle/360) * 360);


        // GETTING CORNERS OF ROTATED RECTANGLE
        // https://stackoverflow.com/questions/41898990/find-corners-of-a-rotated-rectangle-given-its-center-point-and-rotation

        if (-90 < loopedAngle && loopedAngle < 90) { // BOT WALL

            var sideVector = new Vector(0,1).rotate(this.angle)
            ctx.fillStyle = map.calculateShadedColor(sideVector, map.style.playerColor)

            ctx.beginPath();
            ctx.moveTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (0 < loopedAngle && loopedAngle < 180) { // RIGHT WALL

            var sideVector = new Vector(1,0).rotate(this.angle)
            ctx.fillStyle = map.calculateShadedColor(sideVector, map.style.playerColor)

            ctx.beginPath();
            ctx.moveTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (90 < loopedAngle || loopedAngle < -90) { // TOP WALL
            
            var sideVector = new Vector(0,-1).rotate(this.angle)
            ctx.fillStyle = map.calculateShadedColor(sideVector, map.style.playerColor)
            
            ctx.beginPath();
            ctx.moveTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        if (-180 < loopedAngle && loopedAngle < 0) { // LEFT WALL

            var sideVector = new Vector(-1,0).rotate(this.angle)
            ctx.fillStyle = map.calculateShadedColor(sideVector, map.style.playerColor)

            ctx.beginPath();
            ctx.moveTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    
    }

    startLevel() {
        this.speed = 85;
    }

    updatePos(dt) {  // NEEDS TO BE FPS INDEPENDENT
        if (this.speed > 100 && this.speed < 102) {console.log(UserInterface.timer/1000)}
        
        if (UserInterface.levelState == 1 || UserInterface.levelState == 2) {
            this.angle += touchHandler.dragAmount * sensitivity;
        }

        if (UserInterface.levelState == 2) {
            if (this.speed >= 0) { // PREVENTS GOING BACKWARDS
                this.speed += this.calculateGain(touchHandler.dragAmount, dt);
            } else {this.speed = 0}
        
            this.x += Math.cos(this.angle * (Math.PI / 180)) * this.speed/50 * dt; // MOVE FORWARD AT ANGLE BASED ON SPEED
            this.y += Math.sin(this.angle * (Math.PI / 180)) * this.speed/50 * dt;
        
            if (this.jumpValue < 0) { // JUMPING
                this.jumpValue = 0;
                this.jumpVelocity = 2;
                AudioHandler.jump();
                if (!this.checkCollision(map.renderedPlatforms)) {
                    AudioHandler.splash();
                    btn_restart.pressed();
                }
            } else {
                this.jumpValue += this.jumpVelocity * dt;
                this.jumpVelocity -= gravity * dt;
            }

            if (map.endZoneIsRendered) { // CHECK IF COLLIDING WITH ENDZONE
                if (this.checkCollision([map.endZone])) {
                    AudioHandler.success();
                    UserInterface.handleRecord();
                    UserInterface.levelState = 3;
                }
            }
        }

        if (UserInterface.levelState == 3) { // SLOW DOWN MOVEMENT AFTER HITTING END ZONE
            if (this.endSlow > 0.02) {this.endSlow = (this.endSlow * 0.95);} else {this.endSlow = 0} // THIS NEEDS TO BE FPS INDEPENDENT

            this.x += Math.cos(this.angle * (Math.PI / 180)) * this.speed/50 * dt * this.endSlow; // MOVE FORWARD AT ANGLE BASED ON SPEED
            this.y += Math.sin(this.angle * (Math.PI / 180)) * this.speed/50 * dt * this.endSlow;
        
            if (this.jumpValue < 0) { // JUMPING
                this.jumpValue = 0;
                this.jumpVelocity = 2;
            } else {
                this.jumpValue += this.jumpVelocity * dt * this.endSlow;
                this.jumpVelocity -= gravity * dt * this.endSlow;
            }
        }
    }

    calculateGain(drag, dt) { // COULD MAYBE PUT THIS INSIDE OF updatePos() to avoid having to pass dt
        
        var strafeThreshold = 0.9 ** (0.08 * this.speed - 30); // ALSO PRESENT IN strafe optimizer code -- change both -- maybe just add as var somwhere

        if (Math.abs(drag) * sensitivity < strafeThreshold * dt) {
            // console.log(Math.abs(drag) * sensitivity * airAcceleration)
            return Math.abs(drag) * sensitivity * airAcceleration;
        } else {
            return -Math.abs(drag) * sensitivity * airAcceleration;
        }
    }

    checkCollision(arrayOfPlatformsToCheck) { // called every time player hits the floor ALSO used to check endzone collision
        var collision = 0;
        arrayOfPlatformsToCheck.forEach(platform => { // LOOP THROUGH PLATFORMS

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
                new Rectangle(platform.x, platform.y, platform.width, platform.height, platform.angle)
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
        this.endSlow = 1;
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

    divide = function(scalar) {
        return new Vector(this.x / scalar, this.y / scalar);
    }

    multiply = function(scalar) {
        this.x *= scalar;
        this.y *= scalar;
    }

    dotProduct = function(otherVec) { // ONLY FOR 2D Vectors
        return (this.x * otherVec.x) + (this.y * otherVec.y)
    }

    magnitude = function() {
        return Math.sqrt((this.x ** 2) + (this.y ** 2))
    }

    rotate = function(ang) // angle in degrees 
    {
        ang = ang * (Math.PI/180);
        var cos = Math.cos(ang);
        var sin = Math.sin(ang);
        return new Vector(Math.round(10000*(this.x * cos - this.y * sin))/10000, Math.round(10000*(this.x * sin + this.y * cos))/10000);
    }

    angleDifference = function(otherVec) { // returns degrees i guess idk
        return Math.acos((this.dotProduct(otherVec)) / (this.magnitude() * otherVec.magnitude()))
    }

    normalize = function(multiplier) {
        if (this.length !== 0) {
            var n = this.divide(this.length()); // dont ever want to normalize when vector length is zero
            this.x = n.x * multiplier;
            this.y = n.y * multiplier;
        }
    }
}


function updateGameArea() { // CALLED EVERY FRAME
    
    // UPDATING OBJECTS
    touchHandler.update(); 
    UserInterface.update();

    if (UserInterface.gamestate == 6) {
        var dt = (Date.now() - prevDateNow)/10; // Delta Time for FPS independence. dt = amount of milliseconds between frames
        prevDateNow = Date.now();

        map.update();
        player.updatePos(dt)
    };

    // RENDERING OBJECTS
    canvasArea.clear();

    if (UserInterface.gamestate == 6) {
        map.render();
        player.render();
    }

    UserInterface.render(dt);

}


//      :)