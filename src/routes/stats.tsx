import { createFileRoute } from "@tanstack/react-router";
import { StatsPanel } from "../components/StatsPanel";

export const Route = createFileRoute("/stats")({
  component: StatsPanel,
});
