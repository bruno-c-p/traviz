import { expect, test } from "bun:test";
import { accountInitial, createAccountMenuLoader } from "@/features/auth/account-menu-loader";

test("the initial is the first letter of the email, in upper case", () => {
  expect(accountInitial("ada@example.com")).toBe("A");
  expect(accountInitial(" grace@example.com")).toBe("G");
  expect(accountInitial("9lives@example.com")).toBe("9");
});

test("there is no initial without an email", () => {
  expect(accountInitial(null)).toBeNull();
  expect(accountInitial("")).toBeNull();
});

test("the menu loads once however often it is asked for", async () => {
  let loads = 0;

  const loadMenu = createAccountMenuLoader(
    () => {
      loads += 1;

      return Promise.resolve("menu");
    },
    () => {},
  );

  const [first, second] = await Promise.all([loadMenu(), loadMenu()]);

  expect(first).toBe("menu");
  expect(second).toBe("menu");
  expect(await loadMenu()).toBe("menu");
  expect(loads).toBe(1);
});

test("a load that throws is reported and the next ask loads again", async () => {
  const failures: unknown[] = [];
  const offline = new Error("offline");
  let loads = 0;

  const loadMenu = createAccountMenuLoader(
    () => {
      loads += 1;

      return loads === 1 ? Promise.reject(offline) : Promise.resolve("menu");
    },
    (cause) => {
      failures.push(cause);
    },
  );

  expect(await loadMenu()).toBeNull();
  expect(failures).toEqual([offline]);
  expect(await loadMenu()).toBe("menu");
  expect(loads).toBe(2);
});

test("a load that finds no menu is tried again on the next ask", async () => {
  let loads = 0;

  const loadMenu = createAccountMenuLoader(
    () => {
      loads += 1;

      return Promise.resolve(loads === 1 ? null : "menu");
    },
    () => {},
  );

  expect(await loadMenu()).toBeNull();
  expect(await loadMenu()).toBe("menu");
});
