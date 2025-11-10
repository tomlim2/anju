float dotFB = dot(LightVector, Head_Forward_Vector);
float dotLR = dot(LightVector, Head_Right_Vector);

float finalSDF = 0.0;

if(dotLR > 0.0)
{
if (dotFB > 0.0)
{
finalSDF = mad(dotFB, 0.85, 0.15);
}
if (dotFB <= 0.0)
{
finalSDF = max(0.0, mad(dotFB, 0.2, 0.15));
}
}
else 
{
if (dotFB > 0.0)
{
finalSDF = mad(dotFB, -0.92, -0.85);
}
if (dotFB <= 0.0)
{
finalSDF = min(0.0, mad(dotFB, -0.8, -0.75)); 
}

return finalSDF;