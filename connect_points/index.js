let canvas;
let canvas_ctx;

let grid_size = 4;
let min_grid_size = 1;
let max_grid_size = 50;

let circle_line_width_increment = 2;
let line_width = 6;
let min_line_width = 2;
let max_line_width = 20;

let circle_spacing_increment = 5;
let circle_spacing = 80;
let min_circle_spacing = 20;
let max_circle_spacing = 100;

let circle_radius_increment = 5;
let circle_radius = 15;
let min_circle_radius = 5;
let max_circle_radius = 50;

// distance between circle edge and canvas edge
let canvas_padding = 20;

let circle_grid_start_pos_x = 56;
let circle_grid_start_pos_y = 56;

// Last circle row/column where mouse was pressed on
let last_grid_circle_x = -1;
let last_grid_circle_y = -1;

// Array of connection defining arrays
let grid_connection_data = [];

// Undo/redo data (stored as stacks)
let max_memento_size = 100;
let undo_mementos = [];
let redo_mementos = [];

// Array of 1 and 0s where 1 = vertex is taken
let taken_vertices = [];

// Array of 1 and 0s where 1 = edge is intersecting
let intersecting_edges = [];

let left_mouse_button_is_down = false;
let right_mouse_button_is_down = false;
let last_mouse_pos_x = 0;
let last_mouse_pos_y = 0;

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const colour_blue = "#1180ae";
const colour_light_blue = "#36abcc";
const colour_orange = "#edb211";
const colour_light_orange = "#ffcc40";
const colour_green = "#35c13d";
const colour_red = "#ff0000";
const colour_dark_red = "#a10000";

window.onload = function () {
    canvas = document.getElementById('main_canvas');
    canvas_ctx = canvas.getContext('2d');

    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mouseup", mouse_up);
    canvas.addEventListener("mousemove", mouse_move);

    window.addEventListener('contextmenu', (event) => {
        event.preventDefault()
    })

    set_grid_size(grid_size);
    set_line_width(line_width);
    set_circle_spacing(circle_spacing);
    set_circle_radius(circle_radius);
    auto_resize_canvas();

    set_vertices_connected(0);
    set_total_vertices(grid_size * grid_size);
    set_total_connections(0);

    setInterval(draw_everything, 1000 / 60);

    document.getElementById('file_input').addEventListener('change', file_import);
    document.addEventListener('keydown', key_input);
}

function file_import() {
    // Ensure a file is selected
    if (this.files.length === 0) {
        return;
    }

    const selectedFile = this.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const content = e.target.result;
        const parsed_grid_data = parse_grid_import_file(content);
        if (!parsed_grid_data) {
            return;
        }

        undo_mementos.push(structuredClone(grid_connection_data));
        redo_mementos = [];

        grid_connection_data = [];

        parsed_grid_data.forEach((connection) => {
            try_add_new_grid_connection(connection, false);
        });

        log_info("Imported grid data: ", grid_connection_data);

        update_connection_info();
    };

    reader.readAsText(selectedFile);
}

function parse_grid_import_file(content) {
    const lines = content.trim().split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        let numbers = lines[i].trim().split(/\s+/).map(Number);

        // Check if each line contains exactly 2 numbers
        if (numbers.length !== 2) {
            log_error(`Import error in line ${i + 1}: Each line must contain exactly 2 numbers.`);
            return null;
        }

        // Check if each number is an integer
        if (numbers.some(isNaN) || numbers.some(num => !Number.isInteger(num))) {
            log_error(`Import error in line ${i + 1}: Each number must be an integer.`);
            return null;
        }

        // Check if each number is in the range [0, N-1]
        if (numbers.some(num => num <= 0 || num > grid_size * grid_size)) {
            log_error(`Import error in line ${i + 1}: Each number must be in the range [1, ${grid_size * grid_size}].`);
            return null;
        }

        // convert from
        // [1, N*N] grid indexes
        // to
        // [from_x, from_y, to_x, to_y] each in range [0, N-1]
        numbers = numbers.map((num) => num - 1);
        let edge_from = make_2D_index(numbers[0], grid_size);
        let edge_to = make_2D_index(numbers[1], grid_size);
        result.push([edge_from[0], edge_from[1], edge_to[0], edge_to[1]]);
    }

    return result;
}

function import_grid() {
    document.getElementById("file_input").click();
}

function download(content, filename, contentType) {
    if (!contentType) {
        contentType = "application/octet-stream";
    }

    var a = document.createElement("a");
    var blob = new Blob([content], { "type": contentType });
    a.href = window.URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function export_grid() {
    // convert from
    // [from_x, from_y, to_x, to_y] each in range [0, N-1]
    // to
    // [1, N*N] grid indexes
    let mapped_grid_connection_data = [];
    grid_connection_data.forEach((connection) => {
        mapped_grid_connection_data.push([
            make_1D_index(connection[0], connection[1], grid_size) + 1,
            make_1D_index(connection[2], connection[3], grid_size) + 1
        ]);
    });

    const content = mapped_grid_connection_data.map(row => row.join(' ')).join('\n');
    download(content, "grid_data.txt", "text/plain")
}

function key_input(event) {
    if (event.ctrlKey && event.key === 'z') {
        perform_undo();
    }
    else if (event.ctrlKey && event.key === 'y') {
        perform_redo();
    }
}

function draw_everything() {
    canvas_ctx.fillStyle = 'white';
    canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);

    draw_grid_circles();
    draw_grid_lines();
    draw_currently_held_line();
}

// Source: https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
// To find orientation of ordered triplet (p, q, r).
// The function returns following values
// 0 --> p, q and r are collinear
// 1 --> Clockwise
// 2 --> Counterclockwise
function triangle_orientation(p, q, r) {
    // See https://www.geeksforgeeks.org/orientation-3-ordered-points/
    // for details of below formula.
    let val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);

    if (val == 0) return 0;  // collinear

    return (val > 0) ? 1 : 2; // clock or counterclock wise
}

// Returns true if line segment 'p1q1' and 'p2q2' intersect
// assuming they're not collinear and they don't share vertexes.
function segments_intersect(p1, q1, p2, q2) {
    // Discard cases where segments share the same vertex
    if (p1.x === p2.x && p1.y === p2.y)
        return false;

    if (p1.x === q2.x && p1.y === q2.y)
        return false;

    if (q1.x === p2.x && q1.y === p2.y)
        return false;

    if (q1.x === q2.x && q1.y === q2.y)
        return false;


    let o1 = triangle_orientation(p1, q1, p2);
    let o2 = triangle_orientation(p1, q1, q2);
    let o3 = triangle_orientation(p2, q2, p1);
    let o4 = triangle_orientation(p2, q2, q1);

    if (o1 != o2 && o3 != o4)
        return true;

    return false;
}

function make_1D_index(x, y, arr_width) {
    return y * arr_width + x;
}

function make_2D_index(i, arr_width) {
    const y = Math.floor(i / arr_width);
    const x = i % arr_width;
    return [x, y];
}

function draw_grid_circles() {
    let mark_connected_vertices_enabled = is_mark_connected_vertices_enabled();

    for (let y = 0; y < grid_size; y++) {
        for (let x = 0; x < grid_size; x++) {
            let pos_x = circle_grid_start_pos_x + x * circle_spacing;
            let pos_y = circle_grid_start_pos_y + y * circle_spacing;

            let diff_x = pos_x - last_mouse_pos_x;
            let diff_y = pos_y - last_mouse_pos_y;

            let vertex_idx = make_1D_index(x, y, grid_size);
            let vertex_is_taken = false;
            if (taken_vertices[vertex_idx] === 1) {
                vertex_is_taken = true;
            }

            let distance = Math.sqrt(diff_x * diff_x + diff_y * diff_y);
            if (distance <= circle_radius) {
                if (mark_connected_vertices_enabled && vertex_is_taken) {
                    draw_circle(pos_x, pos_y, circle_radius, colour_light_orange);
                }
                else {
                    draw_circle(pos_x, pos_y, circle_radius, colour_light_blue);
                }
            }
            else {
                if (mark_connected_vertices_enabled && vertex_is_taken) {
                    draw_circle(pos_x, pos_y, circle_radius, colour_orange);
                }
                else {
                    draw_circle(pos_x, pos_y, circle_radius, colour_blue);
                }
            }
        }
    }
}

function draw_grid_lines() {
    let mark_intersecting_edges_enabled = is_mark_intersecting_edges_enabled();

    if (mark_intersecting_edges_enabled) {
        // Split up drawing iterations, to avoid random order of line draws on top of another
        // First draw green lines, then red lines

        for (let i = 0; i < grid_connection_data.length; i++) {
            if (intersecting_edges[i] !== 0) {
                continue;
            }

            from_x = grid_connection_data[i][0];
            from_y = grid_connection_data[i][1];
            to_x = grid_connection_data[i][2];
            to_y = grid_connection_data[i][3];

            from_x = from_x * circle_spacing + circle_grid_start_pos_x;
            from_y = from_y * circle_spacing + circle_grid_start_pos_y;
            to_x = to_x * circle_spacing + circle_grid_start_pos_x;
            to_y = to_y * circle_spacing + circle_grid_start_pos_y;

            draw_line(from_x, from_y, to_x, to_y, colour_green);
        }

        for (let i = 0; i < grid_connection_data.length; i++) {
            if (intersecting_edges[i] !== 1) {
                continue;
            }

            from_x = grid_connection_data[i][0];
            from_y = grid_connection_data[i][1];
            to_x = grid_connection_data[i][2];
            to_y = grid_connection_data[i][3];

            from_x = from_x * circle_spacing + circle_grid_start_pos_x;
            from_y = from_y * circle_spacing + circle_grid_start_pos_y;
            to_x = to_x * circle_spacing + circle_grid_start_pos_x;
            to_y = to_y * circle_spacing + circle_grid_start_pos_y;

            draw_line(from_x, from_y, to_x, to_y, colour_red);
        }
    }
    else {
        for (let i = 0; i < grid_connection_data.length; i++) {
            from_x = grid_connection_data[i][0];
            from_y = grid_connection_data[i][1];
            to_x = grid_connection_data[i][2];
            to_y = grid_connection_data[i][3];

            from_x = from_x * circle_spacing + circle_grid_start_pos_x;
            from_y = from_y * circle_spacing + circle_grid_start_pos_y;
            to_x = to_x * circle_spacing + circle_grid_start_pos_x;
            to_y = to_y * circle_spacing + circle_grid_start_pos_y;

            draw_line(from_x, from_y, to_x, to_y, colour_green);
        }
    }
}

function draw_currently_held_line() {
    if (last_grid_circle_x == -1 && last_grid_circle_y == -1) {
        return;
    }

    from_x = last_grid_circle_x * circle_spacing + circle_grid_start_pos_x;
    from_y = last_grid_circle_y * circle_spacing + circle_grid_start_pos_y;
    to_x = last_mouse_pos_x;
    to_y = last_mouse_pos_y;

    if (left_mouse_button_is_down) {
        draw_line(from_x, from_y, to_x, to_y, colour_green);
    }
    else {
        draw_line(from_x, from_y, to_x, to_y, colour_dark_red);
    }
}

function draw_circle(x, y, radius, style) {
    let ctx = canvas_ctx;
    ctx.save();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = style;
    ctx.fill();

    ctx.restore();
}

function draw_line(from_x, from_y, to_x, to_y, style) {
    let ctx = canvas_ctx;
    ctx.save();

    ctx.lineWidth = line_width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from_x, from_y);
    ctx.lineTo(to_x, to_y);
    ctx.strokeStyle = style;
    ctx.stroke();

    ctx.restore();
}

function reset_grid() {
    undo_mementos.push(structuredClone(grid_connection_data));
    redo_mementos = [];

    grid_connection_data.length = 0;
    update_connection_info();
}

function set_grid_size(new_value) {
    grid_size = clamp(new_value, min_grid_size, max_grid_size);
    document.getElementById("grid_size").textContent = grid_size;
    auto_resize_canvas();
}

function increase_grid_size() {
    set_grid_size(grid_size + 1);
    update_connection_info();
}

function decrease_grid_size() {
    set_grid_size(grid_size - 1);

    // remove out of bounds grid connections
    for (let i = 0; i < grid_connection_data.length; i++) {
        for (let j = 0; j < 4; j++) {
            if (grid_connection_data[i][j] >= grid_size) {
                grid_connection_data.splice(i, 1);
                i--;
                break;
            }
        }
    }

    update_connection_info();
}

function set_line_width(new_value) {
    line_width = clamp(new_value, min_line_width, max_line_width);
    document.getElementById("line_width").textContent = line_width;
}

function increase_line_width() {
    set_line_width(line_width + circle_line_width_increment);
}

function decrease_line_width() {
    set_line_width(line_width - circle_line_width_increment);
}

function set_circle_spacing(new_value) {
    circle_spacing = clamp(new_value, min_circle_spacing, max_circle_spacing);
    document.getElementById("circle_spacing").textContent = circle_spacing;
    auto_resize_canvas();
}

function increase_circle_spacing() {
    set_circle_spacing(circle_spacing + circle_spacing_increment);
}

function decrease_circle_spacing() {
    set_circle_spacing(circle_spacing - circle_spacing_increment);
}

function set_circle_radius(new_value) {
    circle_radius = clamp(new_value, min_circle_radius, max_circle_radius);
    document.getElementById("circle_radius").textContent = circle_radius;
    recalculate_grid_start_pos();
    auto_resize_canvas();
}

function increase_circle_radius() {
    set_circle_radius(circle_radius + circle_radius_increment);
}

function decrease_circle_radius() {
    set_circle_radius(circle_radius - circle_radius_increment);
}

function auto_resize_canvas() {
    let canvas_size = 2 * canvas_padding + 2 * circle_radius + circle_spacing * (grid_size - 1);
    document.getElementById("main_canvas").width = canvas_size;
    document.getElementById("main_canvas").height = canvas_size;

    draw_everything();
}

function recalculate_grid_start_pos() {
    let start_pos = canvas_padding + circle_radius;
    circle_grid_start_pos_x = start_pos;
    circle_grid_start_pos_y = start_pos;
}

function calculate_intersection_location(mouse_pos_x, mouse_pos_y) {
    for (let y = 0; y < grid_size; y++) {
        for (let x = 0; x < grid_size; x++) {
            let pos_x = circle_grid_start_pos_x + x * circle_spacing;
            let pos_y = circle_grid_start_pos_y + y * circle_spacing;
            let diff_x = pos_x - mouse_pos_x;
            let diff_y = pos_y - mouse_pos_y;

            let distance = Math.sqrt(diff_x * diff_x + diff_y * diff_y);
            if (distance <= circle_radius) {
                return [x, y]
            }
        }
    }

    return []
}

function try_add_new_grid_connection(connection, add_to_undo_stack) {
    let [from_x, from_y, to_x, to_y] = connection;

    let from_idx = make_1D_index(from_x, from_y, grid_size);
    let to_idx = make_1D_index(to_x, to_y, grid_size);

    // we don't want want connections going from same to same element
    if (from_idx == to_idx) {
        return;
    }

    let vec_x = Math.abs(from_x - to_x);
    let vec_y = Math.abs(from_y - to_y);

    let vector_count = gcd(vec_x, vec_y);
    let simplified_vector = { x: vec_x / vector_count, y: vec_y / vector_count };

    if (from_x > to_x) {
        simplified_vector.x *= -1;
    }

    if (from_y > to_y) {
        simplified_vector.y *= -1;
    }

    // hack to avoid adding duplicate data such as:
    // (0, 1) -> (2, 3)
    // (2, 3) -> (0, 1)
    if (from_idx > to_idx) {
        [from_x, to_x] = [to_x, from_x];
        [from_y, to_y] = [to_y, from_y];
        simplified_vector.x *= -1;
        simplified_vector.y *= -1;
    }

    if (add_to_undo_stack) {
        undo_mementos.push(structuredClone(grid_connection_data));
    }

    for (let i = 0; i < vector_count; i++) {
        grid_connection_data.push([
            from_x + simplified_vector.x * i,
            from_y + simplified_vector.y * i,
            from_x + simplified_vector.x * (i + 1),
            from_y + simplified_vector.y * (i + 1)
        ]);
    }

    // remove duplicate entries
    // https://stackoverflow.com/a/44014849
    grid_connection_data = Array.from(new Set(grid_connection_data.map(JSON.stringify)), JSON.parse);

    if (add_to_undo_stack) {
        // revert new action from undo stack, if nothing was added
        if (undo_mementos[undo_mementos.length - 1].length === grid_connection_data.length) {
            undo_mementos.pop();
        }
        else {
            // otherwise, new action appeared, clear redo stack
            redo_mementos = [];

            // don't store too many undo actions
            if (undo_mementos.length > max_memento_size) {
                undo_mementos.shift();
            }
        }
    }

    update_connection_info();
}

function add_grid_entry_if_needed(mouse_pos_x, mouse_pos_y) {
    let intersection = calculate_intersection_location(mouse_pos_x, mouse_pos_y);
    if (intersection.length == 0) {
        return;
    }

    let old_last_grid_circle_x = last_grid_circle_x;
    let old_last_grid_circle_y = last_grid_circle_y;

    last_grid_circle_x = intersection[0];
    last_grid_circle_y = intersection[1];

    if (old_last_grid_circle_x == -1 && old_last_grid_circle_y == -1) {
        return;
    }

    let from_x = old_last_grid_circle_x;
    let from_y = old_last_grid_circle_y;
    let to_x = last_grid_circle_x;
    let to_y = last_grid_circle_y;

    try_add_new_grid_connection([from_x, from_y, to_x, to_y], true);
}

function remove_grid_entry_if_needed(mouse_pos_x, mouse_pos_y) {
    let intersection = calculate_intersection_location(mouse_pos_x, mouse_pos_y);
    if (intersection.length == 0) {
        return;
    }

    let old_last_grid_circle_x = last_grid_circle_x;
    let old_last_grid_circle_y = last_grid_circle_y;

    last_grid_circle_x = intersection[0];
    last_grid_circle_y = intersection[1];

    if (old_last_grid_circle_x == -1 && old_last_grid_circle_y == -1) {
        return;
    }

    undo_mementos.push(structuredClone(grid_connection_data));

    let arr_to_remove1 = [old_last_grid_circle_x, old_last_grid_circle_y, last_grid_circle_x, last_grid_circle_y];
    let arr_to_remove2 = [last_grid_circle_x, last_grid_circle_y, old_last_grid_circle_x, old_last_grid_circle_y];

    for (let i = 0; i < grid_connection_data.length; i++) {
        let is_equal1 = true;
        let is_equal2 = true;
        for (let j = 0; j < 4; j++) {
            if (grid_connection_data[i][j] != arr_to_remove1[j]) {
                is_equal1 = false;
            }
            if (grid_connection_data[i][j] != arr_to_remove2[j]) {
                is_equal2 = false;
            }
        }

        if (is_equal1 || is_equal2) {
            grid_connection_data.splice(i, 1);
        }
    }

    // revert new action from undo stack, if nothing was added
    if (undo_mementos[undo_mementos.length - 1].length === grid_connection_data.length) {
        undo_mementos.pop();
    }
    else {
        // otherwise, new action appeared, clear redo stack
        redo_mementos = [];

        // don't store too many undo actions
        if (undo_mementos.length > max_memento_size) {
            undo_mementos.shift();
        }
    }

    update_connection_info();
}

// NOTE: Only works with connections. Doesn't work with grid size changes or other parameters.
function perform_undo() {
    if (undo_mementos.length === 0) {
        return;
    }

    redo_mementos.push(structuredClone(grid_connection_data));
    grid_connection_data = undo_mementos.pop();

    update_connection_info();
}

function perform_redo() {
    if (redo_mementos.length === 0) {
        return;
    }

    undo_mementos.push(structuredClone(grid_connection_data));
    grid_connection_data = redo_mementos.pop();

    update_connection_info();
}

function set_d_g(new_value) {
    document.getElementById("d_g").textContent = new_value;
}

function set_vertices_connected(new_value) {
    document.getElementById("vertices_connected").textContent = new_value;
}

function set_total_vertices(new_value) {
    document.getElementById("total_vertices").textContent = new_value;
}

function set_total_connections(new_value) {
    document.getElementById("total_connections").textContent = new_value;
}

function is_mark_intersecting_edges_enabled() {
    return document.getElementById("mark_intersecting_edges").checked;
}

function is_mark_connected_vertices_enabled() {
    return document.getElementById("mark_connected_vertices").checked;
}

function is_auto_connect_circles_enabled() {
    return document.getElementById("auto_connect_circles").checked;
}

function update_connection_info() {
    let d_g = 0;
    for (let i = 0; i < grid_connection_data.length; i++) {
        let diff_x = Math.abs(grid_connection_data[i][0] - grid_connection_data[i][2]);
        let diff_y = Math.abs(grid_connection_data[i][1] - grid_connection_data[i][3]);
        d_g += diff_x * diff_x + diff_y * diff_y;
    }
    set_d_g(d_g);

    // initialise array with 0 values
    taken_vertices = Array.apply(null, Array(grid_size * grid_size)).map(function (x, i) { return 0; });
    let vertices_connected = 0;
    for (let i = 0; i < grid_connection_data.length; i++) {
        let from_idx = make_1D_index(grid_connection_data[i][0], grid_connection_data[i][1], grid_size);
        let to_idx = make_1D_index(grid_connection_data[i][2], grid_connection_data[i][3], grid_size);
        if (taken_vertices[from_idx] === 0) {
            taken_vertices[from_idx] = 1;
            vertices_connected += 1;
        }
        if (taken_vertices[to_idx] === 0) {
            taken_vertices[to_idx] = 1;
            vertices_connected += 1;
        }
    }

    set_vertices_connected(vertices_connected);

    set_total_vertices(grid_size * grid_size);

    set_total_connections(grid_connection_data.length);

    // initialise array with 0 values
    intersecting_edges = Array.apply(null, Array(grid_connection_data.length)).map(function (x, i) { return 0; });
    for (let i = 0; i < grid_connection_data.length; i++) {
        for (let j = 0; j < grid_connection_data.length; j++) {
            if (i === j) {
                continue;
            }

            p1 = { x: grid_connection_data[i][0], y: grid_connection_data[i][1] };
            q1 = { x: grid_connection_data[i][2], y: grid_connection_data[i][3] };
            p2 = { x: grid_connection_data[j][0], y: grid_connection_data[j][1] };
            q2 = { x: grid_connection_data[j][2], y: grid_connection_data[j][3] };

            if (segments_intersect(p1, q1, p2, q2)) {
                intersecting_edges[i] = 1;
                break;
            }
        }
    }
}

function get_canvas_mouse_pos(event) {
    let rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    }
}

function mouse_down(event) {
    mouse_is_down = true;
    if (event.button == 0) {
        left_mouse_button_is_down = true;
    }

    if (event.button == 2) {
        right_mouse_button_is_down = true;
    }

    last_grid_circle_x = -1;
    last_grid_circle_y = -1;

    let mouse_pos = get_canvas_mouse_pos(event);

    let intersection = calculate_intersection_location(mouse_pos.x, mouse_pos.y);
    if (intersection.length == 0) {
        return;
    }

    last_grid_circle_x = intersection[0];
    last_grid_circle_y = intersection[1];
}

function mouse_up(event) {
    let mouse_pos = get_canvas_mouse_pos(event);

    if (event.button == 0) {
        add_grid_entry_if_needed(mouse_pos.x, mouse_pos.y);
        left_mouse_button_is_down = false;
    }

    if (event.button == 2) {
        remove_grid_entry_if_needed(mouse_pos.x, mouse_pos.y);
        right_mouse_button_is_down = false;
    }

    last_grid_circle_x = -1;
    last_grid_circle_y = -1;
}

function mouse_move(event) {
    let mouse_pos = get_canvas_mouse_pos(event);

    last_mouse_pos_x = mouse_pos.x
    last_mouse_pos_y = mouse_pos.y

    if (is_auto_connect_circles_enabled() == false) {
        return;
    }

    if (left_mouse_button_is_down == true) {
        add_grid_entry_if_needed(mouse_pos.x, mouse_pos.y);
    }
    else if (right_mouse_button_is_down == true) {
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

function log_error(text, ...args) {
    alert("ERROR: " + text);
    if (args.length > 0) {
        console.log("ERROR: " + text, args);
    } else {
        console.log("ERROR: " + text);
    }
}

function log_info(text, ...args) {
    if (args.length > 0) {
        console.log("INFO: " + text, args);
    } else {
        console.log("INFO: " + text);
    }
}