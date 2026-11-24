import { CONTINENT_ORDER, countries } from "@/features/countries";
import { listRowsOf } from "@/features/country-list/list-model";

export const LIST_ROWS = listRowsOf(CONTINENT_ORDER, countries);
