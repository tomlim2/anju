float2 KernelUVs = GetDefaultSceneTextureUV(Parameters, 1);
float2 TexelSize = GetSceneTextureViewSize(1).zw;
float2 PixelUVs;

//float KERNEL_SIZE = 7.0;

float KERNEL_SIZE = floor(KernelSize);

float3 LaplacianFilter_Normal = float3(0.,0.,0.);
float LaplacianFilter_Depth = 0.;
float CenterWeight = KERNEL_SIZE * KERNEL_SIZE - 1.0;

float HALF_KERNEL_SIZE = floor(KERNEL_SIZE / 2.0);

for(float y = -HALF_KERNEL_SIZE; y <= HALF_KERNEL_SIZE; y++)
{
    for(float x = -HALF_KERNEL_SIZE; x <= HALF_KERNEL_SIZE; x++)
    {
        if(x != 0.0 || y != 0.0)
        {
            PixelUVs = KernelUVs + TexelSize*float2(x,y);

            LaplacianFilter_Normal -= SceneTextureLookup(PixelUVs, 8, false).rgb;
            LaplacianFilter_Depth -= SceneTextureLookup(PixelUVs, 1, false).r;
        }
        else
        {
            LaplacianFilter_Normal += SceneTextureLookup(KernelUVs, 8, false).rgb * CenterWeight;
            LaplacianFilter_Depth += SceneTextureLookup(KernelUVs, 1, false).r * CenterWeight;
        }
    }
}

LaplacianFilter_Normal /= CenterWeight;
LaplacianFilter_Depth /= CenterWeight;

return float4(LaplacianFilter_Normal, LaplacianFilter_Depth);