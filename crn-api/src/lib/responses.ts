import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function success(data: unknown, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function created(data: unknown) {
  return NextResponse.json(data, { status: 201 });
}

export function error(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(message: string = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbidden(message: string = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function validationError(err: ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    },
    { status: 400 }
  );
}
