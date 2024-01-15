document.addEventListener("deviceready", onDeviceReady, false);

const airAcceleration = 4; // the sharpness your allowed to turn at
const maxVelocity = 1.12; // basically the rate at which speed is gained / lost. wishDir is scaled to this magnitude
const gravity = 0.05;
let prevDateNow;
let dt = 1;

let midX = 0;
let midY = 0;

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


const canvasArea = { //Canvas Object
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


    convexHull: function(points) {

        function cross(a, b, o) {
            return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
         }

        points.sort(function(a, b) {
           return a[0] == b[0] ? a[1] - b[1] : a[0] - b[0];
        });
     
        const lower = [];
        for (let i = 0; i < points.length; i++) {
           while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
              lower.pop();
           }
           lower.push(points[i]);
        }
     
        const upper = [];
        for (let i = points.length - 1; i >= 0; i--) {
           while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
              upper.pop();
           }
           upper.push(points[i]);
        }
     
        upper.pop();
        lower.pop();
        return lower.concat(upper);
    },


    HSLToRGB: function(h, s, l, alpha) {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n =>
          l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        // return [255 * f(0), 255 * f(8), 255 * f(4), alpha];
        return "rgba(" + Math.round(255 * f(0)) + "," + Math.round(255 * f(8)) + "," + Math.round(255 * f(4)) + "," + alpha + ")"
    },


    calculateShadedColor(sideNormalVector, color) {
        let lightAngleVector;
        let shadowContrastLight;
        let shadowContrastDark;

        if (typeof map !== "undefined") { // if map is loaded or in PreviewWindow
            lightAngleVector = map.style.lightAngleVector
            shadowContrastLight = map.style.shadowContrastLight
            shadowContrastDark = map.style.shadowContrastDark
        } else {
            lightAngleVector = MapEditor.loadedMap.style.lightAngleVector
            shadowContrastLight = MapEditor.loadedMap.style.shadowContrastLight
            shadowContrastDark = MapEditor.loadedMap.style.shadowContrastDark
        }

        let darkness = 180 - (sideNormalVector.angleDifference(lightAngleVector) * (180/Math.PI));
    
        // MAP TO RANGE: https://stackoverflow.com/questions/10756313/javascript-jquery-map-a-range-of-numbers-to-another-range-of-numbers
        // (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
        darkness = (darkness) * (shadowContrastDark - shadowContrastLight) / 180 + shadowContrastLight;

        // USED TO BRIGHTEN AND DARKEN COLORS. p = percent to brighten/darken. c = color in rgba
        // https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
        function RGB_Linear_Shade(p,c) {
        var i=parseInt,r=Math.round,[a,b,c,d]=c.split(","),P=p<0,t=P?0:255*p,P=P?1+p:1-p; // not sure why i needs to be decalared as "var" here instead of "let"
        return"rgb"+(d?"a(":"(")+r(i(a[3]=="a"?a.slice(5):a.slice(4))*P+t)+","+r(i(b)*P+t)+","+r(i(c)*P+t)+(d?","+d:")");
        }

        return RGB_Linear_Shade(darkness, color)
    },

}


const UserInterface = {
    
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

    start : function() { // where all buttons are created

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
        btn_play = new Button("midX - 90", 130, 180, "play_button", "play_button_pressed", 0, function() { 
            UserInterface.gamestate = 2;
            UserInterface.renderedButtons = [btn_mainMenu, btn_custom_maps, btn_level_original, btn_level_noob, btn_level_hellscape]
            UserInterface.renderedButtons.forEach(button => {
                button.resize();
            });
        })

        btn_settings = new Button("midX - 106", 220, 212, "settings_button", "settings_button_pressed", 0, function() {
            UserInterface.gamestate = 3;
            UserInterface.renderedButtons = [btn_mainMenu, btn_sensitivitySlider, btn_volumeSlider, btn_debugText, btn_strafeHUD, btn_reset_settings] // debugText and strafeHud shouldnt be this accessible
            UserInterface.renderedButtons.forEach(button => {
                button.resize();
            });
        })

        btn_mapEditor = new Button("midX - 122", 310, 244, "map_editor_button", "map_editor_button_pressed", 0, function() {
            UserInterface.gamestate = 7;
            UserInterface.renderedButtons = [btn_mainMenu, btn_new_map, btn_load_map]
            UserInterface.renderedButtons.forEach(button => {
                button.resize();
            });
        })


        // SETTINGS Buttons 
        btn_reset_settings = new Button("canvasArea.canvas.width - 150", "canvasArea.canvas.height - 150", 80, "reset_button", "reset_button_pressed", 0, function() {
            window.localStorage.removeItem("record_original") // loop through all maps here
            window.localStorage.removeItem("record_noob")
            window.localStorage.removeItem("record_hellscape")

            UserInterface.sensitivity = 1
            window.localStorage.setItem("sensitivity_storage", 1)
            btn_sensitivitySlider.updateState(1)
        
            UserInterface.debugText = 0
            window.localStorage.setItem("debugText_storage", 0)
            btn_debugText.func(true)

            UserInterface.strafeHUD = 0
            window.localStorage.setItem("strafeHUD_storage", 0)
            btn_strafeHUD.func(true)

            UserInterface.volume = 0.5
            window.localStorage.setItem("volume_storage", 0.5)
            btn_volumeSlider.updateState(0.5)
            
            console.log("records and settings cleared")

        })

        btn_sensitivitySlider = new SliderUI(180, 100, 300, 0.1, 3, 10, "Sensitivity", "white", UserInterface.sensitivity, function() { 
            UserInterface.sensitivity = this.value
            window.localStorage.setItem("sensitivity_storage", this.value)
        })

        btn_volumeSlider = new SliderUI(180, 200, 300, 0, 1, 10, "Volume", "white", UserInterface.volume, function() { 
            UserInterface.volume = this.value
            window.localStorage.setItem("volume_storage", this.value)
            AudioHandler.setVolumes();
        })

        btn_debugText = new Button(310, 240, 80, "checkbox", "checkbox_pressed", 1, function(sync) {
            if (sync) {
                    this.toggle = UserInterface.debugText;
            } else {
                if (this.toggle == 1) {
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

        btn_strafeHUD = new Button(310, 300, 80, "checkbox", "checkbox_pressed", 1, function(sync) {
            if (sync) {
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
                        "backgroundColor": "rgba(163,213,225,1)",
                        "playerColor": "rgba(239,238,236,1)",
                        "platformTopColor": "rgba(209,70,63,1)",
                        "platformSideColor": "rgba(209,70,63,1)",
                        "wallTopColor": "rgba(125, 94, 49, 1)",
                        "wallSideColor": "rgba(125, 94, 49, 1)",
                        "endZoneTopColor": "rgba(255,218,98,1)",
                        "endZoneSideColor": "rgba(255,218,98,1)",
                        "shadowColor": "rgba(7,7,10,0.25)",
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
            
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            document.body.appendChild(input);
            input.click();
            
            input.addEventListener('change', function () {
                const file = input.files[0]
                
                const reader = new FileReader();
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

            const map = MapEditor.loadedMap;

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


            const savemap = confirm("Save Map?");
            if (savemap) {
                // RE-ENABLE TO DOWNLOAD MAPS ON EXIT (SHOULD PROMT IF WANT TO SAVE and NAME MAP)
                downloadObjectAsJson(downloadMap, "custom_map");
            }

            function downloadObjectAsJson(exportObj, exportName) { // https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser
                exportName = prompt("Enter Map Name");
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", exportName + ".json");
                document.body.appendChild(downloadAnchorNode); // required for firefox
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            }

            MapEditor.editorState = 0;
            MapEditor.loadedMap = null;
            MapEditor.screenX = 0
            MapEditor.screenY = 0
            MapEditor.scrollX_vel = 0, // for smooth scrolling 
            MapEditor.scrollY_vel = 0,
            MapEditor.renderedPlatforms = [], // dont actually need to reset all this shit
            UserInterface.renderedButtons = [btn_mainMenu, btn_new_map, btn_load_map]
            MapEditor.selectedPlatformIndex = -1;

        })
        
        btn_add_platform = new Button("canvasArea.canvas.width - 240", "20", 200, "platform_button", "platform_button_pressed", 0, function() {
            
            const newPlatform = {
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
            UserInterface.renderedButtons = [btn_exit_edit, btn_unselect, btn_delete_platform, btn_translate, btn_resize, btn_angleSlider, btn_wall]
            
            // SYNC ALL BUTTONS AND SLIDERS
            btn_translate.func() // intially syncs the buttons position to the selected platform. Called whenever screen is scrolled too. not really needed here but avoids a 1 frame flash 
            btn_resize.func()
            btn_angleSlider.updateState(MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].angle)
            btn_wall.func(true) // syncs the wall button's toggle state
        })

        btn_map_colors = new Button("canvasArea.canvas.width - 400", "20", 125, "map_colors_button", "map_colors_button_pressed", 0, function() {
            MapEditor.editorState = 3 // map settings
            
            PreviewWindow.update(PreviewWindow.platform)
            PreviewWindow.update(PreviewWindow.wall)
            PreviewWindow.update(PreviewWindow.endzone)


            UserInterface.renderedButtons = [
                btn_mainMenu, 
                btn_hueSlider, 
                btn_saturationSlider, 
                btn_lightnessSlider, 
                btn_alphaSlider, 
                
                btn_backgroundColor,
                btn_playerColor,
                btn_platformTopColor,
                btn_platformSideColor,
                btn_wallTopColor,
                btn_wallSideColor,
                btn_endZoneTopColor,
                btn_endZoneSideColor,
                btn_shadowColor,

            ];
            // btn_mainMenu.resize()
        })

        btn_unselect = new Button("canvasArea.canvas.width - 210", "25", 60, "x_button", "x_button_pressed", 0, function() {
            
            MapEditor.selectedPlatformIndex = -1; // No selected platform
            UserInterface.renderedButtons = [btn_exit_edit, btn_add_platform, btn_map_colors]
        })

        btn_translate = new Button(0, 0, 45, "translate_button", "translate_button_pressed", 0, function() {
            let platform = MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex]
            
            if (this.isPressed) {
                platform.x += touchHandler.dragAmountX
                platform.y += touchHandler.dragAmountY
            }

            this.x =  MapEditor.screenX + platform.x + platform.width/2 - this.width/2
            this.y =  MapEditor.screenY + platform.y + platform.height/2 - this.height/2
            
        })

        btn_resize = new Button(0, 0, 35, "translate_button", "translate_button_pressed", 0, function() {

            let platform = MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex]

            // bot right corner
            const angleRad = platform.angle * (Math.PI/180);
            const cornerX =  ((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad))
            const cornerY = ((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad))

            if (this.isPressed && touchHandler.dragging) {
                this.x = touchHandler.touchX - this.width/2
                this.y = touchHandler.touchY - this.height/2

                platform.width = Math.round(this.x - platform.x + platform.width/2 - cornerX - MapEditor.screenX)
                if (platform.width < 10) {platform.width = 10}
                platform.height = Math.round(this.y - platform.y + platform.height/2 - cornerY - MapEditor.screenY)
                if (platform.height < 10) {platform.height = 10}

            } else { // not touching -- just set it to default position
                this.x = platform.x + platform.width/2 + cornerX + MapEditor.screenX
                this.y = platform.y + platform.height/2 + cornerY + MapEditor.screenY
            }

            
        })

        btn_angleSlider = new SliderUI("canvasArea.canvas.width - 205", "205", 170, -50, 50, 1, "Angle", "black", MapEditor.loadedMap ? MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex] : 0, function() { 
            MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].angle = this.value
        })

        btn_wall = new Button("canvasArea.canvas.width - 90", "225", 40, "checkbox", "checkbox_pressed", 1, function(sync) { 
            if (MapEditor.loadedMap) { // throws an error otherwise
                if (sync) {
                    this.toggle = MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].wall?1:0; // gets initial value of toggle
                } else {
                    if (this.toggle) {
                        this.toggle = 0;
                        MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].wall = 0
                    } else {
                        this.toggle = 1;
                        MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].wall = 1
                    }
                }
            }    
        })

        btn_delete_platform = new Button("canvasArea.canvas.width - 200", "300", 150, "delete_button", "delete_button_pressed", 0, function() {
            
            MapEditor.loadedMap.platforms.splice(MapEditor.selectedPlatformIndex, 1)
            MapEditor.selectedPlatformIndex = -1; // No selected platform
            UserInterface.renderedButtons = [btn_exit_edit, btn_add_platform, btn_map_colors]
            
        })


        // COLOR PICKER BUTTONS AND SLIDERS
        btn_hueSlider = new SliderUI("ColorPicker.x", "ColorPicker.y + 130", 300, 0, 360, 1, "Hue", "gray", ColorPicker.h, function() { 
            ColorPicker.h = this.value
            ColorPicker.start()
        })

        btn_saturationSlider = new SliderUI("ColorPicker.x", "ColorPicker.y + 200", 300, 0, 100, 1, "Saturation", "gray", ColorPicker.s, function() { 
            ColorPicker.s = this.value
            ColorPicker.start()
        })

        btn_lightnessSlider = new SliderUI("ColorPicker.x", "ColorPicker.y + 270", 300, 0, 100, 1, "Lightness", "gray", ColorPicker.l, function() { 
            ColorPicker.l = this.value
            ColorPicker.start()
        })

        btn_alphaSlider = new SliderUI("ColorPicker.x", "ColorPicker.y + 340", 300, 0, 1, 100, "Alpha", "gray", ColorPicker.a, function() { 
            ColorPicker.a = this.value
            ColorPicker.start()
        })


        // SET COLOR BUTTONS
        btn_backgroundColor = new Button("canvasArea.canvas.width - 75", "20", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.backgroundColor = ColorPicker.getColor()
        })

        btn_playerColor = new Button("canvasArea.canvas.width - 75", "60", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.playerColor = ColorPicker.getColor()
        })

        btn_platformTopColor = new Button("canvasArea.canvas.width - 75", "100", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.platformTopColor = ColorPicker.getColor()
        })

        btn_platformSideColor = new Button("canvasArea.canvas.width - 75", "140", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.platformSideColor = ColorPicker.getColor()
            PreviewWindow.update(PreviewWindow.platform)
        })

        btn_wallTopColor = new Button("canvasArea.canvas.width - 75", "180", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.wallTopColor = ColorPicker.getColor()
        })

        btn_wallSideColor = new Button("canvasArea.canvas.width - 75", "220", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.wallSideColor = ColorPicker.getColor()
            PreviewWindow.update(PreviewWindow.wall)
        })

        btn_endZoneTopColor = new Button("canvasArea.canvas.width - 75", "260", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.endZoneTopColor = ColorPicker.getColor()
        })

        btn_endZoneSideColor = new Button("canvasArea.canvas.width - 75", "300", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.endZoneSideColor = ColorPicker.getColor()
            PreviewWindow.update(PreviewWindow.endzone)
        })

        btn_shadowColor = new Button("canvasArea.canvas.width - 75", "340", 50, "set_button", "set_button_pressed", 0, function() {
            MapEditor.loadedMap.style.shadowColor = ColorPicker.getColor()
        })


        

        // MAP SELECT Buttons
        btn_custom_maps = new Button("canvasArea.canvas.width - 225", 50, 175, "custom_maps_button", "custom_maps_button_pressed", 0, function() { 
            
            
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            document.body.appendChild(input);
            input.click();
            
            input.addEventListener('change', function () {
                const file = input.files[0]
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    const mapObject = JSON.parse(e.target.result);
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


        // IN LEVEL Buttons
        btn_mainMenu = new Button(40, 40, 80, "back_button", "back_button_pressed", 0, function() { 
            if (UserInterface.gamestate == 7 && MapEditor.editorState == 3) { // in map settings page and in map editor

                UserInterface.renderedButtons = [btn_exit_edit, btn_add_platform, btn_map_colors] // btn_add_checkpoint, btn_map_colors
                MapEditor.editorState = 1 // might need to do more here - like deselect platforms and shit

            } else {
                
                UserInterface.gamestate = 1;
                UserInterface.timer = 0;
                UserInterface.levelState = 1;
                player = null;
                map = null;
                UserInterface.renderedButtons = [btn_mapEditor, btn_play, btn_settings];
                UserInterface.renderedButtons.forEach(button => {
                    button.resize();
                });

            }
        })

        btn_restart = new Button(40, "canvasArea.canvas.height - 220", 80, "restart_button", "restart_button_pressed", 0, function() { 
            UserInterface.timer = 0;
            UserInterface.levelState = 1;
            player.checkpointIndex = -1;
            player.restart();
        })

        btn_jump = new Button(40, "canvasArea.canvas.height - 120", 80, "jump_button", "jump_button_pressed", 0, function() { 
            if (UserInterface.levelState == 1) {
                UserInterface.timerStart = Date.now();
                UserInterface.levelState = 2;
                player.startLevel();
            }
        })

        this.renderedButtons = [btn_mapEditor, btn_play, btn_settings]; 

    },

    update : function() {
        
        if (this.gamestate == 3 || MapEditor.editorState == 2 || MapEditor.editorState == 3) { // in setting page or in map editor
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
        const seconds = milliseconds / 1000
        // seconds = Math.round(seconds * 1000) / 1000

        const minutes = Math.floor(seconds / 60);
        let extraSeconds = seconds % 60;
        extraSeconds = Math.round((seconds % 60) * 1000) / 1000

        // minutes = minutes < 10 ? "0" + minutes : minutes; // adds a zero before minutes number if less than 10 mins
        extraSeconds = extraSeconds < 10 ? "0" + extraSeconds : extraSeconds;
        return minutes + ":" + extraSeconds;
    },

    touchStarted : function(x,y) { // TRIGGERED BY InputHandler
        
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
    },
    
    touchReleased : function(x,y) { // TRIGGERED BY InputHandler
        
        let clickedSidePanel = false;

        this.renderedButtons.forEach(button => {
            if (button.constructor.name == "Button") { // only run on buttons not sliders
                if ( // if x and y touch is within button
                    x >= button.x && x <= button.x + button.width &&
                    y >= button.y && y <= button.y + button.height
                ) {
                    button.released();
                }

                button.isPressed = false
            }
            
        });


        // test if released within the edit platform panel. if so, say a button was pressed so it doesnt select platform underneath
        // needs to be matched with MapEditor.render() values
        //canvasArea.canvas.width - 220, 20, 200, 260
        if (
            UserInterface.gamestate == 7 && MapEditor.editorState == 2 &&
            x >= canvasArea.canvas.width - 220 && x <= canvasArea.canvas.width - 20 &&
            y >= 20 && y <= 260
        ) {
            clickedSidePanel = true;
        }



        // DEALING WITH MAP EDITOR: Clicking player, clicking platforms
        // IF IN MAP EDITOR but not in map select screen within editor OR in map settings screen
        if (clickedSidePanel == false && this.gamestate == 7 && MapEditor.editorState != 0 && MapEditor.editorState != 3) { 
            
            MapEditor.renderedPlatforms.forEach(platform => {
                if (// if x and y touch is within platform (NOT ROTATED THOUGH)
                    x >= platform.x + MapEditor.screenX && x <= platform.x + platform.width + MapEditor.screenX &&
                    y >= platform.y + MapEditor.screenY && y <= platform.y + platform.height + MapEditor.screenY
                ) {
                    MapEditor.selectedPlatformIndex = MapEditor.loadedMap.platforms.indexOf(platform)
                    this.renderedButtons = [
                        btn_exit_edit, 
                        btn_unselect, 
                        
                        btn_translate,
                        btn_resize,
                        btn_angleSlider,
                        btn_wall,

                        btn_delete_platform
                    ]
                    
                    // SYNC ALL BUTTONS AND SLIDERS
                    btn_translate.func() // intially syncs the buttons position to the selected platform. Called whenever screen is scrolled too. not really needed here but avoids a 1 frame flash 
                    btn_resize.func()
                    btn_angleSlider.updateState(MapEditor.loadedMap.platforms[MapEditor.selectedPlatformIndex].angle)
                    btn_wall.func(true) // syncs the wall button's toggle state
                }
            })
            
            if (
                x >= MapEditor.loadedMap.playerStart.x + MapEditor.screenX - 16 && x <= MapEditor.loadedMap.playerStart.x + 16 + MapEditor.screenX &&
                y >= MapEditor.loadedMap.playerStart.y + MapEditor.screenY - 16 && y <= MapEditor.loadedMap.playerStart.y + 16 + MapEditor.screenY
            ) {
                MapEditor.selectedPlatformIndex = -2 // -2 means player is selected. Maybe change this to be its own variable
            }
        }
    },

    render : function() {

        this.renderedButtons.forEach(button => { // LOOP RENDERED BUTTONS AND RUN THEIR .render()
            button.render();
        });

        if (this.gamestate == 1) { // In Main Menu
            canvasArea.canvas.style.backgroundColor = "#a3d5e1";
            document.body.style.backgroundColor = "#a3d5e1";
  
            const title = document.getElementById("title")
            canvasArea.ctx.drawImage(title, canvasArea.canvas.width/2 - 150, 30, 300, (title.height / title.width) * 300)

            const menu_background = document.getElementById("menu_background")
            canvasArea.ctx.drawImage(menu_background, -30, 15, canvasArea.canvas.width + 60, (menu_background.height / menu_background.width) * canvasArea.canvas.width + 60)

        }

        if (this.gamestate == 3) { // In Settings
            canvasArea.ctx.font = "20px sans-serif";
            canvasArea.ctx.fillStyle = "white";
            canvasArea.ctx.fillText("Debug Text", 180, 270)
            canvasArea.ctx.fillText("Strafe Info", 180, 330)

        }

        if (this.gamestate == 6) { // In Level

            canvasArea.ctx.font = "25px sans-serif";
            canvasArea.ctx.fillStyle = "white";
            canvasArea.ctx.fillText("Time: " + UserInterface.secondsToMinutes(this.timer), canvasArea.canvas.width - 230, 60)
            canvasArea.ctx.fillText("Record: " + UserInterface.secondsToMinutes(map.record), canvasArea.canvas.width - 230, 90);


            if (this.debugText == 1) { // DRAWING DEBUG TEXT
                const textX = canvasArea.canvas.width * 0.18; 
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


class Button {
    constructor(x, y, width, image, image_pressed, togglable, func) {
        this.x = eval(x);
        this.y = eval(y);
        this.savedX = x;
        this.savedY = y;

        this.image = document.getElementById(image)
        this.image_pressed = document.getElementById(image_pressed)
        this.width = width;
        if (this.image != null) {
            this.height = this.width * (this.image.height / this.image.width)
        } else {this.height = 75} // incase missing image

        this.isPressed = false
        this.func = func;

        this.toggle = 0
        if (togglable) {
            this.func(true) // runs the released function with the "sync" tag to sync button's toggle state
        }

    }

    render() {
    

        if (this.image == null) { // should remove once all images are added

            if (this.toggle == 1 || this.isPressed) {
                canvasArea.ctx.fillStyle = "#DDDDDD";
            } else {
                canvasArea.ctx.fillStyle = "#FFFFFF"
            }
            canvasArea.ctx.fillRect(this.x, this.y, this.width, this.height);

            // this should be drawing an image not text. text is placholder
            canvasArea.ctx.font = "15px sans-serif";
            canvasArea.ctx.fillStyle = "black";
            canvasArea.ctx.fillText("missing image", this.x + 10, this.y + this.height / 2)

        } else {

            if (this.toggle == 1 || this.isPressed) {
                canvasArea.ctx.drawImage(this.image_pressed, this.x, this.y, this.width, this.width * (this.image.height / this.image.width)); // end part here maintains aspect ratio
            } else {
                canvasArea.ctx.drawImage(this.image, this.x, this.y, this.width, this.width * (this.image.height / this.image.width)); // end part here maintains aspect ratio
            }
        }


     
    }

    pressed() {
        this.isPressed = true;
        // any release event calls released() on applicable buttons then sets isPressed = false on every rendered button
    }

    released(override) {
        if (override) {this.func()}
        if (this.isPressed) {this.func()}
    }
    resize() {
        this.x = eval(this.savedX)
        this.y = eval(this.savedY)
        // console.log("evalled: " + this.savedX)
        // console.log("button position re-evaluated")
    }
}


class SliderUI {
    confirmed = true;

    constructor(x, y, width, min, max, decimalDetail, label, labelColor, variable, func) {
        this.x = eval(x);
        this.y = eval(y);
        this.width = width;
        this.min = min;
        this.max = max;
        this.decimalDetail = decimalDetail // 1 = whole numbers, 10 = 10ths place, 100 = 100ths place
        this.label = label;
        this.labelColor = labelColor;
        this.value = variable;
        this.variableToControl = String(variable);
        this.func = func;
        this.sliderX = this.x + width / ((max - min)/this.value);
    }

    updateState(value) { // updates the button when its value is changed by external source
        this.value = value;
        // this.sliderX = this.x + this.width / ((this.max - this.min)/this.value);
        this.sliderX = (this.value - this.min) * (this.x + this.width - this.x) / (this.max - this.min) + this.x;

    }


    render() {
        canvasArea.ctx.strokeStyle = "#BBBBBB";
        canvasArea.ctx.lineWidth = 8;
        canvasArea.ctx.lineCap = "round"
        // canvasArea.ctx.fillStyle = "#FFFFFF";
        canvasArea.ctx.fillStyle = this.labelColor;
        
        canvasArea.ctx.beginPath(); // Slider Line
        canvasArea.ctx.moveTo(this.x, this.y)
        canvasArea.ctx.lineTo(this.x + this.width, this.y)
        canvasArea.ctx.stroke();

        canvasArea.ctx.beginPath(); // Slider Handle
        canvasArea.ctx.arc(this.sliderX, this.y, 15, 0, 2 * Math.PI);
        canvasArea.ctx.fill();

        canvasArea.ctx.font = "20px sans-serif";
        canvasArea.ctx.fillStyle = this.labelColor;
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
                this.value = Math.round(this.value * this.decimalDetail) / this.decimalDetail;
                // this.value = Math.round(this.value / 10) * 10; // for snapping to nearest multiple of 10 


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


const PreviewWindow = {
    x : 40,
    y : 160,

    // OBJECTS TO DRAW
    platform : {
        "x": 50,
        "y": 50,
        "width": 70,
        "height": 70,
        "angle": 45,
        "endzone": 0,
        "wall": 0
    },

    wall : {
        "x": 100,
        "y": 200,
        "width": 50,
        "height": 50,
        "angle": 45,
        "endzone": 0,
        "wall": 1
    },

    endzone : {
        "x": 0,
        "y": 100,
        "width": 50,
        "height": 50,
        "angle": 20,
        "endzone": 1,
        "wall": 0
    },


    update : function(platform) { // updates the calculations for side colors and shadow points
        // Calculate lighting and shadows for each platform and the endzone
        MapEditor.loadedMap.style.lightAngleVector =  new Vector(Math.cos(MapEditor.loadedMap.style.lightAngle * (Math.PI/180)), Math.sin(MapEditor.loadedMap.style.lightAngle * (Math.PI/180)))
        const shadowX = MapEditor.loadedMap.style.lightAngleVector.x * MapEditor.loadedMap.style.shadowLength;
        const shadowY = MapEditor.loadedMap.style.lightAngleVector.y * MapEditor.loadedMap.style.shadowLength;

        // let platformIndex = 0 // set this so that it is z-order
        // this.platforms.forEach(platform => { // CALCULATE PLATFORMS COLORS and SHADOW POLYGON

        // Setting the colors for platforms, endzones, and walls
        let colorToUse = MapEditor.loadedMap.style.platformSideColor;
        if(platform.endzone) {
            colorToUse = MapEditor.loadedMap.style.endZoneSideColor;
        }
        if(platform.wall) {
            colorToUse = MapEditor.loadedMap.style.wallSideColor;
        }


        // COLORS
        const side1Vec = new Vector(-1,0).rotate(platform.angle)
        const side2Vec = new Vector(0,1).rotate(platform.angle)
        const side3Vec = new Vector(1,0).rotate(platform.angle)

        platform.sideColor1 = canvasArea.calculateShadedColor(side1Vec, colorToUse) // COULD OPTIMIZE. Some sides arent visible at certain platform rotations. Those sides dont need to be calculated
        platform.sideColor2 = canvasArea.calculateShadedColor(side2Vec, colorToUse)
        platform.sideColor3 = canvasArea.calculateShadedColor(side3Vec, colorToUse)

        // SHADOW POLYGON
        const angleRad = platform.angle * (Math.PI/180);
        const wallShadowMultiplier = platform.wall ? (MapEditor.loadedMap.style.wallHeight + MapEditor.loadedMap.style.platformHeight) / MapEditor.loadedMap.style.platformHeight : 1 // makes sure shadows are longer for taller walls

        platform.shadowPoints = [ // ALL THE POSSIBLE POINTS TO INPUT IN CONVEX HULL FUNCTION
        
            // bot left corner
            [
            -((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)),
            -((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight
            ],

            // bot right corner
            [
            ((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)),
            ((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight
            ],

            // top right corner
            [
            ((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)),
            ((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight
            ],
        
            // top left corner
            [
            -((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)),
            -((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight
            ],
        
            // bot left SHADOW
            [
            -((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)) + shadowX * wallShadowMultiplier,
            -((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight + shadowY * wallShadowMultiplier
            ],

            // bot right SHADOW
            [
            ((platform.width / 2) * Math.cos(angleRad)) - ((platform.height / 2) * Math.sin(angleRad)) + shadowX * wallShadowMultiplier,
            ((platform.width / 2) * Math.sin(angleRad)) + ((platform.height / 2) * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight + shadowY * wallShadowMultiplier
            ],
            
            // top right SHADOW
            [
            ((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)) + shadowX * wallShadowMultiplier,
            ((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight + shadowY * wallShadowMultiplier
            ],

            // top left SHADOW
            [
                -((platform.width / 2) * Math.cos(angleRad)) + ((platform.height / 2) * Math.sin(angleRad)) + shadowX * wallShadowMultiplier,
                -((platform.width / 2) * Math.sin(angleRad)) - ((platform.height / 2) * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight + shadowY * wallShadowMultiplier
            ],
            
        ]; // end of shadowPoints array


        platform.shadowPoints = canvasArea.convexHull(platform.shadowPoints)


            // // SHADOW CLIP FOR UPPER PLAYER SHADOW
            // this.upperShadowClip.moveTo( // bot left
            //     platform.x + platform.width/2 + platform.corners[0][0], // x
            //     platform.y + platform.height/2 + platform.corners[0][1] // y
            //     )
            // this.upperShadowClip.lineTo( // bot right
            //     platform.x + platform.width/2 + platform.corners[1][0],
            //     platform.y + platform.height/2 + platform.corners[1][1]
            // )
            // this.upperShadowClip.lineTo( // top right
            //     platform.x + platform.width/2 + platform.corners[2][0],
            //     platform.y + platform.height/2 + platform.corners[2][1]
            // )
            // this.upperShadowClip.lineTo( // top left
            //     platform.x + platform.width/2 + platform.corners[3][0],
            //     platform.y + platform.height/2 + platform.corners[3][1]
            // )
            // this.upperShadowClip.closePath()


        // });
    },


    render : function() {
        const ctx = canvasArea.ctx

        // WINDOW
        ctx.strokeStyle = "black"
        ctx.fillStyle = MapEditor.loadedMap.style.backgroundColor
        ctx.fillRect(this.x, this.y, 300, 245)
        ctx.strokeRect(this.x, this.y, 300, 245)
        

        // RENDER FUNCTION FOR PLATFORM, WALL, and ENDZONE

        function renderPreviewItem(platform) {
            
            // const ctx = canvasArea.ctx;
            
            const adjustedHeight = platform.wall ? MapEditor.loadedMap.style.wallHeight : 0 // for adding height to walls

            // DRAW PLATFORM TOP
            ctx.save(); // ROTATING 
            ctx.translate(PreviewWindow.x + platform.x + platform.width/2, PreviewWindow.y + platform.y + platform.height/2 - adjustedHeight);
            ctx.rotate(platform.angle * Math.PI/180);

            // Change to endzone or wall color if needed. Also where its determined if endzone is being rendered
            if (platform.endzone) {
                ctx.fillStyle = MapEditor.loadedMap.style.endZoneTopColor;
            } else if (platform.wall) {
                ctx.fillStyle = MapEditor.loadedMap.style.wallTopColor;
            } else {
                ctx.fillStyle = MapEditor.loadedMap.style.platformTopColor;
            }
            
            ctx.fillRect(-platform.width/2, -platform.height/2, platform.width, platform.height);

            ctx.restore(); // restores platform rotation NOT translation


            // SIDES OF PLATFORMS
            ctx.save();
            ctx.translate(PreviewWindow.x + platform.x + platform.width/2, PreviewWindow.y + platform.y + platform.height/2);

            const angleRad = platform.angle * (Math.PI/180);
            

            // platform angles should only be max of 90 and -90 in mapData
            // calculating shading works with any angle but sides arent draw because drawing "if statements" are hardcoded to 90 degrees

            if (-90 < platform.angle && platform.angle < 90) { // ALMOST ALWAYS RENDER BOTTOM SIDE. side2
                
                ctx.fillStyle = platform.sideColor2; // sideColor2
                ctx.beginPath();
                ctx.moveTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // bot right
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // bot left
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight);
                ctx.lineTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight);
                ctx.closePath();
                ctx.fill();
            }


            if (0 < platform.angle && platform.angle <= 90) { // side3

                ctx.fillStyle = platform.sideColor3; // sideColor3
                ctx.beginPath();
                ctx.moveTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // bot right
                ctx.lineTo(platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // top right
                ctx.lineTo(platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight);
                ctx.lineTo(platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight);
                ctx.closePath();
                ctx.fill();
            }

            if (-90 <= platform.angle && platform.angle < 0) { // side1

                ctx.fillStyle = platform.sideColor1; // sideColor1
                ctx.beginPath();
                ctx.moveTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // bot left
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) - adjustedHeight); // top left
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) + (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) - (platform.height/2 * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight);
                ctx.lineTo(-platform.width/2 * Math.cos(angleRad) - (platform.height/2 * Math.sin(angleRad)), -platform.width/2 * Math.sin(angleRad) + (platform.height/2 * Math.cos(angleRad)) + MapEditor.loadedMap.style.platformHeight);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore(); // resets back from platform local space. player view space??
        
        
        } // end of drawPreviewItem



        renderPreviewItem(this.platform)
        renderPreviewItem(this.wall)
        renderPreviewItem(this.endzone)



        // DRAW PLAYER
        ctx.fillStyle = MapEditor.loadedMap.style.playerColor
        ctx.fillRect(this.x + 50, this.y + 50, 32, 32)

    }
}


const ColorPicker = {
    state : 0,
    x : 400,
    y : 40,
    width : 300,
    height : 15,
    hueGradient : null,
    saturationGradient : null,
    lightnessGradient : null,
    alphaGradient : null,

    rgbaValue : null,

    h : 117,
    s : 34,
    l : 75,
    a : 1,

    start : function() { // should be called sync
        const ctx = canvasArea.ctx;

        this.rgbaValue = canvasArea.HSLToRGB(this.h, this.s, this.l, this.a)


        // new ones of these are created every time a slider is changed...not great
        this.hueGradient = ctx.createLinearGradient(this.x, 0, this.width + this.x, 0)
        this.saturationGradient = ctx.createLinearGradient(this.x, 0, this.width + this.x, 0)
        this.lightnessGradient = ctx.createLinearGradient(this.x, 0, this.width + this.x, 0)
        this.alphaGradient = ctx.createLinearGradient(this.x, 0, this.width + this.x, 0)


        // testing gradient
        // this.hueGradient.addColorStop(0, "black")
        // this.hueGradient.addColorStop(0.01, "white")
        // this.hueGradient.addColorStop(0.99, "black")
        // this.hueGradient.addColorStop(0.99, "white")


        // HUE BAR
        this.hueGradient.addColorStop(0/360, "hsla(0, 100%, 50%, 1)");
        this.hueGradient.addColorStop(10/360, "hsla(10, 100%, 50%, 1)");
        this.hueGradient.addColorStop(20/360, "hsla(20, 100%, 50%, 1)");
        this.hueGradient.addColorStop(30/360, "hsla(30, 100%, 50%, 1)");
        this.hueGradient.addColorStop(40/360, "hsla(40, 100%, 50%, 1)");
        this.hueGradient.addColorStop(50/360, "hsla(50, 100%, 50%, 1)");
        this.hueGradient.addColorStop(60/360, "hsla(60, 100%, 50%, 1)");
        this.hueGradient.addColorStop(70/360, "hsla(70, 100%, 50%, 1)");
        this.hueGradient.addColorStop(80/360, "hsla(80, 100%, 50%, 1)");
        this.hueGradient.addColorStop(90/360, "hsla(90, 100%, 50%, 1)");
        this.hueGradient.addColorStop(100/360, "hsla(100, 100%, 50%, 1)");
        this.hueGradient.addColorStop(110/360, "hsla(110, 100%, 50%, 1)");
        this.hueGradient.addColorStop(120/360, "hsla(120, 100%, 50%, 1)");
        this.hueGradient.addColorStop(130/360, "hsla(130, 100%, 50%, 1)");
        this.hueGradient.addColorStop(140/360, "hsla(140, 100%, 50%, 1)");
        this.hueGradient.addColorStop(150/360, "hsla(150, 100%, 50%, 1)");
        this.hueGradient.addColorStop(160/360, "hsla(160, 100%, 50%, 1)");
        this.hueGradient.addColorStop(170/360, "hsla(170, 100%, 50%, 1)");
        this.hueGradient.addColorStop(180/360, "hsla(180, 100%, 50%, 1)");
        this.hueGradient.addColorStop(190/360, "hsla(190, 100%, 50%, 1)");
        this.hueGradient.addColorStop(200/360, "hsla(200, 100%, 50%, 1)");
        this.hueGradient.addColorStop(210/360, "hsla(210, 100%, 50%, 1)");
        this.hueGradient.addColorStop(220/360, "hsla(220, 100%, 50%, 1)");
        this.hueGradient.addColorStop(230/360, "hsla(230, 100%, 50%, 1)");
        this.hueGradient.addColorStop(240/360, "hsla(240, 100%, 50%, 1)");
        this.hueGradient.addColorStop(250/360, "hsla(250, 100%, 50%, 1)");
        this.hueGradient.addColorStop(260/360, "hsla(260, 100%, 50%, 1)");
        this.hueGradient.addColorStop(270/360, "hsla(270, 100%, 50%, 1)");
        this.hueGradient.addColorStop(280/360, "hsla(280, 100%, 50%, 1)");
        this.hueGradient.addColorStop(290/360, "hsla(290, 100%, 50%, 1)");
        this.hueGradient.addColorStop(300/360, "hsla(300, 100%, 50%, 1)");
        this.hueGradient.addColorStop(310/360, "hsla(310, 100%, 50%, 1)");
        this.hueGradient.addColorStop(320/360, "hsla(320, 100%, 50%, 1)");
        this.hueGradient.addColorStop(330/360, "hsla(330, 100%, 50%, 1)");
        this.hueGradient.addColorStop(340/360, "hsla(340, 100%, 50%, 1)");
        this.hueGradient.addColorStop(350/360, "hsla(350, 100%, 50%, 1)");
        this.hueGradient.addColorStop(360/360, "hsla(360, 100%, 50%, 1)");


        // SATURATION BAR
        this.saturationGradient.addColorStop(0, "hsla(" + this.h + ", 0%, 50%, 1)");
        this.saturationGradient.addColorStop(0.25, "hsla(" + this.h + ", 25%, 50%, 1)");
        this.saturationGradient.addColorStop(0.5, "hsla(" + this.h + ", 50%, 50%, 1)");
        this.saturationGradient.addColorStop(0.75, "hsla(" + this.h + ", 75%, 50%, 1)");
        this.saturationGradient.addColorStop(1, "hsla(" + this.h + ", 100%, 50%, 1)");
        
        // LIGHTNESS BAR
        this.lightnessGradient.addColorStop(0, "hsla(" + this.h + ", 100%, 0%, 1)");
        this.lightnessGradient.addColorStop(0.25, "hsla(" + this.h + ", 100%, 25%, 1)");
        this.lightnessGradient.addColorStop(0.5, "hsla(" + this.h + ", 100%, 50%, 1)");
        this.lightnessGradient.addColorStop(0.75, "hsla(" + this.h + ", 100%, 75%, 1)");
        this.lightnessGradient.addColorStop(1, "hsla(" + this.h + ", 100%, 100%, 1)");

        // ALPHA BAR
        this.alphaGradient.addColorStop(0, "hsla(" + this.h + ", " + this.s + "%, " + this.l + "%, 0)");
        this.alphaGradient.addColorStop(1, "hsla(" + this.h + ", " + this.s + "%, " + this.l + "%, 1)");

    },

    update : function() {
        if (this.hueGradient == null) {
            this.start();
        }
    },

    render : function() {
        const ctx = canvasArea.ctx;
        
        ctx.fillStyle = "white"
        ctx.strokeStyle = "black"
        ctx.lineWidth = 1
        ctx.fillRect(this.x-20, this.y-20, this.width + 40, 385)
        ctx.strokeRect(this.x-20, this.y-20, this.width + 40, 385)

        ctx.fillStyle = "hsla(" + this.h + ", " + this.s + "%, " + this.l + "%, " + this.a + ")"
        ctx.fillRect(this.x, this.y, this.width/2, 80)
        ctx.strokeRect(this.x, this.y, this.width/2, 80)

        ctx.fillStyle = "black"
        ctx.fillText(this.rgbaValue, this.x + 160, this.y + 10)

        ctx.fillStyle = this.hueGradient
        ctx.fillRect(this.x, this.y + 105, this.width, this.height)

        ctx.fillStyle = this.saturationGradient
        ctx.fillRect(this.x, this.y + 175, this.width, this.height)
        
        ctx.fillStyle = this.lightnessGradient
        ctx.fillRect(this.x, this.y + 245, this.width, this.height)

        ctx.fillStyle = this.alphaGradient
        ctx.fillRect(this.x, this.y + 315, this.width, this.height)
        // ctx.strokeRect(this.x, this.y + 315, this.width, this.height)

    },

    getColor : function() {
        return canvasArea.HSLToRGB(this.h, this.s, this.l, this.a)
        // return "hsla(" + this.h + ", " + this.s + "%, " + this.l + "%, " + this.a + ")"
    } 
}


const MapEditor = {
    editorState : 0, // 0 = map select screen, 1 = main map edit screen, 2 = platform edit menu, 3 = map settings page
    loadedMap : null,
    scrollX_vel : 0, // for smooth scrolling 
    scrollY_vel : 0,
    screenX : 0, // where the view is located
    screenY : 0,
    renderedPlatforms : [],
    selectedPlatformIndex : -1,
    snapping : false,
    debugText : false,

    render : function() {

        if (this.loadedMap !== null) { // IF MAP IS LOADED RENDER IT
            const ctx = canvasArea.ctx;
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


            ctx.fillRect(-2, -2, 4, 4) // (0,0) map origin

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
            ctx.font = "15px sans-serif";


            if (this.editorState == 2) { // DRAWING SIDE PANEL
            
                // SIDE PANEL
                ctx.fillStyle = "#FFFFFF"
                ctx.fillRect(canvasArea.canvas.width - 220, 20, 200, 260) // If these change also change the values in UserInterface.touchReleased()


                if (this.selectedPlatformIndex == -2) { // player is selected
                    
                    ctx.fillStyle = "#000000"
                    ctx.fillText("Player Start", canvasArea.canvas.width - 200, 100);
                    ctx.fillText("Position: " + this.loadedMap.playerStart.x + ", " + this.loadedMap.playerStart.y, canvasArea.canvas.width - 200, 120);

                    
                } else { // platform is selected
                    
                    ctx.fillStyle = "#000000"
                    ctx.fillText("Platform", canvasArea.canvas.width - 200, 100);
                    ctx.fillText("Position: " + this.loadedMap.platforms[this.selectedPlatformIndex].x + ", " + this.loadedMap.platforms[this.selectedPlatformIndex].y, canvasArea.canvas.width - 200, 120);
                    ctx.fillText("Size: " + this.loadedMap.platforms[this.selectedPlatformIndex].width + ", " + this.loadedMap.platforms[this.selectedPlatformIndex].height, canvasArea.canvas.width - 200, 140);
                    ctx.fillText("Wall: " + (this.loadedMap.platforms[this.selectedPlatformIndex].wall?"Yes":"No"), canvasArea.canvas.width - 200, 240)
  
                }
                
            }

            if (this.editorState == 3) { // IN COLOR SETTINGS 
                ColorPicker.render()
                PreviewWindow.render()
                // PreviewWindow update is called by buttons

                canvasArea.ctx.fillStyle = "black"
                canvasArea.ctx.fillText("Background",canvasArea.canvas.width-200, 40)
                canvasArea.ctx.fillText("Player",canvasArea.canvas.width-200, 80)
                canvasArea.ctx.fillText("Platform Top",canvasArea.canvas.width-200, 120)
                canvasArea.ctx.fillText("Platform Side",canvasArea.canvas.width-200, 160)
                canvasArea.ctx.fillText("Wall Top",canvasArea.canvas.width-200, 200)
                canvasArea.ctx.fillText("Wall Side",canvasArea.canvas.width-200, 240)
                canvasArea.ctx.fillText("End Zone Top",canvasArea.canvas.width-200, 280)
                canvasArea.ctx.fillText("End Zone Side",canvasArea.canvas.width-200, 320)
                canvasArea.ctx.fillText("Shadow",canvasArea.canvas.width-200, 360)

            }



            if (this.debugText) {
                
                // GENERAL MAP EDITOR DEBUG TEXT
                const textX = 150;
                ctx.fillStyle = "#FFFFFF";
                ctx.fillText("screenX: " + this.screenX, textX, 60);
                ctx.fillText("touchX: " + Math.round(touchHandler.touchX - this.screenX), textX, 80);
                ctx.fillText("touchY: " + Math.round(touchHandler.touchY - this.screenY), textX, 100);
                ctx.fillText("previousX: " + touchHandler.previousX, textX, 120);
                ctx.fillText("rendered platforms: " + this.renderedPlatforms.length, textX, 140);
                ctx.fillText("editorState: " + this.editorState, textX, 160);
                ctx.fillText("selected platform index: " + this.selectedPlatformIndex, textX, 180);
                
            }

        }

    },

    update : function() {
        
        // when map is loaded for editing
        if (this.editorState == 0) { // 0 == map select screen
            if (this.loadedMap !== null) { // if map is loaded then switch to Main Map Edit screen
                
                canvasArea.canvas.style.backgroundColor = this.loadedMap.style.backgroundColor; // set bg color here so it only triggers once not every render frame
                document.body.style.backgroundColor = this.loadedMap.style.backgroundColor;

                UserInterface.renderedButtons = [btn_exit_edit, btn_add_platform, btn_map_colors] // btn_add_checkpoint, btn_map_colors

                this.screenX = -this.loadedMap.playerStart.x + canvasArea.canvas.width/2;
                this.screenY = -this.loadedMap.playerStart.y + canvasArea.canvas.height/2;

                this.editorState = 1
            }
        }

        if (this.editorState == 1 || this.editorState == 2) { // main map edit screen OR platform select screen

            // SCROLLING THE SCREEN OR USING THE GIZMO's buttons/slider
            if (touchHandler.dragging == 1) {
                if (!btn_translate.isPressed && !btn_resize.isPressed && btn_angleSlider.confirmed) {
                    this.scrollX_vel += touchHandler.dragAmountX
                    this.scrollY_vel += touchHandler.dragAmountY
                }
            }

            this.screenX += this.scrollX_vel / 10;
            this.screenY += this.scrollY_vel / 10;

            this.scrollX_vel *= 0.95
            this.scrollY_vel *= 0.95



            // FIGURING OUT WHICH PLATFORMS TO RENDER
            this.renderedPlatforms = [];

            this.loadedMap.platforms.forEach(platform => { // Loop through platforms
                const hypotenuse = Math.sqrt(platform.width * platform.width + platform.height * platform.height)/2


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

        // updating interface components based on editorState
        if (this.editorState == 3) { // in map settings screen
            ColorPicker.update();
            // ColorPicker.render called in MapEditor.render()
        }



        if (this.editorState == 2) {
            if (this.selectedPlatformIndex != -1 && this.selectedPlatformIndex != -2) {
                btn_translate.func() // updates these buttons 
                btn_resize.func()
            }
        }


        // changing the editorState
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

                    const temp = platforms[i]
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
            const hypotenuse_a = Math.sqrt(a.width * a.width + a.height * a.height)/2
            const hypotenuse_b = Math.sqrt(b.width * b.width + b.height * b.height)/2

            const adjustedHeight_a = a.wall ? MapEditor.loadedMap.style.wallHeight : 0 // for adding height to a if its a wall
            const adjustedHeight_b = b.wall ? MapEditor.loadedMap.style.wallHeight : 0 // for adding height to b if its a wall

            if (
                    (a.x + a.width/2 + hypotenuse_a > b.x + b.width/2 - hypotenuse_b) && // a colliding with b from left side
                    (a.x + a.width/2 - hypotenuse_a < b.x + b.width/2 + hypotenuse_b) && // right side
                    (a.y + a.height/2 + hypotenuse_a > b.y + b.height/2 - hypotenuse_b - adjustedHeight_b) && // top side
                    (a.y + a.height/2 - hypotenuse_a - adjustedHeight_a < b.y + b.height/2 + hypotenuse_b) // bottom side (could also use downloadMap here i think)
                ) {
                
                // corners will be added/sorted after first loop. check if they are already added.
                if (!("corners" in a)) {
                    const angleRad = a.angle * (Math.PI/180);
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
                    const angleRad = b.angle * (Math.PI/180);
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
                    const aCornerExtensionY = a.rightMostPlatformCornerY + (b.leftMostPlatformCornerX - a.rightMostPlatformCornerX) * Math.tan(a.angle * (Math.PI/180))
        
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
        
                    const aCornerExtensionY = a.leftMostPlatformCornerY + (b.rightMostPlatformCornerX - a.leftMostPlatformCornerX) * Math.tan(a.angle * (Math.PI/180))
        
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


const AudioHandler = {
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


            // const mapURL = "https://cdn.jsdelivr.net/gh/tol-uno/Pocket-Hop@main/assets/maps/" + name + ".json"
            // OLD LOCAL STORAGE
            const mapURL = "assets/maps/" + name + ".json";
            // could eventually be "pockethop.com/maps/original.json"

            try {
                const response = await fetch(mapURL);
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


            const playerStart = jsonData.playerStart; // 3 temporary lets that get combined into mapData and pushed out of async function
            const platforms = [];
            const style = jsonData.style;
            const checkpoints = jsonData.checkpoints; // returns an object


            jsonData.platforms.forEach(platform => { // LOOP THROUGH DATA AND ADD EACH PLATFORM TO AN ARRAY
                platforms.push(platform);
            });

            const mapData = [playerStart, platforms, style, checkpoints]; // all the data to be sent out from this async function (platforms, player start, end zone)

            return mapData;
        }


        parseMapData().then(mapData => { // WAITS FOR ASYNC FUNCTION. Big function that handles setting up the map and pre rendering calculations
            this.playerStart = mapData[0];
            this.platforms = mapData[1];
            this.style = mapData[2];
            this.checkpoints = mapData[3];


            // Calculate lighting and shadows for each platform and the endzone
            this.style.lightAngleVector =  new Vector(Math.cos(this.style.lightAngle * (Math.PI/180)), Math.sin(this.style.lightAngle * (Math.PI/180)))
            const shadowX = this.style.lightAngleVector.x * this.style.shadowLength;
            const shadowY = this.style.lightAngleVector.y * this.style.shadowLength;

            let platformIndex = 0 // set this so that it is z-order
            this.platforms.forEach(platform => { // CALCULATE PLATFORMS COLORS and SHADOW POLYGON

                // Setting the colors for platforms, endzones, and walls
                let colorToUse = this.style.platformSideColor;
                if(platform.endzone) {
                    colorToUse = this.style.endZoneSideColor;
                    this.endZone = platform;
                }
                if(platform.wall) {
                    colorToUse = this.style.wallSideColor;
                    this.walls.push(platform);
                }

                platform.index = platformIndex; // asigns an index to each platform for debugging
                platformIndex ++;

                // COLORS
                platform.side1Vec = new Vector(-1,0).rotate(platform.angle) // !! DONT need to be properties of platform. only made properties for debug
                platform.side2Vec = new Vector(0,1).rotate(platform.angle)
                platform.side3Vec = new Vector(1,0).rotate(platform.angle)

                platform.sideColor1 = canvasArea.calculateShadedColor(platform.side1Vec, colorToUse) // COULD OPTIMIZE. Some sides arent visible at certain platform rotations. Those sides dont need to be calculated
                platform.sideColor2 = canvasArea.calculateShadedColor(platform.side2Vec, colorToUse)
                platform.sideColor3 = canvasArea.calculateShadedColor(platform.side3Vec, colorToUse)

                // SHADOW POLYGON
                const angleRad = platform.angle * (Math.PI/180);
                const wallShadowMultiplier = platform.wall ? (this.style.wallHeight + this.style.platformHeight) / this.style.platformHeight : 1 // makes sure shadows are longer for taller walls

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
                    // corners + wall height points need to be "concated" as serperate letiable otherwise they dont stay as points
                    const upperCorners = [
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

                    let behindWallClipPoints = platform.corners.concat(upperCorners)
            
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

    update() {  // Figure out which platforms are in view + renderQueue
                // This is probably were I should check endZoneIsRendered but it's done in render(). Saves an if statement i guess...
                // ALSO where player is slotted into RenderQueue (z-order is determined)

        this.renderedPlatforms = [];
        this.wallsToCheck = [];

        this.platforms.forEach(platform => { // Loop through ALL platforms to get renderedPlatforms
            const hypotenuse = Math.sqrt(platform.width * platform.width + platform.height * platform.height)/2
            const adjustedHeight = platform.wall ? this.style.wallHeight : 0 // for adding height to walls
            const wallShadowMultiplier = platform.wall ? (this.style.wallHeight + this.style.platformHeight) / this.style.platformHeight : 1 // makes sure shadows are longer for taller walls


            if (
                (platform.x + platform.width/2 + hypotenuse + (this.style.shadowLength * wallShadowMultiplier) > player.x - midX) && // coming into frame on left side
                (platform.x + platform.width/2 - hypotenuse - (this.style.shadowLength * wallShadowMultiplier) < player.x + midX) && // right side
                (platform.y + platform.height/2 + hypotenuse + (this.style.shadowLength * wallShadowMultiplier) + this.style.platformHeight > player.y - midY) && // top side
                (platform.y + platform.height/2 - hypotenuse - (this.style.shadowLength * wallShadowMultiplier) - adjustedHeight < player.y + midY) // bottom side
            ) {
                this.renderedPlatforms.push(platform); // ADD platform to renderedPlatforms
            }
        }); // end of looping through ALL platforms
        



        // sort and index platforms on load of map
        // platforms only need to be sorted once(given indexes once) and then the player just needs to be slotted in where they belong in the z-order of the render queue which is the map.renderedPlatforms array
        // not true ^^ platform order can change depending on player position / rotation


        const infrontPlayer = []
        const behindPlayer = []
        let indexSplitSpot = 9999 // if it stays 9999 all platforms will be rendered behind player. Kinda acts as the index of the player

        

        this.renderedPlatforms.forEach(platform => { // Loop through RENDERED platforms (will loop through in order of index)
            
            
            // checking if platform is a wall
            // splitting walls into 2 arrays: infrontPlayer[] and behindPlayer[]. 
            // Sort rendered platforms/walls that ARENT checked(not close enough to player) into the appropriate array
            
            
            if (platform.wall) {

                //change to be platform.hypotenuse that is evaled on map load
                const hypotenuse = Math.sqrt(platform.width * platform.width + platform.height * platform.height)/2
                
                if ( // wall is close enough to player that it needs to be checked with player rotation. Could be behind, infront, or colliding with it
                    (platform.x + platform.width/2 + hypotenuse > player.x - 25) && // colliding with player from left
                    (platform.x + platform.width/2 - hypotenuse < player.x + 25) && // right side
                    (platform.y + platform.height/2 + hypotenuse > player.y - 73) && // top side
                    (platform.y + platform.height/2 - hypotenuse - this.style.wallHeight < player.y + 25) // bottom side
                ) { // test for player overlap and rendering z-order tests
                    
                    this.wallsToCheck.push(platform) // for checking if player is colliding with walls in player.updatePos()

                    // convert player angle and get radian version
                    const angle = player.lookAngle.getAngle();
                    const angleRad = angle * (Math.PI/180);
                    

                    // GET PLAYERS LEFTMOST AND RIGHT MOST CORNERS
                    // YOU DONT NEED X COORDS BUT I KEPT THEM HERE JUST COMMENTED OUT

                    // player.leftMostPlayerCornerX = null
                    player.leftMostPlayerCornerY = null
                    // player.rightMostPlayerCornerX = null
                    player.rightMostPlayerCornerY = null
                    if (0 <= angle && angle < 90) { // leftMost=bot left        rightMost=top right 
                        // player.leftMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        player.leftMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                        // player.rightMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        player.rightMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                    }
                    if (90 <= angle && angle < 180) { // leftMost=bot right     rightMost=top left
                        // player.leftMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        player.leftMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                        // player.rightMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        player.rightMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                    }
                    if (180 <= angle && angle < 270) { // leftMost=top right    rightMost=bot left 
                        // player.leftMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        player.leftMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                        // player.rightMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) + (16 * Math.sin(angleRad)))
                        player.rightMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) - (16 * Math.cos(angleRad)))
                    }
                    if (270 <= angle && angle < 360) { // leftMost=top left     rightMost=bot right
                        // player.leftMostPlayerCornerX = player.x - (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        player.leftMostPlayerCornerY = player.y - (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                        // player.rightMostPlayerCornerX = player.x + (16 * Math.cos(angleRad) - (16 * Math.sin(angleRad)))
                        player.rightMostPlayerCornerY = player.y + (16 * Math.sin(angleRad) + (16 * Math.cos(angleRad)))
                    }



                    
                    // get platform.corner x for LEFT MOST corner (start of corners array) NOTE: corner array is in local space
                    platform.leftMostPlatformCornerX = platform.cornersSorted[0][0] + platform.x + platform.width/2 // platform corners are relative to the platforms middle
                    platform.leftMostPlatformCornerY = platform.cornersSorted[0][1] + platform.y + platform.height/2
                    
                    // get platform.corner x for RIGHT MOST corner (end of corners array) NOTE: corner array is in local space
                    platform.rightMostPlatformCornerX = platform.cornersSorted[3][0] + platform.x + platform.width/2 // platform corners are relative to the platforms middle
                    platform.rightMostPlatformCornerY = platform.cornersSorted[3][1] + platform.y + platform.height/2

                    

                    // wall slopes / extensions of axis. Light is horizontal. Dark is vertical
                    // const horizontalAxisExtensionY = platform.y + platform.height/2 + (platform.horizontalSlope * (player.x - (platform.x + platform.width/2)))
                    const horizontalAxisExtensionX = platform.x + platform.width/2 + ((player.y - (platform.y + platform.height/2)) / platform.horizontalSlope)
                    const verticalAxisExtensionX = platform.x + platform.width/2 + ((player.y - (platform.y + platform.height/2)) / platform.verticalSlope)
                    let axisToUse = null
                    

                    // figures out which axis is needed to compare check
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
                            if (platform.rightMostPlatformCornerY > player.leftMostPlayerCornerY) { // overlapping 
                                // render wall in front of player
                                infrontPlayer.push(platform)
                                if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                            } else {
                                    // render wall behind player
                                    behindPlayer.push(platform)
                            }

    
                        } else { // wall is to the right of player
                            
                            // check player right corner compared to wall's left corner
                            if (platform.leftMostPlatformCornerY > player.rightMostPlayerCornerY) { // overlapping.
                                // render wall in front of player
                                infrontPlayer.push(platform)
                                if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                            } else { 
                                    // render wall behind player
                                    behindPlayer.push(platform)
                            }
                        }
                    }



                    // HORIZONTAL AXIS TESTS
                    if (axisToUse == "horizontal"){

                        if (horizontalAxisExtensionX < player.x) { // walls horizontal axis is to the left of player. wall is to the left (or player is sorta above the horizontal axis)
                        
                            // check player left corner compared to wall's right corner
                            if (platform.rightMostPlatformCornerY > player.leftMostPlayerCornerY) { // overlapping 
                                // render wall in front of player
                                infrontPlayer.push(platform)
                                if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                            } else {
                                // render wall behind player
                                behindPlayer.push(platform)
                            }
    
                        } else { // wall is to the right of player
    
                            // check player right corner compared to wall's left corner
                            if (platform.leftMostPlatformCornerY > player.rightMostPlayerCornerY) { // overlapping 
                                // render wall in front of player
                                infrontPlayer.push(platform)
                                if (platform.index < indexSplitSpot) {indexSplitSpot = platform.index}
                            } else {
                                // render wall behind player
                                behindPlayer.push(platform)
                            }
                        }
                    }


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
        ctx.strokeStyle = "#00000000" // for borders. add a 00 at the end to make them transparent
        ctx.lineJoin = "round"
        ctx.lineWidth = 1
        
        ctx.save();
        ctx.translate(-player.x + midX, -player.y + midY); // move canvas when drawing platforms then restore. midX is center of canvas width

        const adjustedHeight = platform.wall ? this.style.wallHeight : 0 // for adding height to walls

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

        const angleRad = platform.angle * (Math.PI/180);
        

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
        // ctx.fillText("index: " + platform.index, 0, 0);
        // ctx.fillText("renderIndex: " + this.renderedPlatforms.indexOf(platform), 0, 0)
        // ctx.fillText("angle: " + platform.angle, 0, 20);
        // ctx.fillText("position: " + platform.x + ", " + platform.y, 0 , 40)
        // ctx.fillText("width / height: " + platform.width + ", " + platform.height, 0 , 40)
        // ctx.fillText("slope vert: " + platform.verticalSlope, 0, 60)
        // ctx.fillText("slope horz: " + platform.horizontalSlope, 0, 80)

        
        ctx.restore(); // resets back from platform local space. player view space??
        

        // Centered Axis
        // ctx.fillStyle = "lime"
        // ctx.fillRect(platform.x + platform.width/2 + ((player.y - (platform.y + platform.height/2)) / platform.horizontalSlope), player.y, 5, 5)
        // ctx.fillStyle = "green"
        // ctx.fillRect(platform.x + platform.width/2 + ((player.y - (platform.y + platform.height/2)) / platform.verticalSlope), player.y, 5, 5)
        

        // DRAWING WALL Z-ORDER DEBUG POINTS (CORNERS)
        // ctx.fillStyle = "#FF00FF" // left and right most corners (pink)
        // ctx.fillRect(platform.leftMostPlatformCornerX - 2, platform.leftMostPlatformCornerY - 2, 4, 4)
        // ctx.fillRect(platform.rightMostPlatformCornerX - 2, platform.rightMostPlatformCornerY - 2, 4, 4)
        // ctx.fillStyle = "#0000FF" // center (blue)
        // ctx.fillRect(platform.x + platform.width/2 - 2, platform.y + platform.height/2 - 2, 4, 4)

        
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
        // const blurValue = player.jumpValue / 16 + 1
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
            ctx.strokeStyle = "white"
            ctx.lineWidth = 4
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

        window.addEventListener("touchstart", e => {

            if (e.touches.length === 2) {
                this.pinching = true;
            }
            
            for (let i = 0; i < e.changedTouches.length; i++){ // for loop needed incase multiple touches are sent in the same frame

                if (this.dragging == false) { // if this should be the new dragging touch
                    this.currentDragID = e.changedTouches[i].identifier;
                    this.dragging = true;

                    this.touchX = e.changedTouches[i].pageX;
                    this.touchY = e.changedTouches[i].pageY;
                    this.previousX = e.changedTouches[i].pageX;
                    this.previousY = e.changedTouches[i].pageY;
                }

                UserInterface.touchStarted(e.changedTouches[i].pageX, e.changedTouches[i].pageY); // sends touchStarted for every touchStart

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

                UserInterface.touchReleased(e.changedTouches[i].pageX, e.changedTouches[i].pageY); // sends touchRealease for every release

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
        
        ctx.strokeStyle = "#00000000" // player borders. add 00 to make transparent
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
        // const blurValue = player.jumpValue / 16 + 1
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

        ctx.strokeStyle = "#00000000"; // resetting border stroke
        ctx.lineWidth = 1

        
        // draw border
        ctx.beginPath();
        ctx.rect(-16,-16,32,32)
        ctx.stroke();

        // ctx.drawImage(document.getElementById("playerTop"), -16, -16);

        ctx.restore(); // leaves players space translation AND rotation AND jump value translation


        // SIDES OF PLAYER
        ctx.save();

        const angleRad = this.lookAngle.getAngle() * (Math.PI/180);
        const loopedAngle = this.lookAngle.getAngle();


        // GETTING CORNERS OF ROTATED RECTANGLE
        // https://stackoverflow.com/questions/41898990/find-corners-of-a-rotated-rectangle-given-its-center-point-and-rotation

        if (loopedAngle > 270 || loopedAngle < 90) { // BOT WALL

            const sideVector = new Vector(0,1).rotate(this.lookAngle.getAngle())
            ctx.fillStyle = canvasArea.calculateShadedColor(sideVector, map.style.playerColor)

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

            const sideVector = new Vector(1,0).rotate(this.lookAngle.getAngle())
            ctx.fillStyle = canvasArea.calculateShadedColor(sideVector, map.style.playerColor)

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
            
            const sideVector = new Vector(0,-1).rotate(this.lookAngle.getAngle())
            ctx.fillStyle = canvasArea.calculateShadedColor(sideVector, map.style.playerColor)
            
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

            const sideVector = new Vector(-1,0).rotate(this.lookAngle.getAngle())
            ctx.fillStyle = canvasArea.calculateShadedColor(sideVector, map.style.playerColor)

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

    updatePos() {  // NEEDS TO BE FPS INDEPENDENT
        
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
                
                const distance = pDistance(this.x, this.y, checkpoint.triggerX1, checkpoint.triggerY1, checkpoint.triggerX2, checkpoint.triggerY2)
                // console.log("distance to " + checkpoint + ": " + distance)

                if (distance <= 16) { // COLLIDING WITH CP TRIGGER
                    this.checkpointIndex = map.checkpoints.indexOf(checkpoint) // could do this with a callback index function?
                    // console.log(this.checkpointIndex);
                }

                // gets minumum distance to line segment from point: https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
                function pDistance(x, y, x1, y1, x2, y2) { 

                    const A = x - x1;
                    const B = y - y1;
                    const C = x2 - x1;
                    const D = y2 - y1;

                    const dot = A * C + B * D;
                    const len_sq = C * C + D * D;
                    let param = -1;
                    if (len_sq != 0) //in case of 0 length line
                        param = dot / len_sq;

                    let xx, yy;

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

                    const dx = x - xx;
                    const dy = y - yy;
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
        let collision = 0;
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

            const rectangleStore = [
                new Rectangle(player.x-16, player.y-16, 32, 32, player.lookAngle.getAngle()),
                new Rectangle(platform.x, platform.y, platform.width, platform.height, platform.angle)
            ]

            canvasArea.ctx.fillRect(rectangleStore[0].x, rectangleStore[0].y, rectangleStore[0].width, rectangleStore[0].height)

            function workOutNewPoints(cx, cy, vx, vy, rotatedAngle){ //From a rotated object
                //cx,cy are the centre coordinates, vx,vy is the point to be measured against the center point
                    //Convert rotated angle into radians
                    rotatedAngle = rotatedAngle * Math.PI / 180;
                    const dx = vx - cx;
                    const dy = vy - cy;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const originalAngle = Math.atan2(dy,dx);
                    const rotatedX = cx + distance * Math.cos(originalAngle + rotatedAngle);
                    const rotatedY = cy + distance * Math.sin(originalAngle + rotatedAngle);
                
                    return {
                        x: rotatedX,
                        y: rotatedY
                    }
            }
            
            //Get the rotated coordinates for the square
            function getRotatedSquareCoordinates(square){
                const centerX = square.x + (square.width / 2);
                const centerY = square.y + (square.height / 2);
                //Work out the new locations
                const topLeft = workOutNewPoints(centerX, centerY, square.x, square.y, square.angle);
                const topRight = workOutNewPoints(centerX, centerY, square.x + square.width, square.y, square.angle);
                const bottomLeft = workOutNewPoints(centerX, centerY, square.x, square.y + square.height, square.angle);
                const bottomRight = workOutNewPoints(centerX, centerY, square.x + square.width, square.y + square.height, square.angle);
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
                let perpendicularLine = null;
                let dot = 0;
                const perpendicularStack = [];
                let amin = null;
                let amax = null;
                let bmin = null;
                let bmax = null;
                //Work out all perpendicular vectors on each edge for polygonA
                for(let i = 0; i < polygonA.edge.length; i++){
                    perpendicularLine = new xy(-polygonA.edge[i].y,
                                                polygonA.edge[i].x);
                    perpendicularStack.push(perpendicularLine);
                }
                //Work out all perpendicular vectors on each edge for polygonB
                for(let i = 0; i < polygonB.edge.length; i++){
                    perpendicularLine = new xy(-polygonB.edge[i].y,
                                                polygonB.edge[i].x);
                    perpendicularStack.push(perpendicularLine);
                }
                //Loop through each perpendicular vector for both polygons
                for(let i = 0; i < perpendicularStack.length; i++){
                    //These dot products will return different values each time
                    amin = null;
                    amax = null;
                    bmin = null;
                    bmax = null;
                    /*Work out all of the dot products for all of the vertices in PolygonA against the perpendicular vector
                    that is currently being looped through*/
                    for(let j = 0; j < polygonA.vertex.length; j++){
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
                    for(let j = 0; j < polygonB.vertex.length; j++){
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

                const thisRect = rectangleStore[0];
                const otherRect = rectangleStore[1];

                //Get rotated coordinates for both rectangles
                const tRR = getRotatedSquareCoordinates(thisRect);
                const oRR = getRotatedSquareCoordinates(otherRect);
                //Vertices & Edges are listed in clockwise order. Starting from the top right
                const thisTankVertices = [
                    new xy(tRR.tr.x, tRR.tr.y),
                    new xy(tRR.br.x, tRR.br.y),
                    new xy(tRR.bl.x, tRR.bl.y),
                    new xy(tRR.tl.x, tRR.tl.y),
                ];
                const thisTankEdges = [
                    new xy(tRR.br.x - tRR.tr.x, tRR.br.y - tRR.tr.y),
                    new xy(tRR.bl.x - tRR.br.x, tRR.bl.y - tRR.br.y),
                    new xy(tRR.tl.x - tRR.bl.x, tRR.tl.y - tRR.bl.y),
                    new xy(tRR.tr.x - tRR.tl.x, tRR.tr.y - tRR.tl.y)
                ];
                const otherTankVertices = [
                    new xy(oRR.tr.x, oRR.tr.y),
                    new xy(oRR.br.x, oRR.br.y),
                    new xy(oRR.bl.x, oRR.bl.y),
                    new xy(oRR.tl.x, oRR.tl.y),
                ];
                const otherTankEdges = [
                    new xy(oRR.br.x - oRR.tr.x, oRR.br.y - oRR.tr.y),
                    new xy(oRR.bl.x - oRR.br.x, oRR.bl.y - oRR.br.y),
                    new xy(oRR.tl.x - oRR.bl.x, oRR.tl.y - oRR.bl.y),
                    new xy(oRR.tr.x - oRR.tl.x, oRR.tr.y - oRR.tl.y)
                ];
                const thisRectPolygon = new polygon(thisTankVertices, thisTankEdges);
                const otherRectPolygon = new polygon(otherTankVertices, otherTankEdges);

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
            btn_restart.released(true);
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
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        return new Vector(Math.round(10000*(this.x * cos - this.y * sin))/10000, Math.round(10000*(this.x * sin + this.y * cos))/10000);
    }

    angleDifference = function(otherVec) { // returns degrees i guess idk
        return Math.acos((this.dotProduct(otherVec)) / (this.magnitude() * otherVec.magnitude()))
    }

    getAngle = function() { // RETURNS ANGLE IN DEGREES. https://stackoverflow.com/questions/35271222/getting-the-angle-from-a-direction-vector
        const angle = Math.atan2(this.y, this.x);   //radians
        // you need to divide by PI, and MULTIPLY by 180:
        const degrees = 180 * angle/Math.PI;  //degrees
        return (360+Math.round(degrees))%360; //round number, avoid decimal fragments
    }

    normalize = function(multiplier) { // NOTE: requires multiplier
        if (this.length !== 0) {
            const n = this.divide(this.magnitude()); // dont ever want to normalize when vector length is zero
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

        player.updatePos() // dont need dt
        
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

    UserInterface.render();

}


//      :)