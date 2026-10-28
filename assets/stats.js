/*
 * Marin Links tabs and Stats
 * The Stats tab reads the County tracker's public, read-only API and draws
 * charts with the local Chart.js bundle. Public reports contain aggregate
 * counts only; no personal visitor records are requested.
 */

(() => {
  "use strict";

  const COLOR = "#0777cf";
  const COLOR_SECOND = "#e5b53b";
  const TOP_LIMIT = 10;
  const SUPPRESSED_MESSAGE = "Too few visits to show.";
  const EMPTY_MESSAGE = "No visits in this time.";
  const STATS_NOTE = "A visit is one time someone opens a link. Estimated visitors is a guess at how many people that was. It can count one person more than once. Some visits come from automated tools.";
  const DEFAULT_PARAMETER = "utm_source";
  const DEFAULT_PERIOD = "30";
  const VIA_LABELS = { qr: "QR codes", link: "Links" };

  const state = {
    tab: "create",
    loaded: false,
    token: 0,
    last: null,
    pendingLink: "",
    pendingParameter: "",
    report: "tracked",
    shortCode: "",
    shortBase: window.MarinLinksTracker?.serverRoot || "",
    shortLast: null,
    charts: {}
  };

  let refs;

  function byId(id) {
    return document.getElementById(id);
  }

  // ---- Tabs ----

  function selectTab(name, { focus = false, replaceUrl = true } = {}) {
    state.tab = name;
    const stats = name === "stats";
    refs.tabCreate.setAttribute("aria-selected", String(!stats));
    refs.tabStats.setAttribute("aria-selected", String(stats));
    refs.tabCreate.tabIndex = stats ? -1 : 0;
    refs.tabStats.tabIndex = stats ? 0 : -1;
    refs.panelCreate.hidden = stats;
    refs.panelStats.hidden = !stats;
    if (focus) (stats ? refs.tabStats : refs.tabCreate).focus();

    if (replaceUrl) syncUrl();

    if (stats && !state.loaded) {
      state.loaded = true;
      void loadStats();
    }
  }

  // The address carries the tab and the Stats choices, so it can be shared.
  const STATS_PARAMETERS = ["period", "agency", "link", "detail", "report", "code"];

  function statsAddress() {
    const params = new URLSearchParams(window.location.search);
    params.set("view", "stats");
    if (refs.period.value !== DEFAULT_PERIOD) params.set("period", refs.period.value); else params.delete("period");
    if (state.report === "short") {
      params.set("report", "short");
      params.delete("agency");
      params.delete("link");
      params.delete("detail");
      if (state.shortCode) params.set("code", state.shortCode); else params.delete("code");
    } else {
      params.delete("report");
      params.delete("code");
      if (refs.agency.value) params.set("agency", refs.agency.value); else params.delete("agency");
      const link = refs.link.value || state.pendingLink;
      if (link) params.set("link", link); else params.delete("link");
      const detail = refs.parameter.value || state.pendingParameter;
      if (detail) params.set("detail", detail); else params.delete("detail");
    }
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }

  function syncUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (state.tab === "stats") {
        const address = new URL(statsAddress());
        refs.copyLink.dataset.copyValue = address.href;
        window.history.replaceState(null, "", `${address.pathname}${address.search}${window.location.hash}`);
      } else {
        params.delete("view");
        STATS_PARAMETERS.forEach((name) => params.delete(name));
        const query = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      }
    } catch (error) {
      // The tab still works without a shareable address.
    }
  }

  function bindTabs() {
    refs.tabCreate.addEventListener("click", () => selectTab("create"));
    refs.tabStats.addEventListener("click", () => selectTab("stats"));
    refs.tabs.addEventListener("keydown", (event) => {
      const keys = { ArrowLeft: "create", ArrowRight: "stats", Home: "create", End: "stats" };
      const next = keys[event.key];
      if (!next) return;
      event.preventDefault();
      selectTab(next, { focus: true });
    });
  }

  // ---- Tracker API ----

  function utcDate(offsetDays = 0) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  }

  async function getJson(path, params = {}) {
    const url = new URL(path, window.MarinLinksTracker.apiBase);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, value);
    });
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) {
      const error = new Error(`The tracker answered ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    try {
      return await response.json();
    } catch {
      const error = new Error("The tracker sent a result the app could not read.");
      error.status = response.status;
      throw error;
    }
  }

  // Only visits from the chosen agency are counted when one is picked.
  function agencyFilter() {
    return refs.agency.value ? { filter_param: "agency", filter_value: refs.agency.value } : {};
  }

  async function loadStats() {
    const token = ++state.token;
    if (state.report === "short") {
      await loadShortStats(token);
      return;
    }
    const days = Number(refs.period.value);
    const link = refs.link.value || state.pendingLink;
    const range = { from: utcDate(-(days - 1)), to: utcDate() };
    const scoped = { ...range, link, ...agencyFilter() };

    refs.status.textContent = "Loading Marin Links…";
    refs.status.hidden = false;

    try {
      const [summary, daily, links, parameters, agents, via] = await Promise.all([
        getJson("summary", scoped),
        getJson("daily", scoped),
        getJson("links", { ...range, limit: 100 }),
        getJson("parameters", scoped),
        getJson("agents", { ...scoped, group_by: "browser" }),
        getJson("parameters/values", { ...scoped, name: "via" })
      ]);
      if (token !== state.token) return;

      fillLinkSelect(links.data?.items || []);
      const names = (parameters.data || []).map((entry) => entry.name);
      fillParameterSelect(names);

      let values = null;
      if (refs.parameter.value) {
        values = await getJson("parameters/values", { ...scoped, name: refs.parameter.value });
        if (token !== state.token) return;
      }

      state.last = { summary, daily, links, agents, via, values, hasParameters: names.length > 0, range };
      renderStats();
      refs.csv.disabled = false;
      syncUrl();
    } catch (error) {
      console.error(error);
      if (token !== state.token) return;
      refs.kpis.hidden = true;
      refs.grid.hidden = true;
      refs.note.hidden = true;
      refs.status.textContent = "Stats could not load. Try again later.";
      refs.status.hidden = false;
    }
  }

  function setShortControls() {
    const short = state.report === "short";
    refs.report.value = state.report;
    refs.agencyField.hidden = short;
    refs.linkField.hidden = short;
    refs.shortCodeField.hidden = !short;
    refs.shortCodeInput.value = state.shortCode;
    refs.shortCodeClear.hidden = !state.shortCode;
  }

  function normalizeShortCode(value) {
    return window.MarinLinksShortApi?.normalizeKnownCode(value, state.shortBase || window.MarinLinksTracker.serverRoot) ?? null;
  }

  function showShortCode() {
    const code = normalizeShortCode(refs.shortCodeInput.value);
    if (code === null) {
      refs.shortCodeError.textContent = "Enter a short code or a Short URL from this County service.";
      refs.shortCodeError.hidden = false;
      refs.shortCodeInput.setAttribute("aria-invalid", "true");
      return;
    }
    refs.shortCodeError.hidden = true;
    refs.shortCodeInput.removeAttribute("aria-invalid");
    state.shortCode = code;
    setShortControls();
    void loadStats();
  }

  function populateShortTable(tbody, entries, label) {
    tbody.textContent = "";
    if (!entries.length) {
      const tr = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 2;
      cell.textContent = "No public details in this time.";
      tr.append(cell);
      tbody.append(tr);
      return;
    }
    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = label(entry);
      const count = document.createElement("td");
      count.textContent = number(entry.visits);
      tr.append(name, count);
      tbody.append(tr);
    });
  }

  async function loadShortStats(token) {
    refs.csv.disabled = true;
    const days = Number(refs.period.value);
    const range = { from: utcDate(-(days - 1)), to: utcDate() };
    refs.status.textContent = "Loading Short URL stats…";
    refs.status.hidden = false;
    refs.shortDetail.hidden = true;
    refs.shortDetailData.hidden = true;

    try {
      const capabilityRequest = window.MarinLinksShortApi?.capabilities?.().catch(() => null) || Promise.resolve(null);
      const summary = await getJson("short-links/summary", range);
      const capability = await capabilityRequest;
      if (token !== state.token) return;
      state.shortBase = capability?.short_url_base_url || window.MarinLinksTracker.serverRoot;

      let detail = null;
      let detailState = state.shortCode ? "loading" : "none";
      let detailMessage = "";
      if (state.shortCode) {
        try {
          detail = await getJson(`short-links/${encodeURIComponent(state.shortCode)}/stats`, range);
          detailState = detail?.meta?.suppressed ? "suppressed" : "loaded";
        } catch (error) {
          detailState = error.status === 404 ? "not_found" : "error";
          detailMessage = error.message;
        }
      }
      if (token !== state.token) return;

      state.shortLast = { summary, detail, detailState, detailMessage, range, code: state.shortCode };
      state.last = null;
      renderShortStats();
      refs.csv.disabled = false;
      syncUrl();
    } catch (error) {
      if (token !== state.token) return;
      state.shortLast = null;
      refs.shortOverallHeading.hidden = true;
      refs.kpis.hidden = true;
      refs.grid.hidden = true;
      refs.shortDetail.hidden = true;
      refs.note.hidden = true;
      refs.csv.disabled = true;
      refs.status.hidden = false;
      refs.status.textContent = "Short URL stats could not load. Try again later.";
      Object.keys(state.charts).forEach(destroyChart);
    }
  }

  function populateShortDailyTable(entries) {
    populateShortTable(refs.shortDaily, entries, (row) => row.date);
  }

  function renderShortStats() {
    const { summary, detail, detailState, code } = state.shortLast;
    const summaryData = summary?.data;
    if (!summaryData) {
      refs.status.textContent = "Short URL stats could not load. Try again later.";
      refs.status.hidden = false;
      refs.csv.disabled = true;
      return;
    }

    refs.status.hidden = true;
    refs.shortOverallHeading.hidden = false;
    refs.kpis.hidden = false;
    refs.grid.hidden = false;
    refs.linksCard.hidden = true;
    refs.viaCard.hidden = true;
    refs.parameterCard.hidden = true;
    refs.browsersCard.hidden = true;
    refs.kpiLinksLabel.textContent = "Active Short URLs";
    refs.kpiVisitorsLabel.textContent = "Estimated visitors";
    refs.kpiVisits.textContent = number(summaryData.visits);
    refs.kpiVisitors.textContent = summaryData.estimated_daily_unique_ips == null ? "—" : number(summaryData.estimated_daily_unique_ips);
    refs.kpiLinks.textContent = number(summaryData.active_short_links);

    const summaryRows = (summaryData.daily || []).map((row) => ({
      date: row.date,
      redirects: row.visits,
      estimated_daily_unique_ips: 0
    }));
    renderLineChart("daily", refs.dailyCanvas, summaryRows, false, false);
    ["links", "via", "parameter", "browsers"].forEach(destroyChart);

    refs.shortDetail.hidden = !code;
    refs.shortDetailData.hidden = true;
    destroyChart("shortDaily");
    if (code) {
      if (detailState === "suppressed") {
        refs.shortDetailStatus.textContent = SUPPRESSED_MESSAGE;
      } else if (detailState === "not_found") {
        refs.shortDetailStatus.textContent = "This Short URL is not available for a public report.";
      } else if (detailState === "error") {
        refs.shortDetailStatus.textContent = "This Short URL report could not load. The overall report is still shown.";
      } else if (detailState === "loaded" && detail?.data) {
        const data = detail.data;
        refs.shortDetailStatus.textContent = `Short code ${code}. Places are approximate. Small groups may be hidden.`;
        refs.shortDetailData.hidden = false;
        refs.shortKpiVisits.textContent = number(data.visits);
        refs.shortKpiVisitors.textContent = data.estimated_daily_unique_ips == null ? "—" : number(data.estimated_daily_unique_ips);
        const detailRows = (data.daily || []).map((row) => ({
          date: row.date,
          redirects: row.visits,
          estimated_daily_unique_ips: 0
        }));
        renderLineChart("shortDaily", refs.shortDailyCanvas, detailRows, false, false);
        populateShortDailyTable(data.daily || []);
        populateShortTable(refs.shortBrowsers, data.browsers || [], (row) => row.browser || "Unknown");
        populateShortTable(refs.shortCountries, data.countries || [], (row) => row.country || "Unknown");
        populateShortTable(refs.shortCities, data.cities || [], (row) => [row.city, row.subdivision, row.country, row.region].filter(Boolean).join(", ") || "Unknown");
      } else {
        refs.shortDetailStatus.textContent = "Loading this Short URL…";
      }
    }

    refs.note.hidden = false;
    refs.note.textContent = "Short URL visits are separate from Long link visits. Estimated visitors can count the same person more than once across links and days. Active Short URLs is the current total.";
  }

  async function loadParameterValues() {
    state.pendingParameter = "";
    syncUrl();
    if (!state.last) return;
    const token = ++state.token;
    const days = Number(refs.period.value);
    try {
      const values = await getJson("parameters/values", {
        from: utcDate(-(days - 1)),
        to: utcDate(),
        link: refs.link.value,
        ...agencyFilter(),
        name: refs.parameter.value
      });
      if (token !== state.token) return;
      state.last.values = values;
      renderParameterChart();
    } catch (error) {
      console.error(error);
    }
  }

  function fillLinkSelect(items) {
    const selected = refs.link.value || state.pendingLink;
    state.pendingLink = "";
    refs.link.textContent = "";
    refs.link.append(new Option("All links", ""));
    items.forEach((item) => {
      refs.link.append(new Option(`${item.display} (${item.redirects})`, item.id));
    });
    // A link with no visits in this period would drop out of the list.
    if (selected && !items.some((item) => item.id === selected)) {
      refs.link.append(new Option("Selected link", selected));
    }
    refs.link.value = selected;
  }

  function parameterLabel(name) {
    const title = window.MarinLinksParameterTitles?.[name];
    return title ? `${title} (${name})` : name;
  }

  function fillParameterSelect(names) {
    const selected = refs.parameter.value || state.pendingParameter;
    state.pendingParameter = "";
    refs.parameter.textContent = "";
    names.forEach((name) => refs.parameter.append(new Option(parameterLabel(name), name)));
    if (names.includes(selected)) refs.parameter.value = selected;
    else if (names.includes(DEFAULT_PARAMETER)) refs.parameter.value = DEFAULT_PARAMETER;
    refs.parameter.disabled = names.length === 0;
  }

  // ---- Rendering ----

  function number(value) {
    return Number(value || 0).toLocaleString();
  }

  function renderStats() {
    const { summary, daily, links, agents } = state.last;
    const summaryData = summary.data;

    refs.status.hidden = true;
    refs.shortOverallHeading.hidden = true;
    refs.kpis.hidden = false;
    refs.grid.hidden = false;
    refs.shortDetail.hidden = true;
    refs.shortDetailData.hidden = true;
    destroyChart("shortDaily");
    refs.kpiLinksLabel.textContent = "Links";
    refs.kpiVisitorsLabel.textContent = "Estimated visitors";
    refs.viaCard.hidden = false;
    refs.parameterCard.hidden = false;
    refs.browsersCard.hidden = false;
    refs.note.textContent = STATS_NOTE;
    refs.note.hidden = false;

    refs.kpiVisits.textContent = number(summaryData?.period_redirects);
    refs.kpiVisitors.textContent = number(summaryData?.estimated_daily_unique_ips);
    refs.kpiLinks.textContent = number(summaryData?.tracked_links);

    const dailyRows = daily.data || [];
    renderLineChart(
      "daily",
      refs.dailyCanvas,
      dailyRows,
      daily.meta?.suppressed
    );

    refs.linksCard.hidden = Boolean(refs.link.value);
    renderBarChart(
      "links",
      refs.linksCanvas,
      (links.data?.items || [])
        .filter((item) => item.redirects > 0)
        .sort((a, b) => b.redirects - a.redirects)
        .slice(0, TOP_LIMIT)
        .map((item) => [item.display, item.redirects]),
      links.meta?.suppressed
    );

    renderParameterChart();

    renderBarChart(
      "via",
      refs.viaCanvas,
      (state.last.via.data || []).map((entry) => [VIA_LABELS[entry.value] || entry.value, entry.redirects]),
      state.last.via.meta?.suppressed
    );

    renderBarChart(
      "browsers",
      refs.browsersCanvas,
      (agents.data || []).slice(0, TOP_LIMIT).map((entry) => [entry.label, entry.redirects]),
      agents.meta?.suppressed
    );
  }

  // Values in links are codes. Show the name from the choices list, or the value as typed.
  function valueLabel(parameter, value) {
    return window.MarinLinksPresets?.labelFor(parameter, value) || value;
  }

  function renderParameterChart() {
    const { values, hasParameters } = state.last;
    const entries = (values?.data || [])
      .slice(0, TOP_LIMIT)
      .map((entry) => [entry.value ? valueLabel(refs.parameter.value, entry.value) : "(empty)", entry.redirects]);
    renderBarChart(
      "parameter",
      refs.parameterCanvas,
      hasParameters ? entries : [],
      values?.meta?.suppressed,
      hasParameters ? EMPTY_MESSAGE : "No tracking details have been used yet."
    );
  }

  // Chart.js draws its own text and grid, so give it the page's colors.
  function applyChartTheme() {
    if (typeof Chart === "undefined") return;
    Chart.defaults.color = getComputedStyle(document.body).color;
    const card = refs.grid.querySelector(".app-card");
    if (card) Chart.defaults.borderColor = getComputedStyle(card).borderTopColor;
  }

  function chartImage(canvas) {
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const context = out.getContext("2d");
    context.fillStyle = getComputedStyle(canvas.closest(".app-card")).backgroundColor;
    context.fillRect(0, 0, out.width, out.height);
    context.drawImage(canvas, 0, 0);
    return out;
  }

  function describeChart(canvas, summary) {
    const title = canvas.dataset.chartTitle || "Chart";
    canvas.setAttribute("aria-label", summary ? `${title}. ${summary}` : title);
  }

  // Shows a short message instead of an empty chart.
  function setChartMessage(canvas, message) {
    const empty = canvas.parentElement.querySelector(".ml-stats-empty");
    const download = canvas.parentElement.querySelector(".ml-chart-download");
    canvas.hidden = Boolean(message);
    if (download) download.hidden = Boolean(message);
    empty.textContent = message || "";
    empty.hidden = !message;
  }

  function destroyChart(key) {
    if (!state.charts[key]) return;
    state.charts[key].destroy();
    state.charts[key] = null;
  }

  function renderLineChart(key, canvas, rows, suppressed, withUnique = true) {
    const total = rows.reduce((sum, row) => sum + row.redirects, 0);
    if (suppressed || total === 0) {
      destroyChart(key);
      describeChart(canvas, suppressed ? SUPPRESSED_MESSAGE : EMPTY_MESSAGE);
      setChartMessage(canvas, suppressed ? SUPPRESSED_MESSAGE : EMPTY_MESSAGE);
      return;
    }
    setChartMessage(canvas, "");

    const labels = rows.map((row) => new Date(`${row.date}T00:00:00Z`).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }));
    const visits = rows.map((row) => row.redirects);
    const peak = visits.indexOf(Math.max(...visits));
    describeChart(canvas, `${total} visits, peaking at ${visits[peak]} on ${labels[peak]}.`);

    const data = {
      labels,
      datasets: [
        { label: "Visits", data: visits, borderColor: COLOR, backgroundColor: COLOR, tension: 0 },
        ...(withUnique ? [{
          label: "Estimated visitors",
          data: rows.map((row) => row.estimated_daily_unique_ips),
          borderColor: COLOR_SECOND,
          backgroundColor: COLOR_SECOND,
          tension: 0
        }] : [])
      ]
    };
    if (state.charts[key]) {
      state.charts[key].data = data;
      state.charts[key].update();
      return;
    }
    applyChartTheme();
    state.charts[key] = new Chart(canvas, {
      type: "line",
      data,
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: { y: { ticks: { precision: 0 }, beginAtZero: true } }
      }
    });
  }

  function renderBarChart(key, canvas, entries, suppressed, emptyMessage = EMPTY_MESSAGE) {
    if (suppressed || entries.length === 0) {
      destroyChart(key);
      const message = suppressed ? SUPPRESSED_MESSAGE : emptyMessage;
      describeChart(canvas, message);
      setChartMessage(canvas, message);
      return;
    }
    setChartMessage(canvas, "");
    describeChart(canvas, `Top: ${entries[0][0]} with ${entries[0][1]}, of ${entries.length} shown.`);

    const data = {
      labels: entries.map(([label]) => label),
      datasets: [{ data: entries.map(([, count]) => count), backgroundColor: COLOR }]
    };
    if (state.charts[key]) {
      state.charts[key].data = data;
      state.charts[key].update();
      return;
    }
    applyChartTheme();
    state.charts[key] = new Chart(canvas, {
      type: "bar",
      data,
      options: {
        indexAxis: "y",
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { precision: 0 } } }
      }
    });
  }

  function downloadChartPng(key) {
    const chart = state.charts[key];
    if (!chart) return;
    const title = chart.canvas.dataset.chartTitle || "Chart";
    chartImage(chart.canvas).toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `marin-links-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  // ---- CSV ----

  // A cell that starts with = + - or @ could run as a formula in a spreadsheet, so it gets a leading apostrophe.
  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function buildCsv() {
    if (state.report === "short") return buildShortCsv();
    const { daily, links, via, agents, values, range } = state.last;
    const selectedText = (select) => select.options[select.selectedIndex]?.text || "";
    const rows = [
      ["Marin Links stats"],
      ["Period", `${range.from} to ${range.to}`],
      ["Agency", selectedText(refs.agency)],
      ["Link", selectedText(refs.link)],
      [],
      ["Section", "Label", "Visits", "Estimated visitors"]
    ];
    (daily.data || []).forEach((row) => rows.push(["Visits over time", row.date, row.redirects, row.estimated_daily_unique_ips]));
    (links.data?.items || []).filter((item) => item.redirects > 0)
      .forEach((item) => rows.push(["Top links", item.display, item.redirects, ""]));
    (via.data || []).forEach((entry) => rows.push(["QR codes and links", VIA_LABELS[entry.value] || entry.value, entry.redirects, ""]));
    (values?.data || []).forEach((entry) => rows.push([`Tracking details (${refs.parameter.value})`, entry.value ? valueLabel(refs.parameter.value, entry.value) : "(empty)", entry.redirects, ""]));
    (agents.data || []).forEach((entry) => rows.push(["Browsers", entry.label, entry.redirects, ""]));
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function buildShortCsv() {
    const { summary, detail, detailState, range, code } = state.shortLast;
    const overall = summary.data;
    const rows = [
      ["Marin Links Short URL stats"],
      ["Period", `${range.from} to ${range.to}`],
      [],
      ["All Short URLs"],
      ["Visits", overall.visits],
      ["Estimated daily visitors", overall.estimated_daily_unique_ips ?? "Not available"],
      ["Active Short URLs", overall.active_short_links],
      [],
      ["Section", "Label", "Visits"]
    ];
    (overall.daily || []).forEach((row) => rows.push(["All Short URLs daily", row.date, row.visits]));

    if (code) {
      rows.push([], ["One Short URL"], ["Short code", code]);
      if (detailState === "suppressed") {
        rows.push(["Status", SUPPRESSED_MESSAGE]);
      } else if (detailState === "not_found") {
        rows.push(["Status", "Not available for a public report"]);
      } else if (detailState === "error") {
        rows.push(["Status", "Report could not load"]);
      } else if (detail?.data) {
        const data = detail.data;
        rows.push(
          ["Visits", data.visits],
          ["Estimated daily visitors", data.estimated_daily_unique_ips ?? "Not available"],
          [],
          ["Section", "Label", "Visits"]
        );
        (data.daily || []).forEach((row) => rows.push(["One Short URL daily", row.date, row.visits]));
        (data.browsers || []).forEach((row) => rows.push(["Browsers", row.browser, row.visits]));
        (data.countries || []).forEach((row) => rows.push(["Countries", row.country, row.visits]));
        (data.cities || []).forEach((row) => rows.push(["Approximate cities", [row.city, row.subdivision, row.country, row.region].filter(Boolean).join(", "), row.visits]));
      }
    }
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function downloadCsv() {
    if ((state.report === "short" && !state.shortLast) || (state.report !== "short" && !state.last)) return;
    const blob = new Blob(["\uFEFF", buildCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `marin-links-stats-${utcDate()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function rebuildCharts() {
    if (!state.last && !state.shortLast) return;
    Object.keys(state.charts).forEach(destroyChart);
    if (state.report === "short" && state.shortLast) renderShortStats();
    else if (state.last) renderStats();
  }

  function bindStats() {
    refs.report.addEventListener("change", () => {
      state.report = refs.report.value === "short" ? "short" : "tracked";
      setShortControls();
      void loadStats();
    });
    refs.shortCodeShow.addEventListener("click", showShortCode);
    refs.shortCodeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); showShortCode(); }
    });
    refs.shortCodeClear.addEventListener("click", () => {
      state.shortCode = "";
      refs.shortCodeError.hidden = true;
      refs.shortCodeInput.removeAttribute("aria-invalid");
      setShortControls();
      void loadStats();
    });
    // A new choice drops any link or detail that came from the address.
    refs.period.addEventListener("change", () => void loadStats());
    refs.link.addEventListener("change", () => { state.pendingLink = ""; void loadStats(); });
    refs.agency.addEventListener("change", () => void loadStats());
    refs.csv.addEventListener("click", downloadCsv);
    refs.copyLink.addEventListener("pointerdown", syncUrl);
    refs.parameter.addEventListener("change", () => void loadParameterValues());
    refs.panelStats.querySelectorAll("[data-chart-download]").forEach((button) => {
      button.addEventListener("click", () => downloadChartPng(button.dataset.chartDownload));
    });
    // Existing charts keep their old colors, so rebuild them when the page theme changes.
    window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", rebuildCharts);
  }

  function start() {
    refs = {
      tabs: byId("main-tabs"),
      tabCreate: byId("tab-create"),
      tabStats: byId("tab-stats"),
      panelCreate: byId("panel-create"),
      panelStats: byId("panel-stats"),
      period: byId("stats-period"),
      report: byId("stats-report"),
      agencyField: byId("stats-agency-field"),
      linkField: byId("stats-link-field"),
      shortCodeField: byId("stats-short-code-field"),
      shortCodeInput: byId("stats-short-code"),
      shortCodeShow: byId("stats-short-show"),
      shortCodeClear: byId("stats-short-clear"),
      shortCodeError: byId("stats-short-code-error"),
      shortOverallHeading: byId("stats-short-overall-heading"),
      shortDetail: byId("stats-short-detail"),
      shortDetailStatus: byId("stats-short-detail-status"),
      shortDetailData: byId("stats-short-detail-data"),
      shortKpiVisits: byId("stats-short-kpi-visits"),
      shortKpiVisitors: byId("stats-short-kpi-visitors"),
      shortDailyCanvas: byId("stats-short-daily-chart"),
      shortDaily: byId("stats-short-daily"),
      shortBrowsers: byId("stats-short-browsers"),
      shortCountries: byId("stats-short-countries"),
      shortCities: byId("stats-short-cities"),
      kpiLinksLabel: byId("stats-kpi-links-label"),
      kpiVisitorsLabel: byId("stats-kpi-visitors-label"),
      viaCard: byId("stats-via-card"),
      parameterCard: byId("stats-parameter-card"),
      browsersCard: byId("stats-browsers-card"),
      link: byId("stats-link"),
      agency: byId("stats-agency"),
      csv: byId("stats-csv"),
      copyLink: byId("stats-copy-link"),
      viaCanvas: byId("stats-via-chart"),
      parameter: byId("stats-parameter"),
      status: byId("stats-status"),
      kpis: byId("stats-kpis"),
      kpiVisits: byId("stats-kpi-visits"),
      kpiVisitors: byId("stats-kpi-visitors"),
      kpiLinks: byId("stats-kpi-links"),
      grid: byId("stats-grid"),
      linksCard: byId("stats-links-card"),
      note: byId("stats-note"),
      dailyCanvas: byId("stats-daily-chart"),
      linksCanvas: byId("stats-links-chart"),
      parameterCanvas: byId("stats-parameter-chart"),
      browsersCanvas: byId("stats-browsers-chart")
    };
    if (!refs.tabs || !refs.panelStats || !window.MarinLinksTracker) return;

    window.MarinLinksPresets?.agencies.forEach(({ value, name }) => {
      refs.agency.append(new Option(name, value));
    });
    // Choices that came in the address (a shared Stats link).
    const incoming = new URLSearchParams(window.location.search);
    const period = incoming.get("period");
    if (period && [...refs.period.options].some((option) => option.value === period)) refs.period.value = period;
    const agency = incoming.get("agency");
    // An older shared link may hold the agency's earlier name instead of its code.
    const agencyCode = agency && window.MarinLinksPresets?.codeFor("agency", agency);
    if (agencyCode && [...refs.agency.options].some((option) => option.value === agencyCode)) refs.agency.value = agencyCode;
    const link = incoming.get("link");
    if (link && /^[0-9a-f]{32}$/.test(link)) state.pendingLink = link;
    const detail = incoming.get("detail");
    if (detail && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,63}$/.test(detail)) state.pendingParameter = detail;

    const report = incoming.get("report");
    state.report = report === "short" ? "short" : "tracked";
    const code = incoming.get("code");
    state.shortCode = code ? (normalizeShortCode(code) || "") : "";
    setShortControls();
    bindTabs();
    bindStats();
    const view = incoming.get("view");
    selectTab(view === "stats" ? "stats" : "create", { replaceUrl: false });
  }

  if (document.readyState === "complete") {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
