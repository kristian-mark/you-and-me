import { createFileRoute } from "@tanstack/react-router";
import { CoupleApp } from "@/components/couple-app";

export const Route = createFileRoute("/")({ component: CoupleApp });
