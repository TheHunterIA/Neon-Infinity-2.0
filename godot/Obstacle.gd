# Obstacle.gd (Godot 4.x)
extends Area2D

var speed = 400.0
var type = "static"
var vx = 0.0

func _ready():
    add_to_group("obstacles")
    # Randomize visual properties like in React
    var scale_factor = randf_range(0.8, 1.5)
    scale = Vector2(scale_factor, scale_factor)

func _process(delta):
    position.y += speed * delta
    position.x += vx * delta
    
    # Bounce off walls if moving
    var screen_width = get_viewport_rect().size.x
    if position.x < 0 or position.x > screen_width:
        vx *= -1

    if position.y > get_viewport_rect().size.y + 100:
        queue_free()
