import { createFileRoute } from "@tanstack/react-router";
import { DataPanel } from "../components/DataPanel";

export const Route = createFileRoute("/data")({
  component: DataPanel,
});
