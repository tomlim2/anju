void main(void)
{
   vec2 uv = -1. + 2. * v_texcoord;
   gl_FragColor = vec4(
       abs(sin(cos(time + 3. * uv.y) * 2. * uv.x + time)),
       abs(cos(sin(time + 2. * uv.x) * 3. * uv.y + time)),
       spectrum.x * 100.,
       1.0
   );
}
