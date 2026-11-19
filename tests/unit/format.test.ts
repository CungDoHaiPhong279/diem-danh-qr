import { describe, expect, it } from "vitest";
import { foldText } from "@/lib/format";

describe("foldText", () => {
  it("strips accents, case and đ", () => {
    expect(foldText("Nguyễn Văn ĐỨC")).toBe("nguyen van duc");
    expect(foldText("Lê Thị Đào").includes(foldText("dao"))).toBe(true);
  });
});
