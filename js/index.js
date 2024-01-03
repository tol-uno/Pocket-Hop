document.addEventListener("deviceready", onDeviceReady, false);

let airAcceleration = 4; // the sharpness your allowed to turn at
let maxVelocity = 1.12; // basically the rate at which speed is gained / lost. wishDir is scaled to this magnitude
let gravity = 0.05;
let prevDateNow;
let dt = 1;

var midX = 0;
var midY = 0;

function onDeviceReady() { // Called on page load in HMTL
    document.querySelector("body").onresize = function() {canvasArea.resize()};

    window.addEventListener("orientationchange", e => {
        canvasArea.resize()
    })
    // console.log(screen.orientation)
    if (screen.orientation){
        screen.orientation.addEventListener("change", event => {
            canvasArea.resize();
        });
    }

    touchHandler = new InputHandler;

    player = null; // Needs to be created by map
    canvasArea.start();
    UserInterface.start(); // need to be ran after canvas is resized in canvasArea.start()
    AudioHandler.setVolumes();

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
        
        prevDateNow = performance.now()

        this.interval = setInterval(updateGameArea, 10); // Number sets the taget frame rate. 1000/# = FPS
    },

    clear : function() { // CLEARS WHOLE CANVAS
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    },


    renderTheQueue : function() {
        map.renderQueue.forEach(queueItem => {
            if (queueItem == player) {
                player.render()
            } else {
                map.renderPlatform(queueItem)
            }
        })

        // draw shadow border if player is behind wall
        if (map.renderQueue[map.renderQueue.length - 1] != player) { // if player is not last in renderQueue
            canvasArea.ctx.save()
            
            canvasArea.ctx.translate(-player.x + midX, -player.y + midY)
            canvasArea.ctx.clip(map.behindWallClip);
            canvasArea.ctx.translate(player.x , player.y);
        
            canvasArea.ctx.rotate(player.lookAngle.getAngle() * Math.PI/180)

            canvasArea.ctx.strokeStyle = map.style.playerColor
            canvasArea.ctx.lineWidth = 2
            canvasArea.ctx.beginPath()
            canvasArea.ctx.strokeRect(-15, -15, 30, 30)
            canvasArea.ctx.stroke()

            canvasArea.ctx.restore() // clears behindWallClip
        }
    },


    resize : function() {
        console.log("resized :)");

        // this.canvas.width = window.screen.availWidth;
        // this.canvas.height = window.screen.availHeight;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        midX = this.canvas.width / 2;
        midY = this.canvas.height / 2;

        UserInterface.renderedButtons.forEach(button => {
            button.resize();
        });
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


class SliderUI {
    confirmed = true;

    constructor(x, y, width, min, max, label, variable, func) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.min = min;
        this.max = max;
        this.label = label;
        this.value = variable;
        this.variableToControl = String(variable);
        this.func = func;
        this.sliderX = x + width / ((max - min)/this.value);
    }

    updateState(value) { // updates the button when its value is changed by external source
        this.value = value;
        this.sliderX = this.x + this.width / ((this.max - this.min)/this.value);
    }


    render() {
        canvasArea.ctx.strokeStyle = "#BBBBBB";
        canvasArea.ctx.lineWidth = 10;
        canvasArea.ctx.fillStyle = "#FFFFFF";
        
        canvasArea.ctx.beginPath(); // Slider Line
        canvasArea.ctx.moveTo(this.x, this.y)
        canvasArea.ctx.lineTo(this.x + this.width, this.y)
        canvasArea.ctx.stroke();

        // canvasArea.ctx.save();
        // canvasArea.ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        // canvasArea.ctx.shadowBlur = 10;
        // canvasArea.ctx.fill();
        // canvasArea.ctx.restore();

        canvasArea.ctx.beginPath(); // Slider Handle
        canvasArea.ctx.arc(this.sliderX, this.y, 15, 0, 2 * Math.PI);
        canvasArea.ctx.fill();

        canvasArea.ctx.font = "20px sans-serif";
        canvasArea.ctx.fillStyle = "white";
        canvasArea.ctx.fillText(this.label + ": " + this.value, this.x, this.y - 30)
    }

    update() {
        if (touchHandler.dragging) { // User is touching the screen
            if (Math.abs(touchHandler.touchX - this.sliderX) < 30 && Math.abs(touchHandler.touchY - this.y) < 30) {
                
                if (touchHandler.touchX > this.x && touchHandler.touchX < this.x + this.width) {

                    this.sliderX = touchHandler.touchX
                }

                // MAP TO RANGE: https://stackoverflow.com/questions/10756313/javascript-jquery-map-a-range-of-numbers-to-another-range-of-numbers
                // (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
                // inmin = this.x
                // inmax = this.x + this.width
                // outmin = this.min
                // outmax = this.max

                this.value = (this.sliderX - this.x) * (this.max - this.min) / (this.width) + this.min;
                this.value = Math.round(this.value * 10) / 10;

                this.confirmed = false;
            }
        } else { // if not dragging (testing for a touch end on slider)
            if (!this.confirmed) { // and if real values havent been updated

                // map snapped value to pixels along slider. snapping the position of the visual slider
                this.sliderX = (this.value - this.min) * (this.x + this.width - this.x) / (this.max - this.min) + this.x;

                this.func(); // run the functions built into the slider
                this.confirmed = true;
            }
        }
    }

    resize() {}
}


var UserInterface = {
    
    gamestate : 1,
    // 1: main menu
    // 2: level select
    // 3: settings
    // 4: store
    // 5: loading map page
    // 6: in level
    // 7: in map editor

    sensitivity : null,
    debugText : null,
    strafeHUD : null,
    volume : null,
    
    timer : 0,
    timerStart : null, // set by jump button
    levelState : 1, // 1 = pre-start, 2 = playing level, 3 = in endzone

    start : function() {

        // Retreaving settings from local storage OR setting them
        this.sensitivity = window.localStorage.getItem("sensitivity_storage")
        if (this.sensitivity == null) {
            this.sensitivity = 1
            window.localStorage.setItem("sensitivity_storage", 1)
        }

        this.debugText = window.localStorage.getItem("debugText_storage")
        if (this.debugText == null) {
            this.debugText = 0
            window.localStorage.setItem("debugText_storage", 0)
        }

        this.strafeHUD = window.localStorage.getItem("strafeHUD_storage")
        if (this.strafeHUD == null) {
            this.strafeHUD = 0
            window.localStorage.setItem("strafeHUD_storage", 0)
        }

        this.volume = window.localStorage.getItem("volume_storage")
        console.log("volume " + this.volume)
        if (this.volume == null) {
            this.volume = 0.5
            window.localStorage.setItem("volume_storage", 0.5)
        }



        // CREATING THE BUTTONS []  []  [] 

        // Main Menu BUTTONS
        btn_levelSelect = new Button("midX - 100", "midY - 50", 200, 100, "Play", 0, function() { 
            UserInterface.gamestate = 2;
            UserInterface.renderedButtons = [btn_mainMenu, btn_custom_maps, btn_level_original, btn_level_noob, btn_level_hellscape]
            UserInterface.renderedButtons.forEach(button => {
                button.resize();
            });
        })

        btn_settings = new Button("midX + 130", "midY - 50", 200, 100, "Settings", 0, function() {
            UserInterface.gamestate = 3;
            UserInterface.renderedButtons = [btn_mainMenu, btn_sensitivitySlider, btn_volumeSlider, btn_debugText, btn_strafeHUD, btn_reset_settings] // debugText and strafeHud shouldnt be this accessible
            UserInterface.renderedButtons.forEach(button => {
                button.resize();
            });
        })

        btn_mapEditor = new Button("midX - 330", "midY - 50", 200, 100, "Map Editor", 0, function() {
            UserInterface.gamestate = 7;
            UserInterface.renderedButtons = [btn_mainMenu, btn_new_map, btn_load_map]
            UserInterface.renderedButtons.forEach(button => {
                button.resize();
            });
        })


        // SETTINGS Buttons 
        btn_reset_settings = new Button("canvasArea.canvas.width - 150", "canvasArea.canvas.height - 150", 80, 80, "Reset", 0, function() {
            window.localStorage.removeItem("record_original")
            window.localStorage.removeItem("record_noob")
            window.localStorage.removeItem("record_hellscape")

            UserInterface.sensitivity = 1
            window.localStorage.setItem("sensitivity_storage", 1)
            btn_sensitivitySlider.updateState(1)
        
            UserInterface.debugText = 0
            window.localStorage.setItem("debugText_storage", 0)
            
            UserInterface.strafeHUD = 0
            window.localStorage.setItem("strafeHUD_storage", 0)
            
            UserInterface.volume = 0.5
            window.localStorage.setItem("volume_storage", 0.5)
            
            console.log("records and settings cleared")

        })

        btn_sensitivitySlider = new SliderUI(180, 100, 300, 0.1, 3, "Sensitivity", UserInterface.sensitivity, function() { 
            UserInterface.sensitivity = this.value
            window.localStorage.setItem("sensitivity_storage", this.value)
        })

        btn_volumeSlider = new SliderUI(180, 200, 300, 0, 1, "Volume", UserInterface.volume, function() { 
            UserInterface.volume = this.value
            window.localStorage.setItem("volume_storage", this.value)
            AudioHandler.setVolumes();
        })

        btn_debugText = new Button(180, 270, 80, 80, "Debug Text", 1, function(init) {
            if (init) {
                    this.toggle = UserInterface.debugText;
                } else {
                if (this.toggle) {
                    this.toggle = 0;
                    UserInterface.debugText = 0
                    window.localStorage.setItem("debugText_storage", 0)
                } else {
                    this.toggle = 1;
                    UserInterface.debugText = 1
                    window.localStorage.setItem("debugText_storage", 1)
                }
            }
        })

        btn_strafeHUD = new Button(300, 270, 80, 80, "Strafe Helper", 1, function(init) {
            if (init) {
                this.toggle = UserInterface.strafeHUD;
            } else {
                if (this.toggle == 1) {
                    this.toggle = 0;
                    UserInterface.strafeHUD = 0
                    window.localStorage.setItem("strafeHUD_storage", 0)
                } else {
                    this.toggle = 1;
                    UserInterface.strafeHUD = 1
                    window.localStorage.setItem("strafeHUD_storage", 1)
                }
            }
        })


        // MAP EDITOR BUTTONS
        btn_new_map = new Button("200", "40", 400, 100, "Create New Map", 0, function() {
            
            MapEditor.loadedMap =
                {
                    "playerStart": {
                        "x": 350,
                        "y": 250,
                        "angle": 0
                    },
                    "checkpoints": [],
                    "style": {
                        "platformTopColor": "rgba(209,70,63,1)",
                        "platformSideColor": "rgba(209,70,63,1)",
                        "wallTopColor": "rgba(125, 94, 49, 1)",
                        "wallSideColor": "rgba(125, 94, 49, 1)",
                        "endZoneTopColor": "rgba(255,218,98,1)",
                        "endZoneSideColor": "rgba(255,218,98,1)",
                        "backgroundColor": "#a3d5e1",
                        "shadowColor": "#07070a25",
                        "playerColor": "rgba(239,238,236,1)",
                        "platformHeight": 25,
                        "wallHeight": 50,
                        "lightAngle": 45,
                        "shadowContrastLight": -0.005,
                        "shadowContrastDark": -0.4,
                        "shadowLength": 25
                    },
                    "platforms": [
                        {
                            "x": 300,
                            "y": 10,
                            "width": 100,
                            "height": 100,
                            "angle": 0,
                            "endzone": 1,
                            "wall": 0
                        },
                        {
                            "x": 300,
                            "y": 200,
                            "width": 100,
                            "height": 100,
                            "angle": 45,
                            "endzone": 0,
                            "wall": 0
                        }
                    ]
                }
        })

        btn_load_map = new Button("200", "180", 400, 100, "Load A Map", 0, function() {
            
            var input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            document.body.appendChild(input);
            input.click();
            
            input.addEventListener('change', function () {
                let file = input.files[0]
                
                let reader = new FileReader();
                reader.onload = (e) => {
                    // console.log(e.target.result)
                    MapEditor.loadedMap = JSON.parse(e.target.result)
                };
                reader.onerror = (e) => alert(e.target.error.name);

                reader.readAsText(file)
            })

            input.remove();

        })

        btn_exit_edit = new Button("20", "20", 150, 50, "Save and Exit", 0, function() {

            var map = MapEditor.loadedMap;

            downloadMap = {};
            downloadMap.playerStart = {
                    "x": map.playerStart.x,
                    "y": map.playerStart.y,
                    "angle": map.playerStart.angle
                },
            downloadMap.checkpoints = map.checkpoints;
            downloadMap.style = {
                    "platformTopColor": map.style.platformTopColor,
                    "platformSideColor": map.style.platformSideColor,
                    "wallTopColor": map.style.wallTopColor,
                    "wallSideColor": map.style.wallSideColor,
                    "endZoneTopColor": map.style.endZoneTopColor,
                    "endZoneSideColor": map.style.endZoneSideColor,
                    "backgroundColor": map.style.backgroundColor,
                    "shadowColor": map.style.shadowColor,
                    "playerColor": map.style.playerColor,
                    "platformHeight": map.style.platformHeight,
                    "wallHeight": map.style.wallHeight,
                    "lightAngle": map.style.lightAngle,
                    "shadowContrastLight": map.style.shadowContrastLight,
                    "shadowContrastDark": map.style.shadowContrastDark,
                    "shadowLength": map.style.shadowLength
                }
            downloadMap.platforms = [];
            map.platforms.forEach(platform => {
                downloadMap.platforms.push(
                    {
                        "x": platform.x,
                        "y": platform.y,
                        "width": platform.width,
                        "height": platform.height,
                        "angle": platform.angle,
                        "endzone": platform.endzone,
                        "wall": platform.wall
                    }
                )
            })


            // downloadMap.platforms.sort(MapEditor.sortPlatforms)
            console.log(JSON.stringify(downloadMap.platforms))

            MapEditor.sortPlatforms2(downloadMap.platforms)

            console.log(JSON.stringify(downloadMap.platforms))


            var savemap = confirm("Save Map?");
            if (savemap) {
                // RE-ENABLE TO DOWNLOAD MAPS ON EXIT (SHOULD PROMT IF WANT TO SAVE and NAME MAP)
                downloadObjectAsJson(downloadMap, "custom_map");
            }

            function downloadObjectAsJson(exportObj, exportName) { // https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser
                var exportName = prompt("Enter Map Name");
                var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
                var downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", exportName + ".json");
                document.body.appendChild(downloadAnchorNode); // required for firefox
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            }

            MapEditor.loadedMap = null;
            UserInterface.renderedButtons = [btn_mainMenu, btn_new_map, btn_load_map]
            MapEditor.editorState = 0;
            MapEditor.selectedPlatformIndex -1;
        })
        
        btn_add_platform = new Button("canvasArea.canvas.width - 200", "100", 150, 80, "New Platform", 0, function() {
            
            var newPlatform = {
                "x": Math.round(-MapEditor.screenX + canvasArea.canvas.width/2),
                "y": Math.round(-MapEditor.screenY + canvasArea.canvas.height/2),
                "width": 100,
                "height": 100,
                "angle": 0,
                "endzone": 0,
                "wall": 0
            }


            MapEditor.loadedMap.platforms.push(newPlatform);
            MapEditor.selectedPlatformIndex = MapEditor.loadedMap.platforms.length - 1;
            UserInterface.renderedButtons = [btn_exit_edit, btn_unselect, btn_delete_platform]
                
        })

        btn_unselect = new Button("canvasArea.canvas.width - 190", "30", 60, 60, "X", 0, function() {
            
            MapEditor.selectedPlatformIndex = -1; // No selected platform
            UserInterface.renderedButtons = [btn_exit_edit, btn_add_platform]
        })

        btn_x_plus = new Button("canvasArea.canvas.width - 55", "120", 20, 20, "+", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].x += 20 })
        btn_x_minus = new Button("canvasArea.canvas.width - 90", "120", 20, 20, "-", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].x -= 20 })
        btn_y_plus = new Button("canvasArea.canvas.width - 55", "140", 20, 20, "+", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].y += 20 })
        btn_y_minus = new Button("canvasArea.canvas.width - 90", "140", 20, 20, "-", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].y -= 20 })
        btn_width_plus = new Button("canvasArea.canvas.width - 55", "160", 20, 20, "+", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].width += 20 })
        btn_width_minus = new Button("canvasArea.canvas.width - 90", "160", 20, 20, "-", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].width -= 20 })
        btn_height_plus = new Button("canvasArea.canvas.width - 55", "180", 20, 20, "+", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].height += 20 })
        btn_height_minus = new Button("canvasArea.canvas.width - 90", "180", 20, 20, "-", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].height -= 20 })
        btn_angle_plus = new Button("canvasArea.canvas.width - 55", "200", 20, 20, "+", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].angle += 20 })
        btn_angle_minus = new Button("canvasArea.canvas.width - 90", "200", 20, 20, "-", 0, function() { MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].angle -= 20 })
        btn_wall = new Button("canvasArea.canvas.width - 90", "220", 40, 20, "toggle", 1, function(init) { 
            if (MapEditor.loadedMap) { // throws an error otherwise
                
                if (init) {
                    this.toggle = MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].wall?1:0; // gets initial value of toggle
                    console.log("init run")
                } else {
                    if (this.toggle) {
                        this.toggle = 0;
                        MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].wall = 1
                    } else {
                        this.toggle = 1;
                        MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].wall = 0
                    }
                }
            }    
        })
        

        btn_delete_platform = new Button("canvasArea.canvas.width - 190", "300", 150, 60, "Delete Platform", 0, function() {
            
            MapEditor.loadedMap.platforms.splice(MapEditor.selectedPlatformIndex, 1)
            MapEditor.selectedPlatformIndex = -1; // No selected platform
            UserInterface.renderedButtons = [btn_exit_edit, btn_add_platform]
            
        })


        // MAP SELECT Buttons
        btn_custom_maps = new Button("canvasArea.canvas.width - 200", 50, 150, 80, "Custom Maps", 0, function() { 
            
            
            var input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            document.body.appendChild(input);
            input.click();
            
            input.addEventListener('change', function () {
                let file = input.files[0]
                
                let reader = new FileReader();
                reader.onload = (e) => {
                    let mapObject = JSON.parse(e.target.result);
                    mapObject.name = String(input.files[0].name.split(".")[0]) // for getting the name of a custom map
                    map = new Map(mapObject);
                    UserInterface.gamestate = 5;
                    UserInterface.renderedButtons = [btn_mainMenu];
                    btn_mainMenu.resize()

                };
                reader.onerror = (e) => alert(e.target.error.name);

                reader.readAsText(file)
            })

            input.remove();

        })

        btn_level_original = new Button(200, 100, 100, 80, "Original", 0, function() { 
            map = new Map("original");
            UserInterface.gamestate = 5;
            UserInterface.renderedButtons = [btn_mainMenu];
            btn_mainMenu.resize()
        })

        btn_level_noob = new Button(320, 100, 100, 80, "Noob", 0, function() { 
            map = new Map("noob");
            UserInterface.gamestate = 5;
            UserInterface.renderedButtons = [btn_mainMenu];
            btn_mainMenu.resize()
        })

        btn_level_hellscape = new Button(440, 100, 100, 80, "Hellscape", 0, function() { 
            map = new Map("hellscape");
            UserInterface.gamestate = 5;
            UserInterface.renderedButtons = [btn_mainMenu];
            btn_mainMenu.resize()
        })


        // In Level Buttons
        btn_mainMenu = new Button(50, 40, 80, 60, "menu", 0, function() { 
            UserInterface.gamestate = 1;
            UserInterface.timer = 0;
            UserInterface.levelState = 1;
            player = null;
            map = null;
            UserInterface.renderedButtons = [btn_mapEditor, btn_levelSelect, btn_settings];
            UserInterface.renderedButtons.forEach(button => {
                button.resize();
            });
        })

        btn_restart = new Button(50, 200, 80, 60, "restart", 0, function() { 
            UserInterface.timer = 0;
            UserInterface.levelState = 1;
            player.checkpointIndex = -1;
            player.restart();
        })

        btn_jump = new Button(50, 300, 80, 60, "jump", 0, function() { 
            if (UserInterface.levelState == 1) {
                UserInterface.timerStart = Date.now();
                UserInterface.levelState = 2;
                player.startLevel();
            }
        })

        this.renderedButtons = [btn_mapEditor, btn_levelSelect, btn_settings]; 

    },

    update : function() {
        
        if (this.gamestate == 3) { // in setting page -- only place with sliders that need to be updated
            this.renderedButtons.forEach(button => { // LOOP RENDERED BUTTONS
                if (button.constructor.name == "SliderUI") { // run .update() for only Sliders
                    button.update();
                }
            });
        }

        if (this.levelState == 2) {
            this.timer = Date.now() - this.timerStart;
        }
    },

    mapLoaded : function() { // called by map.start()
        UserInterface.gamestate = 6;
        UserInterface.renderedButtons = [btn_mainMenu, btn_restart, btn_jump];
        UserInterface.renderedButtons.forEach(button => {
            button.resize();
        });
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

    secondsToMinutes : function(milliseconds) {
        let seconds = milliseconds / 1000
        // seconds = Math.round(seconds * 1000) / 1000

        let minutes = Math.floor(seconds / 60);
        let extraSeconds = seconds % 60;
        extraSeconds = Math.round(extraSeconds * 1000) / 1000

        // minutes = minutes < 10 ? "0" + minutes : minutes; // adds a zero before minutes number if less than 10 mins
        extraSeconds = extraSeconds < 10 ? "0" + extraSeconds : extraSeconds;
        return minutes + ":" + extraSeconds;
    },

    touchReleased : function(x,y) { // TRIGGERED BY InputHandler
        
        var clickedPlatform = false;
        var clickedButton = false;
        var clickedPlayer = false;

        // TEST IF TOUCHING WITHIN PLATFORM EDIT PANEL ON THE RIGHT

        this.renderedButtons.forEach(button => {
            if (button.constructor.name == "Button") { // only run on buttons not sliders
                if ( // if x and y touch is within button
                    x >= button.x && x <= button.x + button.width &&
                    y >= button.y && y <= button.y + button.height
                ) {
                    button.pressed();
                    clickedButton = true;
                }
            }
        });


        if (clickedButton == false && this.gamestate == 7 && MapEditor.editorState != 0) { // IF IN MAP EDITOR and not in map select screen in editor
            
            MapEditor.renderedPlatforms.forEach(platform => {
                if (// if x and y touch is within platform (NOT ROTATED THOUGH)
                    x >= platform.x + MapEditor.screenX && x <= platform.x + platform.width + MapEditor.screenX &&
                    y >= platform.y + MapEditor.screenY && y <= platform.y + platform.height + MapEditor.screenY
                ) {
                    MapEditor.selectedPlatformIndex = MapEditor.loadedMap.platforms.indexOf(platform)
                    clickedPlatform = true;
                    this.renderedButtons = [btn_exit_edit, btn_unselect, 
                        
                        btn_x_plus, 
                        btn_x_minus, 
                        btn_y_plus, 
                        btn_y_minus, 
                        btn_width_plus, 
                        btn_width_minus,
                        btn_height_plus,
                        btn_height_minus,
                        btn_angle_plus,
                        btn_angle_minus,
                        btn_wall,

                        btn_delete_platform]
                }
            })
            
            if (
                x >= MapEditor.loadedMap.playerStart.x + MapEditor.screenX - 16 && x <= MapEditor.loadedMap.playerStart.x + 16 + MapEditor.screenX &&
                y >= MapEditor.loadedMap.playerStart.y + MapEditor.screenY - 16 && y <= MapEditor.loadedMap.playerStart.y + 16 + MapEditor.screenY
            ) {
                MapEditor.selectedPlatformIndex = -2 // -2 means player is selected. Maybe change this to be its own var
                clickedPlayer = true;
            }

            if (clickedPlatform == false && clickedPlayer == false) {
                btn_unselect.pressed();
            }

        }

        


    },

    render : function(dt) {

        this.renderedButtons.forEach(button => { // LOOP RENDERED BUTTONS AND RUN THEIR .render()
            button.render();
        });

        if (this.gamestate == 1) { // In Main Menu
            canvasArea.ctx.font = "70px sans-serif";
            canvasArea.ctx.fillStyle = "#FFFFFF"; // WHITE
            canvasArea.ctx.fillText("Null's Voyage", canvasArea.canvas.width/4.4, 90);
        }

        if (this.gamestate == 6) { // In Level

            if (this.debugText == 1) { // DRAWING DEBUG TEXT
                var textX = canvasArea.canvas.width * 0.18; 
                canvasArea.ctx.font = "15px sans-serif";
                canvasArea.ctx.fillStyle = "#FFFFFF"; // WHITE
    
                canvasArea.ctx.fillText("dragAmountX: " + touchHandler.dragAmountX, textX, 60);
                canvasArea.ctx.fillText("fps: " + Math.round(100/dt), textX, 80);
                canvasArea.ctx.fillText("rounded dt: " + Math.round(dt * 10) / 10 + " milliseconds", textX, 100);
                canvasArea.ctx.fillText("velocity: " + Math.round(player.velocity.magnitude()), textX, 120);
                canvasArea.ctx.fillText("lookAngle: " + player.lookAngle.getAngle(), textX, 140);
                canvasArea.ctx.fillText("timer: " + UserInterface.secondsToMinutes(this.timer), textX, 160);
                canvasArea.ctx.fillText("renderedPlatforms Count: " + map.renderedPlatforms.length, textX, 180);
                canvasArea.ctx.fillText("touch x: " + touchHandler.touchX, textX, 200);
                canvasArea.ctx.fillText("touch y: " + touchHandler.touchY, textX, 220);
                canvasArea.ctx.fillText("player pos: " + Math.round(player.x) + ", " + Math.round(player.y), textX, 240);
                canvasArea.ctx.fillText("dragging: " + touchHandler.dragging, textX, 260);
                canvasArea.ctx.fillText("endZoneIsRendered: " + map.endZoneIsRendered, textX, 280);
                canvasArea.ctx.fillText("player posInRenderQueue: " + player.posInRenderQueue, textX, 300);
                canvasArea.ctx.fillText("lookAngle Length: " + player.lookAngle.magnitude(), textX, 320);
                canvasArea.ctx.fillText("velocity: " + player.velocity.x + ", " + player.velocity.y, textX, 340)
                canvasArea.ctx.fillText("wishDir: " + player.wishDir.x + ", " + player.wishDir.y, textX, 360)

            }
    
    
            if (this.strafeHUD == 1) { // STRAFE OPTIMIZER HUD
                
                canvasArea.ctx.fillRect(midX - 18, midY + 28, 8, 4 * Math.abs(touchHandler.dragAmountX) * UserInterface.sensitivity); // YOUR STRAFE
                canvasArea.ctx.fillRect(midX - 4, midY + 28, 8, 10 * player.currentSpeedProjected); // THE THRESHOLD
                canvasArea.ctx.fillRect(midX + 12, midY + 28 + 10 * airAcceleration * dt , 8, 2); // ADDSPEED LIMIT
                canvasArea.ctx.fillRect(midX + 10, midY + 28, 8, 10 * player.addSpeed ); // GAIN

                // little text for strafeHelper
                canvasArea.ctx.save()
                canvasArea.ctx.font = "12px sans-serif";
                canvasArea.ctx.fillStyle = "black"; 
                canvasArea.ctx.translate(midX - 17, midY + 28)
                canvasArea.ctx.rotate(90 * Math.PI / 180)
                canvasArea.ctx.fillText("dragAmountX", 0, 0)
                canvasArea.ctx.fillText("currentSpeedProjected: " + player.currentSpeedProjected, 0, -14)
                canvasArea.ctx.fillText("addSpeed: " + player.addSpeed, 0, -28)
                canvasArea.ctx.fillText("airAcceleration * dt: " + airAcceleration * dt, 0, -42)
                canvasArea.ctx.restore()

                // DRAWING PLAYER MOVEMENT DEBUG VECTORS
                // player wishDir
                canvasArea.ctx.strokeStyle = "#FF00FF";
                canvasArea.ctx.lineWidth = 4
                canvasArea.ctx.beginPath();
                canvasArea.ctx.moveTo(midX, midY);
                canvasArea.ctx.lineTo(midX + player.wishDir.x * 100, midY + player.wishDir.y * 100);
                canvasArea.ctx.stroke();

                // player velocity
                canvasArea.ctx.strokeStyle = "#0000FF";
                canvasArea.ctx.lineWidth = 5
                canvasArea.ctx.beginPath();
                canvasArea.ctx.moveTo(midX, midY);
                canvasArea.ctx.lineTo(midX + player.velocity.x * 10, midY + player.velocity.y * 10);
                canvasArea.ctx.stroke();

                // player lookAngle
                canvasArea.ctx.strokeStyle = "#FF00FF";
                canvasArea.ctx.lineWidth = 1
                canvasArea.ctx.beginPath();
                canvasArea.ctx.moveTo(midX, midY);
                canvasArea.ctx.lineTo(midX + player.lookAngle.x * 100, midY + player.lookAngle.y * 100);
                canvasArea.ctx.stroke();


                canvasArea.ctx.strokeStyle = "#000000"; // resetting
                canvasArea.ctx.lineWidth = 1

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
                canvasArea.ctx.fillText("Time: " + UserInterface.secondsToMinutes(UserInterface.timer), midX - 120, midY - 0);
                canvasArea.ctx.fillText("Record: " + UserInterface.secondsToMinutes(map.record), midX - 120, midY + 30);

                if (UserInterface.timer == map.record) {canvasArea.ctx.fillText("New Record!", midX - 120, midY + 65)}

            }
        }
    }
}


var MapEditor = {
    editorState : 0, // 0 = map select screen, 1 = main map edit screen, 2 = platform edit menu,
    loadedMap : null,
    scrollX_vel : 0, // for smooth scrolling 
    scrollY_vel : 0,
    screenX : 0, // where the view is located
    screenY : 0,
    renderedPlatforms : [],
    selectedPlatformIndex : -1,
    gizmoMidX : 0,
    gizmoMidY : 0,

    render : function() {

        if (this.loadedMap !== null) { // IF MAP IS LOADED RENDER IT
            var ctx = canvasArea.ctx;
            ctx.save() // moving to screenx and screeny
            ctx.translate(this.screenX, this.screenY);

            this.renderedPlatforms.forEach(platform => {
                // DRAW PLATFORM TOP
                ctx.save(); // ROTATING for Platforms
                ctx.translate(platform.x + platform.width/2, platform.y + platform.height/2);
                ctx.rotate(platform.angle * Math.PI/180);

                // Change to endzone color if needed. Also where its determined if endzone is being rendered
                if (platform.wall) {
                    ctx.fillStyle = this.loadedMap.style.wallTopColor;
                } else if (platform.endzone) {
                    ctx.fillStyle = this.loadedMap.style.endZoneTopColor;
                } else {
                    ctx.fillStyle = this.loadedMap.style.platformTopColor;
                }
                
                ctx.fillRect(-platform.width/2, -platform.height/2, platform.width, platform.height);



                if (platform == this.loadedMap.platforms[this.selectedPlatformIndex]) { // DRAWING THE BORDER AROUND THE SELECTED PLATFORM
                    ctx.strokeStyle = "#000000"
                    ctx.lineWidth = 6
                    ctx.strokeRect(-platform.width/2 + 3, -platform.height/2 + 3, platform.width - 6, platform.height - 6);
                    
                    ctx.strokeStyle = "#FFFFFF"
                    ctx.lineWidth = 2
                    ctx.strokeRect(-platform.width/2 + 3, -platform.height/2 + 3, platform.width - 6, platform.height - 6);
                }
                

                // PLAFORM RENDERING DEBUG TEXT
                // ctx.fillStyle = "#FFFFFF";
                // ctx.fillText("angle: " + platform.angle, 0,-20);
                // ctx.fillText("position: " + platform.x + ", " + platform.y, 0, 0);
                // ctx.fillText("screen Loc X mid: " + (platform.x + platform.width/2 + this.screenX), 0, 20);
                // ctx.fillText("screen Loc Y: " + (platform.y + platform.height/2 + this.screenY), 0, 40);

                ctx.restore(); // restoring platform rotation and translation
            })



            ctx.fillRect(-5, -5, 10, 10) // (0,0) map origin

            // DRAWING THE PLAYER START
            ctx.save()
            ctx.translate(this.loadedMap.playerStart.x, this.loadedMap.playerStart.y)
            ctx.rotate(this.loadedMap.playerStart.angle * Math.PI/180);
            ctx.fillStyle = this.loadedMap.style.playerColor;
            ctx.fillRect(-16,-16,32,32)

            // draw player arrow
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-5, -7);
            ctx.lineTo(-5, 7);
            ctx.lineTo(8, 0)
            ctx.stroke();

            if (this.selectedPlatformIndex == -2) { // DRAWING SELECTION BORDER AROUND PLAYER
                ctx.strokeStyle = "#000000"
                ctx.lineWidth = 6
                ctx.strokeRect(-13, -13, 26, 26);
                
                ctx.strokeStyle = "#FFFFFF"
                ctx.lineWidth = 2
                ctx.strokeRect(-13, -13, 26, 26);
            }

            ctx.restore() //restoring player rotation and transformation
            ctx.restore() // restoring screenx and screeny translation




            // MAP EDITOR UI

            if (this.editorState == 2) { // DRAWING SIDE PANEL and gizmo for PLATFORM SELECTED AND EDITING
            
                // SIDE PANEL
                ctx.fillStyle = "#FFFFFF"
                ctx.fillRect(canvasArea.canvas.width - 200, 20, 180, 260)



                // GIZMO
                if (this.selectedPlatformIndex == -2) { // player is selected
                    
                    ctx.fillStyle = "#000000"
                    ctx.fillText("Player Start", canvasArea.canvas.width - 190, 120);
                    ctx.fillText("X: " + this.loadedMap.playerStart.x, canvasArea.canvas.width - 190, 140);
                    ctx.fillText("Y: " + this.loadedMap.playerStart.y, canvasArea.canvas.width - 190, 160);

                    
                    // this.gizmoMidY = this.loadedMap.playerStart.y + this.screenY
                    // this.gizmoMidX = this.loadedMap.playerStart.x + this.screenX
                
                } else { // platform is selected
                    
                    ctx.fillStyle = "#000000"
                    ctx.fillText("Platform", canvasArea.canvas.width - 190, 120);
                    ctx.fillText("X: " + this.loadedMap.platforms[this.selectedPlatformIndex].x, canvasArea.canvas.width - 190, 140);
                    ctx.fillText("Y: " + this.loadedMap.platforms[this.selectedPlatformIndex].y, canvasArea.canvas.width - 190, 160);

                    ctx.fillText("Width: " + this.loadedMap.platforms[this.selectedPlatformIndex].width, canvasArea.canvas.width - 190, 180);
                    ctx.fillText("Height: " + this.loadedMap.platforms[this.selectedPlatformIndex].height, canvasArea.canvas.width - 190, 200);

                    ctx.fillText("Angle: " + this.loadedMap.platforms[this.selectedPlatformIndex].angle, canvasArea.canvas.width - 190, 220)

                    ctx.fillText("Wall: " + (this.loadedMap.platforms[this.selectedPlatformIndex].wall?"Yes":"No"), canvasArea.canvas.width - 190, 240)


                    // this.gizmoMidX = this.loadedMap.platforms[this.selectedPlatformIndex].x + this.loadedMap.platforms[this.selectedPlatformIndex].width/2 + this.screenX
                    // this.gizmoMidY = this.loadedMap.platforms[this.selectedPlatformIndex].y + this.loadedMap.platforms[this.selectedPlatformIndex].height/2 + this.screenY
                }

                // ctx.fillRect(this.gizmoMidX, this.gizmoMidY, 10, 10)
            
            }



            // GENERAL MAP EDITOR DEBUG TEXT
            var textX = 200;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText("screenX: " + this.screenX, textX, 60);
            ctx.fillText("touchX: " + Math.round(touchHandler.touchX - this.screenX), textX, 80);
            ctx.fillText("touchY: " + Math.round(touchHandler.touchY - this.screenY), textX, 100);
            ctx.fillText("previousX: " + touchHandler.previousX, textX, 120);
            ctx.fillText("rendered platforms: " + this.renderedPlatforms.length, textX, 140);
            ctx.fillText("editorState: " + this.editorState, textX, 160);
            ctx.fillText("selected platform index: " + this.selectedPlatformIndex, textX, 180);


        }

    },

    update : function() {
        
        // when map is loaded for editing
        if (this.editorState == 0) { // 0 == map select screen
            if (this.loadedMap !== null) { // if map is loaded then switch to Main Map Edit screen
                
                canvasArea.canvas.style.backgroundColor = this.loadedMap.style.backgroundColor; // set bg color here so it only triggers once not every render frame
                document.body.style.backgroundColor = this.loadedMap.style.backgroundColor;

                UserInterface.renderedButtons = [btn_exit_edit, btn_add_platform] // btn_add_checkpoint, btn_map_settings

                this.screenX = -this.loadedMap.playerStart.x + canvasArea.canvas.width/2;
                this.screenY = -this.loadedMap.playerStart.y + canvasArea.canvas.height/2;

                this.editorState = 1
            }
        }

        if (this.editorState == 1 || this.editorState == 2) { // main map edit screen OR platform select screen

            // SCROLLING THE SCREEN
            if (touchHandler.dragging == 1) {
                this.scrollX_vel += touchHandler.dragAmountX
                this.scrollY_vel += touchHandler.dragAmountY
            }

            this.screenX += this.scrollX_vel / 10;
            this.screenY += this.scrollY_vel / 10;

            this.scrollX_vel *= 0.95
            this.scrollY_vel *= 0.95



            // FIGURING OUT WHICH PLATFORMS TO RENDER
            this.renderedPlatforms = [];

            this.loadedMap.platforms.forEach(platform => { // Loop through platforms
                var hypotenuse = Math.sqrt(platform.width * platform.width + platform.height * platform.height)/2


                if (
                    (platform.x + platform.width/2 + hypotenuse + this.screenX > 0) && // coming into frame on left side
                    (platform.x + platform.width/2 - hypotenuse + this.screenX < canvasArea.canvas.width) && // right side
                    (platform.y + platform.height/2 + hypotenuse + this.screenY > 0) && // top side
                    (platform.y + platform.height/2 - hypotenuse + this.screenY < canvasArea.canvas.height) // bottom side
                ) {
                    this.renderedPlatforms.push(platform); // ADD platform to renderedPlatforms
                }
            });


        }

        if (this.editorState == 1 && this.selectedPlatformIndex !== -1) {
            this.editorState = 2;
        }

        if (this.editorState == 2 && this.selectedPlatformIndex == -1) {
            this.editorState = 1;
        }


    
    },

    sortPlatforms2 : function(platforms) { 
        // inefficient sorting algorithm but its only run on map save so whatever
        // this doesnt need to return anything because it's directly editing the object its passed as a perameter (not a copy)


        // sort all platforms by y initially (keeps rendering order correct when some platforms arent compared with each other)
        platforms.sort(sortY)

        function sortY(a, b) {
            // if return is negative ... a comes first 
            // if return is positive ... b comes first
            // return is 0... nothing is changed
            if (a.y + a.height/2 < b.y + b.height/2) {return -1;}
            if (a.y + a.height/2 > b.y + b.height/2) {return 1;}
            return 0;
        }


        console.log("platforms.length = " + platforms.length)

        for (let i = 0; i < platforms.length; i++) { // if its NOT the last platform. dont need to test last platform

            // takes platforms[i] and compares it to every other platform using compareIndex
            // Needs to do this otherwise long walls create this gap where two platforms arent being compared to each other.
        
            for (let compareIndex = 1; compareIndex + i < platforms.length; compareIndex ++) {

                if (shouldBeInFront(platforms[i], platforms[i+compareIndex]) == true) {

                    // swap them in the array
                    console.log("SWAPED.  i=" + i + "  compareIndex=" + compareIndex + "  (" + platforms[i].x + ", " + platforms[i].y + ") with (" + platforms[i+compareIndex].x + ", " + platforms[i+compareIndex].y + ")")

                    var temp = platforms[i]
                    platforms[i] = platforms[i+compareIndex]
                    platforms[i+compareIndex] = temp 
                } else {
                    console.log("No swap. i=" + i + "  compareIndex=" + compareIndex)
                }
            }
        }

        console.log("done sorting")
    
        

        function shouldBeInFront(a,b) {

            // a is in correct spot behind b
            // return false; 

            // a should be rendered infront of b
            // return true;


            // only sort/swap if platforms could be overlapping each other.
            var hypotenuse_a = Math.sqrt(a.width * a.width + a.height * a.height)/2
            var hypotenuse_b = Math.sqrt(b.width * b.width + b.height * b.height)/2

            var adjustedHeight_a = a.wall ? MapEditor.loadedMap.style.wallHeight : 0 // for adding height to a if its a wall
            var adjustedHeight_b = b.wall ? MapEditor.loadedMap.style.wallHeight : 0 // for adding height to b if its a wall

            if (
                    (a.x + a.width/2 + hypotenuse_a > b.x + b.width/2 - hypotenuse_b) && // a colliding with b from left side
                    (a.x + a.width/2 - hypotenuse_a < b.x + b.width/2 + hypotenuse_b) && // right side
                    (a.y + a.height/2 + hypotenuse_a > b.y + b.height/2 - hypotenuse_b - adjustedHeight_b) && // top side
                    (a.y + a.height/2 - hypotenuse_a - adjustedHeight_a < b.y + b.height/2 + hypotenuse_b) // bottom side (could also use downloadMap here i think)
                ) {
                
                // corners will be added/sorted after first loop. check if they are already added.
                if (!("corners" in a)) {
                    var angleRad = a.angle * (Math.PI/180);
                    a.corners = [
                        // bot left corner        
                        [
                        -((a.width / 2) * Math.cos(angleRad)) - ((a.height / 2) * Math.sin(angleRad)),
                        -((a.width / 2) * Math.sin(angleRad)) + ((a.height / 2) * Math.cos(angleRad))
                        ],
            
                        // bot right corner
                        [
                        ((a.width / 2) * Math.cos(angleRad)) - ((a.height / 2) * Math.sin(angleRad)),
                        ((a.width / 2) * Math.sin(angleRad)) + ((a.height / 2) * Math.cos(angleRad))
                        ],
            
                        // top right corner
                        [
                        ((a.width / 2) * Math.cos(angleRad)) + ((a.height / 2) * Math.sin(angleRad)),
                        ((a.width / 2) * Math.sin(angleRad)) - ((a.height / 2) * Math.cos(angleRad))
                        ],
                    
                        // top left corner
                        [
                        -((a.width / 2) * Math.cos(angleRad)) + ((a.height / 2) * Math.sin(angleRad)),
                        -((a.width / 2) * Math.sin(angleRad)) - ((a.height / 2) * Math.cos(angleRad))
                        ]
                    ]
                    
                    a.corners.sort(sortCornersX)
                }
    
    
                if (!("corners" in b)) {
                    var angleRad = b.angle * (Math.PI/180);
                    b.corners = [
                        // bot left corner        
                        [
                        -((b.width / 2) * Math.cos(angleRad)) - ((b.height / 2) * Math.sin(angleRad)),
                        -((b.width / 2) * Math.sin(angleRad)) + ((b.height / 2) * Math.cos(angleRad))
                        ],
            
                        // bot right corner
                        [
                        ((b.width / 2) * Math.cos(angleRad)) - ((b.height / 2) * Math.sin(angleRad)),
                        ((b.width / 2) * Math.sin(angleRad)) + ((b.height / 2) * Math.cos(angleRad))
                        ],
            
                        // top right corner
                        [
                        ((b.width / 2) * Math.cos(angleRad)) + ((b.height / 2) * Math.sin(angleRad)),
                        ((b.width / 2) * Math.sin(angleRad)) - ((b.height / 2) * Math.cos(angleRad))
                        ],
                    
                        // top left corner
                        [
                        -((b.width / 2) * Math.cos(angleRad)) + ((b.height / 2) * Math.sin(angleRad)),
                        -((b.width / 2) * Math.sin(angleRad)) - ((b.height / 2) * Math.cos(angleRad))
                        ]
                    ]
                    
                    b.corners.sort(sortCornersX)
                }
        
    
                function sortCornersX(a, b) {
                    // if return is negative ... a comes first 
                    // if return is positive ... b comes first
                    // return is 0... nothing is changed
                    if (a[0] < b[0]) {return -1;}
                    if (a[0] > b[0]) {return 1;}
                    return 0;
                }
        
        
    
                if ((a.x + a.width/2) < (b.x + b.width/2)) { // A IS TO THE LEFT OF B
                // if (a.x < b.x) { // A IS TO THE LEFT OF B
    
                    // console.log("RETURNING TRUE")
                    // return true
    
                    // GETS A's platform.corner for right most corner (end of corners array) NOTE: corner array is in local space
                    a.rightMostPlatformCornerX = a.corners[3][0] + a.x + a.width/2 // platform corners are relative to the platforms middle
                    a.rightMostPlatformCornerY = a.corners[3][1] + a.y + a.height/2
        
                    // gets B's platform.corner for left most corner (start of corners array) NOTE: corner array is in local space
                    b.leftMostPlatformCornerX = b.corners[0][0] + b.x + b.width/2 // platform corners are relative to the platforms middle
                    b.leftMostPlatformCornerY = b.corners[0][1] + b.y + b.height/2
        
                    // gets corner extension for A's corner compared to B 
                    var aCornerExtensionY = a.rightMostPlatformCornerY + (b.leftMostPlatformCornerX - a.rightMostPlatformCornerX) * Math.tan(a.angle * (Math.PI/180))
        
                    if (a.rightMostPlatformCornerY > b.leftMostPlatformCornerY){ // below
                        // render a in front of b
                        // console.log("a was to the LEFT of b and should be infront")
                        return true;
                    } else {return false;} // above. render b in front of a
        
        
                }
                
                if ((a.x + a.width/2) >= (b.x + b.width/2)) { // A IS TO THE RIGHT OF B
                // if (a.x >= b.x) { // A IS TO THE RIGHT OF B (its always doing this one)
    
                    // console.log("RETURNING FALSE")
                    // return false
    
                    // gets A's platform.corner for left most corner (start of corners array) NOTE: corner array is in local space
                    a.leftMostPlatformCornerX = a.corners[0][0] + a.x + a.width/2 // platform corners are relative to the platforms middle
                    a.leftMostPlatformCornerY = a.corners[0][1] + a.y + a.height/2
        
                    // GETS B's platform.corner for right most corner (end of corners array) NOTE: corner array is in local space
                    b.rightMostPlatformCornerX = b.corners[3][0] + b.x + b.width/2 // platform corners are relative to the platforms middle
                    b.rightMostPlatformCornerY = b.corners[3][1] + b.y + b.height/2
        
                    var aCornerExtensionY = a.leftMostPlatformCornerY + (b.rightMostPlatformCornerX - a.leftMostPlatformCornerX) * Math.tan(a.angle * (Math.PI/180))
        
                    if (a.leftMostPlatformCornerY > b.rightMostPlatformCornerY){ // a is below
                        // render a in front of b
                        // console.log("a was to the RIGHT of b and should be infront")
                        return true;
                    } else {return false;} // above. render b in front of a
    
                }

            } else {
                console.log("didnt check: " + "(" + a.x + ", " + a.y + ") with (" + b.x + ", " + b.y + ")")
                return false
            }
        } // end of shouldBeInFront

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
    constructor(x, y, width, height, image, togglable, func) {
        this.x = eval(x);
        this.y = eval(y);
        this.savedX = x;
        this.savedY = y;

        this.width = width;
        this.height = height;
        this.image = image
        this.togglable = togglable;
        this.func = func;

        this.toggle = 0
        if (this.togglable == 1) {this.func(true)} // runs the pressed function with the "init" tag to sync button pressed or released
    }

    render() {
        canvasArea.ctx.fillStyle = "#FFFFFF";

        if (this.togglable == 1) {
            if (this.toggle == 1) {canvasArea.ctx.fillStyle = "#a3a3a3";}
        }

        canvasArea.ctx.strokeStyle = "#BBBBBB";
        canvasArea.ctx.lineWidth = 6;
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

    resize() {
        this.x = eval(this.savedX)
        this.y = eval(this.savedY)
        // console.log("evalled: " + this.savedX)
        // console.log("button position re-evaluated")
    }
}


class Map {
    platforms = [];
    walls = [];
    mapData = [];
    renderedPlatforms = [];
    renderQueue = [];
    wallsToCheck = [];
    checkpoints = [];
    endZoneIsRendered = false;
    name;
    record;
    upperShadowClip = new Path2D();
    behindWallClip = new Path2D();
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
        // this.name = name;

        if (typeof name  === "string"){ // distinguishing between loading a normal map (string) OR a custom map (object)
            this.name = name;
        } else {
            this.name = name.name;
        }
        

        // PARSE JSON DATA. FUNCTION USED BY parseMapData()
        async function getJsonData() { // Taken from: https://www.javascripttutorial.net/javascript-fetch-api/


            // const map = import("/assets/maps/" + name + ".json")
            // return map;


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
        async function parseMapData() {
            
            let jsonData

            if (typeof name  === "string"){ // distinguishing between loading a normal map OR a custom map
                jsonData = await getJsonData(); // SEE ABOVE ^^
            } else {
                jsonData = name
            }


            var playerStart = jsonData.playerStart; // 3 temporary vars that get combined into mapData and pushed out of async function
            var platforms = [];
            var style = jsonData.style;
            var checkpoints = jsonData.checkpoints; // returns an object


            jsonData.platforms.forEach(platform => { // LOOP THROUGH DATA AND ADD EACH PLATFORM TO AN ARRAY
                platforms.push(platform);
            });

            var mapData = [playerStart, platforms, style, checkpoints]; // all the data to be sent out from this async function (platforms, player start, end zone)

            return mapData;
        }


        parseMapData().then(mapData => { // WAITS FOR ASYNC FUNCTION. Big function that handles setting up the map and pre rendering calculations
            this.playerStart = mapData[0];
            this.platforms = mapData[1];
            this.style = mapData[2];
            this.checkpoints = mapData[3];


            // Calculate lighting and shadows for each platform and the endzone
            this.style.lightAngleVector =  new Vector(Math.cos(this.style.lightAngle * (Math.PI/180)), Math.sin(this.style.lightAngle * (Math.PI/180)))
            var shadowX = this.style.lightAngleVector.x * this.style.shadowLength;
            var shadowY = this.style.lightAngleVector.y * this.style.shadowLength;

            var platformIndex = 0 // set this so that it is z-order
            this.platforms.forEach(platform => { // CALCULATE PLATFORMS COLORS and SHADOW POLYGON

                // Setting the colors for platforms, endzones, and walls
                var colorToUse = this.style.platformSideColor;
                if(platform.endzone) {
                    colorToUse = this.style.endZoneSideColor;
                    this.endZone = platform;
                }
                if(platform.wall) {
                    colorToUse = this.style.wallSideColor;
                    // this.platforms.splice(this.platforms.indexOf(platform), 1) // remove from platforms array
                    this.walls.push(platform);
                }

                platform.index = platformIndex; // asigns an index to each platform for debugging
                platformIndex ++;

                // COLORS
                platform.side1Vec = new Vector(-1,0).rotate(platform.angle) // !! DONT need to be properties of platform. only made properties for debug
                platform.side2Vec = new Vector(0,1).rotate(platform.angle)
                platform.side3Vec = new Vector(1,0).rotate(platform.angle)

                platform.sideColor1 = this.calculateShadedColor(platform.side1Vec, colorToUse) // COULD OPTIMIZE. Some sides arent visible at certain platform rotations. Those sides dont need to be calculated
                platform.sideColor2 = this.calculateShadedColor(platform.side2Vec, colorToUse)
                platform.sideColor3 = this.calculateShadedColor(platform.side3Vec, colorToUse)

                // SHADOW POLYGON
                var angleRad = platform.angle * (Math.PI/180);
                var wallShadowMultiplier = platform.wall ? (this.style.wallHeight + this.style.platformHeight) / this.style.platformHeight : 1 // makes sure shadows are longer for taller walls

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
                
                    // top left corner
                    [
                    -((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)),
                    -((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight
                    ],
                
                    // bot left SHADOW
                    [
                    -((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)) + shadowX * wallShadowMultiplier,
                    -((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight + shadowY * wallShadowMultiplier
                    ],

                    // bot right SHADOW
                    [
                    ((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)) + shadowX * wallShadowMultiplier,
                    ((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight + shadowY * wallShadowMultiplier
                    ],
                    
                    // top right SHADOW
                    [
                    ((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)) + shadowX * wallShadowMultiplier,
                    ((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight + shadowY * wallShadowMultiplier
                ],

                // top left SHADOW
                [
                    -((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)) + shadowX * wallShadowMultiplier,
                    -((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + this.style.platformHeight + shadowY * wallShadowMultiplier
                ],
                
            ]; // end of shadowPoints array
            
            
            
            platform.corners = [] // save the first 4 corner coordinates before its modified
            for(let i=0; i < 4; i++) { // taking the first 4
                platform.corners.push([platform.shadowPoints[i][0], platform.shadowPoints[i][1] - this.style.platformHeight]) // take away platformHeight
            }


            if (platform.wall) // add wall's shape to behindWallClip (for drawing player outline behind walls)
            {
                    // corners + wall height points need to be "concated" as serperate variable otherwise they dont stay as points
                    var upperCorners = [
                        [
                            platform.corners[0][0],
                            platform.corners[0][1] - this.style.wallHeight
                        ],
                        [
                            platform.corners[1][0],
                            platform.corners[1][1] - this.style.wallHeight
                        ],
                        [
                            platform.corners[2][0],
                            platform.corners[2][1] - this.style.wallHeight
                        ],
                        [
                            platform.corners[3][0],
                            platform.corners[3][1] - this.style.wallHeight
                        ],
                    ] 

                    var behindWallClipPoints = platform.corners.concat(upperCorners)
            
                    behindWallClipPoints = canvasArea.convexHull(behindWallClipPoints)

                    // ADD TO CLIP SHAPE FOR AREAS BEHIND WALLS
                    // the behindWallClip array can have different lengths so it must dynamicly go through the array of points
                    for (let i = 0; i < behindWallClipPoints.length; i++) {
                        if (i == 0) { // first point in array so use moveTo
                            this.behindWallClip.moveTo(
                                platform.x + platform.width/2 + behindWallClipPoints[i][0], // x
                                platform.y + platform.height/2 + behindWallClipPoints[i][1] // y
                            )
                        } else { // its not the first point in the hull so use lineTo
                            this.behindWallClip.lineTo(
                                platform.x + platform.width/2 + behindWallClipPoints[i][0], // x
                                platform.y + platform.height/2 + behindWallClipPoints[i][1] // y
                            )
                        }
                    }

                    this.behindWallClip.closePath()
                }




                platform.shadowPoints = canvasArea.convexHull(platform.shadowPoints)



                // SHADOW CLIP FOR UPPER PLAYER SHADOW
                this.upperShadowClip.moveTo( // bot left
                    platform.x + platform.width/2 + platform.corners[0][0], // x
                    platform.y + platform.height/2 + platform.corners[0][1] // y
                    )
                
                this.upperShadowClip.lineTo( // bot right
                    platform.x + platform.width/2 + platform.corners[1][0],
                    platform.y + platform.height/2 + platform.corners[1][1]
                )

                this.upperShadowClip.lineTo( // top right
                    platform.x + platform.width/2 + platform.corners[2][0],
                    platform.y + platform.height/2 + platform.corners[2][1]
                )

                this.upperShadowClip.lineTo( // top left
                    platform.x + platform.width/2 + platform.corners[3][0],
                    platform.y + platform.height/2 + platform.corners[3][1]
                )

                this.upperShadowClip.closePath()


                // SORT CORNERS AFTER CREATING SHADOW and behindWall CLIP. called bellow
                function sortCornersX(a, b) {
                    // if return is negative ... a comes first 
                    // if return is positive ... b comes first
                    // return is 0... nothing is changed
                    if (a[0] < b[0]) {return -1;}
                    if (a[0] > b[0]) {return 1;}
                    return 0;
                }

                // platform.corners stays the same for use later is extending the sides. order: BL BR TR TL
                platform.cornersSorted = platform.corners.toSorted(sortCornersX)

                // Create slopes
                platform.horizontalSlope = (platform.corners[2][1] - platform.corners[3][1])/(platform.corners[2][0] - platform.corners[3][0])
                platform.verticalSlope = (platform.corners[2][1] - platform.corners[1][1])/(platform.corners[2][0] - platform.corners[1][0])

                // incase divided by zero and got infinity slope
                if (platform.angle == 0) {platform.verticalSlope = 999999}
                if (Math.abs(platform.angle) == 90) {platform.horizontalSlope = 999999}
                // if (!isFinite(platform.horizontalSlope)) {platform.horizontalSlope > 0 ? platform.horizontalSlope = 999999 : platform.horizontalSlope = -999999}
                // if (!isFinite(platform.verticalSlope)) {platform.verticalSlope > 0 ? platform.verticalSlope = 999999 : platform.verticalSlope = -999999}


            });

            canvasArea.canvas.style.backgroundColor = this.style.backgroundColor;
            document.body.style.backgroundColor = this.style.backgroundColor;
            player = new Player(this.playerStart.x, this.playerStart.y, this.playerStart.angle);

            // Get map record from local storage
            this.record = window.localStorage.getItem("record_" + map.name)

            UserInterface.mapLoaded(); // moves onto gamestate 6
        });
    }

    update() {  // Figure out which platforms are in view. 
                // This is probably were I should check endZoneIsRendered but it's done in render(). Saves an if statement i guess...
                // ALSO where player is slotted into RenderQueue (z-order is determined)

        this.renderedPlatforms = [];
        this.wallsToCheck = [];

        this.platforms.forEach(platform => { // Loop through ALL platforms to get renderedPlatforms
            var hypotenuse = Math.sqrt(platform.width * platform.width + platform.height * platform.height)/2
            var adjustedHeight = platform.wall ? this.style.wallHeight : 0 // for adding height to walls

            if (
                (platform.x + platform.width/2 + hypotenuse + this.style.shadowLength > player.x - midX) && // coming into frame on left side
                (platform.x + platform.width/2 - hypotenuse - this.style.shadowLength < player.x + midX) && // right side
                (platform.y + platform.height/2 + hypotenuse + this.style.shadowLength + this.style.platformHeight > player.y - midY) && // top side
                (platform.y + platform.height/2 - hypotenuse - this.style.shadowLength - adjustedHeight < player.y + midY) // bottom side
            ) {
                this.renderedPlatforms.push(platform); // ADD platform to renderedPlatforms
            }
        }); // end of looping through ALL platforms
        



        // sort and index platforms on load of map
        // platforms only need to be sorted once(given indexes once) and then the player just needs to be slotted in where they belong in the z-order of the render queue which is the map.renderedPlatforms array
        // not true ^^ platform order can change depending on player position / rotation


        var infrontPlayer = []
        var behindPlayer = []
        var indexSplitSpot = 9999 // if it stays 9999 all platforms will be rendered behind player. Kinda acts as the index of the player

        

        this.renderedPlatforms.forEach(platform => { // Loop through RENDERED platforms (will loop through in order of index)
            
            
            // checking if platform is a wall
            // splitting walls into 2 arrays: infrontPlayer[] and behindPlayer[]. 
            // Sort rendered platforms/walls that ARENT checked(not close enough to player) into the appropriate array
            
            
            if (platform.wall) {

                //change to be platform.hypotenuse that is evaled on map load
                var hypotenuse = Math.sqrt(platform.width * platform.width + platform.height * platform.height)/2
                
                if ( // wall is close enough to player that it needs to be checked with player rotation. Could be behind, infront, or colliding with it
                    (platform.x + platform.width/2 + hypotenuse > player.x - 25) && // colliding with player from left
                    (platform.x + platform.width/2 - hypotenuse < player.x + 25) && // right side
                    (platform.y + platform.height/2 + hypotenuse > player.y - 73) && // top side
                    (platform.y + platform.height/2 - hypotenuse - this.style.wallHeight < player.y + 25) // bottom side
                ) { // test for player overlap and rendering z-order tests
                    
                    this.wallsToCheck.push(platform) // for checking if player is colliding with walls in player.updatePos()

                    // convert player angle and get radian version
                    let angle = player.lookAngle.getAngle();
                    let angleRad = angle * (Math.PI/180);
                    

                    // GET PLAYERS LEFTMOST AND RIGHT MOST CORNERS
                    player.leftMostPlayerCornerX = null
                    player.leftMostPlayerCornerY = null
                    player.rightMostPlayerCornerX = null
                    player.rightMostPlayerCornerY = null
                    if (0 <= angle && angle < 90) { // leftMost=bot left        rightMost=top right 
                        player.leftMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        player.leftMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                        player.rightMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        player.rightMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                    }
                    if (90 <= angle && angle < 180) { // leftMost=bot right     rightMost=top left
                        player.leftMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        player.leftMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                        player.rightMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        player.rightMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                    }
                    if (180 <= angle && angle < 270) { // leftMost=top right    rightMost=bot left 
                        player.leftMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        player.leftMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                        player.rightMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        player.rightMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                    }
                    if (270 <= angle && angle < 360) { // leftMost=top left     rightMost=bot right
                        player.leftMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        player.leftMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                        player.rightMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        player.rightMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                    }



                    
                    // get platform.corner x for LEFT MOST corner (start of corners array) NOTE: corner array is in local space
                    platform.leftMostPlatformCornerX = platform.cornersSorted[0][0] + platform.x + platform.width/2 // platform corners are relative to the platforms middle
                    platform.leftMostPlatformCornerY = platform.cornersSorted[0][1] + platform.y + platform.height/2
                    
                    // get platform.corner x for RIGHT MOST corner (end of corners array) NOTE: corner array is in local space
                    platform.rightMostPlatformCornerX = platform.cornersSorted[3][0] + platform.x + platform.width/2 // platform corners are relative to the platforms middle
                    platform.rightMostPlatformCornerY = platform.cornersSorted[3][1] + platform.y + platform.height/2

                    

                    // wall slopes / extensions of axis. Light is horizontal. Dark is vertical
                    // var horizontalAxisExtensionY = platform.y + platform.height/2 + (platform.horizontalSlope * (player.x - (platform.x + platform.width/2)))
                    var horizontalAxisExtensionX = platform.x + platform.width/2 + ((player.y - (platform.y + platform.height/2)) / platform.horizontalSlope)
                    var verticalAxisExtensionX = platform.x + platform.width/2 + ((player.y - (platform.y + platform.height/2)) / platform.verticalSlope)
                    var axisToUse = null
                    
                    /*
                    // SOME OF THESE EXTENSIONS ARE NOT SNAPPED TO Player.x LIKE THE AXIS's ARE
                    // Left Corner Extension
                    // Horizontal (compared with player.y) light pink
                    var leftCornerExtension_Horizontal = platform.leftMostPlatformCornerY + (platform.horizontalSlope * (player.x - (platform.leftMostPlatformCornerX)))
                    // Vertical (compared with player.x) dark pink
                    var leftCornerExtension_Vertical = platform.leftMostPlatformCornerX + ((player.y - (platform.leftMostPlatformCornerY)) / platform.verticalSlope)

                    // Right Corner Extension
                    // Horizontal (compared with player.y) light red
                    var rightCornerExtension_Horizontal = platform.rightMostPlatformCornerY + (platform.horizontalSlope * (player.x - (platform.rightMostPlatformCornerX)))
                    // Vertical (compared with player.x) dark red
                    var rightCornerExtension_Vertical = platform.rightMostPlatformCornerX + ((player.y - (platform.rightMostPlatformCornerY)) / platform.verticalSlope)
                    */

                    // figures out which axis is more vertical
                    if (platform.angle >= 0) {
                        if (platform.leftMostPlatformCornerY >= platform.rightMostPlatformCornerY) { // rightMost corner is higher up
                            axisToUse = "vertical"
                        } else { // platforms leftMost corner is higher up
                            axisToUse = "horizontal"
                        }
                    } else { // if platform.angle < 0
                        if (platform.leftMostPlatformCornerY >= platform.rightMostPlatformCornerY) { // rightMost corner is higher up
                            axisToUse = "horizontal"
                        } else { // platforms leftMost corner is higher up
                            axisToUse = "vertical"
                        }
                    }


                    // VERTICAL AXIS TESTS
                    if (axisToUse == "vertical") {
                        
                        if (verticalAxisExtensionX < player.x) { // walls vertical axis is to the left of player. wall is to the left
    
                                // check player left corner compared to wall's right corner
                                if (platform.rightMostPlatformCornerX > player.leftMostPlayerCornerX && platform.rightMostPlatformCornerY > player.leftMostPlayerCornerY) { // overlapping 
                                    // render wall in front of player
                                    infrontPlayer.push(platform)
                                    if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                                } else {
                                    // render wall normally (behind player)
                                    behindPlayer.push(platform)
                                }
    
    
                            } else { // wall is to the right of player
                                
                                // check player right corner compared to wall's left corner
                                if (platform.leftMostPlatformCornerX < player.rightMostPlayerCornerX && platform.leftMostPlatformCornerY > player.rightMostPlayerCornerY) { // overlapping 
                                    // render wall in front of player
                                    infrontPlayer.push(platform)
                                    if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                                } else {
                                    // render wall normally (behind player)
                                    behindPlayer.push(platform)
                                }
    
                            }
                    }



                    // HORIZONTAL AXIS TESTS
                    if (axisToUse == "horizontal"){

                        if (horizontalAxisExtensionX < player.x) { // walls horizontal axis is to the left of player. wall is to the left (or player is sorta above the horizontal axis)
                        
                            // check player left corner compared to wall's right corner
                            if (platform.rightMostPlatformCornerX > player.leftMostPlayerCornerX && platform.rightMostPlatformCornerY > player.leftMostPlayerCornerY) { // overlapping 
                                // render wall in front of player
                                infrontPlayer.push(platform)
                                if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                            } else {
                                // render wall normally (behind player)
                                behindPlayer.push(platform)
                            }
    
                        } else { // wall is to the right of player
    
                            // check player right corner compared to wall's left corner
                            if (platform.leftMostPlatformCornerX < player.rightMostPlayerCornerX && platform.leftMostPlatformCornerY > player.rightMostPlayerCornerY) { // overlapping 
                                // render wall in front of player
                                infrontPlayer.push(platform)
                                if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                            } else {
                                // render wall normally (behind player)
                                behindPlayer.push(platform)
                            }
                        }
                    }



                    /*

                    if (verticalAxisExtensionX < player.x) { // WALL IS TO THE LEFT
                        
                        // // GETS LEFT MOST PLAYER CORNER
                        // player.leftMostPlayerCornerX = null
                        // player.leftMostPlayerCornerY = null
                        // if (0 <= angle && angle < 90) { // bot left
                        //     player.leftMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        //     player.leftMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                        // }
                        // if (90 <= angle && angle < 180) { // bot right
                        //     player.leftMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        //     player.leftMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                        // }
                        // if (180 <= angle && angle < 270) { // top right
                        //     player.leftMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        //     player.leftMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                        // }
                        // if (270 <= angle && angle < 360) { // top left
                        //     player.leftMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        //     player.leftMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                        // }


                        var cornerExtensionY = platform.rightMostPlatformCornerY + (player.leftMostPlayerCornerX - platform.rightMostPlatformCornerX) * Math.tan(platform.angle * (Math.PI/180))
                        var cornerExtensionX = platform.rightMostPlatformCornerX + (player.leftMostPlayerCornerY - platform.rightMostPlatformCornerY) * Math.tan((180-platform.angle) * (Math.PI/180))
                        

                        if (cornerExtensionX > player.leftMostPlayerCornerX && cornerExtensionY > player.leftMostPlayerCornerY) { // overlapping 
                            // render wall in front of player
                            infrontPlayer.push(platform)
                            if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                        } else {
                            // render wall normally (behind player)
                            behindPlayer.push(platform)
                        }




                    } else { // WALL IS TO THE RIGHT

                        // GETS RIGHT MOST PLAYER CORNER
                        // player.rightMostPlayerCornerX = null
                        // player.rightMostPlayerCornerY = null
                        // if (0 <= angle && angle < 90) { // top right
                        //     player.rightMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        //     player.rightMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                        // }
                        // if (90 <= angle && angle < 180) { // top left
                        //     player.rightMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        //     player.rightMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                        // }
                        // if (180 <= angle && angle < 270) { // bot left
                        //     player.rightMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        //     player.rightMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                        // }
                        // if (270 <= angle && angle < 360) { // bot right
                        //     player.rightMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        //     player.rightMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                        // }



                        var cornerExtensionY = platform.leftMostPlatformCornerY + (player.rightMostPlayerCornerX - platform.leftMostPlatformCornerX) * Math.tan(platform.angle * (Math.PI/180))
                        var cornerExtensionX = platform.leftMostPlatformCornerX + (player.rightMostPlayerCornerY - platform.leftMostPlatformCornerY) * Math.tan((180-platform.angle) * (Math.PI/180))

                        if (cornerExtensionX < player.rightMostPlayerCornerX && cornerExtensionY > player.rightMostPlayerCornerY) { // overlapping 
                            // render wall in front of player
                            infrontPlayer.push(platform)
                            if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                        } else {
                            // render wall normally (behind player)
                            behindPlayer.push(platform)
                        }
                    }

                    */

                } else { // is a wall but not close enough to do a precise check. Sort into correct array based of index

                    if (platform.index > indexSplitSpot) { // platform can also be rendered infront of player
                        infrontPlayer.push(platform)
                    } else {
                        behindPlayer.push(platform)
                    } // will need to sort these

                }
                
            } else { // platform is NOT a wall. Sort into correct array based of index
                
                if (platform.index > indexSplitSpot) { // platform can also be rendered infront of player
                    infrontPlayer.push(platform)
                } else {
                    behindPlayer.push(platform)
                } // need to sort these ?? maybe not?
            }

        }); // end of looping through each rendered platform


        this.renderQueue = behindPlayer.concat(player, infrontPlayer) // combine arrays 
        // console.log(this.renderQueue)


    }

    renderPlatform(platform) { // seperate function to render platforms so that it can be called at different times (ex. called after drawing player inorder to render infront)
        
        const ctx = canvasArea.ctx;
        ctx.strokeStyle = "#000000" // for borders
        ctx.lineJoin = "round"
        ctx.lineWidth = 2
        
        ctx.save();
        ctx.translate(-player.x + midX, -player.y + midY); // move canvas when drawing platforms then restore. midX is center of canvas width

        var adjustedHeight = platform.wall ? this.style.wallHeight : 0 // for adding height to walls

        // DRAW PLATFORM TOP
        ctx.save(); // ROTATING 
        ctx.translate(platform.x + platform.width/2, platform.y + platform.height/2 - adjustedHeight);
        ctx.rotate(platform.angle * Math.PI/180);

        // Change to endzone or wall color if needed. Also where its determined if endzone is being rendered
        if (platform.endzone) {
            ctx.fillStyle = this.style.endZoneTopColor;
            this.endZoneIsRendered = true;
        } else if (platform.wall) {
            ctx.fillStyle = this.style.wallTopColor;
            // this.endZoneIsRendered = true;
        } else {
            ctx.fillStyle = this.style.platformTopColor;
        }
        
        ctx.fillRect(-platform.width/2, -platform.height/2, platform.width, platform.height);


        ctx.beginPath(); // line border on top
        ctx.rect(-platform.width/2, -platform.height/2, platform.width, platform.height)
        ctx.closePath();
        ctx.stroke();

        ctx.restore(); // restores platform rotation NOT translation


        // SIDES OF PLATFORMS
        ctx.save();
        ctx.translate(platform.x + platform.width/2, platform.y + platform.height/2);

        var angleRad = platform.angle * (Math.PI/180);
        

        // platform angles should only be max of 90 and -90 in mapData
        // calculating shading works with any angle but sides arent draw because drawing "if statements" are hardcoded to 90 degrees


        if (-90 < platform.angle && platform.angle < 90) { // ALMOST ALWAYS RENDER BOTTOM SIDE. side2
            
            ctx.fillStyle = platform.sideColor2; // sideColor2
            ctx.beginPath();
            ctx.moveTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // bot right
            ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // bot left
            ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
            ctx.lineTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }


        if (0 < platform.angle && platform.angle <= 90) { // side3

            ctx.fillStyle = platform.sideColor3; // sideColor3
            ctx.beginPath();
            ctx.moveTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // bot right
            ctx.lineTo(platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // top right
            ctx.lineTo(platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
            ctx.lineTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

        }

        if (-90 <= platform.angle && platform.angle < 0) { // side1

            ctx.fillStyle = platform.sideColor1; // sideColor1  
            ctx.beginPath();
            ctx.moveTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // bot left
            ctx.lineTo(-platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // top left
            ctx.lineTo(-platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
            ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + this.style.platformHeight);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

        }

        // PLAFORM RENDERING DEBUG TEXT
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "12px sans-serif"
        ctx.fillText("index: " + platform.index, 0, 0);
        // ctx.fillText("renderIndex: " + this.renderedPlatforms.indexOf(platform), 0, 0)
        ctx.fillText("angle: " + platform.angle, 0, 20);
        // ctx.fillText("position: " + platform.x + ", " + platform.y, 0 , 40)
        ctx.fillText("width / height: " + platform.width + ", " + platform.height, 0 , 40)
        ctx.fillText("slope vert: " + platform.verticalSlope, 0, 60)
        ctx.fillText("slope horz: " + platform.horizontalSlope, 0, 80)

        
        ctx.restore(); // resets back from platform local space. player view space??
        

        // Centered Axis
        ctx.fillStyle = "lime"
        // old one that snaps to player.x not player.y
        // ctx.fillRect(player.x, platform.y + platform.height/2 + (platform.horizontalSlope * (player.x - (platform.x + platform.width/2))), 5, 5)
        ctx.fillRect(platform.x + platform.width/2 + ((player.y - (platform.y + platform.height/2)) / platform.horizontalSlope), player.y, 5, 5)


        ctx.fillStyle = "green"
        ctx.fillRect(platform.x + platform.width/2 + ((player.y - (platform.y + platform.height/2)) / platform.verticalSlope), player.y, 5, 5)

        /*
        // Left Corner Extension
        // Horizontal
        ctx.fillStyle = "deeppink"
        ctx.fillRect(player.x, platform.leftMostPlatformCornerY + (platform.horizontalSlope * (player.x - (platform.leftMostPlatformCornerX))), 5, 5)
        // Vertical
        ctx.fillStyle = "darkorchid"
        ctx.fillRect(platform.leftMostPlatformCornerX + ((player.y - (platform.leftMostPlatformCornerY)) / platform.verticalSlope), player.y, 5, 5)


        // Right Corner Extension
        // Horizontal
        ctx.fillStyle = "sandybrown"
        ctx.fillRect(player.x, platform.rightMostPlatformCornerY + (platform.horizontalSlope * (player.x - (platform.rightMostPlatformCornerX))), 5, 5)
        // Vertical
        ctx.fillStyle = "red"
        ctx.fillRect(platform.rightMostPlatformCornerX + ((player.y - (platform.rightMostPlatformCornerY)) / platform.verticalSlope), player.y, 5, 5)
        */


        ctx.fillStyle = "white"


        // drawing wall z-order debug POINTS
        ctx.fillStyle = "#FF00FF" // left and right most corners (pink)
        ctx.fillRect(platform.leftMostPlatformCornerX - 2, platform.leftMostPlatformCornerY - 2, 4, 4)
        ctx.fillRect(platform.rightMostPlatformCornerX - 2, platform.rightMostPlatformCornerY - 2, 4, 4)
        ctx.fillStyle = "#0000FF" // center (blue)
        ctx.fillRect(platform.x + platform.width/2 - 2, platform.y + platform.height/2 - 2, 4, 4)

        
        ctx.restore(); // resets back to global space
    }

    render() { // Render the platforms that are in view (and player lower shadow)
    
        this.endZoneIsRendered = false; // resets every frame. if the endzone is being rendered it activates it. otherwise it stays false

        const ctx = canvasArea.ctx;

        ctx.save();
        ctx.translate(-player.x + midX, -player.y + midY); // move canvas when drawing platforms then restore. midX is center of canvas width


        // DRAWING LOWER PLAYER SHADOW
        ctx.save(); // Saves the state of the canvas for drawing player shadow. Weird to draw it here but whatever. Could also put this above the first translate ^^
        ctx.translate(player.x , player.y + this.style.platformHeight)
        ctx.rotate(player.lookAngle.getAngle() * Math.PI/180); // rotating canvas

        ctx.fillStyle = this.style.shadowColor;
        // ctx.fillStyle = "green";
        // var blurValue = player.jumpValue / 16 + 1
        // ctx.filter = "blur(" + blurValue + "px)";
        ctx.fillRect(-15, -15, 30, 30)
        // ctx.filter = "none";
        ctx.restore(); // restore back to top corner of map for drawing the platforms



        // LOOP THROUGHT TO DRAW PLATFORMS LOWER SHADOWS
        this.renderedPlatforms.forEach(platform => { 

            ctx.save();
            ctx.translate(platform.x + platform.width/2, platform.y + platform.height/2);

            ctx.fillStyle = this.style.shadowColor;

            // ctx.filter = "blur(2px)"; // start blur
            ctx.beginPath();
            
            ctx.moveTo(platform.shadowPoints[0][0], platform.shadowPoints[0][1]); // this comes up in debug a lot
            for (let i = platform.shadowPoints.length - 1; i > 0; i --) {
                ctx.lineTo(platform.shadowPoints[i][0], platform.shadowPoints[i][1]);
            }

            ctx.closePath();
            ctx.fill();

            // ctx.filter = "none"; // end blur

            ctx.restore();
        })


        this.checkpoints.forEach(checkpoint => { // draw line to show checkpoint triggers
            ctx.beginPath(); 
            ctx.moveTo(checkpoint.triggerX1, checkpoint.triggerY1);
            ctx.lineTo(checkpoint.triggerX2, checkpoint.triggerY2);
            ctx.stroke();
        });


        ctx.restore(); // RESTORING VIEW FOLLOWING PLAYER I THINK
    }
}


class InputHandler {
    dragAmountX = 0;
    dragAmountY = 0;
    previousX = 0;
    previousY = 0;
    touchX = 0;
    touchY = 0;
    dragging = false;
    pinching = false;
    pinchAmount = 0;
    currentDragID = null;


    constructor(){
        var scrolled = false; // if scrolled==true UserInterface.touchReleased isnt sent

        window.addEventListener("touchstart", e => {

            if (e.touches.length === 2) {
                this.pinching = true;
            }
            
            for (let i = 0; i < e.changedTouches.length; i++){ // for loop needed incase multiple touches are sent in the same frame

                if (this.dragging == false) { // if this should be the new dragging touch
                    this.currentDragID = e.changedTouches[i].identifier;
                    this.dragging = true;
                    scrolled = false; // if scrolled==true UserInterface.touchReleased isnt sent

                    this.touchX = e.changedTouches[i].pageX;
                    this.touchY = e.changedTouches[i].pageY;
                    this.previousX = e.changedTouches[i].pageX;
                    this.previousY = e.changedTouches[i].pageY;

                }
            }
        });


        window.addEventListener("touchmove", e => {
            for (let i = 0; i < e.changedTouches.length; i++){ // for loop needed incase multiple touches are sent in the same frame

                if (e.changedTouches[i].identifier == this.currentDragID) { // if this touch is the dragging touch
                    this.touchX = e.changedTouches[i].pageX;
                    this.touchY = e.changedTouches[i].pageY;
                    scrolled = true; // if scrolled==true UserInterface.touchReleased isnt sent
                }

                if (this.dragging == false) { // if main drag is released but theres another to jump to
                    this.currentDragID = e.changedTouches[i].identifier;
                }

                if (this.pinching) {
                    // calculatePinchAmount
                    // OKAY MAYBE KILL THE PINCH IDEA
                }

    
            }

        });


        window.addEventListener("touchcancel", e => { // Fixes tripple tap bugs by reseting everything
            this.currentDragID = null;
            this.dragging = false;
            this.pinching = false;
        });

        window.addEventListener("touchend", e => {

            for (let i = 0; i < e.changedTouches.length; i++){ // for loop needed incase multiple touches are sent in the same frame

                if (this.dragging && e.changedTouches[i].identifier == this.currentDragID) { // might not need to check if dragging is true here
                    
                    if (e.touches.length == 0) {

                        this.currentDragID = null;
                        this.dragAmountX = 0;
                        this.dragAmountY = 0;
                        this.touchX = 0;
                        this.touchY = 0;
                        this.previousX = 0;
                        this.previousY = 0;
                        this.dragging = false;
                        this.pinching = false;


                    } else {
                        this.currentDragID = e.touches[0].identifier
                        this.touchX = e.touches[0].pageX;
                        this.touchY = e.touches[0].pageY;
                        this.previousX = e.touches[0].pageX;
                        this.previousY = e.touches[0].pageY;
                    }
                }

                // if (scrolled == false) {
                    UserInterface.touchReleased(e.changedTouches[i].pageX, e.changedTouches[i].pageY); // sends touchRealease for every release
                // }
            
            }



        });
    }

    update() {
        if (this.dragging == true) {
            this.dragAmountX = this.touchX - this.previousX;
            this.dragAmountY = this.touchY - this.previousY;
            this.previousY = this.touchY;
            this.previousX = this.touchX;
        }

        // FOR TESTING
        // this.dragAmountX = 2 * dt;
        // console.log(2 * dt)
    }

}


class Player {
    jumpValue = 0;
    jumpVelocity = 2;
    endSlow = 1;
    gain = 0;
    checkpointIndex = -1;
    posInRenderQueue = null; // Not Used

    currentSpeedProjected = 0;
    addSpeed = 0; // initialized here so that userInterface can access for debug

    // new movement code that uses real quake / source movement
    // https://adrianb.io/2015/02/14/bunnyhop.html
    // https://www.youtube.com/watch?v=v3zT3Z5apaM
    // https://www.youtube.com/watch?v=rTsXO6Zicls
    // https://www.youtube.com/watch?v=rTsXO6Zicls
    // https://steamcommunity.com/sharedfiles/filedetails/?id=184184420
    // https://github.com/myria666/qMovementDoc/blob/main/Quake_s_Player_Movement.pdf

    wishDir = new Vector(0,0);   // left (-1,0) vector OR right (1,0) vector that is rotated by the change in angle that frame. 
                                //if angle change is postive use Right vec. Negative use left vec
                                // normalized left and right vectors act as if strafe keys were pressed 

    velocity = new Vector(0,0);

    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.restartX = x;
        this.restartY = y;
        this.lookAngle = new Vector(1,0)
        this.lookAngle = this.lookAngle.rotate(angle)
        this.restartAngle = angle;
    }

    render() {
        
        const ctx = canvasArea.ctx;
        
        ctx.strokeStyle = "#000000" // borders
        ctx.lineJoin = "round"
        ctx.lineWidth = 1

        ctx.save(); // Saves the state of the canvas
        
        ctx.translate(midX, midY);


        // LOWER SHADOW IS DRAWN BY MAP
        // DRAWING UPPER SHADOW HERE \/
        ctx.save()
        
        ctx.translate(-player.x, -player.y)
        ctx.clip(map.upperShadowClip);
        ctx.translate(player.x , player.y);
    
        ctx.rotate(this.lookAngle.getAngle() * Math.PI/180)

        ctx.fillStyle = map.style.shadowColor;
        // var blurValue = player.jumpValue / 16 + 1
        // ctx.filter = "blur(" + blurValue + "px)";
        ctx.fillRect(-15, -15, 30, 30)
        // ctx.filter = "none";

        ctx.restore() // clears upperShadowClip

        // DRAWING PLAYER TOP
        ctx.translate(0, -this.jumpValue - 32); 
        ctx.rotate(this.lookAngle.getAngle() * Math.PI/180) // rotating canvas
        ctx.fillStyle = map.style.playerColor;
        ctx.fillRect(-16,-16,32,32)

        // Draw players top arrow
        ctx.strokeStyle = "#00000030";
        ctx.lineWidth = 2

        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -7);
        ctx.lineTo(-5, 7);
        ctx.lineTo(8, 0)
        ctx.stroke();

        ctx.strokeStyle = "#000000"; // resetting
        ctx.lineWidth = 1

        
        // draw border
        ctx.beginPath();
        ctx.rect(-16,-16,32,32)
        ctx.stroke();

        // ctx.drawImage(document.getElementById("playerTop"), -16, -16);

        ctx.restore(); // leaves players space translation AND rotation AND jump value translation


        // SIDES OF PLAYER
        ctx.save();

        var angleRad = this.lookAngle.getAngle() * (Math.PI/180);
        var loopedAngle = this.lookAngle.getAngle();


        // GETTING CORNERS OF ROTATED RECTANGLE
        // https://stackoverflow.com/questions/41898990/find-corners-of-a-rotated-rectangle-given-its-center-point-and-rotation

        if (loopedAngle > 270 || loopedAngle < 90) { // BOT WALL

            var sideVector = new Vector(0,1).rotate(this.lookAngle.getAngle())
            ctx.fillStyle = map.calculateShadedColor(sideVector, map.style.playerColor)

            ctx.beginPath();
            ctx.moveTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        if (0 < loopedAngle && loopedAngle < 180) { // RIGHT WALL

            var sideVector = new Vector(1,0).rotate(this.lookAngle.getAngle())
            ctx.fillStyle = map.calculateShadedColor(sideVector, map.style.playerColor)

            ctx.beginPath();
            ctx.moveTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        if (90 < loopedAngle && loopedAngle < 270) { // TOP WALL
            
            var sideVector = new Vector(0,-1).rotate(this.lookAngle.getAngle())
            ctx.fillStyle = map.calculateShadedColor(sideVector, map.style.playerColor)
            
            ctx.beginPath();
            ctx.moveTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        if (180 < loopedAngle && loopedAngle < 360) { // LEFT WALL

            var sideVector = new Vector(-1,0).rotate(this.lookAngle.getAngle())
            ctx.fillStyle = map.calculateShadedColor(sideVector, map.style.playerColor)

            ctx.beginPath();
            ctx.moveTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - 32 - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad))));
            ctx.lineTo(midX - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad))), midY - this.jumpValue - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad))));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }


        ctx.restore(); 
    
    }

    startLevel() {
        this.velocity.set(6,0); // 6,0
        this.velocity = this.velocity.rotate(this.lookAngle.getAngle());
    }

    updatePos(dt) {  // NEEDS TO BE FPS INDEPENDENT
        
        if (UserInterface.levelState == 1 || UserInterface.levelState == 2) { // if NOT at end screen

            this.lookAngle = this.lookAngle.rotate(touchHandler.dragAmountX * UserInterface.sensitivity)
            
            // Setting wishDir
            if (touchHandler.dragAmountX > 0) {
                this.wishDir = this.lookAngle.rotate(90) // look angle is already a normalized
                this.wishDir.normalize(maxVelocity) // changes the length to be maxVelocity
            }

            if (touchHandler.dragAmountX < 0) {
                this.wishDir = this.lookAngle.rotate(-90) // look angle is already a normalized
                this.wishDir.normalize(maxVelocity) // changes the length to be maxVelocity
            }

            if (touchHandler.dragAmountX == 0) {this.wishDir.set(0,0)}
        
        }

        if (UserInterface.levelState == 2) { // 1 = pre-start, 2 = playing level, 3 = in endzone

            // ALL MOVEMENT CALCULATIONS
            // THIS IS VIDEO VERSION OF QUAKE1 CODE	

            this.currentSpeedProjected = this.velocity.dotProduct(this.wishDir); // Vector projection of Current_velocity onto wishDir

            // addSpeed is clipped between 0 and MAX_ACCEL * dt  --- addSpeed should only be 0 when wishDir is 0
            this.addSpeed = maxVelocity - this.currentSpeedProjected; // sometimes currentSpeedProj is negative
            
            // this is a hack to make gain consistent between fps changes BAD BAD BAD BS
            // https://www.desmos.com/calculator/k1uc1yai14
            this.addSpeed *= (0.25 * (Math.cbrt(dt)+3)) 
            
            if (this.addSpeed > airAcceleration * dt) {this.addSpeed = airAcceleration * dt; console.log("maxspeed clipped by AA")} // addspeed is to big and needs to be limited by airacceleration value
            if (this.addSpeed <= 0) {this.addSpeed = 0; console.log("zero addspeed")} // currentSpeedProjected is greater than max_speed. dont add speed
            
        
            // addSpeed is a scaler for wishdir. if addspeed == 0 no wishdir is applied
            this.velocity.x += (this.wishDir.x * this.addSpeed)
            this.velocity.y += (this.wishDir.y * this.addSpeed)
            // addSpeed needs to be adjusted by dt. Bigger dt, less fps, bigger addSpeed


            // APPLYING VELOCITY
            this.x += this.velocity.x / 5 * dt;
            this.y += this.velocity.y / 5 * dt;



            
            // JUMPING
            if (this.jumpValue < 0) { 
                this.jumpValue = 0;
                this.jumpVelocity = 2;
                AudioHandler.jump();
                if (!this.checkCollision(map.renderedPlatforms)) {
                    AudioHandler.splash();
                    // this.teleport();
                }
            } else {
                this.jumpValue += this.jumpVelocity * dt;
                this.jumpVelocity -= gravity * dt;
            }


            // CHECK IF COLLIDING WITH WALLS
            if (this.checkCollision(map.wallsToCheck)) {
                AudioHandler.splash();
                this.teleport();
            }
    


            // CHECK if colliding with checkpoint triggers
            map.checkpoints.forEach(checkpoint => {
                
                var distance = pDistance(this.x, this.y, checkpoint.triggerX1, checkpoint.triggerY1, checkpoint.triggerX2, checkpoint.triggerY2)
                // console.log("distance to " + checkpoint + ": " + distance)

                if (distance <= 16) { // COLLIDING WITH CP TRIGGER
                    this.checkpointIndex = map.checkpoints.indexOf(checkpoint) // could do this with a callback index function?
                    // console.log(this.checkpointIndex);
                }

                // gets minumum distance to line segment from point: https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
                function pDistance(x, y, x1, y1, x2, y2) { 

                    var A = x - x1;
                    var B = y - y1;
                    var C = x2 - x1;
                    var D = y2 - y1;

                    var dot = A * C + B * D;
                    var len_sq = C * C + D * D;
                    var param = -1;
                    if (len_sq != 0) //in case of 0 length line
                        param = dot / len_sq;

                    var xx, yy;

                    if (param < 0) {
                        xx = x1;
                        yy = y1;
                    }
                    else if (param > 1) {
                        xx = x2;
                        yy = y2;
                    }
                    else {
                        xx = x1 + param * C;
                        yy = y1 + param * D;
                    }

                    var dx = x - xx;
                    var dy = y - yy;
                    return Math.sqrt(dx * dx + dy * dy);
                }
            });

            // CHECK IF COLLIDING WITH ENDZONE
            if (map.endZoneIsRendered) { 
                if (this.checkCollision([map.endZone])) {
                    AudioHandler.success();
                    UserInterface.handleRecord();
                    UserInterface.levelState = 3;
                }
            }
        }

        if (UserInterface.levelState == 3) { // SLOW DOWN MOVEMENT AFTER HITTING END ZONE
            // if (this.endSlow > 0.02) {this.endSlow = (this.endSlow * 0.95);} else {this.endSlow = 0} // THIS NEEDS TO BE FPS INDEPENDENT
            if (this.endSlow > 0.02) {this.endSlow = (this.endSlow - 0.02 * dt);} else {this.endSlow = 0}

            this.x += this.velocity.x/5 * dt * this.endSlow; // MOVE FORWARD AT ANGLE BASED ON VELOCITY
            this.y += this.velocity.y/5 * dt * this.endSlow;
        
            if (this.jumpValue < 0) { // JUMPING
                this.jumpValue = 0;
                this.jumpVelocity = 2;
            } else {
                this.jumpValue += this.jumpVelocity * dt * this.endSlow;
                this.jumpVelocity -= gravity * dt * this.endSlow;
            }
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
                new Rectangle(player.x-16, player.y-16, 32, 32, player.lookAngle.getAngle()),
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

    teleport() { // Called when player hits the water
        if (this.checkpointIndex !== -1) {
            this.x = map.checkpoints[this.checkpointIndex].x;
            this.y = map.checkpoints[this.checkpointIndex].y;
            this.lookAngle.set(1,0)
            this.lookAngle = this.lookAngle.rotate(map.checkpoints[this.checkpointIndex].angle)
            this.velocity.set(2,0)
            this.velocity = this.velocity.rotate(this.lookAngle.getAngle())
            this.jumpValue = 0;
            this.jumpVelocity = 2;
        } else {
            btn_restart.pressed();
        }
    }

    restart() { // Called when user hits restart button (not when teleported from water)
        this.x = this.restartX;
        this.y = this.restartY;
        this.lookAngle.set(1,0)
        this.lookAngle = this.lookAngle.rotate(this.restartAngle)
        this.velocity.set(0,0)
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

    set = function(x,y) {
        this.x = x;
        this.y = y;
        // should add angle
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

    dotProduct = function(otherVec) { // ONLY FOR 2D Vectors. Projects Parent Vector onto otherVec
        return (this.x * otherVec.x) + (this.y * otherVec.y)
    }

    magnitude = function() {
        return Math.sqrt((this.x ** 2) + (this.y ** 2))
    }

    rotate = function(ang) // angle in degrees. returns new array -- doesnt modify existing one. It seems to incriment by the angle
    {
        ang = ang * (Math.PI/180);
        var cos = Math.cos(ang);
        var sin = Math.sin(ang);
        return new Vector(Math.round(10000*(this.x * cos - this.y * sin))/10000, Math.round(10000*(this.x * sin + this.y * cos))/10000);
    }

    angleDifference = function(otherVec) { // returns degrees i guess idk
        return Math.acos((this.dotProduct(otherVec)) / (this.magnitude() * otherVec.magnitude()))
    }

    getAngle = function() { // RETURNS ANGLE IN DEGREES. https://stackoverflow.com/questions/35271222/getting-the-angle-from-a-direction-vector
        var angle = Math.atan2(this.y, this.x);   //radians
        // you need to divide by PI, and MULTIPLY by 180:
        var degrees = 180 * angle/Math.PI;  //degrees
        return (360+Math.round(degrees))%360; //round number, avoid decimal fragments
    }

    normalize = function(multiplier) { // NOTE: requires multiplier
        if (this.length !== 0) {
            var n = this.divide(this.magnitude()); // dont ever want to normalize when vector length is zero
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
        
        dt = (performance.now() - prevDateNow)/10; // Delta Time for FPS independence. dt = amount of milliseconds between frames
        prevDateNow = performance.now();

        player.updatePos(dt) // dont need dt
        
        // Map sorts all in view platforms, walls, and player
        // places the player.posInRenderQueue where it belongs
        map.update();
    };
    
    if (UserInterface.gamestate == 7) {
        // could only update if user is touching (no?)
        MapEditor.update();
    }
    
    
    
    
    // RENDERING OBJECTS
    canvasArea.clear();

    if (UserInterface.gamestate == 6) {
        
        // should be called map.renderLowerShadows or map.renderBackground
        map.render(); // draws player lower shadow and platform lower shadows. also draws checkpoints (draw walls' upper shadows elsewhere)

        canvasArea.renderTheQueue()
        
    }
    

    if (UserInterface.gamestate == 7) {
        MapEditor.render();
    }

    UserInterface.render(dt);

}


//      :)