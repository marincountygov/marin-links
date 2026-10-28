/* Marin Links Server v0.4.5 anonymous short-link client. No saved secrets or retry keys. */
(() => {
  "use strict";

  const CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const REQUEST_KEY = /^[A-Za-z0-9_-]{16,128}$/;
  const ACTIVE_ID = /^[a-f0-9]{32}$/;
  const CHANNELS = new Set(["qr", "print", "email", "social", "other"]);
  const REQUEST_FIELDS = new Set(["destination", "alias", "label", "channel", "campaign", "source_path"]);
  let capabilityPromise = null;
  let capabilityValue = null;

  const configured = () => window.MarinLinksTracker;

  function directoryUrl(value, message = "Invalid server short-link base.") {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.search
      || url.hash
      || !url.pathname.endsWith("/")
      || url.pathname.includes("//")
      || /%2f|%5c/i.test(url.pathname)
    ) {
      throw new Error(message);
    }
    return url;
  }

  function validCode(code) {
    return typeof code === "string"
      && code.length >= 1
      && code.length <= 48
      && code !== "s"
      && CODE.test(code);
  }

  function requestKey() {
    if (typeof crypto === "undefined") {
      throw new ShortLinkError("This browser cannot safely create a short link. Try a current browser.", {
        code: "crypto_unavailable",
        canRetry: false
      });
    }
    if (typeof crypto.randomUUID === "function") {
      const key = crypto.randomUUID();
      if (REQUEST_KEY.test(key)) return key;
    }
    if (typeof crypto.getRandomValues !== "function") {
      throw new ShortLinkError("This browser cannot safely create a short link. Try a current browser.", {
        code: "crypto_unavailable",
        canRetry: false
      });
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const key = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    if (!REQUEST_KEY.test(key)) {
      throw new ShortLinkError("This browser cannot safely create a short link. Try a current browser.", {
        code: "crypto_unavailable",
        canRetry: false
      });
    }
    return key;
  }

  function shortCodeFromUrl(value, canonicalBase) {
    try {
      const root = directoryUrl(canonicalBase);
      const text = String(value || "").trim();
      const url = new URL(text);
      if (
        url.protocol !== "https:"
        || url.origin !== root.origin
        || url.username
        || url.password
        || url.search
        || url.hash
        || !url.pathname.startsWith(root.pathname)
        || /%2f|%5c/i.test(url.pathname)
      ) {
        return null;
      }
      const rest = url.pathname.slice(root.pathname.length);
      if (!validCode(rest)) return null;
      return text === new URL(rest, root).href ? rest : null;
    } catch {
      return null;
    }
  }

  function normalizeKnownCode(value, canonicalBase) {
    const text = String(value || "").trim();
    if (!text) return "";
    const lower = text.toLowerCase();
    if (validCode(lower) && !text.includes(":") && !text.includes("/")) return lower;
    return shortCodeFromUrl(text, canonicalBase);
  }

  function checkedShortUrl(urlValue, code, canonicalBase) {
    if (!validCode(code) || typeof urlValue !== "string") {
      throw new ShortLinkError("The County system returned an invalid short link.", {
        code: "invalid_response",
        uncertain: true
      });
    }
    const root = directoryUrl(canonicalBase);
    const extracted = shortCodeFromUrl(urlValue, root.href);
    const expected = new URL(code, root).href;
    if (extracted !== code || urlValue !== expected) {
      throw new ShortLinkError("The County system returned a link from an unexpected address.", {
        code: "invalid_response",
        uncertain: true
      });
    }
    return urlValue;
  }

  function capabilityShortBase(value) {
    const trusted = directoryUrl(configured().serverRoot);
    if (value === null || value === undefined) return trusted.href;
    try {
      const advertised = directoryUrl(value, "Invalid short-link address in County settings.");
      return advertised.origin === trusted.origin && advertised.pathname === trusted.pathname
        ? advertised.href
        : trusted.href;
    } catch {
      return trusted.href;
    }
  }

  function errorDetails(code, status) {
    const details = {
      creation_disabled: {
        message: "Short links are not available right now. Ask your administrator to check the settings.",
        stopBatch: true,
        canRetry: true
      },
      source_not_allowed: {
        message: "Short links are not available from this website or network. Connect to the County network or VPN, or ask your administrator.",
        stopBatch: true,
        canRetry: true
      },
      destination_not_allowed: {
        message: "This web address cannot be used for a short link. Check it or ask your administrator.",
        canRetry: false
      },
      alias_not_permitted: {
        message: "The County system did not accept the short-link request. Ask your administrator to check the settings.",
        stopBatch: true,
        canRetry: false
      },
      invalid_alias: {
        message: "The County system did not accept the short-link request.",
        canRetry: false
      },
      invalid_fields: {
        message: "Some link details were not accepted. Change the form, then try again.",
        canRetry: false
      },
      invalid_content_type: {
        message: "The County system could not read this request. Reload the page and try again.",
        canRetry: false
      },
      invalid_json: {
        message: "The County system did not accept the request.",
        canRetry: false
      },
      request_too_large: {
        message: "This web address or its tracking details are too long.",
        canRetry: false
      },
      invalid_channel: {
        message: "The sharing method was not accepted. Change it, then try again.",
        canRetry: false
      },
      invalid_metadata: {
        message: "A tracking detail was not accepted. Change it, then try again.",
        canRetry: false
      },
      sensitive_metadata: {
        message: "A tracking detail may contain private information. Remove it, then try again.",
        canRetry: false
      },
      invalid_idempotency_key: {
        message: "This browser could not safely retry. Reload the page and try again.",
        canRetry: false
      },
      idempotency_conflict: {
        message: "This retry does not match the first request. Change the form, then create a new short link.",
        canRetry: false
      },
      alias_taken: {
        message: "That short code is already in use.",
        canRetry: false
      },
      reserved_alias: {
        message: "That short code cannot be used.",
        canRetry: false
      },
      quota_exceeded: {
        message: "The County system cannot save more short links right now. Ask your administrator.",
        stopBatch: true,
        canRetry: true
      },
      rate_limit_exceeded: {
        message: "Too many short links were requested. Try again later. Links already made are kept.",
        stopBatch: true,
        canRetry: true
      },
      abuse_limit_exceeded: {
        message: "Too many short-link requests were made. Try again later.",
        stopBatch: true,
        canRetry: true
      },
      unavailable: {
        message: "The County system is not available right now. Try the same request again later.",
        stopBatch: true,
        canRetry: true
      },
      unauthorized: {
        message: "The County system rejected this request. Ask your administrator to check the short-link setup.",
        stopBatch: true,
        canRetry: false
      }
    };
    if (details[code]) return details[code];
    if (status === 429) return details.rate_limit_exceeded;
    if (status === 403) return {
      message: "Short links are not available from this website or network. Connect to the County network or VPN, or ask your administrator.",
      stopBatch: true,
      canRetry: true
    };
    if (status === 401) return details.unauthorized;
    if (status === 409) return {
      message: "The County system could not save this short link. Change the form or try again later.",
      stopBatch: false,
      canRetry: false
    };
    if (status === 413) return {
      message: "This web address or its tracking details are too long.",
      canRetry: false
    };
    if (status === 415 || status === 400) return {
      message: "The County system did not accept the link details.",
      canRetry: false
    };
    if (status === 422) return details.destination_not_allowed;
    if (status === 503 || status >= 500) return details.unavailable;
    return {
      message: "The County system could not make this short link. Check the form and try again.",
      canRetry: false
    };
  }

  function errorMessage(code, status) {
    return errorDetails(code, status).message;
  }

  class ShortLinkError extends Error {
    constructor(message, {
      status = 0,
      code = "network_error",
      uncertain = false,
      retryAfter = null,
      stopBatch = false,
      canRetry = true
    } = {}) {
      super(message);
      this.name = "ShortLinkError";
      this.status = status;
      this.code = code;
      this.uncertain = uncertain;
      this.retryAfter = retryAfter;
      this.stopBatch = stopBatch;
      this.canRetry = canRetry;
    }
  }

  async function readJson(response, { uncertain = false } = {}) {
    try {
      return await response.json();
    } catch {
      throw new ShortLinkError(
        uncertain
          ? "The County system did not confirm the result. The link may have been made. Try again without changing the form or network."
          : "The County system sent a result the app could not read.",
        {
          status: response.status,
          code: "invalid_response",
          uncertain,
          stopBatch: uncertain,
          canRetry: true
        }
      );
    }
  }

  async function capabilities({ refresh = false } = {}) {
    if (!refresh && capabilityValue) return capabilityValue;
    if (!refresh && capabilityPromise) return capabilityPromise;

    capabilityPromise = (async () => {
      let response;
      try {
        response = await fetch(configured().capabilitiesEndpoint || new URL("capabilities", configured().apiBase), {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          headers: { Accept: "application/json" },
          cache: "no-store",
          referrerPolicy: "no-referrer"
        });
      } catch {
        throw new ShortLinkError("Short-link availability could not be checked.", {
          code: "capabilities_unavailable",
          canRetry: true
        });
      }
      if (!response.ok) {
        throw new ShortLinkError("Short-link availability could not be checked.", {
          status: response.status,
          code: "capabilities_unavailable",
          canRetry: true
        });
      }
      const body = await readJson(response);
      if (!body?.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        throw new ShortLinkError("The County system sent settings the app could not read.", {
          code: "invalid_response",
          canRetry: true
        });
      }
      const canonicalBase = capabilityShortBase(body.data.short_url_base_url);
      capabilityValue = Object.freeze({ ...body.data, short_url_base_url: canonicalBase });
      return capabilityValue;
    })();

    try {
      return await capabilityPromise;
    } finally {
      capabilityPromise = null;
    }
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ShortLinkError("The short-link request is missing.", { code: "invalid_fields", canRetry: false });
    }
    if (Object.keys(payload).some((key) => !REQUEST_FIELDS.has(key))) {
      throw new ShortLinkError("The short-link request has an unexpected field.", { code: "invalid_fields", canRetry: false });
    }
    let destination;
    try {
      destination = new URL(payload.destination);
    } catch {
      throw new ShortLinkError("Enter a full web address.", { code: "destination_not_allowed", canRetry: false });
    }
    if (destination.protocol !== "https:" || destination.username || destination.password) {
      throw new ShortLinkError("Use a secure HTTPS web address without a user name or password.", {
        code: "destination_not_allowed",
        canRetry: false
      });
    }
    if (payload.alias !== null && payload.alias !== undefined) {
      throw new ShortLinkError("This app does not ask for custom short codes.", { code: "invalid_fields", canRetry: false });
    }
    if (payload.label !== "" || typeof payload.campaign !== "string" || !CHANNELS.has(payload.channel)) {
      throw new ShortLinkError("The short-link details are not valid.", { code: "invalid_fields", canRetry: false });
    }
    if (typeof payload.source_path !== "string" || !payload.source_path.startsWith("/") || !payload.source_path.endsWith("/")) {
      throw new ShortLinkError("The app path is not valid.", { code: "invalid_fields", canRetry: false });
    }
  }

  async function create(payload, idempotencyKey, canonicalBase = null) {
    validatePayload(payload);
    if (!REQUEST_KEY.test(String(idempotencyKey || ""))) {
      throw new ShortLinkError("This browser could not safely retry. Reload the page and try again.", {
        code: "invalid_idempotency_key",
        canRetry: false
      });
    }

    const config = configured();
    let response;
    try {
      response = await fetch(config.createEndpoint, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new ShortLinkError(
        "The County system did not confirm the result. The link may have been made. Try again without changing the form or network.",
        {
          uncertain: true,
          stopBatch: true,
          canRetry: true
        }
      );
    }

    const body = await readJson(response, { uncertain: response.ok });
    if (!response.ok) {
      const code = typeof body?.error?.code === "string" ? body.error.code : "unknown_error";
      const details = errorDetails(code, response.status);
      const retryRaw = response.headers.get("Retry-After");
      const retryAfter = retryRaw && /^\d+$/.test(retryRaw) ? Number(retryRaw) : null;
      throw new ShortLinkError(details.message, {
        status: response.status,
        code,
        retryAfter,
        stopBatch: Boolean(details.stopBatch),
        canRetry: details.canRetry !== false
      });
    }

    if (![200, 201].includes(response.status) || !body?.data || typeof body.data !== "object") {
      throw new ShortLinkError(
        "The County system did not confirm the result. The link may have been made. Try again without changing the form or network.",
        {
          status: response.status,
          code: "invalid_response",
          uncertain: true,
          stopBatch: true,
          canRetry: true
        }
      );
    }

    const data = body.data;
    if (
      !ACTIVE_ID.test(String(data.id || ""))
      || !Number.isInteger(data.revision)
      || data.revision < 1
      || typeof data.created_at !== "string"
      || Number.isNaN(Date.parse(data.created_at))
      || data.status !== "active"
    ) {
      throw new ShortLinkError(
        "The County system did not confirm a complete short link. Try again without changing the form or network.",
        {
          status: response.status,
          code: "invalid_response",
          uncertain: true,
          stopBatch: true,
          canRetry: true
        }
      );
    }

    const root = canonicalBase || capabilityValue?.short_url_base_url || config.serverRoot;
    const shortUrl = checkedShortUrl(data.short_url, data.code, root);
    return Object.freeze({
      id: data.id,
      code: data.code,
      shortUrl,
      status: data.status,
      revision: data.revision,
      createdAt: data.created_at,
      replayed: response.status === 200
    });
  }

  window.MarinLinksShortApi = Object.freeze({
    capabilities,
    create,
    requestKey,
    validCode,
    normalizeKnownCode,
    shortCodeFromUrl,
    checkedShortUrl,
    errorMessage,
    ShortLinkError
  });
})();
