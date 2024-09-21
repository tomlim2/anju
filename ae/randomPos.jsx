var comp = app.project.activeItem;
if (comp && comp.selectedLayers.length > 0) {
    app.beginUndoGroup("Set Random Position");

    for (var i = 0; i < comp.selectedLayers.length; i++) {
        var layer = comp.selectedLayers[i];
        var randomX = Math.random() * comp.width;
        var randomY = Math.random() * comp.height;
        layer.property("Position").setValue([randomX, randomY]);
    }

    app.endUndoGroup();
} else {
    alert("Please select one or more layers.");
}