float dotFB = dot(LightVector, Head_Forward_Vector);
float dotLR = dot(LightVector, Head_Right_Vector);

if (dotLR > 0.0)
{
   return -1.0;
}

return 1.0;