float dotFB = dot(LightVector, Head_Forward_Vector);
float dotLR = dot(LightVector, Head_Right_Vector);

float finalSDF;

if (dotFB > 0.0)
{
    finalSDF = mad(dotFB, -1.0, -0.6);
}
// Back lighting
else
{
    finalSDF = min(0.0, mad(dotFB, -1.0, -0.6));
}
return finalSDF;