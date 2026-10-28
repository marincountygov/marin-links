/*
 * Marin Links
 * Long links and QR images are made in the browser. Creating a Short link
 * explicitly sends the completed URL to Marin Links Server. Shared navigation, copy feedback, and app information are owned by
 * the MarinOS App Shell.
 */

(() => {
  "use strict";

  const MAX_PARAMETER_ROWS = 20;
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 4096;
  const TARGET_PNG_SIZE = 2048;
  const MIN_CONTRAST_WITH_WHITE = 7;
  const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const DEFAULT_PARAMETER_NAME = "utm_term";
  const CUSTOM_PARAMETER_VALUE = "custom";
  const MAX_CUSTOM_PARAMETER_NAME_LENGTH = 64;
  const CUSTOM_PARAMETER_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;
  const PARAMETER_OPTIONS = Object.freeze([
    // Source, Channel (utm_medium), Campaign and Content (utm_content) are fields of their own above this list.
    { value: "utm_term", title: "Audience or keyword", group: "Campaign tracking" },
    { value: "ref", title: "Who sent people here", group: "General" },
    { value: "source", title: "Where the visit came from", group: "General" },
    { value: "campaign", title: "Campaign name", group: "General" },
    { value: "event", title: "Event name", group: "General" },
    { value: "location", title: "Place or site", group: "General" },
    { value: "lang", title: "Language", group: "General" },
    { value: "category", title: "Type of content", group: "General" },
    { value: "topic", title: "Topic", group: "General" },
    { value: "id", title: "Record number", group: "General" },
    { value: "form", title: "Form name", group: "General" },
    { value: "program", title: "Program name", group: "General" },
    { value: CUSTOM_PARAMETER_VALUE, title: "Something else", hint: "Type your own name", group: "Other" }
  ]);
  // The Stats tab shows the same plain names.
  window.MarinLinksParameterTitles = Object.freeze({
    ...Object.fromEntries(
      PARAMETER_OPTIONS
        .filter((option) => option.value !== CUSTOM_PARAMETER_VALUE)
        .map((option) => [option.value, option.title])
    ),
    utm_source: "Where people see the link",
    utm_medium: "How the link is shared",
    utm_campaign: "Campaign or project name",
    utm_content: "Which version of the link",
    agency: "Agency",
    division: "Division"
  });
  // Typed values should be codes. Block the plain cases of an email address or a phone number.
  const PERSONAL_VALUE_PATTERN = /@|(?:\d[\s().-]*){10,}/;
  const OTHER_VALUE = "__other__";
  const NEW_VALUE = "__new__";
  const LOGO_UPLOAD_VALUE = "__upload__";
  const QUIET_ZONE_MODULES = 4;
  const MIN_MODULE_INCHES = 0.0197;
  const DENSE_QR_VERSION = 13;
  const PRINT_DPI = 300;
  // Common answers. A short list keeps spelling the same, so Stats groups visits together.
  // Common answers, from the generated list. A link carries the code, not the name.
  const asChoices = (list) => list.map(({ value, name }) => [value, name]);
  const TRACKING_LISTS = window.MarinTrackingOptions || { channels: [], sources: [], languages: [] };
  const VALUE_OPTIONS = Object.freeze({
    lang: asChoices(TRACKING_LISTS.languages)
  });
  // The County is the source unless someone picks or adds another.
  const DEFAULT_SOURCE = "marin-county";
  const PARAMETER_PLACEHOLDERS = Object.freeze({
    utm_term: "seniors",
    ref: "library",
    source: "outreach",
    event: "health-fair",
    location: "novato",
    lang: "es"
  });
  const FEATURES = Object.freeze({
    qrColorPicker: false,
    backgroundOption: false,
    logoUpload: false
  });

  // The app URL can opt into broader destinations. This is a public mode,
  // not an authentication or access-control mechanism.
  const allowAnyHttpsDestination = (() => {
    const parameters = new URLSearchParams(window.location.search);
    const overrides = parameters.getAll("dest");
    return overrides.length === 1 && overrides[0] === "any";
  })();

  const state = {
    parameterId: 0,
    bulkRows: [],
    updateTimer: null,
    imageToken: 0,
    generationToken: 0,
    generating: false,
    logo: null,
    mode: "link",
    logos: [...(window.MarinLinksPresets?.logos || [])],
    finalUrl: "",
    renderResult: null,
    shortCandidate: null,
    shortSingle: null,
    lastShortCompleted: null,
    shortEpoch: 0,
    shortCapabilities: null,
    shortCanonicalBase: window.MarinLinksTracker?.serverRoot || "",
    shortAvailabilityChecked: false,
    shortAvailabilityMessage: "",
    shortCreationUnavailable: false,
    shortBatch: null,
    previousShortBatch: null,
    shortBatchLocked: [],
    renderSnapshot: null,
    openParameterPicker: null
  };

  let refs;

  function byId(id) {
    return document.getElementById(id);
  }

  function announce(message) {
    const status = byId("app-status-message");
    if (!status) return;
    status.textContent = "";
    window.requestAnimationFrame(() => {
      status.textContent = message;
    });
  }

  function setFieldError(input, error, message) {
    input.setAttribute("aria-invalid", "true");
    error.textContent = message;
    error.hidden = false;
  }

  function clearFieldError(input, error) {
    input.removeAttribute("aria-invalid");
    error.textContent = "";
    error.hidden = true;
  }

  function isAllowedHostname(hostname) {
    return window.MarinQrAuthorizedDomains.some((entry) => {
      if (hostname === entry.domain) return true;
      return entry.allowSubdomains && hostname.endsWith(`.${entry.domain}`);
    });
  }

  function parseDestination(rawValue) {
    const raw = rawValue.trim();
    if (!raw) return { empty: true };

    let url;
    try {
      url = new URL(raw);
    } catch {
      return {
        error: "Enter a full web address, such as https://marincounty.gov/innovation."
      };
    }

    if (url.protocol !== "https:") {
      return { error: "Use a secure HTTPS link." };
    }

    if (url.username || url.password) {
      return { error: "Remove the user name or password from this link." };
    }

    if (url.port) {
      return { error: "Remove the extra number after the website name." };
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname || (!allowAnyHttpsDestination && !isAllowedHostname(hostname))) {
      return { error: "Use a link from an approved Marin County website." };
    }

    url.hostname = hostname;
    return { url };
  }

  function normalizeHexColor(value) {
    const clean = value.trim().toLowerCase();
    if (/^[0-9a-f]{6}$/.test(clean)) return `#${clean}`;
    if (/^#[0-9a-f]{6}$/.test(clean)) return clean;
    return null;
  }

  function relativeLuminance(hex) {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    const linear = channels.map((channel) => (
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrastWithWhite(hex) {
    return 1.05 / (relativeLuminance(hex) + 0.05);
  }

  function validateColor() {
    const color = normalizeHexColor(refs.colorText.value);
    if (!color) {
      setFieldError(
        refs.colorText,
        refs.colorError,
        "Enter six letters or numbers, such as #1f1f1f."
      );
      return null;
    }

    if (contrastWithWhite(color) < MIN_CONTRAST_WITH_WHITE) {
      setFieldError(
        refs.colorText,
        refs.colorError,
        "Choose a darker color. Light QR codes may not scan."
      );
      return null;
    }

    clearFieldError(refs.colorText, refs.colorError);
    refs.color.value = color;
    return color;
  }

  function makeLabel(text, input) {
    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = text;
    label.append(input);
    return label;
  }

  function cancelScheduledUpdate() {
    window.clearTimeout(state.updateTimer);
    state.updateTimer = null;
  }

  function setExportActionsEnabled(enabled) {
    refs.download.disabled = !enabled;
    refs.downloadFormat.disabled = !enabled;
    refs.copyLink.disabled = !enabled;
  }

  // The Type choice is Link or QR code. "Add many web addresses" turns Link into a list of links.
  function currentMode() {
    const type = refs.outputs.find((radio) => radio.checked)?.value === "qr" ? "qr" : "link";
    return type === "link" && refs.many.checked ? "bulk" : type;
  }

  function isQrMode() {
    return state.mode === "qr";
  }

  function isBulkMode() {
    return state.mode === "bulk";
  }

  function emptyMessage() {
    if (isBulkMode()) return "Add web addresses to make links.";
    return isQrMode() ? "Add a web address to make a QR code." : "Add a web address to make a link.";
  }

  // Long links keep the local tracking URL workflow. Short links are registered by API only.
  function isShortMode() {
    return document.querySelector('input[name="length"]:checked')?.value === "short";
  }

  function buildTrackedUrl(destinationHref) {
    return `${window.MarinLinksTracker.endpoint}?d=${encodeURIComponent(destinationHref)}`;
  }

  function shortPayload(destination, parameters) {
    const campaign = parameters.find((item) => item.name === "utm_campaign")?.value || "";
    const medium = parameters.find((item) => item.name === "utm_medium")?.value || "";
    const mediumChoice = window.MarinLinksPresets?.channels?.find((item) =>
      item.value === medium || item.id === medium || item.legacy?.includes(medium)
    );
    const mediumId = mediumChoice?.id || medium;
    const channel = isQrMode() ? "qr" : (["print", "email", "social"].includes(mediumId) ? mediumId : "other");
    return {
      destination,
      alias: null,
      label: "",
      channel,
      campaign: normalizeCampaign(campaign),
      source_path: window.MarinLinksTracker.sourcePath
    };
  }

  function shortSnapshot(payload) {
    return JSON.stringify(payload);
  }

  function renderShortAvailability() {
    const visible = isShortMode() && Boolean(state.shortAvailabilityMessage);
    if (refs.shortAvailability) {
      refs.shortAvailability.textContent = state.shortAvailabilityMessage;
      refs.shortAvailability.hidden = !visible || isBulkMode();
    }
    if (refs.shortBulkAvailability) {
      refs.shortBulkAvailability.textContent = state.shortAvailabilityMessage;
      refs.shortBulkAvailability.hidden = !visible || !isBulkMode();
    }
  }

  async function checkShortAvailability() {
    if (state.shortAvailabilityChecked || !window.MarinLinksShortApi) return;
    state.shortAvailabilityChecked = true;
    try {
      const data = await window.MarinLinksShortApi.capabilities();
      state.shortCapabilities = data;
      state.shortCanonicalBase = data.short_url_base_url || window.MarinLinksTracker.serverRoot;
      state.shortCreationUnavailable = data.creation?.anonymous_enabled === false;
      state.shortAvailabilityMessage = state.shortCreationUnavailable
        ? "Short links are not available. Ask your administrator to check the settings and approved websites."
        : "";
    } catch {
      // This check is only a hint. The Create button still makes the final check.
      state.shortCreationUnavailable = false;
      state.shortAvailabilityMessage = "We could not check short links. You can still try to create one.";
    }
    renderShortAvailability();
    if (isShortMode() && state.shortCandidate) showShortCandidate(
      state.shortCandidate.payload,
      state.shortCandidate.color,
      state.shortCandidate.transparentBackground
    );
    if (isShortMode() && state.shortBatch) renderShortBulk();
  }

  function displayPriorShort() {
    const prior = state.lastShortCompleted;
    if (!prior || !isShortMode() || isBulkMode() || (state.shortCandidate && prior.snapshot === state.shortCandidate.snapshot)) {
      refs.shortPrior.hidden = true;
      return;
    }
    refs.shortPrior.hidden = false;
    refs.shortPriorUrl.textContent = prior.result.shortUrl;
    refs.shortPriorCopy.dataset.copyValue = prior.result.shortUrl;
  }

  function showShortCandidate(payload, color, transparentBackground) {
    const snapshot = shortSnapshot(payload);
    state.shortCandidate = { snapshot, payload, color, transparentBackground };
    refs.shortActions.hidden = false;
    const attempt = state.shortSingle;
    const matches = attempt?.snapshot === snapshot;
    const ready = Boolean(matches && attempt.result);
    const blockedRetry = Boolean(matches && attempt && attempt.canRetry === false && !attempt.result);
    refs.shortDestination.textContent = payload.destination;
    refs.shortCreate.disabled = Boolean(attempt?.inFlight) || ready || blockedRetry || state.shortCreationUnavailable;
    refs.shortCreate.textContent = attempt?.inFlight
      ? "Creating…"
      : (matches && attempt?.message && attempt.canRetry !== false ? "Try again" : "Create short link");
    refs.shortCreate.hidden = ready;
    refs.shortStatus.hidden = !matches || (!attempt?.message && !ready);
    refs.shortStatus.textContent = ready ? "Short link created." : (matches ? attempt.message || "" : "");
    renderShortAvailability();
    displayPriorShort();
    return ready ? attempt.result.shortUrl : null;
  }

  async function createSingleShort() {
    const candidate = state.shortCandidate;
    if (
      !candidate
      || state.updateTimer
      || !isShortMode()
      || isBulkMode()
      || state.shortSingle?.inFlight
      || state.shortCreationUnavailable
      || !window.MarinLinksShortApi
    ) return;

    let attempt = state.shortSingle;
    if (!attempt || attempt.snapshot !== candidate.snapshot) {
      attempt = {
        snapshot: candidate.snapshot,
        payload: candidate.payload,
        key: window.MarinLinksShortApi.requestKey(),
        inFlight: false,
        result: null,
        uncertain: false,
        canRetry: true,
        message: ""
      };
      state.shortSingle = attempt;
    }
    if (attempt.result || attempt.canRetry === false) return;

    const epoch = state.shortEpoch;
    attempt.inFlight = true;
    attempt.message = "Creating short link…";
    refs.shortCreate.disabled = true;
    refs.shortCreate.textContent = "Creating…";
    refs.shortStatus.hidden = false;
    refs.shortStatus.textContent = attempt.message;
    refs.shortActions.setAttribute("aria-busy", "true");
    refs.resetForm.disabled = true;
    try {
      const result = await window.MarinLinksShortApi.create(
        attempt.payload,
        attempt.key,
        state.shortCanonicalBase || state.shortCapabilities?.short_url_base_url || window.MarinLinksTracker.serverRoot
      );
      if (epoch !== state.shortEpoch) return;
      attempt.result = result;
      attempt.uncertain = false;
      attempt.canRetry = false;
      attempt.message = "Short link created.";
      state.lastShortCompleted = { snapshot: attempt.snapshot, payload: attempt.payload, result };
      announce("Short link created. You can copy it now.");
    } catch (error) {
      if (epoch !== state.shortEpoch) return;
      attempt.uncertain = Boolean(error.uncertain);
      attempt.canRetry = error.canRetry !== false;
      attempt.message = error.message || "The short link could not be created.";
      announce(attempt.message);
    } finally {
      attempt.inFlight = false;
      refs.shortActions.removeAttribute("aria-busy");
      refs.resetForm.disabled = false;
      if (epoch === state.shortEpoch) void updatePreview();
    }
  }


  function applyMode() {
    const qr = isQrMode();
    const bulk = isBulkMode();
    // Many links shows its results across the full width, under the form.
    refs.panelCreate.dataset.mode = state.mode;
    refs.manyField.hidden = qr;
    refs.singleUrlField.hidden = bulk;
    refs.bulkUrlField.hidden = !bulk;
    refs.singleResult.hidden = bulk;
    refs.bulkResult.hidden = !bulk;
    refs.designSection.hidden = !qr;
    refs.canvasFrame.hidden = !qr;
    if (refs.sizeNote) syncDownloadControls();
    refs.downloadGroup.hidden = !qr;
    refs.scanNote.hidden = !qr;
    refs.shortActions.hidden = true;
    refs.shortBulkActions.hidden = true;
    refs.shortPrior.hidden = true;
    refs.shortBulkPrior.hidden = true;
  }

  function exportsAreReady() {
    return Boolean(
      state.finalUrl
      && (state.renderResult || !isQrMode())
      && !state.updateTimer
      && !state.generating
    );
  }

  function getParameterOption(value) {
    return PARAMETER_OPTIONS.find((option) => option.value === value) || null;
  }

  function getParameterPlaceholder(value) {
    return PARAMETER_PLACEHOLDERS[value] || "Enter a value";
  }

  function createParameterPicker(id, initialValue, errorId, onSelectionChange) {
    const field = document.createElement("div");
    field.className = "qr-parameter-name-field";

    // The picker is a button, not a form field, so this text is not a <label>.
    const label = document.createElement("span");
    label.id = `parameter-name-label-${id}`;
    label.className = "qr-parameter-label";
    label.textContent = "What do you want to track?";

    const picker = document.createElement("div");
    picker.className = "qr-parameter-picker";

    const trigger = document.createElement("button");
    trigger.id = `parameter-name-${id}`;
    trigger.type = "button";
    trigger.className = "qr-parameter-picker__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-describedby", errorId);

    const triggerText = document.createElement("span");
    triggerText.className = "qr-parameter-picker__selection";
    triggerText.id = `parameter-selection-${id}`;
    // The button is named by its label and the choice it shows, so its visible words are in its name.
    trigger.setAttribute("aria-labelledby", `${label.id} ${triggerText.id}`);
    const triggerName = document.createElement("span");
    triggerName.className = "qr-parameter-picker__name";
    const triggerDescription = document.createElement("span");
    triggerDescription.className = "qr-parameter-picker__description";
    triggerText.append(triggerName, triggerDescription);

    const arrow = document.createElement("span");
    arrow.className = "qr-parameter-picker__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "▾";
    trigger.append(triggerText, arrow);

    const popup = document.createElement("div");
    popup.id = `parameter-picker-popup-${id}`;
    popup.className = "qr-parameter-picker__popup";
    popup.hidden = true;
    trigger.setAttribute("aria-controls", popup.id);

    const searchLabel = document.createElement("label");
    searchLabel.className = "visually-hidden";
    searchLabel.htmlFor = `parameter-search-${id}`;
    searchLabel.textContent = "Search tracking details";

    const search = document.createElement("input");
    search.id = searchLabel.htmlFor;
    search.type = "search";
    search.className = "qr-parameter-picker__search";
    search.placeholder = "Type to filter";
    search.autocomplete = "off";
    search.autocapitalize = "none";
    search.spellcheck = false;
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-expanded", "true");

    const listbox = document.createElement("div");
    listbox.id = `parameter-options-${id}`;
    listbox.className = "qr-parameter-picker__listbox";
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("aria-labelledby", label.id);
    search.setAttribute("aria-controls", listbox.id);

    const emptyMessage = document.createElement("p");
    emptyMessage.className = "qr-parameter-picker__empty";
    emptyMessage.setAttribute("role", "status");
    emptyMessage.setAttribute("aria-live", "polite");
    emptyMessage.textContent = "Nothing matches.";
    emptyMessage.hidden = true;

    const groupRecords = new Map();
    const optionRecords = PARAMETER_OPTIONS.map((option, index) => {
      let groupRecord = groupRecords.get(option.group);
      if (!groupRecord) {
        const group = document.createElement("div");
        group.className = "qr-parameter-picker__group";
        group.setAttribute("role", "group");

        const groupLabel = document.createElement("div");
        groupLabel.id = `parameter-group-${id}-${groupRecords.size + 1}`;
        groupLabel.className = "qr-parameter-picker__group-label";
        groupLabel.textContent = option.group;
        group.setAttribute("aria-labelledby", groupLabel.id);
        group.append(groupLabel);
        listbox.append(group);
        groupRecord = { element: group, options: [] };
        groupRecords.set(option.group, groupRecord);
      }

      const optionButton = document.createElement("button");
      optionButton.id = `parameter-option-${id}-${index + 1}`;
      optionButton.type = "button";
      optionButton.className = "qr-parameter-picker__option";
      optionButton.dataset.value = option.value;
      optionButton.setAttribute("role", "option");
      optionButton.setAttribute("aria-selected", "false");
      optionButton.tabIndex = -1;

      const optionName = document.createElement("span");
      optionName.className = "qr-parameter-picker__option-name";
      optionName.textContent = option.title;
      const optionDescription = document.createElement("span");
      optionDescription.className = "qr-parameter-picker__option-description";
      optionDescription.textContent = option.hint || option.value;
      optionButton.append(optionName, optionDescription);
      groupRecord.element.append(optionButton);

      const record = { option, element: optionButton, group: groupRecord };
      groupRecord.options.push(record);
      return record;
    });

    popup.append(searchLabel, search, listbox, emptyMessage);
    picker.append(trigger, popup);
    field.append(label, picker);

    let selectedValue = getParameterOption(initialValue) ? initialValue : DEFAULT_PARAMETER_NAME;
    let activeRecord = null;

    function visibleRecords() {
      return optionRecords.filter((record) => !record.element.hidden);
    }

    function setActiveRecord(record, scroll = true) {
      optionRecords.forEach((candidate) => {
        candidate.element.classList.toggle("is-active", candidate === record);
      });
      activeRecord = record || null;
      if (activeRecord) {
        search.setAttribute("aria-activedescendant", activeRecord.element.id);
        if (scroll) activeRecord.element.scrollIntoView({ block: "nearest" });
      } else {
        search.removeAttribute("aria-activedescendant");
      }
    }

    function renderSelection() {
      const selected = getParameterOption(selectedValue) || getParameterOption(DEFAULT_PARAMETER_NAME);
      trigger.dataset.value = selected.value;
      triggerName.textContent = selected.title;
      triggerDescription.textContent = selected.hint || selected.value;
      optionRecords.forEach((record) => {
        record.element.setAttribute(
          "aria-selected",
          record.option.value === selected.value ? "true" : "false"
        );
      });
    }

    function filterOptions() {
      const query = search.value.trim().toLowerCase();
      optionRecords.forEach((record) => {
        const searchable = `${record.option.value} ${record.option.title} ${record.option.hint || ""}`.toLowerCase();
        record.element.hidden = Boolean(query) && !searchable.includes(query);
      });
      groupRecords.forEach((groupRecord) => {
        groupRecord.element.hidden = !groupRecord.options.some((record) => !record.element.hidden);
      });

      const visible = visibleRecords();
      emptyMessage.hidden = visible.length > 0;
      if (!visible.includes(activeRecord)) {
        const selected = visible.find((record) => record.option.value === selectedValue);
        setActiveRecord(selected || visible[0] || null, false);
      }
    }

    function close(returnFocus = false) {
      if (popup.hidden) return;
      popup.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      search.value = "";
      setActiveRecord(null, false);
      if (state.openParameterPicker === api) state.openParameterPicker = null;
      if (returnFocus) trigger.focus();
    }

    function open(initialQuery = "", edge = "selected") {
      if (state.openParameterPicker && state.openParameterPicker !== api) {
        state.openParameterPicker.close(false);
      }
      popup.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      search.value = initialQuery;
      filterOptions();
      const visible = visibleRecords();
      if (edge === "last") {
        setActiveRecord(visible[visible.length - 1] || null, false);
      } else if (edge === "first") {
        setActiveRecord(visible[0] || null, false);
      } else {
        setActiveRecord(
          visible.find((record) => record.option.value === selectedValue) || visible[0] || null,
          false
        );
      }
      state.openParameterPicker = api;
      window.requestAnimationFrame(() => {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
      });
    }

    function choose(value) {
      const selected = getParameterOption(value);
      if (!selected) return;
      const previous = selectedValue;
      selectedValue = selected.value;
      renderSelection();
      close(false);
      if (selectedValue !== previous) {
        onSelectionChange(selectedValue, previous);
      } else {
        trigger.focus();
      }
    }

    function moveActive(step) {
      const visible = visibleRecords();
      if (!visible.length) return;
      const currentIndex = visible.indexOf(activeRecord);
      const nextIndex = currentIndex < 0
        ? (step > 0 ? 0 : visible.length - 1)
        : (currentIndex + step + visible.length) % visible.length;
      setActiveRecord(visible[nextIndex]);
    }

    trigger.addEventListener("click", () => {
      if (popup.hidden) open();
      else close(true);
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        open("", "selected");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        open("", "last");
      } else if (
        event.key.length === 1
        && event.key !== " "
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
      ) {
        event.preventDefault();
        open(event.key, "first");
      }
    });

    search.addEventListener("input", filterOptions);
    search.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveRecord(visibleRecords()[0] || null);
      } else if (event.key === "End") {
        event.preventDefault();
        const visible = visibleRecords();
        setActiveRecord(visible[visible.length - 1] || null);
      } else if (event.key === "Enter" && activeRecord) {
        event.preventDefault();
        choose(activeRecord.option.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      } else if (event.key === "Tab") {
        close(false);
      }
    });

    optionRecords.forEach((record) => {
      record.element.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      record.element.addEventListener("click", () => choose(record.option.value));
      record.element.addEventListener("mousemove", () => setActiveRecord(record, false));
    });

    field.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!field.contains(document.activeElement)) close(false);
      }, 0);
    });

    const api = {
      field,
      button: trigger,
      wrapper: picker,
      close,
      open,
      getValue: () => selectedValue
    };

    renderSelection();
    return api;
  }

  function clearParameterRowError(row) {
    const controls = row.querySelectorAll(
      ".qr-parameter-picker__trigger, .qr-custom-parameter-input, .qr-parameter-value"
    );
    controls.forEach((control) => control.removeAttribute("aria-invalid"));
    const error = row.querySelector(".qr-parameter-error");
    error.textContent = "";
    error.hidden = true;
  }

  function setParameterRowError(row, controls, message) {
    controls.forEach((control) => control.setAttribute("aria-invalid", "true"));
    const error = row.querySelector(".qr-parameter-error");
    error.textContent = message;
    error.hidden = false;
  }

  function addParameterRow(name = DEFAULT_PARAMETER_NAME, value = "", moveFocus = false) {
    if (refs.parameterList.children.length >= MAX_PARAMETER_ROWS) {
      announce("You can add up to 20 tracking details.");
      return;
    }

    const id = ++state.parameterId;
    const trimmedName = String(name || "").trim();
    const initialOption = getParameterOption(trimmedName);
    const initialSelection = initialOption ? initialOption.value : (trimmedName ? CUSTOM_PARAMETER_VALUE : DEFAULT_PARAMETER_NAME);
    const initialCustomName = initialSelection === CUSTOM_PARAMETER_VALUE ? trimmedName : "";

    const row = document.createElement("div");
    row.className = "qr-parameter-row";
    row.dataset.parameterId = String(id);
    row.dataset.parameterSelection = initialSelection;
    row.dataset.parameterEngaged = value.trim() || initialCustomName ? "true" : "false";
    row.setAttribute("role", "group");

    const error = document.createElement("p");
    error.id = `parameter-error-${id}`;
    error.className = "app-error qr-parameter-error";
    error.setAttribute("role", "alert");
    error.hidden = true;

    const customField = document.createElement("div");
    customField.className = "qr-custom-parameter-field";
    customField.hidden = initialSelection !== CUSTOM_PARAMETER_VALUE;

    const customInput = document.createElement("input");
    customInput.id = `custom-parameter-name-${id}`;
    customInput.className = "qr-custom-parameter-input";
    customInput.type = "text";
    customInput.value = initialCustomName;
    customInput.maxLength = MAX_CUSTOM_PARAMETER_NAME_LENGTH;
    customInput.autocapitalize = "none";
    customInput.spellcheck = false;
    customInput.setAttribute("aria-describedby", error.id);
    customField.append(makeLabel("Your own name", customInput));

    const valueSelect = document.createElement("select");
    valueSelect.id = `parameter-value-choice-${id}`;
    valueSelect.className = "qr-parameter-value-choice";
    valueSelect.setAttribute("aria-describedby", error.id);

    const valueInput = document.createElement("input");
    valueInput.id = `parameter-value-${id}`;
    valueInput.className = "qr-parameter-value";
    valueInput.type = "text";
    valueInput.value = value;
    valueInput.placeholder = getParameterPlaceholder(initialSelection);
    valueInput.autocapitalize = "none";
    valueInput.spellcheck = false;
    valueInput.setAttribute("aria-describedby", error.id);

    const selectLabel = makeLabel("Value", valueSelect);
    const inputLabel = makeLabel("Value", valueInput);

    // Names with a short list of common answers get a dropdown. "Something else" opens the text box.
    function syncValueControls(selection, initialText = "") {
      const choices = VALUE_OPTIONS[selection];
      selectLabel.hidden = !choices;
      valueSelect.textContent = "";
      if (!choices) {
        inputLabel.hidden = false;
        inputLabel.firstChild.textContent = "Value";
        return;
      }
      valueSelect.append(new Option("Choose one", ""));
      choices.forEach(([choice, title]) => valueSelect.append(new Option(title, choice)));
      valueSelect.append(new Option("Something else", OTHER_VALUE));
      const known = choices.some(([choice]) => choice === initialText);
      valueSelect.value = known ? initialText : (initialText ? OTHER_VALUE : "");
      inputLabel.hidden = valueSelect.value !== OTHER_VALUE;
      inputLabel.firstChild.textContent = "Your own value";
    }

    const valueField = document.createElement("div");
    valueField.className = "qr-parameter-value-field";
    valueField.append(selectLabel, inputLabel);

    let picker;
    picker = createParameterPicker(id, initialSelection, error.id, (selection) => {
      row.dataset.parameterSelection = selection;
      row.dataset.parameterEngaged = "true";
      customInput.value = "";
      customField.hidden = selection !== CUSTOM_PARAMETER_VALUE;
      valueInput.value = "";
      syncValueControls(selection);
      valueInput.placeholder = getParameterPlaceholder(selection);
      clearParameterRowError(row);
      scheduleUpdate();
      window.requestAnimationFrame(() => {
        if (selection === CUSTOM_PARAMETER_VALUE) customInput.focus();
        else picker.button.focus();
      });
    });
    row.parameterPicker = picker;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "action-button is-danger qr-remove-parameter";
    remove.dataset.icon = "trash";
    remove.setAttribute("aria-label", "Remove tracking detail");
    remove.title = "Remove tracking detail";
    remove.addEventListener("pointerdown", cancelScheduledUpdate);
    remove.addEventListener("click", () => {
      if (state.openParameterPicker === picker) picker.close(false);
      row.remove();
      renumberParameterRows();
      void updatePreview();
      announce("Tracking detail removed.");
      refs.addParameter.focus();
    });

    row.append(
      picker.field,
      valueField,
      remove,
      customField,
      error
    );

    syncValueControls(initialSelection, value);
    valueInput.value = VALUE_OPTIONS[initialSelection] && valueSelect.value !== OTHER_VALUE ? "" : value;

    valueInput.addEventListener("input", () => {
      row.dataset.parameterEngaged = "true";
      scheduleUpdate();
    });
    valueSelect.addEventListener("change", () => {
      row.dataset.parameterEngaged = "true";
      inputLabel.hidden = valueSelect.value !== OTHER_VALUE;
      if (valueSelect.value === OTHER_VALUE) valueInput.focus();
      scheduleUpdate();
    });
    customInput.addEventListener("input", () => {
      row.dataset.parameterEngaged = "true";
      scheduleUpdate();
    });

    refs.parameterList.append(row);
    renumberParameterRows();
    refs.addParameter.disabled = refs.parameterList.children.length >= MAX_PARAMETER_ROWS;

    if (moveFocus) picker.button.focus();
  }

  function renumberParameterRows() {
    const rows = [...refs.parameterList.querySelectorAll(".qr-parameter-row")];
    rows.forEach((row, index) => {
      const number = index + 1;
      row.setAttribute("aria-label", `Tracking detail ${number}`);
      row.querySelector(".qr-remove-parameter").setAttribute("aria-label", `Remove tracking detail ${number}`);
    });
    refs.addParameter.disabled = rows.length >= MAX_PARAMETER_ROWS;
  }

  // The Logo dropdown starts with the backup list. When the Brand Center list arrives, it takes over.
  function renderLogoOptions() {
    const chosen = refs.logoChoice.value;
    refs.logoChoice.querySelectorAll("option[data-brand]").forEach((option) => option.remove());
    const upload = refs.logoChoice.querySelector(`option[value="${LOGO_UPLOAD_VALUE}"]`);
    [...state.logos]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(({ value, name }) => {
        const option = new Option(name, value);
        option.dataset.brand = "true";
        refs.logoChoice.insertBefore(option, upload);
      });
    if (chosen && refs.logoChoice.querySelector(`option[value="${CSS.escape(chosen)}"]`)) {
      refs.logoChoice.value = chosen;
    } else if (chosen && chosen !== LOGO_UPLOAD_VALUE) {
      // The chosen brand is no longer listed.
      refs.logoChoice.value = "";
      state.imageToken += 1;
      clearImageChoice();
      scheduleUpdate();
    }
  }

  async function loadBrandLogos() {
    state.logos = await window.MarinLinksPresets.loadLogos();
    renderLogoOptions();
  }

  function fillPresetLists() {
    const { agencies, campaigns, channels, sources, contents } = window.MarinLinksPresets;
    // Each list ends with "Add a new one", so the choices go in front of it.
    const fillChoices = (select, list, selectedValue = "") => {
      const addNew = select.querySelector(`option[value="${NEW_VALUE}"]`);
      list.forEach(({ value, name }) => select.insertBefore(new Option(name, value, value === selectedValue, value === selectedValue), addNew));
    };
    fillChoices(refs.channel, channels);
    fillChoices(refs.source, sources, DEFAULT_SOURCE);
    fillChoices(refs.contentChoice, contents);
    // A department, then its divisions right after it ("Health and Human Services: Public Health").
    agencies.forEach(({ value, name, divisions = [] }) => {
      refs.agency.append(new Option(name, value));
      divisions.forEach((division) => {
        refs.agency.append(new Option(`${name}: ${division.name}`, `${value}/${division.value}`));
      });
    });
    // Only Brand Center logos for now. The upload code stays, switched off.
    const upload = refs.logoChoice.querySelector(`option[value="${LOGO_UPLOAD_VALUE}"]`);
    if (!FEATURES.logoUpload) {
      upload.remove();
    } else {
      refs.logoHelp.textContent = "Shown in the middle of the QR code. Pick a Marin logo or upload a PNG, JPG, or WebP file.";
    }
    renderLogoOptions();
    fillChoices(refs.campaignChoice, campaigns);
  }

  // Lowercase words joined by hyphens, so "Fall Flu 2026" and "fall-flu-2026" count together.
  // The value a field gives: the chosen list item, or the typed new value in hyphen form.
  function choiceValue(select, input) {
    return select.value === NEW_VALUE ? normalizeCampaign(input.value) : select.value;
  }

  function normalizeCampaign(text) {
    return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function collectParameters() {
    const parameters = [];
    const seenNames = new Set();
    let valid = true;

    const addChoice = (name, value) => {
      if (!value) return;
      parameters.push({ name, value });
      seenNames.add(name);
    };
    addChoice("utm_medium", choiceValue(refs.channel, refs.channelNew));
    addChoice("utm_source", choiceValue(refs.source, refs.sourceNew) || DEFAULT_SOURCE);
    addChoice("utm_campaign", choiceValue(refs.campaignChoice, refs.campaign));
    if (refs.agency.value) {
      // A division is stored as "agency/division". The agency label always carries the whole department.
      const [agency, division] = refs.agency.value.split("/");
      parameters.push({ name: "agency", value: agency });
      seenNames.add("agency");
      if (division) {
        parameters.push({ name: "division", value: division });
        seenNames.add("division");
      }
    }
    // Lets Stats tell printed QR codes apart from shared links.
    parameters.push({ name: "via", value: isQrMode() ? "qr" : "link" });
    seenNames.add("via");
    // The send date goes in front of the content value (YYMMDD, like 261023-poster-a).
    const dateCode = refs.date.value ? refs.date.value.replaceAll("-", "").slice(2) : "";
    addChoice("utm_content", [dateCode, choiceValue(refs.contentChoice, refs.content)].filter(Boolean).join("-"));

    refs.parameterList.querySelectorAll(".qr-parameter-row").forEach((row) => {
      const selection = row.dataset.parameterSelection || DEFAULT_PARAMETER_NAME;
      const customInput = row.querySelector(".qr-custom-parameter-input");
      const valueInput = row.querySelector(".qr-parameter-value");
      const valueSelect = row.querySelector(".qr-parameter-value-choice");
      const trigger = row.querySelector(".qr-parameter-picker__trigger");
      const customName = customInput.value.trim();
      const choosing = VALUE_OPTIONS[selection] && valueSelect.value !== OTHER_VALUE;
      const value = (choosing ? valueSelect.value : valueInput.value).trim();
      const engaged = row.dataset.parameterEngaged === "true" || Boolean(customName || value);

      clearParameterRowError(row);
      if (!engaged && !customName && !value) return;

      let name = selection;
      if (selection === CUSTOM_PARAMETER_VALUE) {
        name = customName;
        if (!name) {
          setParameterRowError(row, [customInput], "Type a name for this tracking detail.");
          valid = false;
          return;
        }
        if (
          name.length > MAX_CUSTOM_PARAMETER_NAME_LENGTH
          || !CUSTOM_PARAMETER_NAME_PATTERN.test(name)
        ) {
          setParameterRowError(
            row,
            [customInput],
            "Use letters, numbers, underscores, hyphens, periods, or tildes."
          );
          valid = false;
          return;
        }
      }

      if (!choosing && PERSONAL_VALUE_PATTERN.test(value)) {
        setParameterRowError(row, [valueInput], "This looks like an email address or phone number. Use a code instead.");
        valid = false;
        return;
      }

      if (!value) {
        setParameterRowError(row, [choosing ? valueSelect : valueInput], "Add a value for this tracking detail.");
        valid = false;
        return;
      }

      if (seenNames.has(name)) {
        setParameterRowError(row, [trigger, customInput], "Use each tracking detail name only once.");
        valid = false;
        return;
      }

      seenNames.add(name);
      parameters.push({ name, value });
    });

    return { valid, parameters };
  }

  function showEmpty(message) {
    state.finalUrl = "";
    state.renderResult = null;
    refs.previewEmpty.textContent = message;
    refs.previewEmpty.hidden = false;
    refs.previewReady.hidden = true;
    refs.canvas.removeAttribute("data-qr-ready");
    refs.canvas.removeAttribute("data-final-url");
    refs.canvas.removeAttribute("data-qr-version");
    refs.canvas.removeAttribute("data-qr-module-count");
    refs.canvas.removeAttribute("data-logo-image-width-modules");
    refs.canvas.removeAttribute("data-logo-image-height-modules");
    refs.canvas.removeAttribute("data-logo-backing-width-modules");
    refs.canvas.removeAttribute("data-logo-backing-height-modules");
    refs.canvas.removeAttribute("data-logo-safety-usage");
    refs.canvas.removeAttribute("data-transparent-background");
    refs.canvasFrame.removeAttribute("data-transparent");
    refs.finalUrl.value = "";
    refs.finalUrl.textContent = "";
    refs.copyLink.dataset.copyValue = "";
    state.bulkRows = [];
    refs.bulkCopy.dataset.copyValue = "";
    refs.bulkCopy.disabled = true;
    refs.bulkCsv.disabled = true;
    setExportActionsEnabled(false);
    syncDownloadControls();
  }

  function buildQrModel(finalUrl) {
    const qr = new window.MarinQrCode.QRCode(
      -1,
      window.MarinQrCode.QRErrorCorrectLevel.H
    );
    qr.addData(finalUrl);
    qr.make();
    return window.MarinQrSafety.createModel(
      qr,
      window.MarinQrCode.QRErrorCorrectLevel.H
    );
  }

  // The page address for printing: no scheme, labels, or fragment; words in the path joined in camel case.
  function addressCaption(url) {
    const camel = (segment) => {
      const words = segment.split(/[-_\s]+/).filter(Boolean);
      return words.map((word, index) => {
        const lower = word.toLowerCase();
        return index ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
      }).join("");
    };
    const path = url.pathname.split("/").filter(Boolean).map((segment) => camel(decodeURIComponent(segment))).join("/");
    return `${url.hostname}${path ? `/${path}` : ""}`;
  }

  const CAPTION_COLOR = "#1f1f1f";

  // A PNG with the address in a strip under the code.
  function withCaptionCanvas(source, text, transparentBackground) {
    const width = source.width;
    let size = Math.round(width * 0.045);
    const probe = document.createElement("canvas").getContext("2d");
    const font = (px) => `700 ${px}px "Open Sans", Arial, sans-serif`;
    probe.font = font(size);
    const available = width * 0.92;
    const measured = probe.measureText(text).width;
    if (measured > available) size = Math.max(8, Math.floor(size * available / measured));
    const strip = Math.round(size * 2.4);
    const out = document.createElement("canvas");
    out.width = width;
    out.height = source.height + strip;
    const context = out.getContext("2d");
    if (!transparentBackground) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, out.width, out.height);
    }
    context.drawImage(source, 0, 0);
    context.fillStyle = CAPTION_COLOR;
    context.font = font(size);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, source.height + strip / 2);
    return out;
  }

  // The same strip for SVG: the picture gets taller and the text sits in the new space.
  function withCaptionSvg(svg, text, transparentBackground) {
    const match = svg.match(/viewBox="0 0 (\d+) (\d+)" width="(\d+)" height="(\d+)"/);
    if (!match) return svg;
    const [whole, modules, , width, height] = match;
    const total = Number(modules);
    const strip = 3;
    const newHeight = Math.round(Number(height) * (total + strip) / total);
    const size = Math.min(1.7, (total * 0.92) / (text.length * 0.62));
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const extra = [
      transparentBackground ? "" : `  <rect id="qr-address-background" y="${total}" width="${total}" height="${strip}" fill="#ffffff"/>`,
      `  <text id="qr-address" x="${total / 2}" y="${total + strip / 2}" font-family="Open Sans, Arial, sans-serif" font-weight="700" font-size="${size.toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="${CAPTION_COLOR}">${escaped}</text>`
    ].filter(Boolean).join("\n");
    return svg
      .replace(whole, `viewBox="0 0 ${total} ${total + strip}" width="${width}" height="${newHeight}"`)
      .replace("</svg>", `${extra}\n</svg>`);
  }

  function renderQr(model, color, logoPlan = null, transparentBackground = false, address = "") {
    window.MarinQrSafety.render(
      refs.canvas,
      model,
      color,
      state.logo?.prepared || null,
      logoPlan,
      TARGET_PNG_SIZE,
      { transparentBackground }
    );

    // The address is part of the picture, in the preview as in the downloads.
    if (address) {
      const captioned = withCaptionCanvas(refs.canvas, address, transparentBackground);
      refs.canvas.width = captioned.width;
      refs.canvas.height = captioned.height;
      refs.canvas.getContext("2d").drawImage(captioned, 0, 0);
    }

    refs.canvas.setAttribute("aria-label", address
      ? `QR code for the final link shown below, with the address ${address} under it.`
      : "QR code for the final link shown below.");
    refs.canvas.dataset.transparentBackground = transparentBackground ? "true" : "false";
    refs.canvasFrame.dataset.transparent = transparentBackground ? "true" : "false";
    refs.canvas.dataset.qrReady = "true";
    refs.canvas.dataset.qrVersion = String(model.typeNumber);
    refs.canvas.dataset.qrModuleCount = String(model.moduleCount);
    if (logoPlan) {
      refs.canvas.dataset.logoImageWidthModules = logoPlan.imageWidth.toFixed(2);
      refs.canvas.dataset.logoImageHeightModules = logoPlan.imageHeight.toFixed(2);
      refs.canvas.dataset.logoBackingWidthModules = logoPlan.backingWidth.toFixed(2);
      refs.canvas.dataset.logoBackingHeightModules = logoPlan.backingHeight.toFixed(2);
      refs.canvas.dataset.logoSafetyUsage = logoPlan.verification.maximumUsage.toFixed(3);
    } else {
      refs.canvas.removeAttribute("data-logo-image-width-modules");
      refs.canvas.removeAttribute("data-logo-image-height-modules");
      refs.canvas.removeAttribute("data-logo-backing-width-modules");
      refs.canvas.removeAttribute("data-logo-backing-height-modules");
      refs.canvas.removeAttribute("data-logo-safety-usage");
    }
  }

  async function updatePreview() {
    cancelScheduledUpdate();
    if (isShortMode()) void checkShortAvailability();
    state.shortCandidate = null;
    refs.previewCard.dataset.shortMode = String(isShortMode());
    if (isBulkMode()) {
      state.generationToken += 1;
      state.generating = false;
      refs.previewCard.removeAttribute("aria-busy");
      updateBulk();
      return;
    }
    const token = ++state.generationToken;
    state.generating = true;
    setExportActionsEnabled(false);

    try {
      const destination = parseDestination(refs.destination.value);
      if (destination.error) {
        setFieldError(refs.destination, refs.destinationError, destination.error);
      } else {
        clearFieldError(refs.destination, refs.destinationError);
      }

      const qr = isQrMode();
      const color = qr ? validateColor() : "#000000";
      const transparentBackground = qr && refs.transparentBackground.checked;
      const parameterResult = collectParameters();

      if (destination.empty) {
        showEmpty(emptyMessage());
        return;
      }

      if (destination.error || !color || !parameterResult.valid) {
        showEmpty(qr ? "Fix the fields to make a QR code." : "Fix the fields to make a link.");
        return;
      }

      const final = new URL(destination.url.href);
      parameterResult.parameters.forEach(({ name, value }) => {
        final.searchParams.append(name, value);
      });
      refs.showAddress.disabled = isShortMode();
      let finalUrl;
      if (isShortMode()) {
        finalUrl = showShortCandidate(shortPayload(final.href, parameterResult.parameters), color, transparentBackground);
        if (!finalUrl) {
          showEmpty("Review the web address, then choose Create short link.");
          refs.shortActions.hidden = false;
          displayPriorShort();
          return;
        }
      } else {
        state.shortCandidate = null;
        refs.shortActions.hidden = true;
        refs.shortPrior.hidden = true;
        finalUrl = buildTrackedUrl(final.href);
      }

      // A confirmed Short QR prints the Short URL itself. Long QR codes may print the destination page.
      let address = "";
      if (qr && isShortMode()) address = finalUrl.replace(/^https?:\/\//, "");
      else if (qr && refs.showAddress.checked) address = addressCaption(destination.url);

      if (!qr) {
        state.finalUrl = finalUrl;
        state.renderResult = null;
        showLink(finalUrl);
        return;
      }

      showEmpty(state.logo ? "Checking the logo…" : "Making your QR code…");
      refs.previewCard.setAttribute("aria-busy", "true");

      let model;
      let logoPlan = null;
      try {
        model = buildQrModel(finalUrl);
        if (state.logo) {
          clearFieldError(refs.logoChoice, refs.imageError);
          logoPlan = await window.MarinQrSafety.findLargestLogoPlan(
            model,
            state.logo.prepared,
            color,
            { shouldCancel: () => token !== state.generationToken }
          );
          if (token !== state.generationToken) return;
          if (!logoPlan) {
            setFieldError(
              refs.imageInput,
              refs.imageError,
              "This logo does not work well with this QR code. Try a shorter link or another logo."
            );
            showEmpty("Try another logo to make this QR code.");
            return;
          }
        }

        renderQr(model, color, logoPlan, transparentBackground, address);
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error(error);
        const message = /overflow|code length|bad rs block/i.test(String(error))
          ? "This link is too long for a QR code. Shorten the link or remove tracking details."
          : "Marin Links could not make this code. Check the link and try again.";
        setFieldError(refs.destination, refs.destinationError, message);
        showEmpty("Fix the web address to make a QR code.");
        return;
      }

      if (token !== state.generationToken) return;
      state.finalUrl = finalUrl;
      state.renderResult = Object.freeze({
        model,
        color,
        preparedImage: state.logo?.prepared || null,
        logoPlan,
        transparentBackground,
        finalUrl,
        address
      });
      refs.canvas.dataset.finalUrl = finalUrl;
      showPrintAdvice(model);
      showLink(finalUrl);
    } finally {
      if (token === state.generationToken) {
        state.generating = false;
        refs.previewCard.removeAttribute("aria-busy");
        setExportActionsEnabled(Boolean(state.finalUrl));
      }
    }
  }

  // ---- Many links ----

  const MAX_BULK_LINES = 100;

  // Each line can be a plain address, or a spreadsheet row (the first address in it is used).
  function pickAddress(line) {
    const cells = line.split(/[\t,;]/).map((cell) => cell.trim().replace(/^"|"$/g, "").trim()).filter(Boolean);
    return cells.find((cell) => /^https?:\/\//i.test(cell)) || cells[0] || "";
  }

  function updateBulk() {
    if (isShortMode()) {
      updateShortBulk();
      return;
    }
    refs.shortBulkActions.hidden = true;
    refs.shortBulkPrior.hidden = true;
    clearFieldError(refs.bulkUrls, refs.bulkError);
    const addresses = refs.bulkUrls.value.split(/\r?\n/).map(pickAddress).filter(Boolean);
    if (!addresses.length) {
      showEmpty(emptyMessage());
      return;
    }
    if (addresses.length > MAX_BULK_LINES) {
      setFieldError(refs.bulkUrls, refs.bulkError, `Use up to ${MAX_BULK_LINES} web addresses at a time. You entered ${addresses.length}.`);
      showEmpty("Use fewer web addresses to make links.");
      return;
    }
    const parameterResult = collectParameters();
    if (!parameterResult.valid) {
      showEmpty("Fix the tracking fields to make links.");
      return;
    }

    state.bulkRows = addresses.map((address) => {
      const destination = parseDestination(address);
      if (destination.error) return { address, link: "", problem: destination.error };
      const final = new URL(destination.url.href);
      parameterResult.parameters.forEach(({ name, value }) => final.searchParams.append(name, value));
      return { address, link: buildTrackedUrl(final.href), problem: "" };
    });

    refs.bulkRowsBody.textContent = "";
    state.bulkRows.forEach((row) => {
      const tr = document.createElement("tr");
      const address = document.createElement("td");
      address.textContent = row.address;
      const link = document.createElement("td");
      if (row.problem) {
        const problem = document.createElement("span");
        problem.className = "app-error";
        problem.textContent = row.problem;
        link.append(problem);
      } else {
        link.className = "qr-bulk-link";
        link.textContent = row.link;
      }
      const status = document.createElement("td");
      status.textContent = row.problem ? "Needs correction" : "Created";
      tr.append(address, link, status);
      refs.bulkRowsBody.append(tr);
    });

    const made = state.bulkRows.filter((row) => !row.problem);
    refs.bulkSummary.textContent = made.length === state.bulkRows.length
      ? `${made.length} ${made.length === 1 ? "link" : "links"} made.`
      : `${made.length} of ${state.bulkRows.length} links made. Fix the ones that show a problem.`;
    refs.bulkCopy.dataset.copyValue = made.map((row) => row.link).join("\n");
    refs.bulkCopy.disabled = made.length === 0;
    refs.bulkCsv.disabled = state.bulkRows.length === 0;
    refs.previewEmpty.hidden = true;
    refs.previewReady.hidden = false;
  }

  // ---- Registered short links: one explicit request per row ----

  function prepareShortBulk() {
    clearFieldError(refs.bulkUrls, refs.bulkError);
    const addresses = refs.bulkUrls.value.split(/\r?\n/).map(pickAddress).filter(Boolean);
    if (!addresses.length) return null;
    if (addresses.length > MAX_BULK_LINES) {
      setFieldError(refs.bulkUrls, refs.bulkError, `Use up to ${MAX_BULK_LINES} web addresses at a time. You entered ${addresses.length}.`);
      return null;
    }
    const parameters = collectParameters();
    if (!parameters.valid) return null;
    const rows = addresses.map((address) => {
      const parsed = parseDestination(address);
      if (parsed.error || parsed.empty) return { address, destination: "", link: "", status: "Needs correction", problem: parsed.error || "Enter a web address.", payload: null, key: null };
      const url = new URL(parsed.url.href);
      parameters.parameters.forEach(({ name, value }) => url.searchParams.append(name, value));
      return { address, destination: url.href, link: "", status: "Waiting", problem: "", payload: shortPayload(url.href, parameters.parameters), key: null };
    });
    return { signature: JSON.stringify(rows.map((row) => [row.address, row.destination, row.payload])), rows, started: false, running: false, completed: false, stopRequested: false, reason: "" };
  }

  function showPriorBatch() {
    const previous = state.previousShortBatch;
    const links = previous?.rows.filter((row) => row.status === "Created" && row.link).map((row) => row.link) || [];
    refs.shortBulkPrior.hidden = !isShortMode() || !isBulkMode() || links.length === 0;
    if (links.length) {
      refs.shortBulkPrior.querySelector("p").textContent = `${links.length} short links from your previous batch. These do not match the current form.`;
      refs.previousBulkCopy.dataset.copyValue = links.join("\n");
    }
  }

  function renderShortBulk() {
    const batch = state.shortBatch;
    if (!batch) return;
    const created = batch.rows.filter((row) => row.status === "Created" && row.link);
    const valid = batch.rows.filter((row) => row.payload);
    refs.bulkRowsBody.textContent = "";
    batch.rows.forEach((row) => {
      const tr = document.createElement("tr");
      const address = document.createElement("td");
      address.textContent = row.address;
      const link = document.createElement("td");
      if (row.link) {
        link.textContent = row.link;
        link.className = "qr-bulk-link";
      } else link.textContent = "—";
      const status = document.createElement("td");
      const label = document.createElement("span");
      label.textContent = row.status;
      label.className = "short-row-status";
      status.append(label);
      if (row.problem) {
        const problem = document.createElement("p");
        problem.className = "app-help-text";
        problem.textContent = row.problem;
        status.append(problem);
      }
      tr.append(address, link, status);
      refs.bulkRowsBody.append(tr);
    });
    state.bulkRows = batch.rows;
    refs.bulkCopy.dataset.copyValue = created.map((row) => row.link).join("\n");
    refs.bulkCopy.disabled = created.length === 0;
    refs.bulkCsv.disabled = false;
    refs.bulkSummary.textContent = batch.started
      ? `${created.length} of ${valid.length} eligible short links created.`
      : `${batch.rows.length} rows: ${valid.length} ready, ${batch.rows.length - valid.length} need correction. Each saved link counts toward County system limits.`;
    refs.shortBulkProgress.textContent = batch.running
      ? `Created ${created.length} of ${valid.length}. ${batch.reason}`
      : (batch.reason || `${created.length} created. ${batch.rows.filter((row) => row.status === "Not attempted").length} not attempted.`);
    refs.shortBulkCreate.hidden = batch.started;
    refs.shortBulkCreate.disabled = batch.running || valid.length === 0 || state.shortCreationUnavailable;
    refs.shortBulkRetry.hidden = !batch.started || batch.running || !batch.rows.some((row) => ["Waiting", "Not attempted", "Unknown—retry safely", "Rate limited"].includes(row.status));
    refs.shortBulkStop.hidden = !batch.running;
    refs.shortBulkStop.disabled = Boolean(batch.stopRequested);
    refs.previewEmpty.hidden = true;
    refs.previewReady.hidden = false;
    refs.shortBulkActions.hidden = false;
    renderShortAvailability();
    showPriorBatch();
  }

  function updateShortBulk() {
    const candidate = prepareShortBulk();
    refs.shortActions.hidden = true;
    refs.shortPrior.hidden = true;
    if (!candidate) {
      state.bulkRows = [];
      showEmpty(refs.bulkUrls.value.trim() ? "Fix the web addresses or tracking details before creating short links." : emptyMessage());
      refs.shortBulkActions.hidden = true;
      showPriorBatch();
      return;
    }
    if (!state.shortBatch || candidate.signature !== state.shortBatch.signature) {
      if (state.shortBatch?.rows.some((row) => row.status === "Created" || row.status === "Unknown—retry safely")) {
        state.previousShortBatch = state.shortBatch;
      }
      state.shortBatch = candidate;
    }
    renderShortBulk();
  }

  function lockBulkInputs(locked) {
    if (locked) {
      state.shortBatchLocked = [...refs.form.querySelectorAll("input, select, textarea, button")].filter((input) => !input.disabled);
      state.shortBatchLocked.forEach((input) => { input.disabled = true; });
    } else {
      state.shortBatchLocked.forEach((input) => { input.disabled = false; });
      state.shortBatchLocked = [];
    }
  }

  async function createShortBatch(retry = false) {
    const batch = state.shortBatch;
    if (
      !isShortMode()
      || !isBulkMode()
      || !batch
      || state.updateTimer
      || batch.running
      || state.shortCreationUnavailable
      || (!retry && batch.started)
    ) return;
    const epoch = state.shortEpoch;
    batch.started = true;
    batch.completed = false;
    batch.running = true;
    batch.stopRequested = false;
    batch.reason = "Creating short links one at a time…";
    lockBulkInputs(true);
    renderShortBulk();
    try {
      for (const row of batch.rows) {
        if (!row.payload || row.status === "Created" || row.status === "Needs correction") continue;
        if (batch.stopRequested) break;
        if (!row.key) row.key = window.MarinLinksShortApi.requestKey();
        row.status = "Creating";
        row.problem = "";
        renderShortBulk();
        try {
          const result = await window.MarinLinksShortApi.create(
            row.payload,
            row.key,
            state.shortCanonicalBase || state.shortCapabilities?.short_url_base_url || window.MarinLinksTracker.serverRoot
          );
          if (epoch !== state.shortEpoch) break;
          row.link = result.shortUrl;
          row.status = "Created";
        } catch (error) {
          if (epoch !== state.shortEpoch) break;
          row.problem = error.message || "The County system could not create this link.";
          if (error.uncertain) {
            row.status = "Unknown—retry safely";
            batch.reason = "The last request may have worked. Retry remaining without changing the list.";
            batch.stopRequested = true;
          } else if (error.status === 429) {
            row.status = "Rate limited";
            batch.reason = "Too many short links were requested. Try again later. Links already made are kept.";
            batch.stopRequested = true;
          } else if (error.stopBatch) {
            row.status = "Not attempted";
            batch.reason = error.message;
            batch.stopRequested = true;
          } else {
            row.status = "Needs correction";
          }
        }
        renderShortBulk();
      }
      if (batch.stopRequested) {
        batch.rows.filter((row) => row.status === "Waiting").forEach((row) => { row.status = "Not attempted"; });
        if (!batch.reason || batch.reason.includes("one at a time")) batch.reason = "Stopped. Links already made are kept. Retry remaining when ready.";
      } else batch.reason = "Finished. You can copy or download the short links.";
    } finally {
      batch.running = false;
      batch.completed = true;
      lockBulkInputs(false);
      if (epoch === state.shortEpoch) {
        renderShortBulk();
        announce(batch.reason);
      }
    }
  }

  function downloadPreviousBulkCsv() {
    if (state.previousShortBatch) saveBulkCsv(state.previousShortBatch.rows, "marin-links-previous-batch.csv");
  }

  // A cell that starts with = + - or @ could run as a formula in a spreadsheet, so it gets a leading apostrophe.
  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function saveBulkCsv(entries, filename) {
    const rows = [["Web address", "Your link", "Status", "Problem"], ...entries.map((row) => [row.address, row.link || "", row.status || (row.problem ? "Needs correction" : "Created"), row.problem || ""])];
    const text = rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    saveBlob(new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }), filename);
    announce("CSV downloaded.");
  }

  function downloadBulkCsv() {
    if (state.bulkRows.length) saveBulkCsv(state.bulkRows, "marin-links.csv");
  }

  // How small the code can be printed, and a note when it is crowded. Each square should be about half a millimeter.
  function showPrintAdvice(model) {
    const squaresAcross = model.moduleCount + (QUIET_ZONE_MODULES * 2);
    const minimumInches = Math.ceil(squaresAcross * MIN_MODULE_INCHES * 10) / 10;
    let text = `Print this code at least ${minimumInches} inches wide.`;
    if (model.typeNumber >= DENSE_QR_VERSION) {
      text += " This code is crowded. A shorter link or fewer tracking details makes it easier to scan.";
    }
    refs.sizeNote.textContent = text;
    refs.sizeNote.dataset.dense = String(model.typeNumber >= DENSE_QR_VERSION);

    // Sizes that are too small for this code cannot be picked.
    let firstUsable = null;
    [...refs.downloadSize.options].forEach((option) => {
      const tooSmall = Number(option.value) < minimumInches;
      option.disabled = tooSmall;
      option.textContent = option.textContent.replace(/ – too small$/, "") + (tooSmall ? " – too small" : "");
      if (!tooSmall && firstUsable === null) firstUsable = option;
    });
    if (refs.downloadSize.selectedOptions[0]?.disabled && firstUsable) refs.downloadSize.value = firstUsable.value;
    state.minimumInches = minimumInches;
    syncDownloadControls();
  }

  // The size only matters for PNG. SVG stays sharp at any size.
  function syncDownloadControls() {
    refs.downloadSize.hidden = refs.downloadFormat.value === "svg";
    refs.sizeNote.hidden = !isQrMode() || !state.finalUrl;
  }

  function showLink(finalUrl) {
    refs.finalUrl.value = finalUrl;
    refs.finalUrl.textContent = finalUrl;
    refs.copyLink.dataset.copyValue = finalUrl;
    refs.previewEmpty.hidden = true;
    refs.previewReady.hidden = false;
  }

  function scheduleUpdate() {
    cancelScheduledUpdate();
    refs.shortActions.hidden = true;
    refs.shortBulkActions.hidden = true;
    state.shortCandidate = null;
    refs.previewCard.dataset.shortMode = String(isShortMode());
    state.generationToken += 1;
    state.generating = false;
    refs.previewCard.removeAttribute("aria-busy");
    showEmpty("Checking your changes…");
    state.updateTimer = window.setTimeout(() => {
      state.updateTimer = null;
      void updatePreview();
    }, 300);
  }

  function canvasToBlob(canvas = refs.canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The PNG file could not be made."));
      }, "image/png");
    });
  }

  function svgToBlob() {
    const result = state.renderResult;
    if (!result) throw new Error("The SVG file could not be made.");
    const svg = window.MarinQrSafety.toSvg(
      result.model,
      result.color,
      result.preparedImage,
      result.logoPlan,
      {
        transparentBackground: result.transparentBackground,
        finalUrl: result.finalUrl
      }
    );
    const finished = result.address ? withCaptionSvg(svg, result.address, result.transparentBackground) : svg;
    return new Blob([finished], { type: "image/svg+xml;charset=utf-8" });
  }

  function saveBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  // One button saves the file type chosen next to it.
  async function download() {
    if (!state.finalUrl) return;
    const format = refs.downloadFormat.value === "svg" ? "svg" : "png";
    refs.download.setAttribute("aria-busy", "true");
    refs.download.disabled = true;

    try {
      if (format === "svg") {
        saveBlob(svgToBlob(), "marin-links.svg");
      } else {
        // PNG is made at the chosen print size, 300 pixels to the inch.
        const inches = Number(refs.downloadSize.value) || 6;
        const result = state.renderResult;
        const canvas = document.createElement("canvas");
        window.MarinQrSafety.render(
          canvas,
          result.model,
          result.color,
          result.preparedImage,
          result.logoPlan,
          Math.round(inches * PRINT_DPI),
          { transparentBackground: result.transparentBackground }
        );
        const finished = result.address ? withCaptionCanvas(canvas, result.address, result.transparentBackground) : canvas;
        saveBlob(await canvasToBlob(finished), `marin-links-${inches}in.png`);
      }
      announce(`${format.toUpperCase()} downloaded.`);
    } catch (error) {
      console.error(error);
      announce(`The ${format.toUpperCase()} could not be downloaded. Try again.`);
    } finally {
      refs.download.removeAttribute("aria-busy");
      refs.download.disabled = !exportsAreReady();
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result), { once: true });
      reader.addEventListener("error", () => reject(new Error("The image could not be read.")), { once: true });
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      // Brand Center logos come from another address. This lets the page read their pixels.
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error("The image could not be opened.")), { once: true });
      image.src = dataUrl;
    });
  }

  function clearImageChoice() {
    state.logo = null;
    refs.imageInput.value = "";
    refs.imagePreview.removeAttribute("src");
    refs.imageName.textContent = "";
    refs.imageChoice.hidden = true;
  }

  async function handleImageChoice() {
    const file = refs.imageInput.files?.[0];
    if (!file) return;

    const token = ++state.imageToken;
    state.generationToken += 1;
    state.generating = false;
    refs.previewCard.removeAttribute("aria-busy");
    clearFieldError(refs.logoChoice, refs.imageError);
    setExportActionsEnabled(false);
    showEmpty("Reading the logo…");
    refs.previewCard.setAttribute("aria-busy", "true");

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      clearImageChoice();
      setFieldError(refs.logoChoice, refs.imageError, "Choose a PNG, JPG, or WebP image.");
      void updatePreview();
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      clearImageChoice();
      setFieldError(refs.logoChoice, refs.imageError, "Choose an image smaller than 2 MB.");
      void updatePreview();
      return;
    }

    refs.imageInput.setAttribute("aria-busy", "true");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(dataUrl);
      if (token !== state.imageToken) return;

      if (image.naturalWidth > MAX_IMAGE_SIDE || image.naturalHeight > MAX_IMAGE_SIDE) {
        clearImageChoice();
        setFieldError(refs.logoChoice, refs.imageError, "Choose an image that is no more than 4,096 pixels wide or tall.");
        void updatePreview();
        return;
      }

      const prepared = window.MarinQrImage.prepare(image);
      state.logo = { image, prepared, dataUrl, name: file.name };
      refs.imagePreview.src = dataUrl;
      refs.imageName.textContent = file.name;
      refs.imageChoice.hidden = false;
      clearFieldError(refs.logoChoice, refs.imageError);
      void updatePreview();
      announce("Logo added.");
    } catch (error) {
      console.error(error);
      if (token !== state.imageToken) return;
      clearImageChoice();
      const message = /blank|visible size/i.test(String(error))
        ? "Choose an image with something visible in it."
        : "This image could not be opened. Choose another file.";
      setFieldError(refs.logoChoice, refs.imageError, message);
      void updatePreview();
    } finally {
      if (token === state.imageToken) refs.imageInput.removeAttribute("aria-busy");
    }
  }

  function removeImage() {
    state.imageToken += 1;
    state.generationToken += 1;
    clearImageChoice();
    clearFieldError(refs.logoChoice, refs.imageError);
    refs.logoChoice.value = "";
    refs.logoUploadField.hidden = true;
    void updatePreview();
    announce("Logo removed.");
    refs.logoChoice.focus();
  }

  // A Marin logo from the Brand Center. It follows the same checks as an upload.
  async function useBrandLogo(entry) {
    const token = ++state.imageToken;
    state.generationToken += 1;
    state.generating = false;
    refs.previewCard.removeAttribute("aria-busy");
    clearFieldError(refs.logoChoice, refs.imageError);
    setExportActionsEnabled(false);
    showEmpty("Reading the logo…");
    refs.previewCard.setAttribute("aria-busy", "true");

    try {
      const image = await loadImage(entry.file);
      if (token !== state.imageToken) return;
      state.logo = { image, prepared: window.MarinQrImage.prepare(image), dataUrl: entry.file, name: entry.name };
      refs.imagePreview.src = entry.file;
      refs.imageName.textContent = entry.name;
      refs.imageChoice.hidden = false;
      void updatePreview();
      announce("Logo added.");
    } catch (error) {
      console.error(error);
      if (token !== state.imageToken) return;
      clearImageChoice();
      setFieldError(refs.logoChoice, refs.imageError, "This logo could not be loaded. Check your connection or choose another one.");
      void updatePreview();
    }
  }

  function handleLogoChoice() {
    const choice = refs.logoChoice.value;
    refs.logoUploadField.hidden = choice !== LOGO_UPLOAD_VALUE;
    clearFieldError(refs.logoChoice, refs.imageError);

    if (choice === LOGO_UPLOAD_VALUE) {
      // Wait for a file. Until then the code has no logo.
      state.imageToken += 1;
      clearImageChoice();
      scheduleUpdate();
      refs.uploadLogo.focus();
      return;
    }
    if (!choice) {
      state.imageToken += 1;
      clearImageChoice();
      scheduleUpdate();
      return;
    }
    const entry = state.logos.find((logo) => logo.value === choice);
    if (entry) void useBrandLogo(entry);
  }

  function newValueFields() {
    return [
      { select: refs.channel, field: refs.channelField, input: refs.channelNew },
      { select: refs.source, field: refs.sourceField, input: refs.sourceNew },
      { select: refs.campaignChoice, field: refs.campaignField, input: refs.campaign },
      { select: refs.contentChoice, field: refs.contentField, input: refs.content }
    ];
  }

  function syncNewValueFields() {
    newValueFields().forEach(({ select, field }) => {
      field.hidden = select.value !== NEW_VALUE;
    });
  }

  // The browser can bring back form choices after a refresh or Back. Read them, so the page matches what is shown.
  function syncFromForm() {
    state.mode = currentMode();
    applyMode();
    syncNewValueFields();

    // A chosen file cannot be restored, so an upload with no file goes back to None.
    if (refs.logoChoice.value === LOGO_UPLOAD_VALUE && !state.logo) refs.logoChoice.value = "";
    refs.logoUploadField.hidden = refs.logoChoice.value !== LOGO_UPLOAD_VALUE;
    if (refs.logoChoice.value && refs.logoChoice.value !== LOGO_UPLOAD_VALUE && !state.logo) {
      handleLogoChoice();
    }

    showEmpty(emptyMessage());
    if (refs.destination.value.trim() || refs.bulkUrls.value.trim()) void updatePreview();
  }

  function resetForm() {
    cancelScheduledUpdate();
    state.imageToken += 1;
    state.generationToken += 1;
    state.generating = false;
    state.shortEpoch += 1;
    state.shortSingle = null;
    state.shortCandidate = null;
    state.lastShortCompleted = null;
    state.shortBatch = null;
    state.previousShortBatch = null;
    refs.shortPrior.hidden = true;
    refs.shortBulkPrior.hidden = true;
    refs.previewCard.removeAttribute("aria-busy");

    refs.form.reset();
    clearFieldError(refs.destination, refs.destinationError);
    clearFieldError(refs.bulkUrls, refs.bulkError);
    state.mode = "link";
    applyMode();

    syncNewValueFields();
    state.openParameterPicker?.close(false);
    refs.parameterList.textContent = "";
    refs.addParameter.disabled = false;

    clearImageChoice();
    clearFieldError(refs.logoChoice, refs.imageError);
    refs.logoUploadField.hidden = true;

    showEmpty(emptyMessage());
    announce("Form reset.");
    refs.destination.focus();
  }

  function bindEvents() {
    refs.form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (isShortMode()) {
        if (isBulkMode()) void createShortBatch();
        else void createSingleShort();
      } else void updatePreview();
    });
    refs.shortCreate.addEventListener("click", () => void createSingleShort());
    refs.shortBulkCreate.addEventListener("click", () => void createShortBatch());
    refs.shortBulkStop.addEventListener("click", () => {
      if (state.shortBatch) state.shortBatch.stopRequested = true;
      refs.shortBulkStop.disabled = true;
      announce("Stopping after the current request.");
    });
    refs.shortBulkRetry.addEventListener("click", () => void createShortBatch(true));
    refs.previousBulkCsv.addEventListener("click", () => downloadPreviousBulkCsv());
    refs.destination.addEventListener("input", scheduleUpdate);
    refs.bulkUrls.addEventListener("input", scheduleUpdate);
    refs.bulkCopy.addEventListener("pointerdown", cancelScheduledUpdate);
    refs.bulkCsv.addEventListener("click", downloadBulkCsv);
    document.querySelectorAll('input[name="length"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        if (isShortMode()) void checkShortAvailability();
        scheduleUpdate();
      });
    });
    document.querySelectorAll('input[name="background"]').forEach((radio) => {
      radio.addEventListener("change", scheduleUpdate);
    });

    refs.color.addEventListener("input", () => {
      refs.colorText.value = refs.color.value.toLowerCase();
      clearFieldError(refs.colorText, refs.colorError);
      scheduleUpdate();
    });

    refs.colorText.addEventListener("input", () => {
      const color = normalizeHexColor(refs.colorText.value);
      if (color) refs.color.value = color;
      scheduleUpdate();
    });

    refs.colorText.addEventListener("blur", () => {
      const color = normalizeHexColor(refs.colorText.value);
      if (color) refs.colorText.value = color;
    });

    // Each of these lists ends with "Add a new one", which opens a field for the new value.
    newValueFields().forEach(({ select, field, input }) => {
      select.addEventListener("change", () => {
        field.hidden = select.value !== NEW_VALUE;
        if (select.value === NEW_VALUE) input.focus();
        scheduleUpdate();
      });
      input.addEventListener("input", scheduleUpdate);
    });
    refs.showAddress.addEventListener("change", scheduleUpdate);
    refs.agency.addEventListener("change", scheduleUpdate);
    refs.date.addEventListener("change", scheduleUpdate);
    refs.campaignChoice.addEventListener("change", () => {
      const choice = refs.campaignChoice.value;
      // A saved campaign can also fill in its usual channel and agency.
      const preset = window.MarinLinksPresets.campaigns.find((entry) => entry.value === choice);
      if (preset?.channel) refs.channel.value = preset.channel;
      if (preset?.agency) refs.agency.value = preset.agency;
      scheduleUpdate();
    });
    refs.addParameter.addEventListener("pointerdown", cancelScheduledUpdate);
    refs.addParameter.addEventListener("click", () => {
      addParameterRow(DEFAULT_PARAMETER_NAME, "", true);
      void updatePreview();
    });

    document.addEventListener("pointerdown", (event) => {
      const openPicker = state.openParameterPicker;
      if (openPicker && !openPicker.wrapper.contains(event.target)) {
        openPicker.close(false);
      }
    });
    refs.logoChoice.addEventListener("change", handleLogoChoice);
    refs.uploadLogo.addEventListener("click", () => refs.imageInput.click());
    refs.imageInput.addEventListener("change", () => handleImageChoice());
    refs.removeImage.addEventListener("click", () => removeImage());
    refs.outputs.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        state.mode = currentMode();
        applyMode();
        void updatePreview();
      });
    });
    refs.many.addEventListener("change", () => {
      state.mode = currentMode();
      applyMode();
      if (isBulkMode()) refs.bulkUrls.focus();
      else refs.destination.focus();
      void updatePreview();
    });
    refs.copyLink.addEventListener("pointerdown", cancelScheduledUpdate);
    refs.resetForm.addEventListener("click", resetForm);
    refs.download.addEventListener("click", download);
    refs.downloadFormat.addEventListener("change", syncDownloadControls);
  }

  function start() {
    refs = {
      form: byId("qr-form"),
      panelCreate: byId("panel-create"),
      many: byId("many-addresses"),
      manyField: byId("many-field"),
      singleUrlField: byId("single-url-field"),
      bulkUrlField: byId("bulk-url-field"),
      bulkUrls: byId("bulk-urls"),
      bulkError: byId("bulk-error"),
      singleResult: byId("single-result"),
      bulkResult: byId("bulk-result"),
      bulkSummary: byId("bulk-summary"),
      bulkRowsBody: byId("bulk-rows"),
      bulkCopy: byId("bulk-copy"),
      bulkCsv: byId("bulk-csv"),
      destination: byId("destination-url"),
      destinationError: byId("destination-error"),
      destinationMode: byId("destination-mode"),
      allowedWebsitesHelp: byId("allowed-websites-help"),
      parameterList: byId("parameter-list"),
      addParameter: byId("add-parameter"),
      channel: byId("tracking-channel"),
      channelField: byId("tracking-channel-field"),
      channelNew: byId("tracking-channel-new"),
      source: byId("tracking-source"),
      sourceField: byId("tracking-source-field"),
      sourceNew: byId("tracking-source-new"),
      contentChoice: byId("tracking-content-choice"),
      contentField: byId("tracking-content-field"),
      content: byId("tracking-content"),
      showAddress: byId("qr-show-address"),
      agency: byId("tracking-agency"),
      date: byId("tracking-date"),
      campaignChoice: byId("tracking-campaign-choice"),
      campaignField: byId("tracking-campaign-field"),
      campaign: byId("tracking-campaign"),
      colorField: byId("qr-color-field"),
      backgroundField: byId("background-field"),
      color: byId("qr-color"),
      colorText: byId("qr-color-text"),
      colorError: byId("color-error"),
      transparentBackground: byId("background-transparent"),
      imageInput: byId("center-image"),
      imageError: byId("image-error"),
      imageChoice: byId("image-choice"),
      imagePreview: byId("image-preview"),
      imageName: byId("image-name"),
      removeImage: byId("remove-image"),
      logoChoice: byId("logo-choice"),
      logoHelp: byId("image-help"),
      logoUploadField: byId("logo-upload-field"),
      uploadLogo: byId("upload-logo"),
      outputs: [...document.querySelectorAll('input[name="output"]')],
      designSection: byId("design-section"),
      scanNote: byId("scan-note"),
      copyLink: byId("copy-link-primary"),
      shortActions: byId("short-create-actions"),
      shortCreate: byId("short-create"),
      shortDestination: byId("short-destination"),
      shortStatus: byId("short-status"),
      shortAvailability: byId("short-availability"),
      shortBulkAvailability: byId("short-bulk-availability"),
      shortPrior: byId("short-prior"),
      shortPriorUrl: byId("short-prior-url"),
      shortPriorCopy: byId("short-prior-copy"),
      shortBulkActions: byId("short-bulk-actions"),
      shortBulkCreate: byId("short-bulk-create"),
      shortBulkRetry: byId("short-bulk-retry"),
      shortBulkStop: byId("short-bulk-stop"),
      shortBulkProgress: byId("short-bulk-progress"),
      shortBulkPrior: byId("short-bulk-prior"),
      previousBulkCopy: byId("short-bulk-prior-copy"),
      previousBulkCsv: byId("short-bulk-prior-csv"),
      resetForm: byId("reset-form"),
      previewCard: byId("qr-preview-card"),
      previewEmpty: byId("preview-empty"),
      previewReady: byId("preview-ready"),
      canvasFrame: byId("qr-canvas-frame"),
      canvas: byId("qr-canvas"),
      finalUrl: byId("final-url"),
      downloadGroup: byId("download-group"),
      downloadFormat: byId("download-format"),
      downloadSize: byId("download-size"),
      sizeNote: byId("size-note"),
      download: byId("download")
    };

    const configReady = Array.isArray(window.MarinQrAuthorizedDomains)
      && window.MarinQrAuthorizedDomains.length > 0;
    const libraryReady = Boolean(
      window.MarinQrCode?.QRCode
      && window.MarinQrCode?.QRErrorCorrectLevel
      && window.MarinQrCode?.QRRSBlock
      && window.MarinQrImage?.prepare
      && window.MarinLinksTracker?.endpoint
      && window.MarinLinksShortApi?.create
      && window.MarinLinksPresets?.agencies?.length
      && window.MarinQrSafety?.createModel
      && window.MarinQrSafety?.findLargestLogoPlan
      && window.MarinQrSafety?.render
      && window.MarinQrSafety?.toSvg
    );

    if (!configReady || !libraryReady) {
      console.error("Marin Links could not load its local settings or QR library.");
      showEmpty("Marin Links could not start. Reload the page.");
      refs.form.querySelectorAll("input, button").forEach((control) => {
        control.disabled = true;
      });
      return;
    }

    refs.colorField.hidden = !FEATURES.qrColorPicker;
    refs.backgroundField.hidden = !FEATURES.backgroundOption;
    refs.destinationMode.hidden = !allowAnyHttpsDestination;
    refs.allowedWebsitesHelp.hidden = allowAnyHttpsDestination;
    if (allowAnyHttpsDestination) {
      refs.destination.setAttribute("aria-describedby", "destination-mode destination-error");
    }
    bindEvents();
    fillPresetLists();
    syncFromForm();
    void loadBrandLogos();
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) syncFromForm();
    });
  }

  if (document.readyState === "complete") {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
