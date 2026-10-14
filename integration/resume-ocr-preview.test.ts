import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import path from "node:path";
import { rm } from "node:fs/promises";
import {
  createProfile,
  getStore,
  readProfile,
  setStore,
  textToPdf,
  writeProfile,
  type TailoredResumeVersion,
} from "@superjob/core";
import { resumeRouter, extractResumeText } from "../packages/server/src/routes/resume.js";
import { runAsUser } from "../packages/server/src/lib/tenant.js";
import type { UserRecord } from "../packages/server/src/lib/identity.js";

const user: UserRecord = {
  userId: "resume-preview-test",
  email: "resume-preview@example.test",
  name: "Resume Preview Test",
  provider: "local",
  createdAt: 1,
  lastLoginAt: 1,
};

const values = new Map<string, unknown>();
setStore({
  async get<T>(key: string): Promise<T | undefined> {
    return values.get(key) as T | undefined;
  },
  async set<T>(key: string, value: T): Promise<void> {
    values.set(key, value);
  },
  async delete(key: string): Promise<void> {
    values.delete(key);
  },
  async keys(): Promise<string[]> {
    return [...values.keys()];
  },
});

test("resume extraction uses injected OCR for image and text-poor PDF inputs", async () => {
  let imageCalls = 0;
  let pdfCalls = 0;
  const ocr = {
    async image() {
      imageCalls++;
      return { text: "Recognized image resume content", pages: 1 };
    },
    async pdf(data) {
      pdfCalls++;
      assert.ok(data.byteLength > 0, "PDF text extraction must preserve bytes for OCR fallback");
      return { text: "Recognized scanned PDF content", pages: 1 };
    },
  };

  const image = await extractResumeText(new Uint8Array([1, 2, 3]), "resume.png", ocr);
  assert.equal(image.method, "ocr-image");
  assert.equal(image.text, "Recognized image resume content");
  assert.equal(imageCalls, 1);

  const pdfBytes = textToPdf("Short text-poor PDF");
  const originalLength = pdfBytes.byteLength;
  const scannedPdf = await extractResumeText(pdfBytes, "resume.pdf", ocr);
  assert.equal(scannedPdf.method, "ocr-pdf");
  assert.match(scannedPdf.text, /Short text-poor PDF/);
  assert.match(scannedPdf.text, /Recognized scanned PDF content/);
  assert.equal(pdfCalls, 1);
  assert.equal(pdfBytes.byteLength, originalLength);
});

test("resume upload extracts text, parses fields, and persists the same tenant profile", async () => {
  const uploadUser: UserRecord = {
    ...user,
    userId: `resume-upload-${randomUUID()}`,
  };
  const uploadDir = path.resolve(".uploads", uploadUser.userId);
  const app = express();
  app.use((_req, _res, next) => {
    void runAsUser(uploadUser, () => next());
  });
  app.use("/api/resume", resumeRouter);

  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const form = new FormData();
    form.append("file", new Blob([`Morgan Taylor
morgan.taylor@example.test
SUMMARY
Software engineer building reliable web services.
SKILLS
TypeScript, Node.js, PostgreSQL
EXPERIENCE
Acme Systems
Software Engineer
2020 - Present
- Built API services and maintained production systems.
EDUCATION
State University
Bachelor of Science, Computer Science
2016 - 2020`], { type: "text/plain" }), "sample-resume.txt");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/resume`, {
      method: "POST",
      body: form,
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.ok, true);
    assert.ok(result.parsed, "readable text should produce a parser summary");
    assert.equal(result.parsed.email, "morgan.taylor@example.test", JSON.stringify(result));
    assert.ok(result.parsed.skillsCount > 0);

    const saved = await runAsUser(uploadUser, () => readProfile<{
      email?: string;
      masterResumeText?: string;
      resumeFileName?: string;
    }>());
    assert.equal(saved?.email, "morgan.taylor@example.test");
    assert.match(saved?.masterResumeText ?? "", /Acme Systems/);
    assert.equal(saved?.resumeFileName, "sample-resume.txt");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await runAsUser(uploadUser, async () => {
      const store = getStore();
      for (const key of await store.keys()) await store.delete(key);
    });
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("resume PDF preview validates versions and serves source/latest PDFs from the account store", async () => {
  const app = express();
  app.use((_req, _res, next) => {
    void runAsUser(user, () => next());
  });
  app.use("/api/resume", resumeRouter);

  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/resume/preview.pdf`;

  try {
    await runAsUser(user, async () => {
      await writeProfile(createProfile({
        firstName: "Alex",
        masterResumeText: "Alex Morgan\nSenior engineer with experience building reliable distributed software.",
      }));
      await getStore().delete("resumeVersions");
    });

    const invalid = await fetch(`${baseUrl}?version=other`);
    assert.equal(invalid.status, 400);

    const source = await fetch(`${baseUrl}?version=source`);
    assert.equal(source.status, 200);
    assert.match(source.headers.get("content-type") || "", /application\/pdf/);
    assert.equal(Buffer.from(await source.arrayBuffer()).subarray(0, 5).toString("ascii"), "%PDF-");

    const latestMissing = await fetch(`${baseUrl}?version=latest`);
    assert.equal(latestMissing.status, 404);

    const latest: TailoredResumeVersion = {
      jobKey: "preview-test",
      title: "Senior Engineer",
      company: "Example Co",
      score: 75,
      atsScore: 75,
      suggestedAdditions: [],
      keywordGaps: [],
      createdAt: Date.now(),
      tailoredText: "Alex Morgan\nA resume version tailored from the saved profile.",
      label: "Senior Engineer @ Example Co",
      bullets: [],
      keywords: [],
      matchingSkills: [],
      source: "profile",
      resumeSource: "masterResumeText",
    };
    await runAsUser(user, async () => {
      await getStore().set("resumeVersions", { [latest.jobKey]: latest });
    });

    const latestResponse = await fetch(`${baseUrl}?version=latest`);
    assert.equal(latestResponse.status, 200);
    assert.match(latestResponse.headers.get("content-type") || "", /application\/pdf/);
    assert.equal(Buffer.from(await latestResponse.arrayBuffer()).subarray(0, 5).toString("ascii"), "%PDF-");

    await runAsUser(user, async () => {
      await getStore().set("resumePath", path.resolve("..", "outside-resume.pdf"));
    });
    const outsidePath = await fetch(`${baseUrl}?version=source`);
    assert.equal(outsidePath.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("active job description is private per account and replaced or cleared by job URL", async () => {
  const firstUser: UserRecord = { ...user, userId: `active-job-${randomUUID()}` };
  const secondUser: UserRecord = { ...user, userId: `active-job-${randomUUID()}` };
  const makeServer = (account: UserRecord) => {
    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use((_req, _res, next) => {
      void runAsUser(account, () => next());
    });
    app.use("/api/resume", resumeRouter);
    return app.listen(0);
  };
  const firstServer = makeServer(firstUser);
  const secondServer = makeServer(secondUser);
  const firstAddress = firstServer.address();
  const secondAddress = secondServer.address();
  assert.ok(firstAddress && typeof firstAddress !== "string");
  assert.ok(secondAddress && typeof secondAddress !== "string");
  const firstBase = `http://127.0.0.1:${firstAddress.port}/api/resume/active-job`;
  const secondBase = `http://127.0.0.1:${secondAddress.port}/api/resume/active-job`;
  const firstJobUrl = "https://boards.greenhouse.io/acme/jobs/100";
  const nextJobUrl = "https://jobs.lever.co/example/200";

  try {
    const saved = await fetch(firstBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobUrl: firstJobUrl,
        jobTitle: "Software Engineer",
        company: "Acme",
        jobDescription: "A".repeat(120),
      }),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).data.descriptionLength, 120);

    const privateRead = await fetch(`${firstBase}?jobUrl=${encodeURIComponent(firstJobUrl)}`);
    assert.equal(privateRead.status, 200);
    assert.equal((await privateRead.json()).data.description, "A".repeat(120));

    const otherAccountRead = await fetch(secondBase);
    assert.equal((await otherAccountRead.json()).data, null);

    const switched = await fetch(firstBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobUrl: nextJobUrl,
        jobTitle: "Data Engineer",
        company: "Example",
        jobDescription: "B".repeat(150),
      }),
    });
    assert.equal(switched.status, 200);
    const staleJobRead = await fetch(`${firstBase}?jobUrl=${encodeURIComponent(firstJobUrl)}`);
    assert.equal((await staleJobRead.json()).data, null);

    const staleDelete = await fetch(`${firstBase}?jobUrl=${encodeURIComponent(firstJobUrl)}`, { method: "DELETE" });
    assert.equal(staleDelete.status, 409);
    const currentDelete = await fetch(`${firstBase}?jobUrl=${encodeURIComponent(nextJobUrl)}`, { method: "DELETE" });
    assert.equal(currentDelete.status, 200);
    assert.equal((await currentDelete.json()).cleared, true);
    assert.equal((await (await fetch(firstBase)).json()).data, null);

    const oversized = await fetch(firstBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobUrl: firstJobUrl,
        jobDescription: "x".repeat(250_001),
      }),
    });
    assert.equal(oversized.status, 413);
  } finally {
    for (const [server, account] of [[firstServer, firstUser], [secondServer, secondUser]] as const) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await runAsUser(account, async () => {
        const store = getStore();
        for (const key of await store.keys()) await store.delete(key);
      });
    }
  }
});
