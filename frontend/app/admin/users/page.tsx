"use client";

import { useEffect } from "react";
import { navigate } from "@/lib/navigation";

export default function UsersPage() {
  useEffect(() => {
    // Redirect to profile page with users tab selected
    navigate("/admin/profile");
  }, []);

  return null;
}
