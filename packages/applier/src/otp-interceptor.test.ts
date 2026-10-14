import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OTPInterceptor } from "./otp-interceptor.js";

describe("OTPInterceptor Security & Extraction", () => {
  const dummyConfig = { host: "imap.example.com", port: 993, tls: true, user: "test@example.com", password: "pwd" };
  const interceptor = new OTPInterceptor(dummyConfig);

  it("accepts authentic sender addresses from whitelisted domains", () => {
    const isValid = (interceptor as any).isValidSender.bind(interceptor);
    assert.equal(isValid("alerts@naukri.com", "naukri"), true);
    assert.equal(isValid("Naukri India <notifications@naukriemail.com>", "naukri"), true);
    assert.equal(isValid("otp@sub.naukri.org", "naukri"), true);
    assert.equal(isValid("security@linkedin.com", "linkedin"), true);
    assert.equal(isValid("LinkedIn <pin@e.linkedin.com>", "linkedin"), true);
    assert.equal(isValid("verify@foundit.in", "foundit"), true);
    assert.equal(isValid("Foundit <alerts@monsterindia.com>", "foundit"), true);
  });

  it("strictly rejects spoofed domain suffix and substring attacks", () => {
    const isValid = (interceptor as any).isValidSender.bind(interceptor);
    // Malicious subdomain spoofing
    assert.equal(isValid("attacker@naukri.com.evil.com", "naukri"), false);
    assert.equal(isValid("attacker@evil-naukri.com", "naukri"), false);
    // Fake domain prefix attack
    assert.equal(isValid("attacker@fake-naukriemail.com", "naukri"), false);
    assert.equal(isValid("attacker@badnaukri.com", "naukri"), false);
    assert.equal(isValid("evil@spoof-linkedin.com", "linkedin"), false);
    // Malformed addresses
    assert.equal(isValid("plain-string-no-at", "naukri"), false);
    assert.equal(isValid("", "naukri"), false);
  });

  it("extracts 6-digit and variable-length OTP codes from notification bodies", () => {
    const extract = (interceptor as any).extractOTPFromEmail.bind(interceptor);
    assert.equal(extract("Your verification code is 849201 for Naukri.", "naukri"), "849201");
    assert.equal(extract("Your LinkedIn verification code: 394821. Please do not share.", "linkedin"), "394821");
    assert.equal(extract("Use code 615243 to verify your account login.", "generic"), "615243");
    assert.equal(extract("Your single use OTP code is 918273", "generic"), "918273");
  });
});
