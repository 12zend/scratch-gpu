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
uniform vec4 sc_llen_0;
uniform vec2 sc_lsize_0;
uniform float sc_loffset_0;
float sc_lget_0_0(float idx) {
  float len = sc_llen_0.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_0.x) + 0.5;
  float y = sc_loffset_0 + floor(i / sc_lsize_0.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_0_1(float idx) {
  float len = sc_llen_0.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_0.x) + 0.5;
  float y = sc_loffset_0 + floor(i / sc_lsize_0.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_0_2(float idx) {
  float len = sc_llen_0.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_0.x) + 0.5;
  float y = sc_loffset_0 + floor(i / sc_lsize_0.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_0_3(float idx) {
  float len = sc_llen_0.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_0.x) + 0.5;
  float y = sc_loffset_0 + floor(i / sc_lsize_0.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_1;
uniform vec2 sc_lsize_1;
uniform float sc_loffset_1;
float sc_lget_1_0(float idx) {
  float len = sc_llen_1.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_1.x) + 0.5;
  float y = sc_loffset_1 + floor(i / sc_lsize_1.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_1_1(float idx) {
  float len = sc_llen_1.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_1.x) + 0.5;
  float y = sc_loffset_1 + floor(i / sc_lsize_1.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_1_2(float idx) {
  float len = sc_llen_1.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_1.x) + 0.5;
  float y = sc_loffset_1 + floor(i / sc_lsize_1.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_1_3(float idx) {
  float len = sc_llen_1.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_1.x) + 0.5;
  float y = sc_loffset_1 + floor(i / sc_lsize_1.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_2;
uniform vec2 sc_lsize_2;
uniform float sc_loffset_2;
float sc_lget_2_0(float idx) {
  float len = sc_llen_2.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_2.x) + 0.5;
  float y = sc_loffset_2 + floor(i / sc_lsize_2.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_2_1(float idx) {
  float len = sc_llen_2.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_2.x) + 0.5;
  float y = sc_loffset_2 + floor(i / sc_lsize_2.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_2_2(float idx) {
  float len = sc_llen_2.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_2.x) + 0.5;
  float y = sc_loffset_2 + floor(i / sc_lsize_2.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_2_3(float idx) {
  float len = sc_llen_2.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_2.x) + 0.5;
  float y = sc_loffset_2 + floor(i / sc_lsize_2.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_3;
uniform vec2 sc_lsize_3;
uniform float sc_loffset_3;
float sc_lget_3_0(float idx) {
  float len = sc_llen_3.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_3.x) + 0.5;
  float y = sc_loffset_3 + floor(i / sc_lsize_3.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_3_1(float idx) {
  float len = sc_llen_3.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_3.x) + 0.5;
  float y = sc_loffset_3 + floor(i / sc_lsize_3.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_3_2(float idx) {
  float len = sc_llen_3.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_3.x) + 0.5;
  float y = sc_loffset_3 + floor(i / sc_lsize_3.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_3_3(float idx) {
  float len = sc_llen_3.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_3.x) + 0.5;
  float y = sc_loffset_3 + floor(i / sc_lsize_3.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_4;
uniform vec2 sc_lsize_4;
uniform float sc_loffset_4;
float sc_lget_4_0(float idx) {
  float len = sc_llen_4.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_4.x) + 0.5;
  float y = sc_loffset_4 + floor(i / sc_lsize_4.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_4_1(float idx) {
  float len = sc_llen_4.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_4.x) + 0.5;
  float y = sc_loffset_4 + floor(i / sc_lsize_4.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_4_2(float idx) {
  float len = sc_llen_4.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_4.x) + 0.5;
  float y = sc_loffset_4 + floor(i / sc_lsize_4.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_4_3(float idx) {
  float len = sc_llen_4.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_4.x) + 0.5;
  float y = sc_loffset_4 + floor(i / sc_lsize_4.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_5;
uniform vec2 sc_lsize_5;
uniform float sc_loffset_5;
float sc_lget_5_0(float idx) {
  float len = sc_llen_5.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_5.x) + 0.5;
  float y = sc_loffset_5 + floor(i / sc_lsize_5.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_5_1(float idx) {
  float len = sc_llen_5.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_5.x) + 0.5;
  float y = sc_loffset_5 + floor(i / sc_lsize_5.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_5_2(float idx) {
  float len = sc_llen_5.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_5.x) + 0.5;
  float y = sc_loffset_5 + floor(i / sc_lsize_5.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_5_3(float idx) {
  float len = sc_llen_5.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_5.x) + 0.5;
  float y = sc_loffset_5 + floor(i / sc_lsize_5.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_6;
uniform vec2 sc_lsize_6;
uniform float sc_loffset_6;
float sc_lget_6_0(float idx) {
  float len = sc_llen_6.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_6.x) + 0.5;
  float y = sc_loffset_6 + floor(i / sc_lsize_6.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_6_1(float idx) {
  float len = sc_llen_6.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_6.x) + 0.5;
  float y = sc_loffset_6 + floor(i / sc_lsize_6.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_6_2(float idx) {
  float len = sc_llen_6.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_6.x) + 0.5;
  float y = sc_loffset_6 + floor(i / sc_lsize_6.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_6_3(float idx) {
  float len = sc_llen_6.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_6.x) + 0.5;
  float y = sc_loffset_6 + floor(i / sc_lsize_6.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_7;
uniform vec2 sc_lsize_7;
uniform float sc_loffset_7;
float sc_lget_7_0(float idx) {
  float len = sc_llen_7.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_7.x) + 0.5;
  float y = sc_loffset_7 + floor(i / sc_lsize_7.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_7_1(float idx) {
  float len = sc_llen_7.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_7.x) + 0.5;
  float y = sc_loffset_7 + floor(i / sc_lsize_7.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_7_2(float idx) {
  float len = sc_llen_7.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_7.x) + 0.5;
  float y = sc_loffset_7 + floor(i / sc_lsize_7.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_7_3(float idx) {
  float len = sc_llen_7.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_7.x) + 0.5;
  float y = sc_loffset_7 + floor(i / sc_lsize_7.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_8;
uniform vec2 sc_lsize_8;
uniform float sc_loffset_8;
float sc_lget_8_0(float idx) {
  float len = sc_llen_8.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_8.x) + 0.5;
  float y = sc_loffset_8 + floor(i / sc_lsize_8.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_8_1(float idx) {
  float len = sc_llen_8.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_8.x) + 0.5;
  float y = sc_loffset_8 + floor(i / sc_lsize_8.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_8_2(float idx) {
  float len = sc_llen_8.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_8.x) + 0.5;
  float y = sc_loffset_8 + floor(i / sc_lsize_8.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_8_3(float idx) {
  float len = sc_llen_8.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_8.x) + 0.5;
  float y = sc_loffset_8 + floor(i / sc_lsize_8.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_9;
uniform vec2 sc_lsize_9;
uniform float sc_loffset_9;
float sc_lget_9_0(float idx) {
  float len = sc_llen_9.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_9.x) + 0.5;
  float y = sc_loffset_9 + floor(i / sc_lsize_9.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_9_1(float idx) {
  float len = sc_llen_9.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_9.x) + 0.5;
  float y = sc_loffset_9 + floor(i / sc_lsize_9.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}
float sc_lget_9_2(float idx) {
  float len = sc_llen_9.z;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_9.x) + 0.5;
  float y = sc_loffset_9 + floor(i / sc_lsize_9.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).z;
}
float sc_lget_9_3(float idx) {
  float len = sc_llen_9.w;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_9.x) + 0.5;
  float y = sc_loffset_9 + floor(i / sc_lsize_9.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).w;
}
uniform vec4 sc_llen_10;
uniform vec2 sc_lsize_10;
uniform float sc_loffset_10;
float sc_lget_10_0(float idx) {
  float len = sc_llen_10.x;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_10.x) + 0.5;
  float y = sc_loffset_10 + floor(i / sc_lsize_10.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).x;
}
float sc_lget_10_1(float idx) {
  float len = sc_llen_10.y;
  if (len <= 0.0) return 0.0;
  float i = clamp(idx - 1.0, 0.0, len - 1.0);
  float x = mod(i, sc_lsize_10.x) + 0.5;
  float y = sc_loffset_10 + floor(i / sc_lsize_10.x) + 0.5;
  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).y;
}

float sc_la_stack[256];
float sc_len_stack;
float sc_laget_stack(float idx) {
  if (sc_len_stack <= 0.0) return 0.0;
  float gi = clamp(idx - 1.0, 0.0, sc_len_stack - 1.0);
  float result = 0.0;
  for (int mi = 0; mi < 256; mi++) {
    if (float(mi) == gi) result = sc_la_stack[mi];
  }
  return result;
}

float sc_rand(vec3 co) {
  return fract(sin(dot(co, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
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
  sc_v_x = (sc_v_c * (1.0 - abs((((2.0 == 0.0) ? 0.0 : mod(((60.0 == 0.0) ? 0.0 : (sc_a_h / 60.0)), 2.0)) - 1.0))));
  sc_v_m = (sc_a_v - sc_v_c);
  if (((sc_a_h < 60.0) ? 1.0 : 0.0) != 0.0) {
    sc_v_cr = sc_v_c;
    sc_v_cg = sc_v_x;
    sc_v_cb = 0.0;
  } else {
    if (((sc_a_h < 120.0) ? 1.0 : 0.0) != 0.0) {
      sc_v_cr = sc_v_x;
      sc_v_cg = sc_v_c;
      sc_v_cb = 0.0;
    } else {
      if (((sc_a_h < 180.0) ? 1.0 : 0.0) != 0.0) {
        sc_v_cr = 0.0;
        sc_v_cg = sc_v_c;
        sc_v_cb = sc_v_x;
      } else {
        if (((sc_a_h < 240.0) ? 1.0 : 0.0) != 0.0) {
          sc_v_cr = 0.0;
          sc_v_cg = sc_v_x;
          sc_v_cb = sc_v_c;
        } else {
          if (((sc_a_h < 300.0) ? 1.0 : 0.0) != 0.0) {
            sc_v_cr = sc_v_x;
            sc_v_cg = 0.0;
            sc_v_cb = sc_v_c;
          } else {
            if (((sc_a_h < 360.0) ? 1.0 : 0.0) != 0.0) {
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
  if (((sc_v_cosi < 0.0) ? 1.0 : 0.0) != 0.0) {
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
  sc_v_F0 = (((sc_v_etai + sc_v_etat) == 0.0) ? 0.0 : ((sc_v_etai - sc_v_etat) / (sc_v_etai + sc_v_etat)));
  sc_v_F0 = (sc_v_F0 * sc_v_F0);
  sc_v_xx = (1.0 - sc_v_cos_);
  sc_v_F = (sc_v_F0 + ((1.0 - sc_v_F0) * (sc_v_xx * (sc_v_xx * (sc_v_xx * (sc_v_xx * sc_v_xx))))));
  if (((mix(0.0, 1.0, sc_rand(vec3(gl_FragCoord.xy, u_time + 0.0))) < sc_v_F) ? 1.0 : 0.0) != 0.0) {
    sc_v_d = ((sc_a_x * sc_a_nx) + ((sc_a_y * sc_a_ny) + (sc_a_z * sc_a_nz)));
    sc_v_specDirX = (sc_a_x - (sc_a_nx * (2.0 * sc_v_d)));
    sc_v_specDirY = (sc_a_y - (sc_a_ny * (2.0 * sc_v_d)));
    sc_v_specDirZ = (sc_a_z - (sc_a_nz * (2.0 * sc_v_d)));
  } else {
    sc_v_eta = ((sc_v_etat == 0.0) ? 0.0 : (sc_v_etai / sc_v_etat));
    sc_v_k = (1.0 - ((sc_v_eta * sc_v_eta) * (1.0 - (sc_v_cosi * sc_v_cosi))));
    if (((sc_v_k < 0.0) ? 1.0 : 0.0) != 0.0) {
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
  sc_v_dist = ((sqrt(((sc_a_x * sc_a_x) + ((sc_a_y * sc_a_y) + (sc_a_z * sc_a_z)))) == 0.0) ? 0.0 : (1.0 / sqrt(((sc_a_x * sc_a_x) + ((sc_a_y * sc_a_y) + (sc_a_z * sc_a_z))))));
  sc_v_vx = (sc_a_x * sc_v_dist);
  sc_v_vy = (sc_a_y * sc_v_dist);
  sc_v_vz = (sc_a_z * sc_v_dist);
}

void sc_fn_intersectionAABB_s(in float sc_a_node) {
  sc_v_t0 = ((sc_lget_4_2((sc_a_node + sc_v_raySignDX)) - sc_v_rayOX) * sc_v_invRayDX);
  sc_v_ty1 = ((sc_lget_4_3((sc_a_node + sc_v_raySignDY)) - sc_v_rayOY) * sc_v_invRayDY);
  if (((sc_v_t0 > sc_v_ty1) ? 1.0 : 0.0) != 0.0) {
    sc_v_hit = 0.0;
    return;
  }
  sc_v_t1 = ((sc_lget_5_0((sc_a_node + sc_v_raySignDX)) - sc_v_rayOX) * sc_v_invRayDX);
  sc_v_ty0 = ((sc_lget_5_1((sc_a_node + sc_v_raySignDY)) - sc_v_rayOY) * sc_v_invRayDY);
  if (((sc_v_ty0 > sc_v_t1) ? 1.0 : 0.0) != 0.0) {
    sc_v_hit = 0.0;
    return;
  }
  if (((sc_v_ty0 > sc_v_t0) ? 1.0 : 0.0) != 0.0) {
    sc_v_t0 = sc_v_ty0;
  }
  if (((sc_v_ty1 < sc_v_t1) ? 1.0 : 0.0) != 0.0) {
    sc_v_t1 = sc_v_ty1;
  }
  sc_v_ty1 = ((sc_lget_5_2((sc_a_node + sc_v_raySignDZ)) - sc_v_rayOZ) * sc_v_invRayDZ);
  if (((sc_v_t0 > sc_v_ty1) ? 1.0 : 0.0) != 0.0) {
    sc_v_hit = 0.0;
    return;
  }
  sc_v_ty0 = ((sc_lget_5_3((sc_a_node + sc_v_raySignDZ)) - sc_v_rayOZ) * sc_v_invRayDZ);
  if (((sc_v_ty0 > sc_v_t1) ? 1.0 : 0.0) != 0.0) {
    sc_v_hit = 0.0;
    return;
  }
  if (((sc_v_ty0 > sc_v_t0) ? 1.0 : 0.0) != 0.0) {
    sc_v_t0 = sc_v_ty0;
  }
  sc_v_hit = ((((((((sc_v_ty1 + ((sc_v_t1 - sc_v_ty1) * ((sc_v_t1 < sc_v_ty1) ? 1.0 : 0.0))) < (sc_v_t0 * ((sc_v_t0 > 0.0) ? 1.0 : 0.0))) ? 1.0 : 0.0) == 0.0) ? 1.0 : 0.0) != 0.0 && ((sc_v_t0 < sc_v_hitT) ? 1.0 : 0.0) != 0.0) ? 1.0 : 0.0) + 0.0);
}

void sc_fn_intersectionTriangle_s(in float sc_a_node) {
  sc_v_i = sc_lget_6_3(sc_a_node);
  for (int sc_i_i_0 = 0; sc_i_i_0 < 1024; sc_i_i_0++) {
    if (float(sc_i_i_0) >= sc_lget_6_0(sc_a_node)) break;
    sc_v_j = sc_lget_7_0(sc_v_i);
    sc_v_nx = sc_lget_7_1(sc_v_j);
    sc_v_ny = sc_lget_7_2(sc_v_j);
    sc_v_nz = sc_lget_7_3(sc_v_j);
    sc_v_den = ((sc_v_nx * sc_v_rayDX) + ((sc_v_ny * sc_v_rayDY) + (sc_v_nz * sc_v_rayDZ)));
    sc_v_t = ((sc_v_den == 0.0) ? 0.0 : ((0.0 - ((sc_v_nx * sc_v_rayOX) + ((sc_v_ny * sc_v_rayOY) + ((sc_v_nz * sc_v_rayOZ) + sc_lget_8_0(sc_v_j))))) / sc_v_den));
    if (((((sc_v_t < sc_v_hitT) ? 1.0 : 0.0) != 0.0 && ((sc_v_t > 1e-8) ? 1.0 : 0.0) != 0.0) ? 1.0 : 0.0) != 0.0) {
      sc_v_px = (sc_v_rayOX + (sc_v_rayDX * sc_v_t));
      sc_v_py = (sc_v_rayOY + (sc_v_rayDY * sc_v_t));
      sc_v_pz = (sc_v_rayOZ + (sc_v_rayDZ * sc_v_t));
      sc_v_x0 = (sc_v_px - sc_lget_8_1(sc_v_j));
      sc_v_y0 = (sc_v_py - sc_lget_8_2(sc_v_j));
      sc_v_z0 = (sc_v_pz - sc_lget_8_3(sc_v_j));
      sc_v_u = ((sc_v_x0 * sc_lget_9_0(sc_v_j)) + ((sc_v_y0 * sc_lget_9_1(sc_v_j)) + (sc_v_z0 * sc_lget_9_2(sc_v_j))));
      if (((((sc_v_u < 0.0) ? 1.0 : 0.0) == 0.0) ? 1.0 : 0.0) != 0.0) {
        sc_v_v = ((sc_v_x0 * sc_lget_9_3(sc_v_j)) + ((sc_v_y0 * sc_lget_10_0(sc_v_j)) + (sc_v_z0 * sc_lget_10_1(sc_v_j))));
        if (((((((sc_v_v < 0.0) ? 1.0 : 0.0) != 0.0 || (((sc_v_u + sc_v_v) > 1.0) ? 1.0 : 0.0) != 0.0) ? 1.0 : 0.0) == 0.0) ? 1.0 : 0.0) != 0.0) {
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
  if (((abs(sc_v_hit - 1.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
    sc_v_lt = sc_v_t0;
    if (((sc_lget_6_0(sc_a_node) > 0.0) ? 1.0 : 0.0) != 0.0) {
      sc_fn_intersectionTriangle_s(sc_a_node);
      return;
    } else {
      sc_v_left = sc_lget_6_1(sc_a_node);
      sc_v_right = sc_lget_6_2(sc_a_node);
      sc_fn_intersectionAABB_s(sc_v_left);
      if (((abs(sc_v_hit - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
        sc_fn_intersectionAABB_s(sc_v_right);
        if (((abs(sc_v_hit - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
          return;
        } else {
          sc_v_node = sc_v_right;
          sc_v_ptr = 1.0;
        }
      } else {
        sc_v_lt = sc_v_t0;
        sc_fn_intersectionAABB_s(sc_v_right);
        if (((abs(sc_v_hit - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
          sc_v_node = sc_v_left;
          sc_v_ptr = 1.0;
        } else {
          if (((sc_v_lt < sc_v_t0) ? 1.0 : 0.0) != 0.0) {
            for (int sc_i_i_1 = 0; sc_i_i_1 < 256; sc_i_i_1++) {
              float ci = float(sc_i_i_1 + 1);
              if (ci <= sc_len_stack) {
                if (ci == clamp(1.0, 1.0, sc_len_stack)) { sc_la_stack[sc_i_i_1] = sc_v_right; }
              } else if (ci == sc_len_stack + 1.0 && ci <= float(256) && floor(1.0 + 0.5) == floor(sc_len_stack + 1.5)) {
                sc_la_stack[sc_i_i_1] = sc_v_right;
                sc_len_stack = sc_len_stack + 1.0;
              }
            }
            sc_v_node = sc_v_left;
          } else {
            for (int sc_i_i_2 = 0; sc_i_i_2 < 256; sc_i_i_2++) {
              float ci = float(sc_i_i_2 + 1);
              if (ci <= sc_len_stack) {
                if (ci == clamp(1.0, 1.0, sc_len_stack)) { sc_la_stack[sc_i_i_2] = sc_v_left; }
              } else if (ci == sc_len_stack + 1.0 && ci <= float(256) && floor(1.0 + 0.5) == floor(sc_len_stack + 1.5)) {
                sc_la_stack[sc_i_i_2] = sc_v_left;
                sc_len_stack = sc_len_stack + 1.0;
              }
            }
            sc_v_node = sc_v_right;
          }
          sc_v_ptr = 2.0;
        }
      }
    }
    for (int sc_i_i_5 = 0; sc_i_i_5 < 256; sc_i_i_5++) {
      if (((sc_lget_6_0(sc_v_node) > 0.0) ? 1.0 : 0.0) != 0.0) {
        sc_fn_intersectionTriangle_s(sc_v_node);
        sc_v_ptr += -1.0;
        if (((abs(sc_v_ptr - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
          return;
        }
        sc_v_node = sc_laget_stack(sc_v_ptr);
      } else {
        sc_v_left = sc_lget_6_1(sc_v_node);
        sc_v_right = sc_lget_6_2(sc_v_node);
        sc_fn_intersectionAABB_s(sc_v_left);
        if (((abs(sc_v_hit - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
          sc_fn_intersectionAABB_s(sc_v_right);
          if (((abs(sc_v_hit - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
            sc_v_ptr += -1.0;
            if (((abs(sc_v_ptr - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
              return;
            }
            sc_v_node = sc_laget_stack(sc_v_ptr);
          } else {
            sc_v_node = sc_v_right;
          }
        } else {
          sc_v_lt = sc_v_t0;
          sc_fn_intersectionAABB_s(sc_v_right);
          if (((abs(sc_v_hit - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
            sc_v_node = sc_v_left;
          } else {
            if (((sc_v_lt < sc_v_t0) ? 1.0 : 0.0) != 0.0) {
              for (int sc_i_i_3 = 0; sc_i_i_3 < 256; sc_i_i_3++) {
                float ci = float(sc_i_i_3 + 1);
                if (ci <= sc_len_stack) {
                  if (ci == clamp(sc_v_ptr, 1.0, sc_len_stack)) { sc_la_stack[sc_i_i_3] = sc_v_right; }
                } else if (ci == sc_len_stack + 1.0 && ci <= float(256) && floor(sc_v_ptr + 0.5) == floor(sc_len_stack + 1.5)) {
                  sc_la_stack[sc_i_i_3] = sc_v_right;
                  sc_len_stack = sc_len_stack + 1.0;
                }
              }
              sc_v_node = sc_v_left;
            } else {
              for (int sc_i_i_4 = 0; sc_i_i_4 < 256; sc_i_i_4++) {
                float ci = float(sc_i_i_4 + 1);
                if (ci <= sc_len_stack) {
                  if (ci == clamp(sc_v_ptr, 1.0, sc_len_stack)) { sc_la_stack[sc_i_i_4] = sc_v_left; }
                } else if (ci == sc_len_stack + 1.0 && ci <= float(256) && floor(sc_v_ptr + 0.5) == floor(sc_len_stack + 1.5)) {
                  sc_la_stack[sc_i_i_4] = sc_v_left;
                  sc_len_stack = sc_len_stack + 1.0;
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
  sc_v_invRayDX = ((sc_v_rayDX == 0.0) ? 0.0 : (1.0 / sc_v_rayDX));
  sc_v_invRayDY = ((sc_v_rayDY == 0.0) ? 0.0 : (1.0 / sc_v_rayDY));
  sc_v_invRayDZ = ((sc_v_rayDZ == 0.0) ? 0.0 : (1.0 / sc_v_rayDZ));
  sc_v_raySignDX = (0.0 + ((sc_v_rayDX < 0.0) ? 1.0 : 0.0));
  sc_v_raySignDY = (0.0 + ((sc_v_rayDY < 0.0) ? 1.0 : 0.0));
  sc_v_raySignDZ = (0.0 + ((sc_v_rayDZ < 0.0) ? 1.0 : 0.0));
  sc_fn_traverse_s(1.0);
  if (((sc_v_hitTri > 0.0) ? 1.0 : 0.0) != 0.0) {
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
    if (((abs(sc_v_id - 1.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
      sc_fn_hsv2rgb_s_s_s(((360.0 == 0.0) ? 0.0 : (((360.0 == 0.0) ? 0.0 : mod((atan(((sc_v_iz == 0.0) ? 0.0 : (sc_v_ix / sc_v_iz))) * 57.29577951308232 + (((((sc_v_iz > 0.0) ? 1.0 : 0.0) == 0.0) ? 1.0 : 0.0) * 180.0)), 360.0)) / 360.0)), 0.8, 1.0);
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
  if (((abs(sc_v_inx) > 0.1) ? 1.0 : 0.0) != 0.0) {
    sc_v_tx = sc_a_nz;
    sc_v_ty = 0.0;
    sc_v_tz = (0.0 - sc_a_nx);
  } else {
    sc_v_tx = 0.0;
    sc_v_ty = (0.0 - sc_a_nz);
    sc_v_tz = sc_a_ny;
  }
  sc_v_tLen = ((sqrt(((sc_v_tx * sc_v_tx) + ((sc_v_ty * sc_v_ty) + (sc_v_tz * sc_v_tz)))) == 0.0) ? 0.0 : (1.0 / sqrt(((sc_v_tx * sc_v_tx) + ((sc_v_ty * sc_v_ty) + (sc_v_tz * sc_v_tz))))));
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
  for (int sc_i_i_6 = 0; sc_i_i_6 < 1024; sc_i_i_6++) {
    if (float(sc_i_i_6) >= sc_v_maxBounces) break;
    sc_fn_castRay_s_s_s_dir_s_s_s_dist_s(sc_v_currOX, sc_v_currOY, sc_v_currOZ, sc_v_currDX, sc_v_currDY, sc_v_currDZ, 1e20);
    if (((abs(sc_v_hitTri - 0.0) < 0.000001) ? 1.0 : 0.0) != 0.0) {
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
  for (int sc_i_i_7 = 0; sc_i_i_7 < 1024; sc_i_i_7++) {
    if (float(sc_i_i_7) >= sc_v_sample) break;
    sc_v_px = (sc_a_x + mix(1e-12, (sc_v_resolution - 1e-12), sc_rand(vec3(gl_FragCoord.xy, u_time + 3.0))));
    sc_v_py = (sc_a_y + mix(1e-12, (sc_v_resolution - 1e-12), sc_rand(vec3(gl_FragCoord.xy, u_time + 4.0))));
    sc_v_dist = ((sqrt(((sc_v_px * sc_v_px) + ((sc_v_py * sc_v_py) + sc_v_focalLength2))) == 0.0) ? 0.0 : (1.0 / sqrt(((sc_v_px * sc_v_px) + ((sc_v_py * sc_v_py) + sc_v_focalLength2)))));
    sc_v_vx = (sc_v_px * sc_v_dist);
    sc_v_vy = (sc_v_py * sc_v_dist);
    sc_v_vz = (sc_v_focalLength * sc_v_dist);
    sc_fn_pathtrace_s_s_s_s_s_s(sc_v_cameraX, sc_v_cameraY, sc_v_cameraZ, ((sc_v_vx * sc_v_m0) + ((sc_v_vy * sc_v_m1) + (sc_v_vz * sc_v_m2))), ((sc_v_vx * sc_v_m3) + ((sc_v_vy * sc_v_m4) + (sc_v_vz * sc_v_m5))), ((sc_v_vx * sc_v_m6) + ((sc_v_vy * sc_v_m7) + (sc_v_vz * sc_v_m8))));
    sc_v_return_r += sc_v_sample_r;
    sc_v_return_g += sc_v_sample_g;
    sc_v_return_b += sc_v_sample_b;
  }
  sc_v_return_r = ((sc_v_sample == 0.0) ? 0.0 : (sc_v_return_r / sc_v_sample));
  sc_v_return_g = ((sc_v_sample == 0.0) ? 0.0 : (sc_v_return_g / sc_v_sample));
  sc_v_return_b = ((sc_v_sample == 0.0) ? 0.0 : (sc_v_return_b / sc_v_sample));
  sc_color = ((65536.0 * floor(((((sc_v_return_r + 1.0) == 0.0) ? 0.0 : (sc_v_return_r / (sc_v_return_r + 1.0))) * 255.0))) + ((256.0 * floor(((((sc_v_return_g + 1.0) == 0.0) ? 0.0 : (sc_v_return_g / (sc_v_return_g + 1.0))) * 255.0))) + floor(((((sc_v_return_b + 1.0) == 0.0) ? 0.0 : (sc_v_return_b / (sc_v_return_b + 1.0))) * 255.0))));
}


void main() {
  sc_len_stack = 0.0;
  for (int sc_i_i_8 = 0; sc_i_i_8 < 256; sc_i_i_8++) { sc_la_stack[sc_i_i_8] = 0.0; }
  sc_v_c = 0.8;
  sc_v_x = -0.6321176111963078;
  sc_v_m = 0.19999999999999996;
  sc_v_cr = 255.0;
  sc_v_cg = 51.52746855542389;
  sc_v_cb = 50.999999999999986;
  sc_v_cosi = 2.9831860660547416;
  sc_v_etai = 0.0;
  sc_v_etat = 1.0;
  sc_v_nx = 74.909010736495;
  sc_v_ny = 25.641709570203993;
  sc_v_nz = 40.03972118952004;
  sc_v_cos_ = 0.9831860660547417;
  sc_v_currDX = 0.1977180215903705;
  sc_v_inx = 0.7400243138982563;
  sc_v_currDY = -0.02270282508124773;
  sc_v_iny = 0.28900949556296757;
  sc_v_currDZ = 0.9799960028855832;
  sc_v_inz = 0.6073199538248797;
  sc_v_F0 = 1.0;
  sc_v_xx = 0.01681393394525832;
  sc_v_F = 1.0;
  sc_v_d = 0.9831860660547417;
  sc_v_specDirX = -0.6909491202490967;
  sc_v_specDirY = -0.45885264851166674;
  sc_v_specDirZ = -0.5586085930210276;
  sc_v_eta = 1.0;
  sc_v_k = 0.0;
  sc_v_dist = 0.9999999999986071;
  sc_v_vx = 0.1977180215903705;
  sc_v_vy = -0.02270282508124773;
  sc_v_vz = 0.9799960028855832;
  sc_v_hitT = 0.0;
  sc_v_hitTri = 0.0;
  sc_v_rayOX = 40.422972598514285;
  sc_v_rayOY = 10.289393522507213;
  sc_v_rayOZ = 27.420391686932618;
  sc_v_rayDX = 0.1977180215903705;
  sc_v_rayDY = -0.02270282508124773;
  sc_v_rayDZ = 0.9799960028855832;
  sc_v_invRayDX = 5.057707901163337;
  sc_v_invRayDY = -44.04738161093389;
  sc_v_invRayDZ = 1.020412325208996;
  sc_v_raySignDX = 0.0;
  sc_v_raySignDY = 1.0;
  sc_v_raySignDZ = 0.0;
  sc_v_w = 0.035677637454555766;
  sc_v_iu = 0.9073279940946163;
  sc_v_iv = 0.05699436845082792;
  sc_v_ir = 255.0;
  sc_v_ig = 51.52746855542389;
  sc_v_ib = 50.999999999999986;
  sc_v_er = 3.0;
  sc_v_eg = 3.0;
  sc_v_eb = 3.0;
  sc_v_ior = 0.0;
  sc_v_rough = 0.0;
  sc_v_id = 1.0;
  sc_v_ix = 40.422232574200386;
  sc_v_iz = 27.419784366978792;
  sc_v_t0 = -66.65157527125542;
  sc_v_ty1 = 14.44198065236373;
  sc_v_hit = 0.0;
  sc_v_t1 = -10.1866819337645;
  sc_v_ty0 = -1.7922437252406622;
  sc_v_lt = -9.9415922700147;
  sc_v_left = 32747.0;
  sc_v_right = 32749.0;
  sc_v_node = 16373.0;
  sc_v_ptr = 0.0;
  sc_v_return_r = 3.0;
  sc_v_return_g = 3.0;
  sc_v_return_b = 3.0;
  sc_v_sample = sc_u_sample;
  sc_v_px = 40.44366711947557;
  sc_v_resolution = sc_u_resolution;
  sc_v_py = 10.287017289497468;
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
  sc_v_sample_r = 3.0;
  sc_v_sample_g = 3.0;
  sc_v_sample_b = 3.0;
  sc_v_i = 21240.0;
  sc_v_j = 20898.0;
  sc_v_den = 53.46748887733794;
  sc_v_t = 0.10466684217668888;
  sc_v_pz = 27.52296477390043;
  sc_v_x0 = -0.3309868805244278;
  sc_v_y0 = 0.5325002894974684;
  sc_v_z0 = 0.2782157739004312;
  sc_v_u = -0.04607345953355951;
  sc_v_v = 0.05699436845082792;
  sc_v_iy = 10.289104513011651;
  sc_v_currOX = 40.422972598514285;
  sc_v_currOY = 10.289393522507213;
  sc_v_currOZ = 27.420391686932618;
  sc_v_rayR = 255.0;
  sc_v_rayG = 51.52746855542389;
  sc_v_rayB = 50.999999999999986;
  sc_v_maxBounces = sc_u_maxBounces;
  sc_v_diffuseDirX = 0.1977180215906459;
  sc_v_diffuseDirY = -0.022702825081279354;
  sc_v_diffuseDirZ = 0.9799960028869482;
  sc_v_theta = 201.23159536296671;
  sc_v_r = 0.6781473770233715;
  sc_v_y = -0.24558336788540466;
  sc_v_z = 0.7349259384702116;
  sc_v_tx = 0.6343918452442203;
  sc_v_ty = 0.0;
  sc_v_tz = -0.7730116342511496;
  sc_v_tLen = 1.0445759953198357;
  sc_v_newDX = sc_u_newDX;
  sc_v_newDY = sc_u_newDY;
  sc_v_newDZ = sc_u_newDZ;
  sc_color = 0.0;
  float sc_px = gl_FragCoord.x - (u_resolution.x * 0.5);
  float sc_py = (u_resolution.y * 0.5) - gl_FragCoord.y;
  sc_fn_pixel_s_s(sc_px, sc_py);
  float c = floor(sc_color + 0.5);
  c = clamp(c, 0.0, 16777215.0);
  float cr = floor(c / 65536.0);
  float cg = mod(floor(c / 256.0), 256.0);
  float cb = mod(c, 256.0);
  gl_FragColor = vec4(gl_FragCoord.x / u_resolution.x, gl_FragCoord.y / u_resolution.y, 0.0, 1.0);
}