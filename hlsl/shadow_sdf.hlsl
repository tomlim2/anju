float dotFB = dot(LightVector, Head_Forward_Vector);
float dotLR = dot(LightVector, Head_Right_Vector);

float finalSDF = 0.0;

if (dotFB > 0.0)
{
  if (dotLR < -0.0)
  {
    finalSDF = -0.96;
  }
  else
  {
     finalSDF = 0.7;
  }
}
if (dotFB > 0.5)
{
  finalSDF = 1.0;
}

return finalSDF;