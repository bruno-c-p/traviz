import { clerkSession } from "@/features/auth/clerk-session";
import { CODE_REASONS, createPasswordSignIn } from "@/features/auth/password-sign-in";
import type {
  PasswordAttempts,
  SignInField,
  SignInStep,
  SignInView,
} from "@/features/auth/password-sign-in";
import { hasActiveClient } from "@/features/auth/session-cookies";
import { BUSY_LABEL, SUBMIT_LABELS } from "@/features/auth/sign-in/sign-in-classes";
import { homePath } from "@/paths";

type StepForm = {
  readonly step: SignInStep;
  readonly form: HTMLFormElement;
  readonly submitButton: HTMLButtonElement;
  readonly errorText: HTMLElement;
  readonly controls: readonly (HTMLInputElement | HTMLButtonElement)[];
  readonly fields: ReadonlyMap<string, HTMLInputElement>;
};

async function loadAttempts(): Promise<PasswordAttempts> {
  await clerkSession.ready();

  const client = window.Clerk?.client;

  if (client === undefined) throw new Error("Clerk loaded without a client.");

  return { signIn: client.signIn.__internal_future, signUp: client.signUp.__internal_future };
}

function goHomeWhenSignedInElsewhere() {
  const check = () => {
    if (document.visibilityState === "visible" && hasActiveClient(document.cookie)) {
      window.location.replace(homePath());
    }
  };

  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) check();
  });
}

function findStepForm(step: SignInStep): StepForm | null {
  const form = document.querySelector<HTMLFormElement>(`form[data-sign-in-step="${step}"]`);
  const submitButton = form?.querySelector<HTMLButtonElement>("button[type=submit]");
  const errorText = form?.querySelector<HTMLElement>("[data-sign-in-error]");

  if (!form || !submitButton || !errorText) return null;

  const inputs = [...form.querySelectorAll<HTMLInputElement>("input[data-sign-in-field]")];

  return {
    step,
    form,
    submitButton,
    errorText,
    controls: [...inputs, ...form.querySelectorAll<HTMLButtonElement>("button")],
    fields: new Map(inputs.map((input) => [input.dataset.signInField ?? "", input])),
  };
}

function showFieldError(input: HTMLInputElement, errorId: string, hasError: boolean) {
  if (hasError) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-errormessage", errorId);
  } else {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-errormessage");
  }
}

function showStepForm(stepForm: StepForm, view: SignInView) {
  const isActive = stepForm.step === view.step;
  const errorMessage = isActive ? view.errorMessage : null;
  const errorField: SignInField | null = isActive ? view.errorField : null;

  stepForm.form.hidden = !isActive;
  stepForm.submitButton.textContent =
    isActive && view.isBusy ? BUSY_LABEL : SUBMIT_LABELS[stepForm.step];
  stepForm.errorText.hidden = errorMessage === null;
  stepForm.errorText.textContent = errorMessage ?? "";

  for (const control of stepForm.controls) control.disabled = view.isBusy;

  for (const [field, input] of stepForm.fields) {
    showFieldError(input, stepForm.errorText.id, field === errorField);
  }
}

function setText(selector: string, text: string) {
  const element = document.querySelector<HTMLElement>(selector);

  if (element) element.textContent = text;
}

function showCodeDetails(view: SignInView) {
  const resent = document.querySelector<HTMLElement>("[data-code-resent]");
  const accountEmail = document.querySelector<HTMLInputElement>("[data-account-email]");

  setText("[data-code-email]", view.emailAddress);
  setText("[data-code-reason]", CODE_REASONS[view.codePurpose]);

  if (resent) resent.hidden = !view.wasCodeResent;

  if (accountEmail) accountEmail.value = view.emailAddress;
}

function valueOf(stepForm: StepForm, field: SignInField): string {
  return stepForm.fields.get(field)?.value ?? "";
}

function settle(stepForm: StepForm, view: SignInView, hasEntered: boolean) {
  const [firstInput] = stepForm.fields.values();
  const errorInput = view.errorField === null ? undefined : stepForm.fields.get(view.errorField);

  if (hasEntered && stepForm.step !== "credentials") stepForm.form.reset();

  (errorInput ?? firstInput)?.focus();
}

function onClick(selector: string, listener: () => void) {
  for (const button of document.querySelectorAll(selector)) {
    button.addEventListener("click", listener);
  }
}

export function startSignInPage() {
  const credentials = findStepForm("credentials");
  const code = findStepForm("code");
  const newPassword = findStepForm("new-password");

  if (!credentials || !code || !newPassword) return;

  const stepForms = [credentials, code, newPassword];
  let shownStep: SignInStep = "credentials";

  const signIn = createPasswordSignIn({
    loadAttempts,
    goHome: (decorateUrl) => {
      window.location.assign(decorateUrl(homePath()));
    },
    show: (view) => {
      for (const stepForm of stepForms) showStepForm(stepForm, view);

      if (!view.isBusy) {
        for (const stepForm of stepForms) {
          if (stepForm.step === view.step) settle(stepForm, view, view.step !== shownStep);
        }

        shownStep = view.step;
      }

      showCodeDetails(view);
    },
  });

  const onSubmit = (stepForm: StepForm, submit: () => Promise<void>) => {
    stepForm.form.addEventListener("submit", (event) => {
      event.preventDefault();
      void submit();
    });
  };

  onSubmit(credentials, () =>
    signIn.submitCredentials(valueOf(credentials, "email"), valueOf(credentials, "password")),
  );
  onSubmit(code, () => signIn.submitCode(valueOf(code, "code")));
  onSubmit(newPassword, () => signIn.submitNewPassword(valueOf(newPassword, "password")));
  onClick("[data-forgot-password]", () => {
    void signIn.forgotPassword(valueOf(credentials, "email"));
  });
  onClick("[data-resend-code]", () => {
    void signIn.resendCode();
  });
  onClick("[data-restart]", signIn.restart);

  goHomeWhenSignedInElsewhere();
  clerkSession.loadNow();
}
