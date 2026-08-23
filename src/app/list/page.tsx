import { CountryList } from "../../components/CountryList";

// instant = false: kept on purpose — SessionGate (root layout) drops this
// segment from rendering entirely when signed out, so instant-navigation
// can't be validated for it.
export const instant = false;

export default function ListPage() {
  return <CountryList />;
}
