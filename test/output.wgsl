struct Uniforms {
  u_resolution: vec2f,
  u_time: f32,
  sc_u_cam_x: f32,
  sc_u_cam_cos: f32,
  sc_u_cam_sin: f32,
  sc_u_cam_size: f32,
  sc_u_cam_y: f32,
  sc_u_fade_in: f32,
  sc_u_fade_out: f32,
  sc_u_beat: f32,
  sc_u_le_t: f32,
  sc_u_sw_radius1: f32,
  sc_u_sw_radius2: f32,
  sc_u_text_size: f32,
  sc_u_text_dir: f32,
  sc_u_flash: f32,
  sc_ltex_size: vec2f,
  sc_llen_0: vec4f,
  sc_lmeta_0: vec3f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> sc_ltex: array<vec4f>;

var<private> sc_v_x: f32;
var<private> sc_v_cam_x: f32;
var<private> sc_v_cam_cos: f32;
var<private> sc_v_cam_sin: f32;
var<private> sc_v_cam_size: f32;
var<private> sc_v_y: f32;
var<private> sc_v_cam_y: f32;
var<private> sc_v_color_r: f32;
var<private> sc_v_color_g: f32;
var<private> sc_v_color_b: f32;
var<private> sc_v_fade_in: f32;
var<private> sc_v_fade_out: f32;
var<private> sc_v_dist: f32;
var<private> sc_v_atan: f32;
var<private> sc_v_beat: f32;
var<private> sc_v_i: f32;
var<private> sc_v_light: f32;
var<private> sc_v_light2: f32;
var<private> sc_v_color_a: f32;
var<private> sc_v_le_t: f32;
var<private> sc_v_x2: f32;
var<private> sc_v_y2: f32;
var<private> sc_v_sw_radius1: f32;
var<private> sc_v_sw_radius2: f32;
var<private> sc_v_text_size: f32;
var<private> sc_v_text_dir: f32;
var<private> sc_v_flash: f32;
var<private> sc_color: f32;
var<private> sc_frag_coord: vec2f;

fn sc_lget_0_0(idx: f32) -> f32 {
  let len = u.sc_llen_0.x;
  if (len <= 0.0) { return 0.0; }
  let i = u32(clamp(idx - 1.0, 0.0, len - 1.0));
  return sc_ltex[u.sc_lmeta_0.z + i].x;
}
fn sc_lget_0_1(idx: f32) -> f32 {
  let len = u.sc_llen_0.y;
  if (len <= 0.0) { return 0.0; }
  let i = u32(clamp(idx - 1.0, 0.0, len - 1.0));
  return sc_ltex[u.sc_lmeta_0.z + i].y;
}
fn sc_lget_0_2(idx: f32) -> f32 {
  let len = u.sc_llen_0.z;
  if (len <= 0.0) { return 0.0; }
  let i = u32(clamp(idx - 1.0, 0.0, len - 1.0));
  return sc_ltex[u.sc_lmeta_0.z + i].z;
}

fn sc_mod(a: f32, b: f32) -> f32 {
  return a - b * floor(a / b);
}

fn sc_rand(co: vec3f) -> f32 {
  var c = co;
  c = fract(c * 0.3183099 + vec3f(0.71, 0.113, 0.419));
  c += dot(c, c.yzx + 19.19);
  return fract((c.x + c.y) * (c.y + c.z) * (c.z + c.x));
}

fn sc_fn_pixel_s_s(sc_a_x: f32, sc_a_y: f32) {
  sc_v_x = (sc_mod(((sc_v_cam_x + (((sc_a_x * sc_v_cam_cos) - (sc_a_y * sc_v_cam_sin)) * sc_v_cam_size)) + 240.0), 480.0) - 240.0);
  sc_v_y = (sc_mod(((sc_v_cam_y + (((sc_a_x * sc_v_cam_sin) + (sc_a_y * sc_v_cam_cos)) * sc_v_cam_size)) + 135.0), 270.0) - 135.0);
  sc_v_color_r = 0.0;
  sc_v_color_g = 255.0;
  sc_v_color_b = 0.0;
  if ((((sc_a_x * sc_a_x) + (sc_a_y * sc_a_y)) < sc_v_fade_in) && ((sc_a_x + (sc_a_y / 5.0)) > sc_v_fade_out)) {
    sc_v_color_r = 0.0;
    sc_v_color_g = 0.0;
    sc_v_color_b = 0.0;
    sc_v_dist = sqrt(((sc_v_x * sc_v_x) + ((sc_v_y + 120.0) * (sc_v_y + 120.0))));
    sc_v_atan = atan(select(1e20, sc_v_x / (sc_v_y + 120.0), (sc_v_y + 120.0) != 0.0)) * 57.29577951308232;
    if (sc_v_dist < 32.0) {
      sc_v_color_r = 255.0;
      sc_v_color_g = 255.0;
      sc_v_color_b = 255.0;
      if (sc_v_dist < 20.0) {
        sc_v_color_r = 0.0;
        sc_v_color_g = 150.0;
        sc_v_color_b = 240.0;
      }
    }
    if (sc_v_dist < 95.0) {
      if (sc_v_dist > 90.0) {
        if (sc_v_dist > 92.5) {
          sc_v_color_g += 70.0;
          sc_v_color_b += 110.0;
        } else {
          sc_v_color_g += 50.0;
          sc_v_color_b += 105.0;
        }
      }
    }
    if (sc_v_dist < 115.0) {
      if (sc_v_dist > 105.0) {
        if (sc_v_dist > 110.0) {
          sc_v_color_g += 70.0;
          sc_v_color_b += 110.0;
        } else {
          sc_v_color_g += 50.0;
          sc_v_color_b += 105.0;
        }
      }
    }
    if (sc_v_dist < 102.0) {
      if (sc_v_dist > 85.0) {
        if (sc_mod((sc_v_atan - (sc_v_beat * 30.0)), 60.0) < 20.0) {
          sc_v_color_r = 255.0;
          sc_v_color_g = 255.0;
          sc_v_color_b = 255.0;
        }
      }
    }
    if (sc_v_dist < 125.0) {
      if (sc_v_dist > 114.0) {
        if (sc_mod((sc_v_atan + (sc_v_beat * 30.0)), 90.0) < 45.0) {
          sc_v_color_g += 60.0;
          sc_v_color_b += 90.0;
        }
      }
    }
    if (sc_v_dist < 129.0) {
      if (sc_v_dist > 127.0) {
        if (sc_mod((sc_v_atan + (sc_v_beat * 10.0)), 90.0) < 20.0) {
          sc_v_color_r += ((255.0 - sc_v_color_r) * 0.5);
          sc_v_color_g += ((255.0 - sc_v_color_g) * 0.5);
          sc_v_color_b += ((255.0 - sc_v_color_b) * 0.5);
        }
      }
    }
    if (sc_v_dist < 145.0) {
      if (sc_v_dist > 133.0) {
        if (sc_mod((sc_v_x + (sc_v_y * 0.25)), 8.0) < 5.0) {
          if (sc_mod((sc_v_atan - (sc_v_beat * 24.0)), 120.0) < 60.0) {
            sc_v_color_g += 100.0;
            sc_v_color_b += 180.0;
          }
        }
      }
    }
    if (sc_v_dist < 183.0) {
      if (sc_v_dist > 155.0) {
        if (sc_v_dist < 180.0) {
          if (sc_mod((sc_v_atan - (sc_v_beat * -20.0)), 90.0) < 60.0) {
            if (sc_mod((sc_v_x + (sc_v_y * -0.25)), 8.0) < 6.5) {
              sc_v_color_r += ((255.0 - sc_v_color_r) * 0.3);
              sc_v_color_g += ((255.0 - sc_v_color_g) * 0.3);
              sc_v_color_b += ((255.0 - sc_v_color_b) * 0.3);
            }
          }
        } else {
          if (sc_mod(((sc_v_atan - (sc_v_beat * -20.0)) - 7.5), 90.0) < 45.0) {
            
          } else {
            sc_v_color_r += ((255.0 - sc_v_color_r) * 0.75);
            sc_v_color_g += ((255.0 - sc_v_color_g) * 0.75);
            sc_v_color_b += ((255.0 - sc_v_color_b) * 0.75);
          }
        }
      }
    }
    if (sc_v_dist < 194.0) {
      if (sc_v_dist > 188.0) {
        if (sc_mod((sc_v_atan + (sc_v_beat * 35.0)), 45.0) < 30.0) {
          sc_v_color_g += 60.0;
          sc_v_color_b += 90.0;
        }
      }
    }
    if (sc_v_dist < 225.0) {
      if (sc_v_dist > 200.0) {
        if (sc_mod((sc_v_atan + (sc_v_beat * -15.0)), 45.0) < 30.0) {
          if (sc_mod((sc_v_x + (sc_v_y * -0.25)), 10.0) < 1.5) {
            sc_v_color_r += ((255.0 - sc_v_color_r) * 0.5);
            sc_v_color_g += ((255.0 - sc_v_color_g) * 0.5);
            sc_v_color_b += ((255.0 - sc_v_color_b) * 0.5);
          }
        }
      }
    }
    if (sc_v_dist < 235.0) {
      if (sc_v_dist > 230.0) {
        if (sc_mod((sc_v_atan + (sc_v_beat * -40.0)), 45.0) < 30.0) {
          sc_v_color_g += 50.0;
          sc_v_color_b += 90.0;
        }
      }
    }
    if (sc_v_dist < 275.0) {
      if (sc_v_dist > 245.0) {
        if (sc_mod((sc_v_atan + (sc_v_beat * 15.0)), 45.0) < 30.0) {
          if (sc_mod((sc_v_x + (sc_v_y * 0.25)), 10.0) < 1.5) {
            sc_v_color_r += ((100.0 - sc_v_color_r) * 0.5);
            sc_v_color_g += ((200.0 - sc_v_color_g) * 0.5);
            sc_v_color_b += ((255.0 - sc_v_color_b) * 0.5);
          }
        }
      }
    }
    if (((sc_v_x > 40.0) && (sc_v_x < 240.0)) && ((sc_v_y > 5.0) && (sc_v_y < 120.0))) {
      sc_v_i = ((floor(((((sc_v_x - 150.0) * 1.5) + 240.0) * 2.0) + 0.5) + (floor(((((sc_v_y - 75.0) * 1.5) + 142.5) * 2.0) + 0.5) * 960.0)) * 4.0);
      sc_v_light = (sc_lget_0_0((sc_v_i + 1.0)) * 0.99);
      sc_v_light2 = (sc_lget_0_0((sc_v_i + 2.0)) * 0.99);
      sc_v_color_a = sc_lget_0_0((sc_v_i + 4.0));
      sc_v_color_r += ((sc_v_light2 - sc_v_color_r) * sc_v_color_a);
      sc_v_color_g += ((((sc_v_light * 0.45) + (sc_v_light2 * 0.55)) - sc_v_color_g) * sc_v_color_a);
      sc_v_color_b += ((sc_v_light - sc_v_color_b) * sc_v_color_a);
    }
    if (((sc_v_x < -40.0) && (sc_v_x > -240.0)) && ((sc_v_y < -5.0) && (sc_v_y > -120.0))) {
      sc_v_i = ((floor(((((sc_v_x + 150.0) * 1.5) + 240.0) * 2.0) + 0.5) + (floor(((((sc_v_y + 75.0) * 1.5) + 142.5) * 2.0) + 0.5) * 960.0)) * 4.0);
      sc_v_light = (sc_lget_0_0((sc_v_i + 1.0)) * 0.99);
      sc_v_light2 = (sc_lget_0_0((sc_v_i + 2.0)) * 0.99);
      sc_v_color_a = sc_lget_0_0((sc_v_i + 4.0));
      sc_v_color_r += ((sc_v_light2 - sc_v_color_r) * sc_v_color_a);
      sc_v_color_g += ((((sc_v_light * 0.45) + (sc_v_light2 * 0.55)) - sc_v_color_g) * sc_v_color_a);
      sc_v_color_b += ((sc_v_light - sc_v_color_b) * sc_v_color_a);
    }
    sc_v_color_r += ((100.0 - sc_v_color_r) * (0.15 - (sc_v_dist * 0.0003)));
    sc_v_color_g += ((200.0 - sc_v_color_g) * (0.15 - (sc_v_dist * 0.0003)));
    sc_v_color_b += ((255.0 - sc_v_color_b) * (0.15 - (sc_v_dist * 0.0003)));
    if (((sc_v_x < 180.0) && (sc_v_x > -180.0)) && ((sc_v_y < 180.0) && (sc_v_y > -180.0))) {
      if ((sc_v_le_t > -0.1) && (((sc_v_le_t + 0.1) * 40.0) < 75.0)) {
        sc_v_i = sc_lget_0_1((1.0 + ((129600.0 * floor(((sc_v_le_t + 0.1) * 40.0))) + (floor((sc_v_x + 180.0) + 0.5) + (floor((180.0 - sc_v_y) + 0.5) * 360.0)))));
        if (sc_v_i > 13107200.0) {
          sc_v_color_r = 255.0;
          sc_v_color_g = 255.0;
          sc_v_color_b = 255.0;
        } else {
          if (sc_mod(sc_v_i, 256.0) > 200.0) {
            sc_v_color_r = 0.0;
            sc_v_color_g = 135.0;
            sc_v_color_b = 255.0;
          }
        }
      }
    }
    sc_v_x2 = (sc_mod((sc_v_x + 40.0), 80.0) - 40.0);
    sc_v_y2 = (sc_mod((sc_v_y + 40.0), 80.0) - 40.0);
    sc_v_dist = ((sc_v_x2 * sc_v_x2) + (sc_v_y2 * sc_v_y2));
    if (sc_v_dist < sc_v_sw_radius1) {
      if (sc_v_dist > sc_v_sw_radius2) {
        sc_v_color_r = 255.0;
        sc_v_color_g = 255.0;
        sc_v_color_b = 255.0;
      }
    }
    if (((sc_v_x > (-237.5 * sc_v_text_size)) && (sc_v_x < (237.5 * sc_v_text_size))) && ((sc_v_y > (-237.5 * sc_v_text_size)) && (sc_v_y < (237.5 * sc_v_text_size)))) {
      sc_v_i = ((floor(((select(1e20, ((sc_v_x * cos((sc_v_text_dir) * 0.017453292519943295)) - (sc_v_y * sin((sc_v_text_dir) * 0.017453292519943295))) / sc_v_text_size, sc_v_text_size != 0.0) + 237.5) * 2.0) + 0.5) + (floor(((70.5 - select(1e20, ((sc_v_x * sin((sc_v_text_dir) * 0.017453292519943295)) + (sc_v_y * cos((sc_v_text_dir) * 0.017453292519943295))) / sc_v_text_size, sc_v_text_size != 0.0)) * 2.0) + 0.5) * 949.0)) * 4.0);
      sc_v_color_a = sc_lget_0_2((4.0 + sc_v_i));
      sc_v_color_r += ((sc_lget_0_2((1.0 + sc_v_i)) - sc_v_color_r) * sc_v_color_a);
      sc_v_color_g += ((sc_lget_0_2((2.0 + sc_v_i)) - sc_v_color_g) * sc_v_color_a);
      sc_v_color_b += ((sc_lget_0_2((3.0 + sc_v_i)) - sc_v_color_b) * sc_v_color_a);
    }
    sc_v_color_r += (0.0 * 0.8);
    sc_v_color_g += (0.0 * 0.8);
    sc_v_color_b += (0.0 * 0.8);
    if (sc_v_color_r < 0.0) {
      sc_v_color_r = 0.0;
    }
    if (sc_v_color_g < 0.0) {
      sc_v_color_g = 0.0;
    }
    if (sc_v_color_b < 0.0) {
      sc_v_color_b = 0.0;
    }
    if (sc_v_color_r > 255.0) {
      sc_v_color_r = 255.0;
    }
    if (sc_v_color_g > 255.0) {
      sc_v_color_g = 255.0;
    }
    if (sc_v_color_b > 255.0) {
      sc_v_color_b = 255.0;
    }
    sc_v_color_r += (sc_v_flash * 120.0);
    sc_v_color_g += (sc_v_flash * 120.0);
    sc_v_color_b += (sc_v_flash * 120.0);
    sc_v_color_g += 10.0;
    sc_v_color_b += 20.0;
    if (sc_v_color_r > 255.0) {
      sc_v_color_r = 255.0;
    }
    if (sc_v_color_g > 255.0) {
      sc_v_color_g = 255.0;
    }
    if (sc_v_color_b > 255.0) {
      sc_v_color_b = 255.0;
    }
  }
  sc_color = ((floor((sc_v_color_r * 0.99)) * 65536.0) + ((floor((sc_v_color_g * 0.99)) * 256.0) + floor((sc_v_color_b * 0.99))));
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let pos = array<vec2f, 4>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0)
  );
  return vec4f(pos[vi], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  sc_frag_coord = pos.xy;
  sc_v_x = -93.9721886508733;
  sc_v_cam_x = u.sc_u_cam_x;
  sc_v_cam_cos = u.sc_u_cam_cos;
  sc_v_cam_sin = u.sc_u_cam_sin;
  sc_v_cam_size = u.sc_u_cam_size;
  sc_v_y = 85.03118717059795;
  sc_v_cam_y = u.sc_u_cam_y;
  sc_v_color_r = 103.43378215269578;
  sc_v_color_g = 121.66756430539158;
  sc_v_color_b = 136.19614448937426;
  sc_v_fade_in = u.sc_u_fade_in;
  sc_v_fade_out = u.sc_u_fade_out;
  sc_v_dist = 220.53490004118217;
  sc_v_atan = -24.62346345064932;
  sc_v_beat = u.sc_u_beat;
  sc_v_i = -1078044.0;
  sc_v_light = 252.4500006490946;
  sc_v_light2 = 0.000166168212890625;
  sc_v_color_a = 0.0;
  sc_v_le_t = u.sc_u_le_t;
  sc_v_x2 = -13.972188650873306;
  sc_v_y2 = 5.031187170597946;
  sc_v_sw_radius1 = u.sc_u_sw_radius1;
  sc_v_sw_radius2 = u.sc_u_sw_radius2;
  sc_v_text_size = u.sc_u_text_size;
  sc_v_text_dir = u.sc_u_text_dir;
  sc_v_flash = u.sc_u_flash;
  sc_color = 0.0;
  let px = pos.x - u.u_resolution.x * 0.5;
  let py = pos.y - u.u_resolution.y * 0.5;
  sc_fn_pixel_s_s(px, py);
  let c = floor(sc_color + 0.5);
  let cl = clamp(c, 0.0, 16777215.0);
  let cr = floor(cl / 65536.0);
  let cg = sc_mod(floor(cl / 256.0), 256.0);
  let cb = sc_mod(cl, 256.0);
  return vec4f(cr / 255.0, cg / 255.0, cb / 255.0, 1.0);
}