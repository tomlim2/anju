import { NextRequest, NextResponse } from "next/server";
import { validate, formatHuman } from "@converter/vrm-validator.js";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const strict = form.get("strict") === "true";
    const buffer = new Uint8Array(await file.arrayBuffer());

    const result = await validate(buffer, strict);
    const humanText = formatHuman(result, file.name);

    return NextResponse.json({ result, humanText });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
