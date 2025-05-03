// https://pgetinker.com/s/TuzDIdXtYI0

#define OLC_PGE_APPLICATION
#include "olcPixelGameEngine.h"

#if defined(__EMSCRIPTEN__)
#include <emscripten.h>
#endif

#define OLC_PGEX_QUICKGUI
#include "olcPGEX_QuickGUI.h"

#include <array>

template <typename T> struct triangle {
  std::array<olc::vf2d, 3> pos;

  inline triangle(const olc::vf2d &p0 = {T(0), T(0)},
                  const olc::vf2d &p1 = {T(0), T(0)},
                  const olc::vf2d &p2 = {T(0), T(0)})
      : pos{p0, p1, p2} {}


  // Get area of triangle
  inline constexpr T area() const {
    return double(0.5) * std::abs((pos[0].x * (pos[1].y - pos[2].y)) +
                                  (pos[1].x * (pos[2].y - pos[0].y)) +
                                  (pos[2].x * (pos[0].y - pos[1].y)));
  }

  // Returns side count: 3
  inline constexpr size_t side_count() const { return 3; }
};

// EMSCRIPTEN ONLY!
//
// At runtime, this function attempts to load a file
// from the provided URL, and maps it to emscripten's
// filesystem. You can then use the file in any C/C++
// filesystem function as if it were on the local disk.
void FILE_RESOLVE(const char *url, const char *file) {
#if defined(__EMSCRIPTEN__)
  emscripten_wget(url, file);
  emscripten_sleep(0);
#endif
}

const int grid_size = 10;
const olc::vi2d canvas_size = {16, 16};

struct TileData {
  olc::Pixel color[grid_size][grid_size][4] = {};
};

// Override base class with your custom functionality
class Example : public olc::PixelGameEngine {
public:
  Example() {
    // Name your application
    sAppName = "PGEtinker Classic Example";
  }

public:
  // contains(t,p)
  // Checks if triangle contains a point
  template <typename T1, typename T2>
  constexpr bool contains(const triangle<T1> &t, const olc::vf2d &p) {
    // http://jsfiddle.net/PerroAZUL/zdaY8/1/
    T2 A = T2(0.5) *
           (-t.pos[1].y * t.pos[2].x + t.pos[0].y * (-t.pos[1].x + t.pos[2].x) +
            t.pos[0].x * (t.pos[1].y - t.pos[2].y) + t.pos[1].x * t.pos[2].y);
    T2 sign = A < T2(0) ? T2(-1) : T2(1);
    T2 s = (t.pos[0].y * t.pos[2].x - t.pos[0].x * t.pos[2].y +
            (t.pos[2].y - t.pos[0].y) * p.x + (t.pos[0].x - t.pos[2].x) * p.y) *
           sign;
    T2 v = (t.pos[0].x * t.pos[1].y - t.pos[0].y * t.pos[1].x +
            (t.pos[0].y - t.pos[1].y) * p.x + (t.pos[1].x - t.pos[0].x) * p.y) *
           sign;
    return s >= T2(0) && v >= T2(0) && (s + v) <= T2(2) * A * sign;
  }

  TileData tile_data;
  int mode = 1;      // 1 = left triangle, 2 = right triangle
  int draw_mode = 1; // 1 = add, 2 = remove

  olc::QuickGUI::Manager manager;
  olc::QuickGUI::Button mode1 =
      olc::QuickGUI::Button(manager, "mode1", {5, 200}, {50, 10});
  olc::QuickGUI::Button mode2 =
      olc::QuickGUI::Button(manager, "mode2", {65, 200}, {50, 10});
  olc::QuickGUI::Button mode3 =
      olc::QuickGUI::Button(manager, "mode3", {125, 200}, {50, 10});

  olc::QuickGUI::Button color1 =
      olc::QuickGUI::Button(manager, "color1", {5, 180}, {50, 10});

  olc::QuickGUI::Button color2 =
      olc::QuickGUI::Button(manager, "color2", {65, 180}, {50, 10});

  olc::QuickGUI::Button color3 =
      olc::QuickGUI::Button(manager, "color3", {125, 180}, {50, 10});

  olc::QuickGUI::Button color4 =
      olc::QuickGUI::Button(manager, "color4", {185, 180}, {50, 10});

  olc::Pixel tri_colors[4] = {olc::BLACK, olc::RED, olc::GREEN, olc::BLUE};
  olc::Pixel hover_color = olc::Pixel{255, 255, 255, 100};

  olc::Pixel new_color = tri_colors[1];

  // OnUserCreate is Called once at the start and
  // is where you do things like load files and
  // initilize variables.
  bool OnUserCreate() override {
    // load "assets/gfx/broken.png" from a URL
    FILE_RESOLVE("https://i.imgur.com/KdWjkwC.png", "assets/gfx/broken.png");

    SetPixelMode(olc::Pixel::ALPHA);

    return true;
  }

  void drawMyTriangle(triangle<float> tri, olc::Pixel color) {
    if (color == olc::BLACK) {
      return;
    }
    FillTriangle(tri.pos[0], tri.pos[1], tri.pos[2], color);
  }

  void handleTriangle(triangle<float> tri, int x, int y, int primary_color_idx1,
                      int primary_color_idx2, int secondary_color_idx1,
                      int secondary_color_idx2, olc::Pixel new_color) {
    DrawTriangle(tri.pos[0], tri.pos[1], tri.pos[2]);

    if (contains<float, float>(tri, GetMousePos())) {
      if (GetMouse(0).bHeld) {
        if (!(tile_data.color[x][y][secondary_color_idx1] ==
                  tile_data.color[x][y][secondary_color_idx2] &&
              tile_data.color[x][y][secondary_color_idx1] == new_color &&
              tile_data.color[x][y][secondary_color_idx1] != olc::BLACK)) {
          tile_data.color[x][y][primary_color_idx1] = new_color;
          tile_data.color[x][y][secondary_color_idx1] = tri_colors[0];
          tile_data.color[x][y][secondary_color_idx2] = tri_colors[0];
        }
      }
      FillTriangle(tri.pos[0], tri.pos[1], tri.pos[2], hover_color);
    }
  }

  // OnUserUpdate is called once per frame and
  // is where you draw things to the screen
  bool OnUserUpdate(float fElapsedTime) override {
    // clear the screen to the provided color
    Clear(olc::DARK_GREY);

    if (mode1.bPressed) {
      mode = 1;
    }

    if (mode2.bPressed) {
      mode = 2;
    }

    if (mode3.bPressed) {
      mode = 3;
    }

    if (color1.bPressed) {
      new_color = tri_colors[0];
    }

    if (color2.bPressed) {
      new_color = tri_colors[1];
    }

    if (color3.bPressed) {
      new_color = tri_colors[2];
    }

    if (color4.bPressed) {
      new_color = tri_colors[3];
    }

    for (int y = 0; y < grid_size; y++) {
      for (int x = 0; x < grid_size; x++) {
        auto pos = olc::vi2d{x, y};
        auto offset = olc::vi2d{45, 10};
        auto canvas_pos = pos * canvas_size;
        canvas_pos += offset;
        auto canvas_pos_top_left = canvas_pos;
        auto canvas_pos_top_right = canvas_pos + olc::vi2d{canvas_size.x, 0};
        auto canvas_pos_bot_left = canvas_pos + olc::vi2d{0, canvas_size.y};
        auto canvas_pos_bot_right = canvas_pos + canvas_size;

        triangle<float> tris[] = {
            triangle<float>{canvas_pos_top_left, canvas_pos_top_right,
                            canvas_pos_bot_left},
            triangle<float>{canvas_pos_top_right, canvas_pos_bot_right,
                            canvas_pos_bot_left},
            triangle<float>{canvas_pos_top_left, canvas_pos_top_right,
                            canvas_pos_bot_right},
            triangle<float>{canvas_pos_top_left, canvas_pos_bot_right,
                            canvas_pos_bot_left}};

        for (int i = 0; i < 4; i++) {
          drawMyTriangle(tris[i], tile_data.color[x][y][i]);
        }

        if (mode == 1) {
          handleTriangle(tris[0], x, y, 0, 1, 2, 3, new_color);
          handleTriangle(tris[1], x, y, 1, 0, 2, 3, new_color);
        }
        if (mode == 2) {
          handleTriangle(tris[2], x, y, 2, 3, 0, 1, new_color);
          handleTriangle(tris[3], x, y, 3, 2, 0, 1, new_color);
        }
      }
    }

    // draw a circle where the mouse is currently located
    FillCircle(GetMousePos(), 1, olc::RED);

    // draw a point where the mouse is currently located
    Draw(GetMousePos(), olc::WHITE);

    FillRect({245, 180}, {10, 10},
             new_color == olc::BLACK ? olc::BLANK : new_color);
    DrawRect({245, 180}, {10, 10}, olc::WHITE);

    manager.Update(this);
    manager.Draw(this);

    return true;
  }
};

int main() {
  // an instance of the Example, called demo
  Example demo;

  // attempt to construct the window/screen 256x240 pixels,
  // with pixels that are 2x2. If successful, start
  // the demo.
  if (demo.Construct(260, 240, 2, 2))
    demo.Start();

  // this is the end of the program
  return 0;
}