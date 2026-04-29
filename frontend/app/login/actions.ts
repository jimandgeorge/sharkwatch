"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "crypto";

function sessionToken(): string {
  const secret = process.env.SECRET_KEY ?? "dev-secret";
  const password = process.env.AUTH_PASSWORD ?? "";
  return createHash("sha256")
    .update(`${password}:${secret}:sw`)
    .digest("hex");
}

export async function login(formData: FormData) {
  const password = (formData.get("password") as string) ?? "";
  const expected = process.env.AUTH_PASSWORD ?? "";

  if (!expected || password !== expected) {
    redirect("/login?error=1");
  }

  cookies().set("sw-session", sessionToken(), {
    httpOnly: true,
    secure: process.env.HTTPS === "true",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  redirect("/queue");
}

export async function logout() {
  cookies().delete("sw-session");
  redirect("/login");
}
