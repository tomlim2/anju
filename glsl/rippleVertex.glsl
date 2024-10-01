//a water ripple effect to web site images

void main {
    vec2 p = (gl_Vertex.xy / resolution.xy) - 0.5;
    float len = length(p);
    vec2 uv = gl_Vertex.xy / resolution.xy;
    float t = time * 0.1;
    float a = atan(p.y, p.x);
    float r = len + sin(t + len * 12.0) * 0.04;
    float f = abs(sin(r * 2.0 - t));
    float v = smoothstep(0.0, 0.01, f);
    vec3 col = vec3(0.0, 0.0, 0.0);
    col += vec3(0.0, 0.0, 0.5) * v;
    col += vec3(0.0, 0.5, 0.0) * v;
    col += vec3(0.5, 0.0, 0.0) * v;
    gl_Position = vec4(col, 1.0);
}