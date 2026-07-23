"use client";

import { useRouter } from "next/navigation";
import { NewMovementForm } from "@/components/NewMovementForm";

export default function NuevaCapturaPage() {
  const router = useRouter();
  const volver = () => router.push("/movimientos");

  return (
    <NewMovementForm
      asPage
      onClose={volver}
      onSuccess={volver}
    />
  );
}
