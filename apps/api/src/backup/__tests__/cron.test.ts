import { describe, expect, test } from "bun:test";
import { matchesCron } from "../scheduler";

const at = (min: number, hour = 0, day = 1, month = 1) => new Date(2026, month - 1, day, hour, min);

describe("matchesCron", () => {
	test("star matches every value", () => {
		for (const m of [0, 7, 59]) expect(matchesCron("* * * * *", at(m))).toBe(true);
	});

	test("step without base: */5 matches multiples of 5 only", () => {
		expect(matchesCron("*/5 * * * *", at(0))).toBe(true);
		expect(matchesCron("*/5 * * * *", at(5))).toBe(true);
		expect(matchesCron("*/5 * * * *", at(55))).toBe(true);
		expect(matchesCron("*/5 * * * *", at(3))).toBe(false);
		expect(matchesCron("*/5 * * * *", at(7))).toBe(false);
	});

	test("range with step: 0-30/5 matches 0,5,...,30 but not 35", () => {
		expect(matchesCron("0-30/5 * * * *", at(0))).toBe(true);
		expect(matchesCron("0-30/5 * * * *", at(30))).toBe(true);
		expect(matchesCron("0-30/5 * * * *", at(35))).toBe(false);
		expect(matchesCron("0-30/5 * * * *", at(31))).toBe(false);
	});

	test("step with base: 5/15 matches 5,20,35,50 not 15,30", () => {
		expect(matchesCron("5/15 * * * *", at(5))).toBe(true);
		expect(matchesCron("5/15 * * * *", at(20))).toBe(true);
		expect(matchesCron("5/15 * * * *", at(50))).toBe(true);
		expect(matchesCron("5/15 * * * *", at(15))).toBe(false);
		expect(matchesCron("5/15 * * * *", at(0))).toBe(false);
	});

	test("plain number matches only itself", () => {
		expect(matchesCron("30 * * * *", at(30))).toBe(true);
		expect(matchesCron("30 * * * *", at(29))).toBe(false);
	});

	test("plain range without step", () => {
		expect(matchesCron("10-20 * * * *", at(15))).toBe(true);
		expect(matchesCron("10-20 * * * *", at(21))).toBe(false);
		expect(matchesCron("10-20 * * * *", at(9))).toBe(false);
	});

	test("range with step respects both bounds and offset", () => {
		expect(matchesCron("0-30/7 * * * *", at(0))).toBe(true);
		expect(matchesCron("0-30/7 * * * *", at(28))).toBe(true);
		expect(matchesCron("0-30/7 * * * *", at(35))).toBe(false);
		expect(matchesCron("5-25/10 * * * *", at(5))).toBe(true);
		expect(matchesCron("5-25/10 * * * *", at(15))).toBe(true);
		expect(matchesCron("5-25/10 * * * *", at(10))).toBe(false);
	});

	test("invalid step never matches", () => {
		expect(matchesCron("*/0 * * * *", at(0))).toBe(false);
		expect(matchesCron("*/x * * * *", at(0))).toBe(false);
	});

	test("hour expression: 0 */6 matches 0,6,12,18", () => {
		expect(matchesCron("0 */6 * * *", at(0, 0))).toBe(true);
		expect(matchesCron("0 */6 * * *", at(0, 6))).toBe(true);
		expect(matchesCron("0 */6 * * *", at(0, 18))).toBe(true);
		expect(matchesCron("0 */6 * * *", at(0, 3))).toBe(false);
	});

	test("comma list", () => {
		expect(matchesCron("1,15 * * * *", at(1))).toBe(true);
		expect(matchesCron("1,15 * * * *", at(15))).toBe(true);
		expect(matchesCron("1,15 * * * *", at(2))).toBe(false);
	});

	test("wrong field count is invalid", () => {
		expect(matchesCron("* * *", at(0))).toBe(false);
		expect(matchesCron("* * * * * *", at(0))).toBe(false);
	});

	test("malformed tokens are rejected outright", () => {
		expect(matchesCron("*/5oops * * * *", at(0))).toBe(false);
		expect(matchesCron("*/5oops * * * *", at(5))).toBe(false);
		expect(matchesCron("5/15/2 * * * *", at(5))).toBe(false);
		expect(matchesCron("5/15/2 * * * *", at(20))).toBe(false);
		expect(matchesCron("10-20-30 * * * *", at(15))).toBe(false);
		expect(matchesCron("1x * * * *", at(1))).toBe(false);
		expect(matchesCron("a * * * *", at(0))).toBe(false);
		expect(matchesCron("1,*/3x * * * *", at(3))).toBe(false);
	});
});
