import { expect, test } from "bun:test";
import type { BrowserWindow } from "electron";
import { controlSettings, registerControl } from "../src/main/control";

const token = "0123456789abcdef0123456789abcdef";

test("a normal launch has no control port", () => {
  expect(controlSettings({})).toBeNull();
  expect(controlSettings({ EASEL_OFFLINE: "1", EASEL_DATA_DIR: "/tmp/easel" })).toBeNull();
});

test("a normal launch starts no control server and does not touch the window", () => {
  // Any access to the window throws, so a null result proves nothing was wired.
  const window = new Proxy({}, { get: () => { throw new Error("the window was used"); } });
  expect(registerControl(window as BrowserWindow, {})).toBeNull();
});

test("the port alone does not enable the control port", () => {
  expect(controlSettings({ EASEL_CONTROL_PORT: "39217" })).toBeNull();
  expect(controlSettings({ EASEL_CONTROL_PORT: "39217", EASEL_CONTROL_TOKEN: "short" })).toBeNull();
});

test("the token alone does not enable the control port", () => {
  expect(controlSettings({ EASEL_CONTROL_TOKEN: token })).toBeNull();
});

test("a privileged or invalid port is refused", () => {
  for (const port of ["0", "80", "70000", "abc", "39217.5", ""]) {
    expect(controlSettings({ EASEL_CONTROL_PORT: port, EASEL_CONTROL_TOKEN: token })).toBeNull();
  }
});

test("the port and the token together enable the control port", () => {
  expect(controlSettings({ EASEL_CONTROL_PORT: "39217", EASEL_CONTROL_TOKEN: token })).toEqual({ port: 39217, token });
});
