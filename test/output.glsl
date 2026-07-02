precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
float sc_v_c;
float sc_v_x;
float sc_v_m;
float sc_v_cr;
float sc_v_cg;
float sc_v_cb;
float sc_v_cosi;
float sc_v_etai;
float sc_v_etat;
float sc_v_nx;
float sc_v_ny;
float sc_v_nz;
float sc_v_cos_;
float sc_v_currDX;
float sc_v_inx;
float sc_v_currDY;
float sc_v_iny;
float sc_v_currDZ;
float sc_v_inz;
float sc_v_F0;
float sc_v_xx;
float sc_v_F;
float sc_v_d;
float sc_v_specDirX;
float sc_v_specDirY;
float sc_v_specDirZ;
float sc_v_eta;
float sc_v_k;
float sc_v_dist;
float sc_v_vx;
float sc_v_vy;
float sc_v_vz;
float sc_v_hitT;
float sc_v_hitTri;
float sc_v_rayOX;
float sc_v_rayOY;
float sc_v_rayOZ;
float sc_v_rayDX;
float sc_v_rayDY;
float sc_v_rayDZ;
float sc_v_invRayDX;
float sc_v_invRayDY;
float sc_v_invRayDZ;
float sc_v_raySignDX;
float sc_v_raySignDY;
float sc_v_raySignDZ;
float sc_v_w;
float sc_v_iu;
float sc_v_iv;
float sc_v_ir;
float sc_v_ig;
float sc_v_ib;
float sc_v_er;
float sc_v_eg;
float sc_v_eb;
float sc_v_ior;
float sc_v_rough;
float sc_v_id;
float sc_v_ix;
float sc_v_iz;
float sc_v_t0;
float sc_v_ty1;
float sc_v_hit;
float sc_v_t1;
float sc_v_ty0;
float sc_v_lt;
float sc_v_left;
float sc_v_right;
float sc_v_node;
float sc_v_ptr;
float sc_v_return_r;
float sc_v_return_g;
float sc_v_return_b;
uniform float sc_u_sample;
float sc_v_sample;
float sc_v_px;
uniform float sc_u_resolution;
float sc_v_resolution;
float sc_v_py;
uniform float sc_u_focalLength2;
float sc_v_focalLength2;
uniform float sc_u_focalLength;
float sc_v_focalLength;
uniform float sc_u_cameraX;
float sc_v_cameraX;
uniform float sc_u_cameraY;
float sc_v_cameraY;
uniform float sc_u_cameraZ;
float sc_v_cameraZ;
uniform float sc_u_m0;
float sc_v_m0;
uniform float sc_u_m1;
float sc_v_m1;
uniform float sc_u_m2;
float sc_v_m2;
uniform float sc_u_m3;
float sc_v_m3;
uniform float sc_u_m4;
float sc_v_m4;
uniform float sc_u_m5;
float sc_v_m5;
uniform float sc_u_m6;
float sc_v_m6;
uniform float sc_u_m7;
float sc_v_m7;
uniform float sc_u_m8;
float sc_v_m8;
float sc_v_sample_r;
float sc_v_sample_g;
float sc_v_sample_b;
float sc_v_i;
float sc_v_j;
float sc_v_den;
float sc_v_t;
float sc_v_pz;
float sc_v_x0;
float sc_v_y0;
float sc_v_z0;
float sc_v_u;
float sc_v_v;
float sc_v_iy;
float sc_v_currOX;
float sc_v_currOY;
float sc_v_currOZ;
float sc_v_rayR;
float sc_v_rayG;
float sc_v_rayB;
uniform float sc_u_maxBounces;
float sc_v_maxBounces;
float sc_v_diffuseDirX;
float sc_v_diffuseDirY;
float sc_v_diffuseDirZ;
float sc_v_theta;
float sc_v_r;
float sc_v_y;
float sc_v_z;
float sc_v_tx;
float sc_v_ty;
float sc_v_tz;
float sc_v_tLen;
uniform float sc_u_newDX;
float sc_v_newDX;
uniform float sc_u_newDY;
float sc_v_newDY;
uniform float sc_u_newDZ;
float sc_v_newDZ;
float sc_color;

uniform sampler2D sc_ltex;
uniform vec2 sc_ltex_size;
uniform vec2 sc_ltex_size_inv;
uniform vec3 sc_lmeta_0;
uniform vec4 sc_llen_0;
float sc_lget_0_0(float idx) {
  float len = sc_llen_0.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_0.x) + 0.5;
  float y = sc_lmeta_0.z + floor(i / sc_lmeta_0.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_0_1(float idx) {
  float len = sc_llen_0.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_0.x) + 0.5;
  float y = sc_lmeta_0.z + floor(i / sc_lmeta_0.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_0_2(float idx) {
  float len = sc_llen_0.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_0.x) + 0.5;
  float y = sc_lmeta_0.z + floor(i / sc_lmeta_0.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_0_3(float idx) {
  float len = sc_llen_0.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_0.x) + 0.5;
  float y = sc_lmeta_0.z + floor(i / sc_lmeta_0.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_1;
uniform vec4 sc_llen_1;
float sc_lget_1_0(float idx) {
  float len = sc_llen_1.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_1.x) + 0.5;
  float y = sc_lmeta_1.z + floor(i / sc_lmeta_1.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_1_1(float idx) {
  float len = sc_llen_1.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_1.x) + 0.5;
  float y = sc_lmeta_1.z + floor(i / sc_lmeta_1.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_1_2(float idx) {
  float len = sc_llen_1.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_1.x) + 0.5;
  float y = sc_lmeta_1.z + floor(i / sc_lmeta_1.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_1_3(float idx) {
  float len = sc_llen_1.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_1.x) + 0.5;
  float y = sc_lmeta_1.z + floor(i / sc_lmeta_1.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_2;
uniform vec4 sc_llen_2;
float sc_lget_2_0(float idx) {
  float len = sc_llen_2.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_2.x) + 0.5;
  float y = sc_lmeta_2.z + floor(i / sc_lmeta_2.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_2_1(float idx) {
  float len = sc_llen_2.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_2.x) + 0.5;
  float y = sc_lmeta_2.z + floor(i / sc_lmeta_2.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_2_2(float idx) {
  float len = sc_llen_2.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_2.x) + 0.5;
  float y = sc_lmeta_2.z + floor(i / sc_lmeta_2.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_2_3(float idx) {
  float len = sc_llen_2.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_2.x) + 0.5;
  float y = sc_lmeta_2.z + floor(i / sc_lmeta_2.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_3;
uniform vec4 sc_llen_3;
float sc_lget_3_0(float idx) {
  float len = sc_llen_3.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_3.x) + 0.5;
  float y = sc_lmeta_3.z + floor(i / sc_lmeta_3.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_3_1(float idx) {
  float len = sc_llen_3.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_3.x) + 0.5;
  float y = sc_lmeta_3.z + floor(i / sc_lmeta_3.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_3_2(float idx) {
  float len = sc_llen_3.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_3.x) + 0.5;
  float y = sc_lmeta_3.z + floor(i / sc_lmeta_3.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_3_3(float idx) {
  float len = sc_llen_3.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_3.x) + 0.5;
  float y = sc_lmeta_3.z + floor(i / sc_lmeta_3.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_4;
uniform vec4 sc_llen_4;
float sc_lget_4_0(float idx) {
  float len = sc_llen_4.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_4.x) + 0.5;
  float y = sc_lmeta_4.z + floor(i / sc_lmeta_4.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_4_1(float idx) {
  float len = sc_llen_4.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_4.x) + 0.5;
  float y = sc_lmeta_4.z + floor(i / sc_lmeta_4.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_4_2(float idx) {
  float len = sc_llen_4.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_4.x) + 0.5;
  float y = sc_lmeta_4.z + floor(i / sc_lmeta_4.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_4_3(float idx) {
  float len = sc_llen_4.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_4.x) + 0.5;
  float y = sc_lmeta_4.z + floor(i / sc_lmeta_4.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_5;
uniform vec4 sc_llen_5;
float sc_lget_5_0(float idx) {
  float len = sc_llen_5.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_5.x) + 0.5;
  float y = sc_lmeta_5.z + floor(i / sc_lmeta_5.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_5_1(float idx) {
  float len = sc_llen_5.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_5.x) + 0.5;
  float y = sc_lmeta_5.z + floor(i / sc_lmeta_5.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_5_2(float idx) {
  float len = sc_llen_5.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_5.x) + 0.5;
  float y = sc_lmeta_5.z + floor(i / sc_lmeta_5.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_5_3(float idx) {
  float len = sc_llen_5.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_5.x) + 0.5;
  float y = sc_lmeta_5.z + floor(i / sc_lmeta_5.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_6;
uniform vec4 sc_llen_6;
float sc_lget_6_0(float idx) {
  float len = sc_llen_6.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_6.x) + 0.5;
  float y = sc_lmeta_6.z + floor(i / sc_lmeta_6.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_6_1(float idx) {
  float len = sc_llen_6.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_6.x) + 0.5;
  float y = sc_lmeta_6.z + floor(i / sc_lmeta_6.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_6_2(float idx) {
  float len = sc_llen_6.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_6.x) + 0.5;
  float y = sc_lmeta_6.z + floor(i / sc_lmeta_6.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_6_3(float idx) {
  float len = sc_llen_6.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_6.x) + 0.5;
  float y = sc_lmeta_6.z + floor(i / sc_lmeta_6.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_7;
uniform vec4 sc_llen_7;
float sc_lget_7_0(float idx) {
  float len = sc_llen_7.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_7.x) + 0.5;
  float y = sc_lmeta_7.z + floor(i / sc_lmeta_7.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_7_1(float idx) {
  float len = sc_llen_7.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_7.x) + 0.5;
  float y = sc_lmeta_7.z + floor(i / sc_lmeta_7.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_7_2(float idx) {
  float len = sc_llen_7.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_7.x) + 0.5;
  float y = sc_lmeta_7.z + floor(i / sc_lmeta_7.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_7_3(float idx) {
  float len = sc_llen_7.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_7.x) + 0.5;
  float y = sc_lmeta_7.z + floor(i / sc_lmeta_7.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_8;
uniform vec4 sc_llen_8;
float sc_lget_8_0(float idx) {
  float len = sc_llen_8.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_8.x) + 0.5;
  float y = sc_lmeta_8.z + floor(i / sc_lmeta_8.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_8_1(float idx) {
  float len = sc_llen_8.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_8.x) + 0.5;
  float y = sc_lmeta_8.z + floor(i / sc_lmeta_8.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_8_2(float idx) {
  float len = sc_llen_8.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_8.x) + 0.5;
  float y = sc_lmeta_8.z + floor(i / sc_lmeta_8.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_8_3(float idx) {
  float len = sc_llen_8.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_8.x) + 0.5;
  float y = sc_lmeta_8.z + floor(i / sc_lmeta_8.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_9;
uniform vec4 sc_llen_9;
float sc_lget_9_0(float idx) {
  float len = sc_llen_9.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_9.x) + 0.5;
  float y = sc_lmeta_9.z + floor(i / sc_lmeta_9.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_9_1(float idx) {
  float len = sc_llen_9.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_9.x) + 0.5;
  float y = sc_lmeta_9.z + floor(i / sc_lmeta_9.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}
float sc_lget_9_2(float idx) {
  float len = sc_llen_9.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_9.x) + 0.5;
  float y = sc_lmeta_9.z + floor(i / sc_lmeta_9.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).z;
}
float sc_lget_9_3(float idx) {
  float len = sc_llen_9.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_9.x) + 0.5;
  float y = sc_lmeta_9.z + floor(i / sc_lmeta_9.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).w;
}
uniform vec3 sc_lmeta_10;
uniform vec4 sc_llen_10;
float sc_lget_10_0(float idx) {
  float len = sc_llen_10.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_10.x) + 0.5;
  float y = sc_lmeta_10.z + floor(i / sc_lmeta_10.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).x;
}
float sc_lget_10_1(float idx) {
  float len = sc_llen_10.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lmeta_10.x) + 0.5;
  float y = sc_lmeta_10.z + floor(i / sc_lmeta_10.x) + 0.5;
  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).y;
}

float sc_la_stack[256];
float sc_len_stack;
float sc_laget_stack(float idx) {
  if (sc_len_stack <= 0.0) return 0.0;
  float gi = clamp(idx - 1.0, 0.0, sc_len_stack - 1.0);
  float result = 0.0;
  for (int mi = 0; mi < 256; mi++) {
    if (float(mi) == gi) { result = sc_la_stack[mi]; break; }
  }
  return result;
}

float sc_rand(vec3 co) {
  co = fract(co * 0.3183099 + vec3(0.71, 0.113, 0.419));
  co += dot(co, co.yzx + 19.19);
  return fract((co.x + co.y) * (co.y + co.z) * (co.z + co.x));
}

void sc_fn_hsv2rgb_s_s_s(in float sc_a_h, in float sc_a_s, in float sc_a_v);
void sc_fn_specular_s_s_s_normal_s_s_s_ior_s(in float sc_a_x, in float sc_a_y, in float sc_a_z, in float sc_a_nx, in float sc_a_ny, in float sc_a_nz, in float sc_a_ior);
void sc_fn_normalize_s_s_s(in float sc_a_x, in float sc_a_y, in float sc_a_z);
void sc_fn_intersectionAABB_s(in float sc_a_node);
void sc_fn_intersectionTriangle_s(in float sc_a_node);
void sc_fn_traverse_s(in float sc_a_node);
void sc_fn_castRay_s_s_s_dir_s_s_s_dist_s(in float sc_a_ox, in float sc_a_oy, in float sc_a_oz, in float sc_a_dx, in float sc_a_dy, in float sc_a_dz, in float sc_a_dist);
void sc_fn_diffuse_s_s_s(in float sc_a_nx, in float sc_a_ny, in float sc_a_nz);
void sc_fn_pathtrace_s_s_s_s_s_s(in float sc_a_ox, in float sc_a_oy, in float sc_a_oz, in float sc_a_dx, in float sc_a_dy, in float sc_a_dz);
void sc_fn_pixel_s_s(in float sc_a_x, in float sc_a_y);

void sc_fn_hsv2rgb_s_s_s(in float sc_a_h, in float sc_a_s, in float sc_a_v) {
  sc_v_c = (sc_a_s * sc_a_v);
  sc_v_x = (sc_v_c * (1.0 - abs((mod((sc_a_h / 60.0), 2.0) - 1.0))));
  sc_v_m = (sc_a_v - sc_v_c);
  if ((sc_a_h < 60.0)) {
    sc_v_cr = sc_v_c;
    sc_v_cg = sc_v_x;
    sc_v_cb = 0.0;
  } else {
    if ((sc_a_h < 120.0)) {
      sc_v_cr = sc_v_x;
      sc_v_cg = sc_v_c;
      sc_v_cb = 0.0;
    } else {
      if ((sc_a_h < 180.0)) {
        sc_v_cr = 0.0;
        sc_v_cg = sc_v_c;
        sc_v_cb = sc_v_x;
      } else {
        if ((sc_a_h < 240.0)) {
          sc_v_cr = 0.0;
          sc_v_cg = sc_v_x;
          sc_v_cb = sc_v_c;
        } else {
          if ((sc_a_h < 300.0)) {
            sc_v_cr = sc_v_x;
            sc_v_cg = 0.0;
            sc_v_cb = sc_v_c;
          } else {
            if ((sc_a_h < 360.0)) {
              sc_v_cr = sc_v_c;
              sc_v_cg = 0.0;
              sc_v_cb = sc_v_x;
            }
          }
        }
      }
    }
  }
  sc_v_cr += sc_v_m;
  sc_v_cg += sc_v_m;
  sc_v_cb += sc_v_m;
  sc_v_cr = (sc_v_cr * 255.0);
  sc_v_cg = (sc_v_cg * 255.0);
  sc_v_cb = (sc_v_cb * 255.0);
}

void sc_fn_specular_s_s_s_normal_s_s_s_ior_s(in float sc_a_x, in float sc_a_y, in float sc_a_z, in float sc_a_nx, in float sc_a_ny, in float sc_a_nz, in float sc_a_ior) {
  sc_v_cosi = ((sc_a_x * sc_a_nx) + ((sc_a_y * sc_a_ny) + (sc_a_z * sc_a_nz)));
  sc_v_cosi = (1.0 + ((sc_v_cosi - 1.0) * ((sc_v_cosi < 1.0) ? 1.0 : 0.0)));
  sc_v_cosi = (1.0 + ((sc_v_cosi + 1.0) * ((sc_v_cosi > -1.0) ? 1.0 : 0.0)));
  sc_v_etai = 1.0;
  sc_v_etat = sc_a_ior;
  if ((sc_v_cosi < 0.0)) {
    sc_v_cosi = (0.0 - sc_v_cosi);
    sc_v_nx = sc_a_nx;
    sc_v_ny = sc_a_ny;
    sc_v_nz = sc_a_nz;
  } else {
    sc_v_etai = sc_a_ior;
    sc_v_etat = 1.0;
    sc_v_nx = (0.0 - sc_a_nx);
    sc_v_ny = (0.0 - sc_a_ny);
    sc_v_nz = (0.0 - sc_a_nz);
  }
  sc_v_cos_ = abs((((0.0 - sc_v_currDX) * sc_v_inx) + (((0.0 - sc_v_currDY) * sc_v_iny) + ((0.0 - sc_v_currDZ) * sc_v_inz))));
  sc_v_F0 = (((sc_v_etai + sc_v_etat) == 0.0) ? 1e20 : ((sc_v_etai - sc_v_etat) / (sc_v_etai + sc_v_etat)));
  sc_v_F0 = (sc_v_F0 * sc_v_F0);
  sc_v_xx = (1.0 - sc_v_cos_);
  sc_v_F = (sc_v_F0 + ((1.0 - sc_v_F0) * (sc_v_xx * (sc_v_xx * (sc_v_xx * (sc_v_xx * sc_v_xx))))));
  if ((mix(0.0, 1.0, sc_rand(vec3(gl_FragCoord.xy, u_time + 0.0))) < sc_v_F)) {
    sc_v_d = ((sc_a_x * sc_a_nx) + ((sc_a_y * sc_a_ny) + (sc_a_z * sc_a_nz)));
    sc_v_specDirX = (sc_a_x - (sc_a_nx * (2.0 * sc_v_d)));
    sc_v_specDirY = (sc_a_y - (sc_a_ny * (2.0 * sc_v_d)));
    sc_v_specDirZ = (sc_a_z - (sc_a_nz * (2.0 * sc_v_d)));
  } else {
    sc_v_eta = ((sc_v_etat == 0.0) ? 1e20 : (sc_v_etai / sc_v_etat));
    sc_v_k = (1.0 - ((sc_v_eta * sc_v_eta) * (1.0 - (sc_v_cosi * sc_v_cosi))));
    if ((sc_v_k < 0.0)) {
      sc_v_specDirX = 0.0;
      sc_v_specDirY = 0.0;
      sc_v_specDirZ = 0.0;
    } else {
      sc_v_k = ((sc_v_eta * sc_v_cosi) - sqrt(sc_v_k));
      sc_v_specDirX = ((sc_a_x * sc_v_eta) + (sc_a_nx * sc_v_k));
      sc_v_specDirY = ((sc_a_y * sc_v_eta) + (sc_a_ny * sc_v_k));
      sc_v_specDirZ = ((sc_a_z * sc_v_eta) + (sc_a_nz * sc_v_k));
    }
  }
}

void sc_fn_normalize_s_s_s(in float sc_a_x, in float sc_a_y, in float sc_a_z) {
  sc_v_dist = ((sqrt(((sc_a_x * sc_a_x) + ((sc_a_y * sc_a_y) + (sc_a_z * sc_a_z)))) == 0.0) ? 1e20 : (1.0 / sqrt(((sc_a_x * sc_a_x) + ((sc_a_y * sc_a_y) + (sc_a_z * sc_a_z))))));
  sc_v_vx = (sc_a_x * sc_v_dist);
  sc_v_vy = (sc_a_y * sc_v_dist);
  sc_v_vz = (sc_a_z * sc_v_dist);
}

void sc_fn_intersectionAABB_s(in float sc_a_node) {
  sc_v_t0 = ((sc_lget_4_2((sc_a_node + sc_v_raySignDX)) - sc_v_rayOX) * sc_v_invRayDX);
  sc_v_ty1 = ((sc_lget_4_3((sc_a_node + sc_v_raySignDY)) - sc_v_rayOY) * sc_v_invRayDY);
  if ((sc_v_t0 > sc_v_ty1)) {
    sc_v_hit = 0.0;
    return;
  }
  sc_v_t1 = ((sc_lget_5_0((sc_a_node + sc_v_raySignDX)) - sc_v_rayOX) * sc_v_invRayDX);
  sc_v_ty0 = ((sc_lget_5_1((sc_a_node + sc_v_raySignDY)) - sc_v_rayOY) * sc_v_invRayDY);
  if ((sc_v_ty0 > sc_v_t1)) {
    sc_v_hit = 0.0;
    return;
  }
  if ((sc_v_ty0 > sc_v_t0)) {
    sc_v_t0 = sc_v_ty0;
  }
  if ((sc_v_ty1 < sc_v_t1)) {
    sc_v_t1 = sc_v_ty1;
  }
  sc_v_ty1 = ((sc_lget_5_2((sc_a_node + sc_v_raySignDZ)) - sc_v_rayOZ) * sc_v_invRayDZ);
  if ((sc_v_t0 > sc_v_ty1)) {
    sc_v_hit = 0.0;
    return;
  }
  sc_v_ty0 = ((sc_lget_5_3((sc_a_node + sc_v_raySignDZ)) - sc_v_rayOZ) * sc_v_invRayDZ);
  if ((sc_v_ty0 > sc_v_t1)) {
    sc_v_hit = 0.0;
    return;
  }
  if ((sc_v_ty0 > sc_v_t0)) {
    sc_v_t0 = sc_v_ty0;
  }
  sc_v_hit = ((((((((sc_v_ty1 + ((sc_v_t1 - sc_v_ty1) * ((sc_v_t1 < sc_v_ty1) ? 1.0 : 0.0))) < (sc_v_t0 * ((sc_v_t0 > 0.0) ? 1.0 : 0.0))) ? 1.0 : 0.0) == 0.0) ? 1.0 : 0.0) != 0.0 && ((sc_v_t0 < sc_v_hitT) ? 1.0 : 0.0) != 0.0) ? 1.0 : 0.0) + 0.0);
}

void sc_fn_intersectionTriangle_s(in float sc_a_node) {
  sc_v_i = sc_lget_6_3(sc_a_node);
  for (int sc_i_i_0 = 0; sc_i_i_0 < 256; sc_i_i_0++) {
    if (float(sc_i_i_0) >= sc_lget_6_0(sc_a_node)) break;
    sc_v_j = sc_lget_7_0(sc_v_i);
    sc_v_nx = sc_lget_7_1(sc_v_j);
    sc_v_ny = sc_lget_7_2(sc_v_j);
    sc_v_nz = sc_lget_7_3(sc_v_j);
    sc_v_den = ((sc_v_nx * sc_v_rayDX) + ((sc_v_ny * sc_v_rayDY) + (sc_v_nz * sc_v_rayDZ)));
    sc_v_t = ((sc_v_den == 0.0) ? 1e20 : ((0.0 - ((sc_v_nx * sc_v_rayOX) + ((sc_v_ny * sc_v_rayOY) + ((sc_v_nz * sc_v_rayOZ) + sc_lget_8_0(sc_v_j))))) / sc_v_den));
    if (((sc_v_t < sc_v_hitT) && (sc_v_t > 1e-8))) {
      sc_v_px = (sc_v_rayOX + (sc_v_rayDX * sc_v_t));
      sc_v_py = (sc_v_rayOY + (sc_v_rayDY * sc_v_t));
      sc_v_pz = (sc_v_rayOZ + (sc_v_rayDZ * sc_v_t));
      sc_v_x0 = (sc_v_px - sc_lget_8_1(sc_v_j));
      sc_v_y0 = (sc_v_py - sc_lget_8_2(sc_v_j));
      sc_v_z0 = (sc_v_pz - sc_lget_8_3(sc_v_j));
      sc_v_u = ((sc_v_x0 * sc_lget_9_0(sc_v_j)) + ((sc_v_y0 * sc_lget_9_1(sc_v_j)) + (sc_v_z0 * sc_lget_9_2(sc_v_j))));
      if ((!((sc_v_u < 0.0)))) {
        sc_v_v = ((sc_v_x0 * sc_lget_9_3(sc_v_j)) + ((sc_v_y0 * sc_lget_10_0(sc_v_j)) + (sc_v_z0 * sc_lget_10_1(sc_v_j))));
        if ((!(((sc_v_v < 0.0) || ((sc_v_u + sc_v_v) > 1.0))))) {
          sc_v_hitT = sc_v_t;
          sc_v_hitTri = sc_v_j;
          sc_v_ix = sc_v_px;
          sc_v_iy = sc_v_py;
          sc_v_iz = sc_v_pz;
          sc_v_iu = sc_v_u;
          sc_v_iv = sc_v_v;
        }
      }
    }
    sc_v_i += 1.0;
  }
}

void sc_fn_traverse_s(in float sc_a_node) {
  sc_fn_intersectionAABB_s(sc_a_node);
  if ((abs(sc_v_hit - 1.0) < 0.000001)) {
    sc_v_lt = sc_v_t0;
    if ((sc_lget_6_0(sc_a_node) > 0.0)) {
      sc_fn_intersectionTriangle_s(sc_a_node);
      return;
    } else {
      sc_v_left = sc_lget_6_1(sc_a_node);
      sc_v_right = sc_lget_6_2(sc_a_node);
      sc_fn_intersectionAABB_s(sc_v_left);
      if ((abs(sc_v_hit - 0.0) < 0.000001)) {
        sc_fn_intersectionAABB_s(sc_v_right);
        if ((abs(sc_v_hit - 0.0) < 0.000001)) {
          return;
        } else {
          sc_v_node = sc_v_right;
          sc_v_ptr = 1.0;
        }
      } else {
        sc_v_lt = sc_v_t0;
        sc_fn_intersectionAABB_s(sc_v_right);
        if ((abs(sc_v_hit - 0.0) < 0.000001)) {
          sc_v_node = sc_v_left;
          sc_v_ptr = 1.0;
        } else {
          if ((sc_v_lt < sc_v_t0)) {
            for (int sc_i_i_1 = 0; sc_i_i_1 < 256; sc_i_i_1++) {
              float ci = float(sc_i_i_1 + 1);
              float sc_i_i_2 = floor(1.0 + 0.5);
              if (ci == sc_i_i_2 && 1.0 >= 1.0 && 1.0 <= sc_len_stack) {
                sc_la_stack[sc_i_i_1] = sc_v_right;
                break;
              } else if (ci == sc_len_stack + 1.0 && ci <= float(256) && sc_i_i_2 == ci) {
                sc_la_stack[sc_i_i_1] = sc_v_right;
                sc_len_stack = sc_len_stack + 1.0;
                break;
              }
            }
            sc_v_node = sc_v_left;
          } else {
            for (int sc_i_i_3 = 0; sc_i_i_3 < 256; sc_i_i_3++) {
              float ci = float(sc_i_i_3 + 1);
              float sc_i_i_4 = floor(1.0 + 0.5);
              if (ci == sc_i_i_4 && 1.0 >= 1.0 && 1.0 <= sc_len_stack) {
                sc_la_stack[sc_i_i_3] = sc_v_left;
                break;
              } else if (ci == sc_len_stack + 1.0 && ci <= float(256) && sc_i_i_4 == ci) {
                sc_la_stack[sc_i_i_3] = sc_v_left;
                sc_len_stack = sc_len_stack + 1.0;
                break;
              }
            }
            sc_v_node = sc_v_right;
          }
          sc_v_ptr = 2.0;
        }
      }
    }
    for (int sc_i_i_9 = 0; sc_i_i_9 < 256; sc_i_i_9++) {
      if ((sc_lget_6_0(sc_v_node) > 0.0)) {
        sc_fn_intersectionTriangle_s(sc_v_node);
        sc_v_ptr += -1.0;
        if ((abs(sc_v_ptr - 0.0) < 0.000001)) {
          return;
        }
        sc_v_node = sc_laget_stack(sc_v_ptr);
      } else {
        sc_v_left = sc_lget_6_1(sc_v_node);
        sc_v_right = sc_lget_6_2(sc_v_node);
        sc_fn_intersectionAABB_s(sc_v_left);
        if ((abs(sc_v_hit - 0.0) < 0.000001)) {
          sc_fn_intersectionAABB_s(sc_v_right);
          if ((abs(sc_v_hit - 0.0) < 0.000001)) {
            sc_v_ptr += -1.0;
            if ((abs(sc_v_ptr - 0.0) < 0.000001)) {
              return;
            }
            sc_v_node = sc_laget_stack(sc_v_ptr);
          } else {
            sc_v_node = sc_v_right;
          }
        } else {
          sc_v_lt = sc_v_t0;
          sc_fn_intersectionAABB_s(sc_v_right);
          if ((abs(sc_v_hit - 0.0) < 0.000001)) {
            sc_v_node = sc_v_left;
          } else {
            if ((sc_v_lt < sc_v_t0)) {
              for (int sc_i_i_5 = 0; sc_i_i_5 < 256; sc_i_i_5++) {
                float ci = float(sc_i_i_5 + 1);
                float sc_i_i_6 = floor(sc_v_ptr + 0.5);
                if (ci == sc_i_i_6 && sc_v_ptr >= 1.0 && sc_v_ptr <= sc_len_stack) {
                  sc_la_stack[sc_i_i_5] = sc_v_right;
                  break;
                } else if (ci == sc_len_stack + 1.0 && ci <= float(256) && sc_i_i_6 == ci) {
                  sc_la_stack[sc_i_i_5] = sc_v_right;
                  sc_len_stack = sc_len_stack + 1.0;
                  break;
                }
              }
              sc_v_node = sc_v_left;
            } else {
              for (int sc_i_i_7 = 0; sc_i_i_7 < 256; sc_i_i_7++) {
                float ci = float(sc_i_i_7 + 1);
                float sc_i_i_8 = floor(sc_v_ptr + 0.5);
                if (ci == sc_i_i_8 && sc_v_ptr >= 1.0 && sc_v_ptr <= sc_len_stack) {
                  sc_la_stack[sc_i_i_7] = sc_v_left;
                  break;
                } else if (ci == sc_len_stack + 1.0 && ci <= float(256) && sc_i_i_8 == ci) {
                  sc_la_stack[sc_i_i_7] = sc_v_left;
                  sc_len_stack = sc_len_stack + 1.0;
                  break;
                }
              }
              sc_v_node = sc_v_right;
            }
            sc_v_ptr += 1.0;
          }
        }
      }
    }
  }
}

void sc_fn_castRay_s_s_s_dir_s_s_s_dist_s(in float sc_a_ox, in float sc_a_oy, in float sc_a_oz, in float sc_a_dx, in float sc_a_dy, in float sc_a_dz, in float sc_a_dist) {
  sc_v_hitT = sc_a_dist;
  sc_v_hitTri = 0.0;
  sc_v_rayOX = sc_a_ox;
  sc_v_rayOY = sc_a_oy;
  sc_v_rayOZ = sc_a_oz;
  sc_v_rayDX = sc_a_dx;
  sc_v_rayDY = sc_a_dy;
  sc_v_rayDZ = sc_a_dz;
  sc_v_invRayDX = ((sc_v_rayDX == 0.0) ? 1e20 : (1.0 / sc_v_rayDX));
  sc_v_invRayDY = ((sc_v_rayDY == 0.0) ? 1e20 : (1.0 / sc_v_rayDY));
  sc_v_invRayDZ = ((sc_v_rayDZ == 0.0) ? 1e20 : (1.0 / sc_v_rayDZ));
  sc_v_raySignDX = (0.0 + ((sc_v_rayDX < 0.0) ? 1.0 : 0.0));
  sc_v_raySignDY = (0.0 + ((sc_v_rayDY < 0.0) ? 1.0 : 0.0));
  sc_v_raySignDZ = (0.0 + ((sc_v_rayDZ < 0.0) ? 1.0 : 0.0));
  sc_fn_traverse_s(1.0);
  if ((sc_v_hitTri > 0.0)) {
    sc_v_w = (1.0 - (sc_v_iu + sc_v_iv));
    sc_fn_normalize_s_s_s(((sc_v_w * sc_lget_0_0(sc_v_hitTri)) + ((sc_v_iu * sc_lget_0_1(sc_v_hitTri)) + (sc_v_iv * sc_lget_0_2(sc_v_hitTri)))), ((sc_v_w * sc_lget_0_3(sc_v_hitTri)) + ((sc_v_iu * sc_lget_1_0(sc_v_hitTri)) + (sc_v_iv * sc_lget_1_1(sc_v_hitTri)))), ((sc_v_w * sc_lget_1_2(sc_v_hitTri)) + ((sc_v_iu * sc_lget_1_3(sc_v_hitTri)) + (sc_v_iv * sc_lget_2_0(sc_v_hitTri)))));
    sc_v_inx = sc_v_vx;
    sc_v_iny = sc_v_vy;
    sc_v_inz = sc_v_vz;
    sc_v_ir = sc_lget_2_1(sc_v_hitTri);
    sc_v_ig = sc_lget_2_2(sc_v_hitTri);
    sc_v_ib = sc_lget_2_3(sc_v_hitTri);
    sc_v_er = sc_lget_3_0(sc_v_hitTri);
    sc_v_eg = sc_lget_3_1(sc_v_hitTri);
    sc_v_eb = sc_lget_3_2(sc_v_hitTri);
    sc_v_ior = sc_lget_3_3(sc_v_hitTri);
    sc_v_rough = sc_lget_4_0(sc_v_hitTri);
    sc_v_id = sc_lget_4_1(sc_v_hitTri);
    if ((abs(sc_v_id - 1.0) < 0.000001)) {
      sc_fn_hsv2rgb_s_s_s((mod((atan(((sc_v_iz == 0.0) ? 1e20 : (sc_v_ix / sc_v_iz))) * 57.29577951308232 + (((((sc_v_iz > 0.0) ? 1.0 : 0.0) == 0.0) ? 1.0 : 0.0) * 180.0)), 360.0) / 360.0), 0.8, 1.0);
      sc_v_ir = sc_v_cr;
      sc_v_ig = sc_v_cg;
      sc_v_ib = sc_v_cb;
    }
  }
}

void sc_fn_diffuse_s_s_s(in float sc_a_nx, in float sc_a_ny, in float sc_a_nz) {
  sc_v_u = mix(0.0, 1.0, sc_rand(vec3(gl_FragCoord.xy, u_time + 1.0)));
  sc_v_theta = mix(0.0, 360.0, sc_rand(vec3(gl_FragCoord.xy, u_time + 2.0)));
  sc_v_r = sqrt(sc_v_u);
  sc_v_x = (sc_v_r * cos((sc_v_theta) * 0.017453292519943295));
  sc_v_y = (sc_v_r * sin((sc_v_theta) * 0.017453292519943295));
  sc_v_z = sqrt((1.0 - sc_v_u));
  if ((abs(sc_v_inx) > 0.1)) {
    sc_v_tx = sc_a_nz;
    sc_v_ty = 0.0;
    sc_v_tz = (0.0 - sc_a_nx);
  } else {
    sc_v_tx = 0.0;
    sc_v_ty = (0.0 - sc_a_nz);
    sc_v_tz = sc_a_ny;
  }
  sc_v_tLen = ((sqrt(((sc_v_tx * sc_v_tx) + ((sc_v_ty * sc_v_ty) + (sc_v_tz * sc_v_tz)))) == 0.0) ? 1e20 : (1.0 / sqrt(((sc_v_tx * sc_v_tx) + ((sc_v_ty * sc_v_ty) + (sc_v_tz * sc_v_tz))))));
  sc_v_tx = (sc_v_tx * sc_v_tLen);
  sc_v_ty = (sc_v_ty * sc_v_tLen);
  sc_v_tz = (sc_v_tz * sc_v_tLen);
  sc_v_d = ((sc_v_newDX * sc_a_nx) + ((sc_v_newDY * sc_a_ny) + (sc_v_newDZ * sc_a_nz)));
  sc_v_diffuseDirX = ((sc_v_tx * sc_v_x) + ((((sc_a_ny * sc_v_tz) - (sc_a_nz * sc_v_ty)) * sc_v_y) + (sc_a_nx * sc_v_z)));
  sc_v_diffuseDirY = ((sc_v_ty * sc_v_x) + ((((sc_a_nz * sc_v_tx) - (sc_a_nx * sc_v_tz)) * sc_v_y) + (sc_a_ny * sc_v_z)));
  sc_v_diffuseDirZ = ((sc_v_tz * sc_v_x) + ((((sc_a_nx * sc_v_ty) - (sc_a_ny * sc_v_tx)) * sc_v_y) + (sc_a_nz * sc_v_z)));
}

void sc_fn_pathtrace_s_s_s_s_s_s(in float sc_a_ox, in float sc_a_oy, in float sc_a_oz, in float sc_a_dx, in float sc_a_dy, in float sc_a_dz) {
  sc_v_currOX = sc_a_ox;
  sc_v_currOY = sc_a_oy;
  sc_v_currOZ = sc_a_oz;
  sc_v_currDX = sc_a_dx;
  sc_v_currDY = sc_a_dy;
  sc_v_currDZ = sc_a_dz;
  sc_v_sample_r = 0.0;
  sc_v_sample_g = 0.0;
  sc_v_sample_b = 0.0;
  sc_v_rayR = 1.0;
  sc_v_rayG = 1.0;
  sc_v_rayB = 1.0;
  for (int sc_i_i_10 = 0; sc_i_i_10 < 256; sc_i_i_10++) {
    if (float(sc_i_i_10) >= sc_v_maxBounces) break;
    sc_fn_castRay_s_s_s_dir_s_s_s_dist_s(sc_v_currOX, sc_v_currOY, sc_v_currOZ, sc_v_currDX, sc_v_currDY, sc_v_currDZ, 0.0);
    if ((abs(sc_v_hitTri - 0.0) < 0.000001)) {
      return;
    }
    sc_v_sample_r += (sc_v_er * sc_v_rayR);
    sc_v_sample_g += (sc_v_eg * sc_v_rayG);
    sc_v_sample_b += (sc_v_eb * sc_v_rayB);
    sc_v_rayR = (sc_v_rayR * sc_v_ir);
    sc_v_rayG = (sc_v_rayG * sc_v_ig);
    sc_v_rayB = (sc_v_rayB * sc_v_ib);
    sc_v_currOX = (sc_v_ix + (sc_v_inx * 0.001));
    sc_v_currOY = (sc_v_iy + (sc_v_iny * 0.001));
    sc_v_currOZ = (sc_v_iz + (sc_v_inz * 0.001));
    sc_fn_diffuse_s_s_s(sc_v_inx, sc_v_iny, sc_v_inz);
    sc_fn_specular_s_s_s_normal_s_s_s_ior_s(sc_v_currDX, sc_v_currDY, sc_v_currDZ, sc_v_inx, sc_v_iny, sc_v_inz, sc_v_ior);
    sc_fn_normalize_s_s_s((sc_v_diffuseDirX + ((sc_v_specDirX - sc_v_diffuseDirX) * sc_v_rough)), (sc_v_diffuseDirY + ((sc_v_specDirY - sc_v_diffuseDirY) * sc_v_rough)), (sc_v_diffuseDirZ + ((sc_v_specDirZ - sc_v_diffuseDirZ) * sc_v_rough)));
    sc_v_currDX = sc_v_vx;
    sc_v_currDY = sc_v_vy;
    sc_v_currDZ = sc_v_vz;
  }
}

void sc_fn_pixel_s_s(in float sc_a_x, in float sc_a_y) {
  sc_v_return_r = 0.0;
  sc_v_return_g = 0.0;
  sc_v_return_b = 0.0;
  for (int sc_i_i_11 = 0; sc_i_i_11 < 256; sc_i_i_11++) {
    if (float(sc_i_i_11) >= sc_v_sample) break;
    sc_v_px = (sc_a_x + mix(1e-12, (sc_v_resolution - 1e-12), sc_rand(vec3(gl_FragCoord.xy, u_time + 3.0))));
    sc_v_py = (sc_a_y + mix(1e-12, (sc_v_resolution - 1e-12), sc_rand(vec3(gl_FragCoord.xy, u_time + 4.0))));
    sc_v_dist = ((sqrt(((sc_v_px * sc_v_px) + ((sc_v_py * sc_v_py) + sc_v_focalLength2))) == 0.0) ? 1e20 : (1.0 / sqrt(((sc_v_px * sc_v_px) + ((sc_v_py * sc_v_py) + sc_v_focalLength2)))));
    sc_v_vx = (sc_v_px * sc_v_dist);
    sc_v_vy = (sc_v_py * sc_v_dist);
    sc_v_vz = (sc_v_focalLength * sc_v_dist);
    sc_fn_pathtrace_s_s_s_s_s_s(sc_v_cameraX, sc_v_cameraY, sc_v_cameraZ, ((sc_v_vx * sc_v_m0) + ((sc_v_vy * sc_v_m1) + (sc_v_vz * sc_v_m2))), ((sc_v_vx * sc_v_m3) + ((sc_v_vy * sc_v_m4) + (sc_v_vz * sc_v_m5))), ((sc_v_vx * sc_v_m6) + ((sc_v_vy * sc_v_m7) + (sc_v_vz * sc_v_m8))));
    sc_v_return_r += sc_v_sample_r;
    sc_v_return_g += sc_v_sample_g;
    sc_v_return_b += sc_v_sample_b;
  }
  sc_v_return_r = ((sc_v_sample == 0.0) ? 1e20 : (sc_v_return_r / sc_v_sample));
  sc_v_return_g = ((sc_v_sample == 0.0) ? 1e20 : (sc_v_return_g / sc_v_sample));
  sc_v_return_b = ((sc_v_sample == 0.0) ? 1e20 : (sc_v_return_b / sc_v_sample));
  sc_color = ((65536.0 * floor(((((sc_v_return_r + 1.0) == 0.0) ? 1e20 : (sc_v_return_r / (sc_v_return_r + 1.0))) * 255.0))) + ((256.0 * floor(((((sc_v_return_g + 1.0) == 0.0) ? 1e20 : (sc_v_return_g / (sc_v_return_g + 1.0))) * 255.0))) + floor(((((sc_v_return_b + 1.0) == 0.0) ? 1e20 : (sc_v_return_b / (sc_v_return_b + 1.0))) * 255.0))));
}


void main() {
  sc_len_stack = 0.0;
  for (int sc_i_i_12 = 0; sc_i_i_12 < 256; sc_i_i_12++) { sc_la_stack[sc_i_i_12] = 0.0; }
  sc_v_c = 0.8;
  sc_v_x = 0.5890752239945691;
  sc_v_m = 0.19999999999999996;
  sc_v_cr = 255.0;
  sc_v_cg = 51.86563629154069;
  sc_v_cb = 50.999999999999986;
  sc_v_cosi = 1.7506461692604733;
  sc_v_etai = 2.0;
  sc_v_etat = 1.0;
  sc_v_nx = 0.23300391634358206;
  sc_v_ny = -0.5545882237667787;
  sc_v_nz = 0.7988373282638727;
  sc_v_cos_ = 0.2493538307395266;
  sc_v_currDX = -0.7677290987593606;
  sc_v_inx = -0.23300391634358206;
  sc_v_currDY = 0.38151017745605154;
  sc_v_iny = 0.5545882237667787;
  sc_v_currDZ = 0.5148223144110906;
  sc_v_inz = -0.7988373282638727;
  sc_v_F0 = 0.1111111111111111;
  sc_v_xx = 0.7506461692604733;
  sc_v_F = 0.32295885373839783;
  sc_v_d = -0.5513479520253566;
  sc_v_specDirX = -1.4872784178835121;
  sc_v_specDirY = 0.7390782165873664;
  sc_v_specDirZ = 0.9973363241093631;
  sc_v_eta = 2.0;
  sc_v_k = 0.45842394836906886;
  sc_v_dist = 0.516197296705136;
  sc_v_vx = -0.7677290987593606;
  sc_v_vy = 0.38151017745605154;
  sc_v_vz = 0.5148223144110906;
  sc_v_hitT = 0.019403212182257084;
  sc_v_hitTri = 4864.0;
  sc_v_rayOX = 0.00912584837977046;
  sc_v_rayOY = 1.662407606731689;
  sc_v_rayOZ = -1.6487472552056321;
  sc_v_rayDX = -0.6902319212839155;
  sc_v_rayDY = 0.2424208466646055;
  sc_v_rayDZ = 0.6817712431183428;
  sc_v_invRayDX = -1.4487883987455668;
  sc_v_invRayDY = 4.125057781781951;
  sc_v_invRayDZ = 1.4667676439770556;
  sc_v_raySignDX = 1.0;
  sc_v_raySignDY = 0.0;
  sc_v_raySignDZ = 0.0;
  sc_v_w = 0.16109835834700525;
  sc_v_iu = 0.16434191830881018;
  sc_v_iv = 0.6745597233441846;
  sc_v_ir = 0.55;
  sc_v_ig = 0.95;
  sc_v_ib = 1.0;
  sc_v_er = 0.1;
  sc_v_eg = 0.1;
  sc_v_eb = 0.1;
  sc_v_ior = 2.0;
  sc_v_rough = 1.0;
  sc_v_id = 0.0;
  sc_v_ix = -0.004266868043868322;
  sc_v_iz = -1.6355187031156457;
  sc_v_t0 = 0.32874397711583725;
  sc_v_ty1 = 22.953076142710383;
  sc_v_hit = 0.0;
  sc_v_t1 = 28.98898939817266;
  sc_v_ty0 = -18.116417888647174;
  sc_v_lt = -6.9333501217289975;
  sc_v_left = 7187.0;
  sc_v_right = 7189.0;
  sc_v_node = 3593.0;
  sc_v_ptr = 0.0;
  sc_v_return_r = 0.21103812500000002;
  sc_v_return_g = 0.452438125;
  sc_v_return_b = 0.5;
  sc_v_sample = sc_u_sample;
  sc_v_px = -0.004266868043868322;
  sc_v_resolution = sc_u_resolution;
  sc_v_py = 1.6671113498569248;
  sc_v_focalLength2 = sc_u_focalLength2;
  sc_v_focalLength = sc_u_focalLength;
  sc_v_cameraX = sc_u_cameraX;
  sc_v_cameraY = sc_u_cameraY;
  sc_v_cameraZ = sc_u_cameraZ;
  sc_v_m0 = sc_u_m0;
  sc_v_m1 = sc_u_m1;
  sc_v_m2 = sc_u_m2;
  sc_v_m3 = sc_u_m3;
  sc_v_m4 = sc_u_m4;
  sc_v_m5 = sc_u_m5;
  sc_v_m6 = sc_u_m6;
  sc_v_m7 = sc_u_m7;
  sc_v_m8 = sc_u_m8;
  sc_v_sample_r = 0.21103812500000002;
  sc_v_sample_g = 0.452438125;
  sc_v_sample_b = 0.5;
  sc_v_i = 10760.0;
  sc_v_j = 907.0;
  sc_v_den = 0.013408924724821237;
  sc_v_t = 2.7903334055758493;
  sc_v_pz = -1.6355187031156457;
  sc_v_x0 = -0.02876886804386832;
  sc_v_y0 = 0.022311349856924734;
  sc_v_z0 = 0.039227296884354335;
  sc_v_u = 0.739356714473316;
  sc_v_v = 0.6745597233441846;
  sc_v_iy = 1.6671113498569248;
  sc_v_currOX = -0.004499871960211905;
  sc_v_currOY = 1.6676659380806915;
  sc_v_currOZ = -1.6363175404439096;
  sc_v_rayR = 0.050328437500000024;
  sc_v_rayG = 0.7737809374999999;
  sc_v_rayB = 1.0;
  sc_v_maxBounces = sc_u_maxBounces;
  sc_v_diffuseDirX = -0.7817367742877517;
  sc_v_diffuseDirY = -0.23808798816899496;
  sc_v_diffuseDirZ = -0.5763694349699207;
  sc_v_theta = 313.2422039106304;
  sc_v_r = 0.8598585432926256;
  sc_v_y = -0.6263761608656483;
  sc_v_z = 0.5105323550243256;
  sc_v_tx = -0.9599968679856332;
  sc_v_ty = 0.0;
  sc_v_tz = 0.28001073811154964;
  sc_v_tLen = 1.2017426252125842;
  sc_v_newDX = sc_u_newDX;
  sc_v_newDY = sc_u_newDY;
  sc_v_newDZ = sc_u_newDZ;
  sc_color = 0.0;
  float sc_px = gl_FragCoord.x - (u_resolution.x * 0.5);
  float sc_py = gl_FragCoord.y - (u_resolution.y * 0.5);
  sc_fn_pixel_s_s(sc_px, sc_py);
  float c = floor(sc_color + 0.5);
  c = clamp(c, 0.0, 16777215.0);
  float cr = floor(c / 65536.0);
  float cg = mod(floor(c / 256.0), 256.0);
  float cb = mod(c, 256.0);
  gl_FragColor = vec4(cr / 255.0, cg / 255.0, cb / 255.0, 1.0);
}