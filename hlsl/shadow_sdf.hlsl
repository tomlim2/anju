float dotFB = dot(LightVector, Head_Forward_Vector);
float dotLR = dot(LightVector, Head_Right_Vector);

float finalSDF;
float halfPoint = 0.5;

// Right side lighting
if (dotLR > 0.0)
{
    // Front lighting
    if (dotFB > 0.0)
    {
        finalSDF = mad(dotFB, 1.0, halfPoint);
    }
    // Back lighting
    else
    {
        finalSDF = max(0.0, mad(dotFB, 1.0, halfPoint));
    }
}
// Left side lighting
else
{
    // Front lighting
    if (dotFB > 0.0)
    {
        finalSDF = mad(dotFB, -1.0, -1.0 + halfPoint);
    }
    // Back lighting
    else
    {
        finalSDF = min(0.0, mad(dotFB, -1.0, -1.0 + halfPoint));
    }
}

return finalSDF;