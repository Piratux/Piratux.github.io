let canvas;
let canvas_ctx;

let circle_radius = 16;
let circle_grid_size = 8;
let min_circle_grid_size = 1;
let max_circle_grid_size = 8;
let circle_grid_start_pos_x = 56;
let circle_grid_start_pos_y = 56;
let circle_grid_spacing = 84;

// Last circle row/column where mouse was pressed on
let last_grid_circle_x = -1;
let last_grid_circle_y = -1;

// Array of connection defining arrays
let grid_green_connection_data = [];
let grid_orange_connection_data = [];

// 0 = green
// 1 = orange
let selected_line_color_index = 0;

// Array of 1 and 0s where 1 = vertex is taken
let taken_vertices = [];

// Array of 1 and 0s where 1 = edge is intersecting
let intersecting_edges = [];

let left_mouse_button_is_down = false;
let right_mouse_button_is_down = false;
let last_mouse_pos_x = 0;
let last_mouse_pos_y = 0;

// both max points are stored in case visualisation of both is needed
let [hausdorff_x_from_max1, hausdorff_y_from_max1, hausdorff_x_to_max1, hausdorff_y_to_max1] = [0, 0, 0, 0];
let [hausdorff_x_from_max2, hausdorff_y_from_max2, hausdorff_x_to_max2, hausdorff_y_to_max2] = [0, 0, 0, 0];
let hausdorff_longer_distance_index = 0;

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const colour_blue = "#1180ae";
const colour_light_blue = "#36abcc";
const colour_orange = "#edb211";
const colour_light_orange = "#ffcc40";
const colour_green = "#35c13d";
const colour_red = "#ff0000";
const colour_dark_red = "#a10000";
const colour_purple = "#a235b5aa";

window.onload = function () {
    canvas = document.getElementById('main_canvas');
    canvas_ctx = canvas.getContext('2d');

    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mouseup", mouse_up);
    canvas.addEventListener("mousemove", mouse_move);

    window.addEventListener('contextmenu', (event) => {
        event.preventDefault()
    })

    set_hausdorff_distance("");

    setInterval(draw_everything, 1000 / 60);
}

function draw_everything() {
    canvas_ctx.fillStyle = 'white';
    canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);

    draw_grid_circles();
    draw_grid_lines();
    draw_hausdorff_distance_lines();
    draw_currently_held_line();
}

// Source: https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
// To find orientation of ordered triplet (p, q, r).
// The function returns following values
// 0 --> p, q and r are collinear
// 1 --> Clockwise
// 2 --> Counterclockwise
function orientation(p, q, r) {
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


    let o1 = orientation(p1, q1, p2);
    let o2 = orientation(p1, q1, q2);
    let o3 = orientation(p2, q2, p1);
    let o4 = orientation(p2, q2, q1);

    if (o1 != o2 && o3 != o4)
        return true;

    return false;
}

function make_1D_index(x, y, arr_width) {
    return y * arr_width + x;
}

function draw_grid_circles() {
    for (let y = 0; y < circle_grid_size; y++) {
        for (let x = 0; x < circle_grid_size; x++) {
            let pos_x = circle_grid_start_pos_x + x * circle_grid_spacing;
            let pos_y = circle_grid_start_pos_y + y * circle_grid_spacing;

            let diff_x = pos_x - last_mouse_pos_x;
            let diff_y = pos_y - last_mouse_pos_y;

            let vertex_idx = make_1D_index(x, y, circle_grid_size);
            let vertex_is_taken = false;
            if (taken_vertices[vertex_idx] === 1) {
                vertex_is_taken = true;
            }

            let distance = Math.sqrt(diff_x * diff_x + diff_y * diff_y);
            if (distance <= circle_radius) {
                draw_circle(pos_x, pos_y, circle_radius, colour_light_blue);
            }
            else {
                draw_circle(pos_x, pos_y, circle_radius, colour_blue);
            }
        }
    }
}

function draw_grid_lines() {
    for (let i = 0; i < grid_green_connection_data.length; i++) {
        let from_x = grid_green_connection_data[i][0];
        let from_y = grid_green_connection_data[i][1];
        let to_x = grid_green_connection_data[i][2];
        let to_y = grid_green_connection_data[i][3];

        from_x = from_x * circle_grid_spacing + circle_grid_start_pos_x;
        from_y = from_y * circle_grid_spacing + circle_grid_start_pos_y;
        to_x = to_x * circle_grid_spacing + circle_grid_start_pos_x;
        to_y = to_y * circle_grid_spacing + circle_grid_start_pos_y;

        draw_line(from_x, from_y, to_x, to_y, colour_green);
    }

    for (let i = 0; i < grid_orange_connection_data.length; i++) {
        let from_x = grid_orange_connection_data[i][0];
        let from_y = grid_orange_connection_data[i][1];
        let to_x = grid_orange_connection_data[i][2];
        let to_y = grid_orange_connection_data[i][3];

        from_x = from_x * circle_grid_spacing + circle_grid_start_pos_x;
        from_y = from_y * circle_grid_spacing + circle_grid_start_pos_y;
        to_x = to_x * circle_grid_spacing + circle_grid_start_pos_x;
        to_y = to_y * circle_grid_spacing + circle_grid_start_pos_y;

        draw_line(from_x, from_y, to_x, to_y, colour_orange);
    }
}

function draw_hausdorff_distance_lines() {
    if (grid_green_connection_data.length === 0 || grid_orange_connection_data.length === 0) {
        return;
    }

    if (hausdorff_longer_distance_index === 0) {
        let from_x = hausdorff_x_from_max1;
        let from_y = hausdorff_y_from_max1;
        let to_x = hausdorff_x_to_max1;
        let to_y = hausdorff_y_to_max1;

        from_x = from_x * circle_grid_spacing + circle_grid_start_pos_x;
        from_y = from_y * circle_grid_spacing + circle_grid_start_pos_y;
        to_x = to_x * circle_grid_spacing + circle_grid_start_pos_x;
        to_y = to_y * circle_grid_spacing + circle_grid_start_pos_y;

        draw_line(from_x, from_y, to_x, to_y, colour_purple, 10);
    }
    else {
        from_x = hausdorff_x_from_max2;
        from_y = hausdorff_y_from_max2;
        to_x = hausdorff_x_to_max2;
        to_y = hausdorff_y_to_max2;

        from_x = from_x * circle_grid_spacing + circle_grid_start_pos_x;
        from_y = from_y * circle_grid_spacing + circle_grid_start_pos_y;
        to_x = to_x * circle_grid_spacing + circle_grid_start_pos_x;
        to_y = to_y * circle_grid_spacing + circle_grid_start_pos_y;

        draw_line(from_x, from_y, to_x, to_y, colour_purple, 10);
    }
}

function draw_currently_held_line() {
    if (last_grid_circle_x == -1 && last_grid_circle_y == -1) {
        return;
    }

    from_x = last_grid_circle_x * circle_grid_spacing + circle_grid_start_pos_x;
    from_y = last_grid_circle_y * circle_grid_spacing + circle_grid_start_pos_y;
    to_x = last_mouse_pos_x;
    to_y = last_mouse_pos_y;

    if (left_mouse_button_is_down) {
        if (selected_line_color_index === 0) {
            draw_line(from_x, from_y, to_x, to_y, colour_green);
        }
        else {
            draw_line(from_x, from_y, to_x, to_y, colour_orange);
        }
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

function draw_line(from_x, from_y, to_x, to_y, style, line_width = 5) {
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
    grid_green_connection_data.length = 0;
    grid_orange_connection_data.length = 0;
    update_connection_info();
}

function calculate_intersection_location(mouse_pos_x, mouse_pos_y) {
    for (let y = 0; y < circle_grid_size; y++) {
        for (let x = 0; x < circle_grid_size; x++) {
            let pos_x = circle_grid_start_pos_x + x * circle_grid_spacing;
            let pos_y = circle_grid_start_pos_y + y * circle_grid_spacing;
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

    let a_x = old_last_grid_circle_x;
    let a_y = old_last_grid_circle_y;
    let b_x = last_grid_circle_x;
    let b_y = last_grid_circle_y;
    let from_idx = make_1D_index(a_x, a_y, max_circle_grid_size - 1);
    let to_idx = make_1D_index(b_x, b_y, max_circle_grid_size - 1);

    // we don't want want connections going from same to same element
    if (from_idx == to_idx) {
        return;
    }

    let vec_x = Math.abs(a_x - b_x);
    let vec_y = Math.abs(a_y - b_y);

    let vector_count = gcd(vec_x, vec_y);
    let simplified_vector = { x: vec_x / vector_count, y: vec_y / vector_count };

    if (a_x > b_x) {
        simplified_vector.x *= -1;
    }

    if (a_y > b_y) {
        simplified_vector.y *= -1;
    }

    // hack to avoid adding duplicate data such as:
    // (0, 1) -> (2, 3)
    // (2, 3) -> (0, 1)
    if (from_idx > to_idx) {
        [a_x, b_x] = [b_x, a_x];
        [a_y, b_y] = [b_y, a_y];
        simplified_vector.x *= -1;
        simplified_vector.y *= -1;
    }

    if (selected_line_color_index === 0) {
        for (let i = 0; i < vector_count; i++) {
            grid_green_connection_data.push([
                a_x + simplified_vector.x * i,
                a_y + simplified_vector.y * i,
                a_x + simplified_vector.x * (i + 1),
                a_y + simplified_vector.y * (i + 1)
            ]);
        }

        // remove duplicate entries
        // https://stackoverflow.com/a/44014849
        grid_green_connection_data = Array.from(new Set(grid_green_connection_data.map(JSON.stringify)), JSON.parse)
    }
    else if (selected_line_color_index === 1) {
        for (let i = 0; i < vector_count; i++) {
            grid_orange_connection_data.push([
                a_x + simplified_vector.x * i,
                a_y + simplified_vector.y * i,
                a_x + simplified_vector.x * (i + 1),
                a_y + simplified_vector.y * (i + 1)
            ]);
        }

        // remove duplicate entries
        // https://stackoverflow.com/a/44014849
        grid_orange_connection_data = Array.from(new Set(grid_orange_connection_data.map(JSON.stringify)), JSON.parse)
    }

    update_connection_info();
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

    let arr_to_remove1 = [old_last_grid_circle_x, old_last_grid_circle_y, last_grid_circle_x, last_grid_circle_y];
    let arr_to_remove2 = [last_grid_circle_x, last_grid_circle_y, old_last_grid_circle_x, old_last_grid_circle_y];

    for (let i = 0; i < grid_green_connection_data.length; i++) {
        let is_equal1 = true;
        let is_equal2 = true;
        for (let j = 0; j < 4; j++) {
            if (grid_green_connection_data[i][j] != arr_to_remove1[j]) {
                is_equal1 = false;
            }
            if (grid_green_connection_data[i][j] != arr_to_remove2[j]) {
                is_equal2 = false;
            }
        }

        if (is_equal1 || is_equal2) {
            grid_green_connection_data.splice(i, 1);
        }
    }

    for (let i = 0; i < grid_orange_connection_data.length; i++) {
        let is_equal1 = true;
        let is_equal2 = true;
        for (let j = 0; j < 4; j++) {
            if (grid_orange_connection_data[i][j] != arr_to_remove1[j]) {
                is_equal1 = false;
            }
            if (grid_orange_connection_data[i][j] != arr_to_remove2[j]) {
                is_equal2 = false;
            }
        }

        if (is_equal1 || is_equal2) {
            grid_orange_connection_data.splice(i, 1);
        }
    }

    update_connection_info();
}

function set_hausdorff_distance(new_value) {
    document.getElementById("hausdorff_distance").textContent = new_value;
}

function euclidian_distance(x1, y1, x2, y2) {
    let x_dist = Math.abs(x1 - x2);
    let y_dist = Math.abs(y1 - y2);
    return Math.sqrt(x_dist * x_dist + y_dist * y_dist).toPrecision(6);
}

// For some reason some points get skipped, so for more robust solution I'm checking all points
function min_dist_from_point_to_set(x, y, grid_data) {
    let min_value = euclidian_distance(x, y, grid_data[0][0], grid_data[0][1])
    let [x_from_min, y_from_min, x_to_min, y_to_min] = [x, y, grid_data[0][0], grid_data[0][1]];

    for (let i = 0; i < grid_data.length; i++) {
        let dist = euclidian_distance(x, y, grid_data[i][0], grid_data[i][1])

        if (dist < min_value) {
            min_value = dist;
            [x_from_min, y_from_min, x_to_min, y_to_min] = [x, y, grid_data[i][0], grid_data[i][1]];
        }
    }

    for (let i = 0; i < grid_data.length; i++) {
        let dist = euclidian_distance(x, y, grid_data[i][2], grid_data[i][3])

        if (dist < min_value) {
            min_value = dist;
            [x_from_min, y_from_min, x_to_min, y_to_min] = [x, y, grid_data[i][2], grid_data[i][3]];
        }
    }

    return [min_value, x_from_min, y_from_min, x_to_min, y_to_min];
}

function max_dist_between_sets(grid_data_A, grid_data_B) {
    let [max_value, x_from_max, y_from_max, x_to_max, y_to_max] = min_dist_from_point_to_set(
        grid_data_A[0][0],
        grid_data_A[0][1],
        grid_data_B
    );

    for (let i = 0; i < grid_data_A.length; i++) {
        let [dist, x_from, y_from, x_to, y_to] = min_dist_from_point_to_set(
            grid_data_A[i][0],
            grid_data_A[i][1],
            grid_data_B
        );

        if (dist > max_value) {
            max_value = dist;
            [x_from_max, y_from_max, x_to_max, y_to_max] = [x_from, y_from, x_to, y_to];
        }
    }

    for (let i = 0; i < grid_data_A.length; i++) {
        let [dist, x_from, y_from, x_to, y_to] = min_dist_from_point_to_set(
            grid_data_A[i][2],
            grid_data_A[i][3],
            grid_data_B
        );

        if (dist > max_value) {
            max_value = dist;
            [x_from_max, y_from_max, x_to_max, y_to_max] = [x_from, y_from, x_to, y_to];
        }
    }

    return [max_value, x_from_max, y_from_max, x_to_max, y_to_max];
}

function update_connection_info() {
    set_hausdorff_distance("");

    if (grid_green_connection_data.length > 0 && grid_orange_connection_data.length > 0) {
        let [dist1, x_from_max1, y_from_max1, x_to_max1, y_to_max1] = max_dist_between_sets(
            grid_green_connection_data,
            grid_orange_connection_data
        );
        [hausdorff_x_from_max1, hausdorff_y_from_max1, hausdorff_x_to_max1, hausdorff_y_to_max1] = [x_from_max1, y_from_max1, x_to_max1, y_to_max1];

        let [dist2, x_from_max2, y_from_max2, x_to_max2, y_to_max2] = max_dist_between_sets(
            grid_orange_connection_data,
            grid_green_connection_data
        );
        [hausdorff_x_from_max2, hausdorff_y_from_max2, hausdorff_x_to_max2, hausdorff_y_to_max2] = [x_from_max2, y_from_max2, x_to_max2, y_to_max2];

        if (dist1 > dist2) {
            set_hausdorff_distance(dist1);
            hausdorff_longer_distance_index = 0;
        }
        else {
            set_hausdorff_distance(dist2);
            hausdorff_longer_distance_index = 1;
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

    mouse_down_pos_x = mouse_pos.x;
    mouse_down_pos_y = mouse_pos.y;
}

function mouse_up(event) {
    if (event.button == 0) {
        left_mouse_button_is_down = false;
    }

    if (event.button == 2) {
        right_mouse_button_is_down = false;
    }

    last_grid_circle_x = -1;
    last_grid_circle_y = -1;
}

function mouse_move(event) {
    let mouse_pos = get_canvas_mouse_pos(event);

    last_mouse_pos_x = mouse_pos.x
    last_mouse_pos_y = mouse_pos.y

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

function set_green_line() {
    selected_line_color_index = 0;
}

function set_orange_line() {
    selected_line_color_index = 1;
}
