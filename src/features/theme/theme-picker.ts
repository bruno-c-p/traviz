import { parseThemeChoice } from "@/features/theme/theme";
import type { ThemeChoice } from "@/features/theme/theme";

export type ThemeControls = {
  readonly choice: () => ThemeChoice;
  readonly choose: (choice: ThemeChoice) => void;
  readonly subscribe: (listener: () => void) => () => void;
};

export function mountThemePicker(picker: HTMLElement, theme: ThemeControls) {
  const options = [...picker.querySelectorAll<HTMLInputElement>("input[type=radio]")];

  const showChoice = () => {
    const choice = theme.choice();

    for (const option of options) option.checked = option.value === choice;
  };

  picker.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement)
      theme.choose(parseThemeChoice(event.target.value));
  });

  showChoice();

  return theme.subscribe(showChoice);
}
