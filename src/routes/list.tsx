import { createFileRoute } from "@tanstack/react-router";
import { CountryList } from "../components/CountryList";

export const Route = createFileRoute("/list")({
  component: CountryList,
});
