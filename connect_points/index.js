let canvas;
let canvas_ctx;

let circle_radius = 10;
let circle_grid_size = 4;
let min_circle_grid_size = 1;
let max_circle_grid_size = 8;
let circle_grid_start_pos_x = 25;
let circle_grid_start_pos_y = 25;
let circle_grid_spacing = 50;

let start_drag_pos_x = 0;
let start_drag_pos_y = 0;

// last circle row/column where mouse was pressed on
let last_grid_circle_x = -1;
let last_grid_circle_y = -1;

let grid_connection_data = []

let mouse_is_down = false;
let mouse_down_pos_x = 0;
let mouse_down_pos_y = 0;

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

window.onload = function(){
	canvas = document.getElementById('main_canvas');
	canvas_ctx = canvas.getContext('2d');
	
	canvas.addEventListener("mousedown", mouse_down);
	canvas.addEventListener("mouseup", mouse_up);
	canvas.addEventListener("mousemove", mouse_move);
	
	set_grid_size(circle_grid_size);
	
	setInterval(draw_everything, 1000/60);
}

function draw_everything(){
	canvas_ctx.fillStyle = 'white';
	canvas_ctx.fillRect(0,0,canvas.width,canvas.height);
	
	draw_grid_circles();
	draw_grid_lines();
}

function make_index_from_2d_to_1d(x, y, arr_width){
	return y * arr_width + x;
}

function draw_grid_circles(){
	for(let y = 0; y < circle_grid_size; y++){
		for(let x = 0; x < circle_grid_size; x++){
			let pos_x = circle_grid_start_pos_x + x * circle_grid_spacing;
			let pos_y = circle_grid_start_pos_y + y * circle_grid_spacing;
			draw_circle(pos_x, pos_y, circle_radius, 'blue');
		}
	}
}

function draw_grid_lines(){
	for(let i = 0; i < grid_connection_data.length; i++){
		from_x = grid_connection_data[i][0];
		from_y = grid_connection_data[i][1];
		to_x = grid_connection_data[i][2];
		to_y = grid_connection_data[i][3];
		
		from_x = from_x * circle_grid_spacing + circle_grid_start_pos_x;
		from_y = from_y * circle_grid_spacing + circle_grid_start_pos_y;
		to_x = to_x * circle_grid_spacing + circle_grid_start_pos_x;
		to_y = to_y * circle_grid_spacing + circle_grid_start_pos_y;
		
		draw_line(from_x, from_y, to_x, to_y, 'green');
	}
}

function draw_circle(x, y, radius, style){
	let ctx = canvas_ctx;
	ctx.save();
	
	ctx.beginPath();
	// ctx.arc(x - 0.5 * radius, y - 0.5 * radius, radius, 0, 2 * Math.PI, false);
	ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
	ctx.fillStyle = style;
	ctx.fill();
	
	ctx.restore();
}

function draw_line(from_x, from_y, to_x, to_y, style){
	let ctx = canvas_ctx;
	ctx.save();
	
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(from_x, from_y);
	ctx.lineTo(to_x, to_y);
	ctx.strokeStyle = style;
	ctx.stroke();
	
	ctx.restore();
}

function reset_grid(){
	grid_connection_data.length = 0;
}

function set_grid_size(new_size){
	circle_grid_size = clamp(new_size, min_circle_grid_size, max_circle_grid_size);
	document.getElementById("grid_size").textContent = circle_grid_size;
}

function increase_grid_size(){
	set_grid_size(circle_grid_size + 1);
}

function decrease_grid_size(){
	set_grid_size(circle_grid_size - 1);
}

function calculate_intersection_location(mouse_pos_x, mouse_pos_y){
	for(let y = 0; y < circle_grid_size; y++){
		for(let x = 0; x < circle_grid_size; x++){
			let pos_x = circle_grid_start_pos_x + x * circle_grid_spacing;
			let pos_y = circle_grid_start_pos_y + y * circle_grid_spacing;
			let diff_x = pos_x - mouse_pos_x;
			let diff_y = pos_y - mouse_pos_y;
			
			let distance = Math.sqrt(diff_x * diff_x + diff_y * diff_y);
			if(distance <= circle_radius){
				return [x, y]
			}
		}
	}
	
	return []
}

function add_grid_entry_if_needed(mouse_pos_x, mouse_pos_y){
	let intersection = calculate_intersection_location(mouse_pos_x, mouse_pos_y);
	if(intersection.length == 0){
		return;
	}
	
	let old_last_grid_circle_x = last_grid_circle_x;
	let old_last_grid_circle_y = last_grid_circle_y;
	
	last_grid_circle_x = intersection[0];
	last_grid_circle_y = intersection[1];
	
	if(old_last_grid_circle_x == -1 && old_last_grid_circle_y == -1){
		return;
	}
	
	// hack to avoid adding duplicate data such as:
	// (0, 1) -> (2, 3)
	// (2, 3) -> (0, 1)
	let from_idx = make_index_from_2d_to_1d(old_last_grid_circle_x, old_last_grid_circle_y, max_circle_grid_size - 1);
	let to_idx = make_index_from_2d_to_1d(last_grid_circle_x, last_grid_circle_y, max_circle_grid_size - 1);
	
	// we don't want want connections going from same to same element
	if (from_idx == to_idx){
		return;
	}
	
	if (from_idx < to_idx){
		grid_connection_data.push([
			old_last_grid_circle_x,
			old_last_grid_circle_y,
			last_grid_circle_x,
			last_grid_circle_y
		]);
	}
	else{
		grid_connection_data.push([
			last_grid_circle_x,
			last_grid_circle_y,
			old_last_grid_circle_x,
			old_last_grid_circle_y
		]);
	}
	
	// remove duplicate entries
	// https://stackoverflow.com/a/44014849
	grid_connection_data = Array.from(new Set(grid_connection_data.map(JSON.stringify)), JSON.parse)
	
	update_distances();
	update_c_n();
}

function update_distances(){
	let manhattan_distance = 0;
	let true_distance = 0.0;
	for(let i = 0; i < grid_connection_data.length; i++){
		let diff_x = Math.abs(grid_connection_data[i][0] - grid_connection_data[i][2]);
		let diff_y = Math.abs(grid_connection_data[i][1] - grid_connection_data[i][3]);
		manhattan_distance += diff_x + diff_y;
		true_distance += Math.sqrt(diff_x * diff_x + diff_y * diff_y);
	}
	
	document.getElementById("manhattan_distance").textContent = manhattan_distance;
	document.getElementById("true_distance").textContent = parseFloat(true_distance).toFixed(2);
}

function update_c_n(){
	let c_n = 0;
	for(let i = 0; i < grid_connection_data.length; i++){
		let x_i0 = grid_connection_data[i][0] + 1;
		let y_i0 = grid_connection_data[i][1] + 1;
		let x_i1 = grid_connection_data[i][2] + 1;
		let y_i1 = grid_connection_data[i][3] + 1;
		c_n += x_i0 * x_i1 + y_i0 * y_i1;
	}
	document.getElementById("c_n").textContent = c_n;
}

function get_canvas_mouse_pos(event){
	let rect = canvas.getBoundingClientRect();
	return {
		x: event.clientX - rect.left,
		y:event.clientY - rect.top
	}
}

function mouse_down(event) {
	mouse_is_down = true;
	
	last_grid_circle_x = -1;
	last_grid_circle_y = -1;
	
	let mouse_pos = get_canvas_mouse_pos(event);
	
	let intersection = calculate_intersection_location(mouse_pos.x, mouse_pos.y);
	if(intersection.length == 0){
		return;
	}
	
	last_grid_circle_x = intersection[0];
	last_grid_circle_y = intersection[1];
	
	mouse_down_pos_x = mouse_pos.x;
	mouse_down_pos_y = mouse_pos.y;
}

function mouse_up(event) {
	mouse_is_down = false;
}

function mouse_move(event) {
	if (mouse_is_down == false){
		return;
	}
	
	let mouse_pos = get_canvas_mouse_pos(event);
	add_grid_entry_if_needed(mouse_pos.x, mouse_pos.y);
}