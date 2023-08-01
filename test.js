function startGame() {

    const text = document.getElementById("text1");
    let dt;

    var lastUpdate = Date.now();
    setInterval(tick, 1000/0);
    setInterval(refreshCanvas, 1000/2);
    
    function tick() {
        var now = Date.now();
        dt = now - lastUpdate;
        lastUpdate = now;
    
        gameLogic();
    }

    function refreshCanvas() { // Called at 60fps
        text.innerHTML = (1000/dt);
    }

    function gameLogic() {
        // console.log(1000 / dt);
    }
}