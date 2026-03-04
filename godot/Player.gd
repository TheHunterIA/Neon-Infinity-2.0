# Player.gd (Godot 4.x)
extends Area2D

signal hit
signal power_up(type)

var velocity = Vector2.ZERO
var accel = 2500.0
var friction = 0.92
var max_vel = 600.0
var screen_size

func _ready():
    screen_size = get_viewport_rect().size
    add_to_group("player")

func _physics_process(delta):
    var input_dir = Vector2.ZERO
    input_dir.x = Input.get_axis("ui_left", "ui_right")
    input_dir.y = Input.get_axis("ui_up", "ui_down")
    
    # Suporte para toque (simulando o touchTarget do React)
    if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
        var target = get_global_mouse_position()
        var to_target = target - global_position
        if to_target.length() > 10:
            input_dir = to_target.normalized()

    if input_dir != Vector2.ZERO:
        velocity += input_dir * accel * delta
    
    # Física de deslize
    velocity *= pow(friction, delta * 60)
    velocity = velocity.limit_length(max_vel)
    
    position += velocity * delta
    
    # Constraints
    position.x = clamp(position.x, 50, screen_size.x - 50)
    position.y = clamp(position.y, 100, screen_size.y - 50)

func _on_area_entered(area):
    if area.is_in_group("obstacles"):
        hit.emit()
    elif area.is_in_group("powerups"):
        power_up.emit(area.type)
        area.queue_free()
