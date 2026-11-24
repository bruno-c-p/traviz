import { CountryList } from "@/features/country-list";
import { MarksBoundary } from "@/features/marks";

export default function ListPage() {
  return (
    <MarksBoundary>
      <CountryList />
    </MarksBoundary>
  );
}
