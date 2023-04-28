let canvas;
let canvas_ctx;

let circle_radius = 16;
let circle_grid_size = 4;
let min_circle_grid_size = 1;
let max_circle_grid_size = 8;
let circle_grid_start_pos_x = 40;
let circle_grid_start_pos_y = 40;
let circle_grid_spacing = 80;

let start_drag_pos_x = 0;
let start_drag_pos_y = 0;

// last circle row/column where mouse was pressed on
let last_grid_circle_x = -1;
let last_grid_circle_y = -1;

let grid_connection_data = []

let left_mouse_button_is_down = false;
let right_mouse_button_is_down = false;
let last_mouse_pos_x = 0;
let last_mouse_pos_y = 0;

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const colour_blue = "#1180ae";
const colour_light_blue = "#36abcc";
const colour_green = "#35c13d";
const colour_red = "#ff0000";

window.onload = function(){
	canvas = document.getElementById('main_canvas');
	canvas_ctx = canvas.getContext('2d');
	
	canvas.addEventListener("mousedown", mouse_down);
	canvas.addEventListener("mouseup", mouse_up);
	canvas.addEventListener("mousemove", mouse_move);
	
	window.addEventListener('contextmenu', (event) => {
		event.preventDefault()
	})
	
	set_grid_size(circle_grid_size);
	
	setInterval(draw_everything, 1000/60);
}

function draw_everything(){
	canvas_ctx.fillStyle = 'white';
	canvas_ctx.fillRect(0,0,canvas.width,canvas.height);
	
	draw_grid_circles();
	draw_grid_lines();
	draw_currently_held_line();
}

function make_index_from_2d_to_1d(x, y, arr_width){
	return y * arr_width + x;
}

function draw_grid_circles(){
	for(let y = 0; y < circle_grid_size; y++){
		for(let x = 0; x < circle_grid_size; x++){
			let pos_x = circle_grid_start_pos_x + x * circle_grid_spacing;
			let pos_y = circle_grid_start_pos_y + y * circle_grid_spacing;
			
			let diff_x = pos_x - last_mouse_pos_x;
			let diff_y = pos_y - last_mouse_pos_y;
			
			let distance = Math.sqrt(diff_x * diff_x + diff_y * diff_y);
			if(distance <= circle_radius){
				draw_circle(pos_x, pos_y, circle_radius, colour_light_blue);
			}
			else{
				draw_circle(pos_x, pos_y, circle_radius, colour_blue);
			}
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
		
		draw_line(from_x, from_y, to_x, to_y, colour_green);
	}
}

function draw_currently_held_line(){
	if(last_grid_circle_x == -1 && last_grid_circle_y == -1){
		return;
	}
	
	from_x = last_grid_circle_x * circle_grid_spacing + circle_grid_start_pos_x;
	from_y = last_grid_circle_y * circle_grid_spacing + circle_grid_start_pos_y;
	to_x = last_mouse_pos_x;
	to_y = last_mouse_pos_y;
	
	if(left_mouse_button_is_down){
		draw_line(from_x, from_y, to_x, to_y, colour_green);
	}
	else{
		draw_line(from_x, from_y, to_x, to_y, colour_red);
	}
}

function draw_circle(x, y, radius, style){
	let ctx = canvas_ctx;
	ctx.save();
	
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
	ctx.fillStyle = style;
	ctx.fill();
	
	ctx.restore();
}

function draw_line(from_x, from_y, to_x, to_y, style){
	let ctx = canvas_ctx;
	ctx.save();
	
	ctx.lineWidth = 5;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(from_x, from_y);
	ctx.lineTo(to_x, to_y);
	ctx.strokeStyle = style;
	ctx.stroke();
	
	ctx.restore();
}

function reset_grid(){
	grid_connection_data.length = 0;
	update_connection_measurements();
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
	
	// remove out of bounds grid connections
	for(let i = 0; i < grid_connection_data.length; i++){
		console.log(i);
		for(let j = 0; j < 4; j++){
			if(grid_connection_data[i][j] >= circle_grid_size){
				grid_connection_data.splice(i, 1);
				i--;
				break;
			}
		}
	}
	
	update_connection_measurements();
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

	let a_x = old_last_grid_circle_x;
	let a_y = old_last_grid_circle_y;
	let b_x = last_grid_circle_x;
	let b_y = last_grid_circle_y;
	let from_idx = make_index_from_2d_to_1d(a_x, a_y, max_circle_grid_size - 1);
	let to_idx = make_index_from_2d_to_1d(b_x, b_y, max_circle_grid_size - 1);
	
	// we don't want want connections going from same to same element
	if (from_idx == to_idx){
		return;
	}
	
	let vec_x = Math.abs(a_x - b_x);
	let vec_y = Math.abs(a_y - b_y);
	
	let vector_count = gcd(vec_x, vec_y);
	let simplified_vector = {x: vec_x / vector_count, y: vec_y / vector_count};

	if(a_x > b_x){
		simplified_vector.x *= -1;
	}
	
	if(a_y > b_y){
		simplified_vector.y *= -1;
	}
	
	// hack to avoid adding duplicate data such as:
	// (0, 1) -> (2, 3)
	// (2, 3) -> (0, 1)
	if (from_idx > to_idx){
		[a_x, b_x] = [b_x, a_x];
		[a_y, b_y] = [b_y, a_y];
		simplified_vector.x *= -1;
		simplified_vector.y *= -1;
	}
	
	for(let i = 0; i < vector_count; i++){
		grid_connection_data.push([
			a_x + simplified_vector.x * i,
			a_y + simplified_vector.y * i,
			a_x + simplified_vector.x * (i + 1),
			a_y + simplified_vector.y * (i + 1)
		]);
	}
	
	// remove duplicate entries
	// https://stackoverflow.com/a/44014849
	grid_connection_data = Array.from(new Set(grid_connection_data.map(JSON.stringify)), JSON.parse)
	
	update_connection_measurements();
}

function remove_grid_entry_if_needed(mouse_pos_x, mouse_pos_y){
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
	
	let arr_to_remove1 = [old_last_grid_circle_x, old_last_grid_circle_y, last_grid_circle_x, last_grid_circle_y];
	let arr_to_remove2 = [last_grid_circle_x, last_grid_circle_y, old_last_grid_circle_x, old_last_grid_circle_y];
	// console.log(arr_to_remove1.toString(), arr_to_remove2.toString());
	// console.log(arr_to_remove2.toString());
	for(let i = 0; i < grid_connection_data.length; i++){
		let is_equal1 = true;
		let is_equal2 = true;
		for(let j = 0; j < 4; j++){
			if(grid_connection_data[i][j] != arr_to_remove1[j]){
				is_equal1 = false;
			}
			if(grid_connection_data[i][j] != arr_to_remove2[j]){
				is_equal2 = false;
			}
		}
		// let contains = grid_connection_data.every(function(value, index) { return value === arr_to_remove[index]});
		if(is_equal1 || is_equal2){
			grid_connection_data.splice(i, 1);
		}
	}

	update_connection_measurements();
}

function set_d_l(new_value){
	document.getElementById("d_l").textContent = new_value;
}

function set_c_l(new_value){
	document.getElementById("c_l").textContent = new_value;
}

function update_connection_measurements(){
	let d_l = 0;
	for(let i = 0; i < grid_connection_data.length; i++){
		let diff_x = Math.abs(grid_connection_data[i][0] - grid_connection_data[i][2]);
		let diff_y = Math.abs(grid_connection_data[i][1] - grid_connection_data[i][3]);
		d_l += diff_x * diff_x + diff_y * diff_y;
	}
	set_d_l(d_l);
	
	let c_l = 0;
	for(let i = 0; i < grid_connection_data.length; i++){
		let x_i0 = grid_connection_data[i][0] + 1;
		let y_i0 = grid_connection_data[i][1] + 1;
		let x_i1 = grid_connection_data[i][2] + 1;
		let y_i1 = grid_connection_data[i][3] + 1;
		c_l += x_i0 * x_i1 + y_i0 * y_i1;
	}
	
	set_c_l(c_l);
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
	if(event.button == 0){
		left_mouse_button_is_down = true;
	}
	
	if (event.button == 2){
		right_mouse_button_is_down = true;
	}
	
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
	if(event.button == 0){
		left_mouse_button_is_down = false;
	}
	
	if (event.button == 2){
		right_mouse_button_is_down = false;
	}
	
	last_grid_circle_x = -1;
	last_grid_circle_y = -1;
}

function mouse_move(event) {
	let mouse_pos = get_canvas_mouse_pos(event);
	
	last_mouse_pos_x = mouse_pos.x
	last_mouse_pos_y = mouse_pos.y
	
	if (left_mouse_button_is_down == true){
		add_grid_entry_if_needed(mouse_pos.x, mouse_pos.y);
	}
	else if (right_mouse_button_is_down == true){
		remove_grid_entry_if_needed(mouse_pos.x, mouse_pos.y);
	}
}

function gcd(a, b) {
    if (b) {
        return gcd(b, a % b);
    } else {
        return Math.abs(a);
    }
}