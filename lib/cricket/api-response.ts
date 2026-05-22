import { NextResponse } from "next/server";

export function cricketJson<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: status < 400,
      ...data,
    },
    { status },
  );
}

export function cricketError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}
