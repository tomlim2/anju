// Two-Tone Toon Shader for Unreal Engine 5.3
// Uses directional light [0] with hard edge transition
// 25% shadow threshold, 75% light

//==============================================================================
// CUSTOM NODE: ToonTwoTone
//==============================================================================
// Description: Calculates two-tone toon shading based on directional light
//
// INPUTS (add these in Custom node with "+" button):
//   float3 WorldNormal     - Connect "Vertex Normal WS" or "Pixel Normal WS" node
//   float3 LightDirection  - Connect "Light Vector" node
//   float3 LightColor      - Color for lit areas (Constant3Vector)
//   float3 ShadowColor     - Color for shadow areas (Constant3Vector)
//   float  ShadowThreshold - Lighting threshold (Constant: 0.25)
//
// OUTPUT:
//   float3 - Final toon shaded color
//
// USAGE IN MATERIAL:
//   1. Create a Custom node in your material graph
//   2. Copy the function code below into the Custom node
//   3. Set "Output Type" to CMOT Float3
//   4. Add inputs as listed above
//   5. Connect the output to Base Color (or multiply with texture)
//==============================================================================

// PASTE THIS CODE INTO CUSTOM NODE (lines 29-35):
// Calculate N dot L (standard diffuse lighting)
float3 Normal = normalize(WorldNormal);
float NdotL = dot(Normal, LightDirection);

// Remap from [-1, 1] to [0, 1] range and apply threshold
float LightIntensity = NdotL * 0.5 + 0.5;
float ToonStep = step(ShadowThreshold, LightIntensity);

// Return final color
return lerp(ShadowColor, LightColor, ToonStep);

//==============================================================================
// ALTERNATIVE: Simplified Custom Node Code (if GetPrimaryLight doesn't work)
//==============================================================================
// If GetPrimaryLight() causes issues, use this version with manual light direction:
//
// ADDITIONAL INPUT REQUIRED:
//   float3 LightDirection - Connect "Light Vector" node (World Space Directional Light)
//
// VERSION 2: Manual light direction (if GetPrimaryLight doesn't work)
// Add an extra input: LightDirection (Float3) and connect "Light Vector" node
// float3 Normal = normalize(WorldNormal);
// float NdotL = dot(Normal, LightDirection);
// float LightIntensity = NdotL * 0.5 + 0.5;
// float ToonStep = step(ShadowThreshold, LightIntensity);
// return lerp(ShadowColor, LightColor, ToonStep);

//==============================================================================
// MATERIAL SETUP INSTRUCTIONS
//==============================================================================
//
// 1. CREATE CUSTOM NODE:
//    - Right-click in material graph > "Custom"
//    - Name it "ToonTwoTone"
//    - Set "Output Type" to "CMOT Float 3"
//    - Paste the ToonTwoTone function code into the Code field
//
// 2. ADD INPUTS (click "+" to add inputs in this exact order):
//    Input Name         | Type
//    -------------------|-------------
//    WorldNormal        | Float 3
//    LightDirection     | Float 3
//    LightColor         | Float 3
//    ShadowColor        | Float 3
//    ShadowThreshold    | Float 1
//
// 3. CONNECT NODES:
//    - "Vertex Normal WS" node → WorldNormal input
//    - "Light Vector" node → LightDirection input
//    - Constant3Vector (1,1,1 for white) → LightColor input
//    - Constant3Vector (0.4,0.35,0.5 for purple-gray) → ShadowColor input
//    - Constant (0.25) → ShadowThreshold input
//
//    IMPORTANT: Make sure you add ALL 5 inputs before connecting nodes!
//
// 4. OPTIONAL - COMBINE WITH TEXTURE:
//    - Add a Texture Sample node for your base texture
//    - Multiply the Custom node output with the texture RGB
//    - Connect to Base Color
//
// 5. MATERIAL SETTINGS:
//    - Set Shading Model to "Default Lit" or "Unlit"
//    - If using "Unlit", shader will work in any lighting
//    - If using "Default Lit", you can combine with other lighting features later
//
// 6. TROUBLESHOOTING:
//    - If you get errors about GetPrimaryLight(), use the Manual version
//    - For Manual version, add "Light Vector" node and connect to LightDirection
//    - Make sure World Normal is in World Space (not Tangent Space)
//
//==============================================================================
// PARAMETERS EXPLANATION
//==============================================================================
//
// ShadowThreshold = 0.25 means:
//   - When surface receives < 25% lighting � Shadow Color
//   - When surface receives >= 25% lighting � Light Color
//   - This creates the hard edge at 25% threshold
//
// To adjust:
//   - Lower threshold (e.g., 0.1) = more light, less shadow
//   - Higher threshold (e.g., 0.5) = more shadow, less light
//
//==============================================================================
// EXAMPLE COLOR SCHEMES
//==============================================================================
//
// Anime Style:
//   LightColor:  (1.0, 0.95, 0.9)   // Warm white
//   ShadowColor: (0.4, 0.35, 0.5)   // Cool purple-gray
//
// High Contrast:
//   LightColor:  (1.0, 1.0, 1.0)    // Pure white
//   ShadowColor: (0.2, 0.2, 0.2)    // Dark gray
//
// Colored Toon:
//   LightColor:  (1.0, 0.8, 0.6)    // Warm peachy
//   ShadowColor: (0.3, 0.2, 0.5)    // Purple shadow
//
//==============================================================================
