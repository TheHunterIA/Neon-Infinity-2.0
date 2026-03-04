# Main.gd (Godot 4.x)
extends Node

@export var obstacle_scene: PackedScene
@export var powerup_scene: PackedScene

var score = 0
var speed_multiplier = 1.0
var is_game_over = false

func _ready():
    $SpawnTimer.start()

func _on_spawn_timer_timeout():
    if is_game_over: return
    
    var spawn_roll = randf()
    if spawn_roll > 0.95:
        spawn_powerup()
    else:
        spawn_obstacle()
    
    # Dynamic spawn rate
    $SpawnTimer.wait_time = max(0.3, 1.0 / (speed_multiplier))

func spawn_obstacle():
    var obs = obstacle_scene.instantiate()
    var screen_width = get_viewport_rect().size.x
    obs.position = Vector2(randf_range(50, screen_width - 50), -100)
    obs.speed = 400.0 * speed_multiplier
    add_child(obs)

func spawn_powerup():
    var pu = powerup_scene.instantiate()
    # ... logic for powerups ...
    add_child(pu)

func _process(delta):
    if not is_game_over:
        score += 1
        speed_multiplier += 0.0001
        $HUD/ScoreLabel.text = str(score)

func game_over():
    is_game_over = true
    $HUD/GameOverScreen.show()
    save_score_to_api(score)

func save_score_to_api(final_score):
	var http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(_on_request_completed)

	var url = "https://ais-dev-yvkqyvufaufozjmace544k-141617301397.us-east1.run.app/api/scores"
	var headers = ["Content-Type: application/json"]
	var body = JSON.stringify({
		"username": "Pilot_" + str(randi() % 1000), # Exemplo de nome
		"score": final_score
	})

	var error = http_request.request(url, headers, HTTPClient.METHOD_POST, body)
	if error != OK:
		push_error("Ocorreu um erro ao iniciar a requisição HTTP.")

func _on_request_completed(result, response_code, headers, body):
	if response_code == 200:
		var json = JSON.parse_string(body.get_string_from_utf8())
		print("Pontuação salva com sucesso: ", json)
	else:
		push_error("Falha ao salvar pontuação. Código: ", response_code)
	
	# Limpeza: remove o nó após a conclusão
	get_child(get_child_count() - 1).queue_free()
