import { describe, it, expect } from "vitest";

describe("Northflank API Token", () => {
  it("should authenticate and list projects", async () => {
    const token = process.env.NORTHFLANK_API_TOKEN;
    expect(token).toBeDefined();
    expect(token).not.toBe("");

    const response = await fetch("https://api.northflank.com/v1/projects", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.projects).toBeDefined();
    expect(data.data.projects.length).toBeGreaterThan(0);
    
    // Verify the UAE Stock Screener project exists
    const uaeProject = data.data.projects.find(
      (p: any) => p.id === "uae-stock-screener"
    );
    expect(uaeProject).toBeDefined();
    expect(uaeProject.name).toBe("UAE Stock Screener");
  });

  it("should be able to access the uae-app service", async () => {
    const token = process.env.NORTHFLANK_API_TOKEN;

    const response = await fetch(
      "https://api.northflank.com/v1/projects/uae-stock-screener/services/uae-app",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.id).toBe("uae-app");
    expect(data.data.serviceType).toBe("deployment");
  });
});
