let canvas;
let canvas_ctx;

let grid_size = 4;
const min_grid_size = 1;
const max_grid_size = 50;

let circle_line_width_increment = 2;
let line_width = 6;
const min_line_width = 2;
const max_line_width = 20;

let circle_spacing_increment = 5;
let circle_spacing = 80;
const min_circle_spacing = 20;
const max_circle_spacing = 100;

let circle_radius = 15;
const circle_radius_increment = 5;
const min_circle_radius = 5;
const max_circle_radius = 50;

// distance between circle edge and canvas edge
const canvas_padding = 20;

let circle_grid_start_pos_x = 56;
let circle_grid_start_pos_y = 56;

// Last circle row/column where mouse was pressed on
let last_grid_circle_x = -1;
let last_grid_circle_y = -1;

// Array of connection defining arrays
let grid_connection_data = [];

// Undo/redo data (stored as stacks)
const max_memento_size = 100;
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

    set_grid_size(grid_size, false);
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

    const selected_file = this.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const content = e.target.result;
        const parsed_import_data = parse_import_file(content);
        if (!parsed_import_data) {
            return;
        }

        push_undo_state();

        set_grid_size(parsed_import_data.grid_size, false);

        grid_connection_data = [];
        parsed_import_data.grid_connection_data.forEach((connection) => {
            try_add_new_grid_connection(connection, false);
        });

        log_info("Imported grid size: ", grid_size);
        log_info("Imported grid data: ", grid_connection_data);

        update_connection_info();
    };

    reader.readAsText(selected_file);
}

function parse_import_file_as_connection_list(content) {
    const lines = content.trim().split('\n');
    const result = {
        grid_connection_data: [],
        grid_size: 0,
    };

    if (lines.length < 1) {
        log_error(`Import error in line ${1}: Expected grid size.`);
        return null;
    }

    for (let i = 0; i < lines.length; i++) {
        let numbers = lines[i].trim().split(/\s+/).map(Number);

        // Check if each number is an integer
        if (numbers.some(isNaN) || numbers.some(num => !Number.isInteger(num))) {
            log_error(`Import error in line ${i + 1}: Each number must be an integer.`);
            return null;
        }

        // Expect grid size
        if (i === 0) {
            if (numbers.length !== 1) {
                log_error(`Import error in line ${i + 1}: Line defining grid size must contain exactly 1 number.`);
                return null;
            }

            if (numbers.some(num => num !== clamp(num, min_grid_size, max_grid_size))) {
                log_error(`Import error in line ${i + 1}: Grid size must be in the range [${min_grid_size}, ${max_grid_size}].`);
                return null;
            }

            result.grid_size = numbers[0];
        }
        // Expect grid connections
        else {
            if (numbers.length !== 2) {
                log_error(`Import error in line ${i + 1}: Each line defining grid connection must contain exactly 2 numbers.`);
                return null;
            }

            if (numbers.some(num => num !== clamp(num, 1, result.grid_size * result.grid_size))) {
                log_error(`Import error in line ${i + 1}: Each number must be in the range [1, ${result.grid_size * result.grid_size}].`);
                return null;
            }

            // convert from
            // [1, N*N] grid indexes
            // to
            // [from_x, from_y, to_x, to_y] each in range [0, N-1]
            numbers = numbers.map((num) => num - 1);
            let edge_from = make_2D_index(numbers[0], result.grid_size);
            let edge_to = make_2D_index(numbers[1], result.grid_size);
            result.grid_connection_data.push([edge_from[0], edge_from[1], edge_to[0], edge_to[1]]);
        }
    }

    return result;
}

function parse_import_file_as_vertex_list(content) {
    const lines = content.trim().split('\n');
    const result = {
        grid_connection_data: [],
        grid_size: 0,
    };

    if (lines.length < 1) {
        log_error(`Import error in line ${1}: Expected grid size.`);
        return null;
    }

    for (let i = 0; i < 2; i++) {
        let numbers = lines[i].trim().split(/\s+/).map(Number);

        // Check if each number is an integer
        if (numbers.some(isNaN) || numbers.some(num => !Number.isInteger(num))) {
            log_error(`Import error in line ${i + 1}: Each number must be an integer.`);
            return null;
        }

        // Expect grid size
        if (i === 0) {
            if (numbers.length !== 1) {
                log_error(`Import error in line ${i + 1}: Line defining grid size must contain exactly 1 number.`);
                return null;
            }

            if (numbers.some(num => num !== clamp(num, min_grid_size, max_grid_size))) {
                log_error(`Import error in line ${i + 1}: Grid size must be in the range [${min_grid_size}, ${max_grid_size}].`);
                return null;
            }

            result.grid_size = numbers[0];
        }
        // Expect grid connections
        else if (i === 1) {
            if (numbers.some(num => num !== clamp(num, 1, result.grid_size * result.grid_size))) {
                log_error(`Import error in line ${i + 1}: Each number must be in the range [1, ${result.grid_size * result.grid_size}].`);
                return null;
            }

            if (numbers.length <= 1) {
                break;
            }

            // convert from
            // [1, N*N] grid indexes
            // to
            // [from_x, from_y, to_x, to_y] each in range [0, N-1]
            numbers = numbers.map((num) => num - 1);
            let edge_from = make_2D_index(numbers[0], result.grid_size);
            let edge_to = make_2D_index(numbers[1], result.grid_size);
            result.grid_connection_data.push([edge_from[0], edge_from[1], edge_to[0], edge_to[1]]);

            for (let i = 2; i < numbers.length; i++) {
                let edge_from = make_2D_index(numbers[i - 1], result.grid_size);
                let edge_to = make_2D_index(numbers[i], result.grid_size);
                result.grid_connection_data.push([edge_from[0], edge_from[1], edge_to[0], edge_to[1]]);
            }
        }
    }

    return result;
}

function parse_import_file_as_connection_chain(content) {
    const lines = content.trim().split('\n');
    const result = {
        grid_connection_data: [],
        grid_size: 0,
    };

    if (lines.length < 1) {
        log_error(`Import error in line ${1}: Expected grid size.`);
        return null;
    }

    for (let i = 0; i < 2; i++) {
        let numbers = i === 0
            ? lines[i].trim().split(/\s+/).map(Number)
            : lines[i].trim().replaceAll("{", "").replaceAll("}", "").replaceAll(",", "").split(/\s+/).map(Number);

        // Check if each number is an integer
        if (numbers.some(isNaN) || numbers.some(num => !Number.isInteger(num))) {
            log_error(`Import error in line ${i + 1}: Each number must be an integer.`);
            return null;
        }

        // Expect grid size
        if (i === 0) {
            if (numbers.length !== 1) {
                log_error(`Import error in line ${i + 1}: Line defining grid size must contain exactly 1 number.`);
                return null;
            }

            if (numbers.some(num => num !== clamp(num, min_grid_size, max_grid_size))) {
                log_error(`Import error in line ${i + 1}: Grid size must be in the range [${min_grid_size}, ${max_grid_size}].`);
                return null;
            }

            result.grid_size = numbers[0];
        }
        // Expect grid connections
        else if (i === 1) {
            if (numbers.some(num => num !== clamp(num, 1, result.grid_size * result.grid_size))) {
                log_error(`Import error in line ${i + 1}: Each number must be in the range [1, ${result.grid_size * result.grid_size}].`);
                return null;
            }

            if (numbers.length < 1) {
                break;
            }

            if (numbers.length % 2 === 1) {
                log_error(`Import error in line ${i + 1}: Expected even amount of numbers.`);
                return null;
            }

            // convert from
            // [1, N*N] grid indexes
            // to
            // [from_x, from_y, to_x, to_y] each in range [0, N-1]
            numbers = numbers.map((num) => num - 1);
            for (let i = 0; i < numbers.length; i += 2) {
                let edge_from = make_2D_index(numbers[i], result.grid_size);
                let edge_to = make_2D_index(numbers[i + 1], result.grid_size);
                result.grid_connection_data.push([edge_from[0], edge_from[1], edge_to[0], edge_to[1]]);
            }
        }
    }

    return result;
}

function parse_import_file(content) {
    let import_export_type = get_import_export_type();
    if (import_export_type === "connection_list") {
        return parse_import_file_as_connection_list(content);
    }
    else if (import_export_type === "vertex_list") {
        return parse_import_file_as_vertex_list(content);
    }
    else if (import_export_type === "connection_chain") {
        return parse_import_file_as_connection_chain(content);
    }
    else {
        log_error("Unexpected import error.");
    }
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

// Returns list of vertices that connect with each other in order with indexes in range [1, grid_size].
// If it's not possible to construct it (due to being many walks unconnected or many loops), returns null
function get_vertex_list() {
    // TODO: YUCK... there should be cleaner way to do this
    let vertex_list = [];

    if (grid_connection_data.length > 0) {
        let first_connection = grid_connection_data[0];
        let from_idx = make_1D_index(first_connection[0], first_connection[1], grid_size) + 1;
        let to_idx = make_1D_index(first_connection[2], first_connection[3], grid_size) + 1;
        vertex_list.push(from_idx);
        vertex_list.push(to_idx);
    }

    let vertex_idx_is_taken_func = (idx) => {
        return vertex_list.some((vertex) => idx === vertex);
    };

    let grid_connection_data_copy = structuredClone(grid_connection_data);
    array_remove_element_at_index(grid_connection_data_copy, 0);

    for (let i = 1; i < grid_connection_data.length; i++) {
        let first_vertex = vertex_list[0];
        let last_vertex = vertex_list[vertex_list.length - 1];
        let element_inserted = false;
        for (let j = 0; j < grid_connection_data_copy.length; j++) {
            let connection = grid_connection_data_copy[j];
            let from_idx = make_1D_index(connection[0], connection[1], grid_size) + 1;
            let to_idx = make_1D_index(connection[2], connection[3], grid_size) + 1;
            if (from_idx === first_vertex) {
                if (vertex_idx_is_taken_func(to_idx) && !(to_idx === last_vertex && i === grid_connection_data.length - 1)) {
                    return null;
                }
                vertex_list.unshift(to_idx);
                element_inserted = true;
                array_remove_element_at_index(grid_connection_data_copy, j);
                break;
            }
            else if (to_idx === first_vertex) {
                if (vertex_idx_is_taken_func(from_idx) && !(from_idx === last_vertex && i === grid_connection_data.length - 1)) {
                    return null;
                }
                vertex_list.unshift(from_idx);
                element_inserted = true;
                array_remove_element_at_index(grid_connection_data_copy, j);
                break;
            }
            else if (from_idx === last_vertex) {
                if (vertex_idx_is_taken_func(to_idx) && !(to_idx === first_vertex && i === grid_connection_data.length - 1)) {
                    return null;
                }
                vertex_list.push(to_idx);
                element_inserted = true;
                array_remove_element_at_index(grid_connection_data_copy, j);
                break;
            }
            else if (to_idx === last_vertex) {
                if (vertex_idx_is_taken_func(from_idx) && !(from_idx === first_vertex && i === grid_connection_data.length - 1)) {
                    return null;
                }
                vertex_list.push(from_idx);
                element_inserted = true;
                array_remove_element_at_index(grid_connection_data_copy, j);
                break;
            }
        }
        if (!element_inserted) {
            return null;
        }
    }

    return vertex_list;
}

function create_lookup_table(size) {
    let squared_size = size * size;
    let edge_lookup_table = [];

    let size_m1 = size - 1;
    let idx_to = 0;

    // Create reordered index lookup map
    // Left
    for (let i = 0; i < size_m1; i++) {
        let idx_from = i * size;
        edge_lookup_table[idx_from] = idx_to;
        idx_to++;
    }

    // Bottom
    for (let i = 0; i < size_m1; i++) {
        let idx_from = squared_size - size_m1 + i - 1;
        edge_lookup_table[idx_from] = idx_to;
        idx_to++;
    }

    // Right
    for (let i = 0; i < size_m1; i++) {
        let idx_from = squared_size - 1 - i * size;
        edge_lookup_table[idx_from] = idx_to;
        idx_to++;
    }

    // Top
    for (let i = 0; i < size_m1; i++) {
        let idx_from = size_m1 - i;
        edge_lookup_table[idx_from] = idx_to;
        idx_to++;
    }

    return edge_lookup_table;
}

// Returns true if any is true:
// - List contains connection starting from vertex 1 that goes above diagonal from top-left to bottom-right.
// - List contains clockwise connections that are on the edge of the grid.
// This is used for algorithm that doesn't accept certain connections as input.
// See more here: https://github.com/Piratux/Grid-Max-Tsp-Bruteforce
function vertex_list_contains_unwanted_connections(vertex_list) {
    let lookup_table = create_lookup_table(grid_size);

    for (let i = 1; i < vertex_list.length; i++) {
        let vertex_from = vertex_list[i - 1] - 1;
        let vertex_to = vertex_list[i] - 1;
        let edge_from = make_2D_index(vertex_from, grid_size);
        let edge_to = make_2D_index(vertex_to, grid_size);

        // detect symmetric connections
        if (vertex_from === 0 && edge_to[0] > edge_to[1]) {
            return true;
        }

        // detect clockwise connections
        let lookup_table_idx_from = lookup_table[vertex_from];
        let lookup_table_idx_to = lookup_table[vertex_to];
        let outside_grid_vertices_count = (grid_size - 1) * 4;
        if (lookup_table_idx_from !== undefined && lookup_table_idx_to !== undefined) {
            if ((lookup_table_idx_to + 1) % outside_grid_vertices_count === lookup_table_idx_from) {
                return true;
            }
        }
    }

    return false;
}

function export_grid() {
    let grid_export_data = [];
    grid_export_data.push([grid_size]);

    let import_export_type = get_import_export_type();
    let content = null;
    if (import_export_type === "connection_list") {
        // convert from
        // [from_x, from_y, to_x, to_y] each in range [0, N-1]
        // to
        // [1, N*N] grid indexes
        grid_connection_data.forEach((connection) => {
            grid_export_data.push([
                make_1D_index(connection[0], connection[1], grid_size) + 1,
                make_1D_index(connection[2], connection[3], grid_size) + 1
            ]);
        });
        content = grid_export_data.map(row => row.join(' ')).join('\n');
    }
    else if (import_export_type === "vertex_list") {
        let vertex_list = get_vertex_list();
        if (!vertex_list) {
            log_error(`Export error: Current graph is not a walk or there is more than one walk.`);
            return;
        }

        if (vertex_list_contains_unwanted_connections(vertex_list)) {
            vertex_list = vertex_list.reverse()
        }

        grid_export_data.push(vertex_list);
        content = grid_export_data.map(row => row.join(' ')).join('\n');
    }
    else if (import_export_type === "connection_chain") {
        let vertex_list = get_vertex_list();
        if (!vertex_list) {
            log_error(`Export error: Current graph is not a walk or there is more than one walk.`);
            return;
        }

        if (vertex_list_contains_unwanted_connections(vertex_list)) {
            vertex_list = vertex_list.reverse()
        }

        let connection_pairs = [];
        for (let i = 1; i < vertex_list.length; i++) {
            connection_pairs.push([vertex_list[i - 1], vertex_list[i]]);
        }

        let result = connection_pairs.map(pair => `{${pair.join(', ')}}`).join(', ');
        result = "{" + result + "}";

        grid_export_data.push([result]);
        content = grid_export_data.join('\n');
    }
    else {
        log_error("Unexpected export error.");
    }

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
    push_undo_state();

    grid_connection_data = [];
    update_connection_info();
}

function set_grid_size(new_value, add_to_undo_stack) {
    if (add_to_undo_stack && grid_size !== clamp(new_value, min_grid_size, max_grid_size)) {
        push_undo_state();
    }

    grid_size = clamp(new_value, min_grid_size, max_grid_size);
    document.getElementById("grid_size").textContent = grid_size;
    auto_resize_canvas();
}

function increase_grid_size() {
    set_grid_size(grid_size + 1, true);
    update_connection_info();
}

function decrease_grid_size() {
    set_grid_size(grid_size - 1, true);

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

    let new_connections = [];

    for (let i = 0; i < vector_count; i++) {
        new_connections.push([
            from_x + simplified_vector.x * i,
            from_y + simplified_vector.y * i,
            from_x + simplified_vector.x * (i + 1),
            from_y + simplified_vector.y * (i + 1)
        ]);
    }

    new_connections = new_connections.filter((new_connection) => {
        return !grid_connection_data.some((grid_connection) => {
            return arrays_equal(grid_connection, new_connection);
        });
    });

    if (new_connections.length > 0) {
        if (add_to_undo_stack) {
            push_undo_state();
        }
        grid_connection_data.push(...new_connections);
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

    let from_x = old_last_grid_circle_x;
    let from_y = old_last_grid_circle_y;
    let to_x = last_grid_circle_x;
    let to_y = last_grid_circle_y;

    let connection_to_remove1 = [from_x, from_y, to_x, to_y];
    let connection_to_remove2 = [to_x, to_y, from_x, from_y];

    for (let i = 0; i < grid_connection_data.length; i++) {
        if (arrays_equal(grid_connection_data[i], connection_to_remove1)
            || arrays_equal(grid_connection_data[i], connection_to_remove2)
        ) {
            push_undo_state();
            grid_connection_data.splice(i, 1);
            break;
        }
    }

    update_connection_info();
}

function create_state_snapshot() {
    return {
        grid_connection_data: structuredClone(grid_connection_data),
        grid_size: structuredClone(grid_size),
    }
}

function load_state_snapshot(snapshot) {
    grid_connection_data = structuredClone(snapshot.grid_connection_data);
    set_grid_size(structuredClone(snapshot.grid_size), false);
}

function perform_undo() {
    if (undo_mementos.length === 0) {
        return;
    }

    redo_mementos.push(create_state_snapshot());
    load_state_snapshot(undo_mementos.pop());

    update_connection_info();
}

function perform_redo() {
    if (redo_mementos.length === 0) {
        return;
    }

    undo_mementos.push(create_state_snapshot());
    load_state_snapshot(redo_mementos.pop());

    update_connection_info();
}

function push_undo_state() {
    undo_mementos.push(create_state_snapshot());

    // new action appeared, clear redo stack
    redo_mementos = [];

    // don't store too many undo actions
    if (undo_mementos.length > max_memento_size) {
        undo_mementos.shift();
    }

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

function get_import_export_type() {
    return document.getElementById("import_export_type").value;
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

function array_remove_element_at_index(arr, idx) {
    arr.splice(idx, 1);
    return arr;
}

// Cares about element order. Only works for simple values inside array.
function arrays_equal(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}