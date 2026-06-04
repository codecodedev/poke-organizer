export function renderLigaSyncPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LigaPokemon Sync</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #172033;
      background: #f4f7fb;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    h1 { margin: 0 0 6px; font-size: 28px; line-height: 1.15; }
    p { margin: 0; color: #5f6b80; }
    button, input {
      border: 1px solid #ced7e5;
      border-radius: 6px;
      font: inherit;
      min-height: 40px;
      background: white;
      color: #172033;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 14px;
      cursor: pointer;
      font-weight: 700;
    }
    button.primary { background: #172033; border-color: #172033; color: white; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #40506a; }
    input { padding: 0 12px; width: 100%; }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(200px, 1fr) 130px 160px auto auto auto;
      gap: 12px;
      align-items: end;
      padding: 16px;
      background: white;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      margin-bottom: 16px;
      box-shadow: 0 1px 2px rgba(21, 31, 51, .06);
    }
    .backupbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .status {
      padding: 12px 14px;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: white;
      margin-bottom: 16px;
      min-height: 48px;
      color: #40506a;
    }
    .status.error { border-color: #f0b8b8; color: #a32929; background: #fff7f7; }
    .status.ok { border-color: #b9dbc5; color: #1b6b38; background: #f5fff8; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: start;
    }
    section {
      background: white;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(21, 31, 51, .06);
      min-height: 220px;
    }
    section h2 {
      margin: 0;
      padding: 14px 16px;
      border-bottom: 1px solid #e8edf5;
      font-size: 18px;
    }
    .list { display: grid; max-height: 620px; overflow: auto; }
    .edition, .job-row {
      display: grid;
      gap: 4px;
      padding: 12px 16px;
      border-bottom: 1px solid #edf1f7;
    }
    .edition { grid-template-columns: 28px 1fr auto; align-items: center; }
    .edition input { width: 18px; min-height: 18px; }
    .name { font-weight: 800; }
    .meta { color: #65738a; font-size: 13px; }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      background: #eef3f9;
      color: #40506a;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .pill.running { background: #e9f1ff; color: #2458a7; }
    .pill.completed { background: #e9f8ee; color: #20643b; }
    .pill.failed, .pill.blocked { background: #fff0f0; color: #a32929; }
    @media (max-width: 860px) {
      main { padding: 16px; }
      header, .grid, .toolbar { grid-template-columns: 1fr; display: grid; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Sync LigaPokemon</h1>
        <p>Selecione edições, ajuste o intervalo e rode a leitura local dos preços.</p>
      </div>
      <button id="refreshJobs">Recarregar jobs</button>
    </header>

    <div class="toolbar">
      <label>Filtrar edições
        <input id="filter" placeholder="Nome, código ou ano" />
      </label>
      <label>Delay entre edições
        <input id="delayMs" type="number" min="0" step="1000" value="15000" />
      </label>
      <label>Anos para sync
        <input id="years" placeholder="2024, 2025" />
      </label>
      <button id="loadEditions">Atualizar edições</button>
      <button id="selectAll">Selecionar todas</button>
      <button id="startSync" class="primary" disabled>Iniciar sync</button>
    </div>

    <div class="backupbar">
      <button id="downloadPrices">Baixar backup de preços</button>
      <button id="uploadPrices">Restaurar backup de preços</button>
      <input id="priceBackupFile" type="file" accept=".csv,text/csv" hidden />
    </div>

    <div id="status" class="status">Nenhuma leitura em andamento.</div>

    <div class="grid">
      <section>
        <h2>Edições</h2>
        <div id="editions" class="list"></div>
      </section>
      <section>
        <h2>Jobs</h2>
        <div id="jobs" class="list"></div>
      </section>
    </div>
  </main>

  <script>
    const state = { editions: [], selected: new Set(), polling: null };
    const els = {
      filter: document.getElementById("filter"),
      delayMs: document.getElementById("delayMs"),
      years: document.getElementById("years"),
      loadEditions: document.getElementById("loadEditions"),
      selectAll: document.getElementById("selectAll"),
      startSync: document.getElementById("startSync"),
      refreshJobs: document.getElementById("refreshJobs"),
      downloadPrices: document.getElementById("downloadPrices"),
      uploadPrices: document.getElementById("uploadPrices"),
      priceBackupFile: document.getElementById("priceBackupFile"),
      editions: document.getElementById("editions"),
      jobs: document.getElementById("jobs"),
      status: document.getElementById("status")
    };

    function setStatus(text, kind) {
      els.status.textContent = text;
      els.status.className = "status" + (kind ? " " + kind : "");
    }

    async function api(path, options) {
      const response = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...options
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Falha na API");
      return data;
    }

    function selectedYears() {
      return els.years.value
        .split(/[ ,;]+/)
        .map((year) => Number.parseInt(year, 10))
        .filter((year) => Number.isFinite(year));
    }

    function selectedEditionsForSync() {
      const years = new Set(selectedYears());
      return state.editions.filter((edition) =>
        state.selected.has(editionKey(edition)) || (edition.year && years.has(Number(edition.year)))
      );
    }

    function updateStartState() {
      els.startSync.disabled = selectedEditionsForSync().length === 0;
    }

    function renderEditions() {
      const filter = els.filter.value.trim().toLowerCase();
      const filtered = state.editions.filter((edition) => {
        const text = [edition.name, edition.code, edition.year].join(" ").toLowerCase();
        return !filter || text.includes(filter);
      });
      els.editions.innerHTML = filtered.map((edition) => {
        const checked = state.selected.has(editionKey(edition)) ? "checked" : "";
        return '<label class="edition">' +
          '<input type="checkbox" data-key="' + escapeHtml(editionKey(edition)) + '" ' + checked + ' />' +
          '<span><span class="name">' + escapeHtml(edition.name) + '</span><span class="meta"> - ' + escapeHtml(String(edition.code || "")) + ' · ' + escapeHtml(edition.year) + '</span></span>' +
          '<span class="pill">' + escapeHtml(edition.code) + '</span>' +
        '</label>';
      }).join("") || '<div class="job-row"><span class="meta">Nenhuma edição carregada.</span></div>';
      updateStartState();
    }

    function renderJobs(jobs) {
      els.jobs.innerHTML = jobs.map((job) => {
        const progress = job.totalEditions ? job.completedEditions + "/" + job.totalEditions : "0/0";
        const editions = (job.editions || []).slice(0, 6).map((edition) =>
          '<span class="meta">' + escapeHtml(edition.code) + ': ' + escapeHtml(edition.status) + ' · cards ' + edition.cardsFound + ' · valores ' + edition.pricesUpdated + '</span>'
        ).join("");
        return '<div class="job-row">' +
          '<span><span class="name">' + escapeHtml(job.id) + '</span> <span class="pill ' + escapeHtml(job.status) + '">' + escapeHtml(job.status) + '</span></span>' +
          '<span class="meta">Progresso ' + progress + ' · delay ' + job.delayMs + 'ms</span>' +
          (job.message ? '<span class="meta">' + escapeHtml(job.message) + '</span>' : '') +
          editions +
        '</div>';
      }).join("") || '<div class="job-row"><span class="meta">Nenhum job criado.</span></div>';
    }

    async function loadEditions(refresh) {
      setStatus(refresh ? "Abrindo navegador local para atualizar edições da LigaPokemon..." : "Carregando edições salvas...");
      els.loadEditions.disabled = true;
      try {
        const data = await api("/liga-sync/editions" + (refresh ? "?refresh=true" : ""));
        state.editions = data.editions;
        if (refresh) state.selected.clear();
        renderEditions();
        setStatus(
          data.editions.length
            ? "Edições carregadas: " + data.editions.length
            : refresh
              ? "Nenhuma edição encontrada na LigaPokemon."
              : "Nenhuma edição salva ainda. Clique em Atualizar edições para buscar na LigaPokemon.",
          data.editions.length || !refresh ? "ok" : "error"
        );
      } catch (err) {
        setStatus(err.message, "error");
      } finally {
        els.loadEditions.disabled = false;
      }
    }

    async function startSync() {
      const selected = selectedEditionsForSync();
      if (!selected.length) return;
      els.startSync.disabled = true;
      try {
        const data = await api("/liga-sync/jobs", {
          method: "POST",
          body: JSON.stringify({ editions: selected, delayMs: Number(els.delayMs.value || 0) })
        });
        setStatus("Job iniciado: " + data.id, "ok");
        await loadJobs();
        startPolling();
      } catch (err) {
        setStatus(err.message, "error");
      } finally {
        updateStartState();
      }
    }

    async function uploadPriceBackup(file) {
      if (!file) return;
      els.uploadPrices.disabled = true;
      try {
        const response = await fetch("/prices/backup.csv", {
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: await file.text()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Falha ao restaurar backup");
        setStatus("Backup restaurado: " + data.prices + " preços e " + data.history + " históricos importados.", "ok");
      } catch (err) {
        setStatus(err.message, "error");
      } finally {
        els.uploadPrices.disabled = false;
        els.priceBackupFile.value = "";
      }
    }

    async function loadJobs() {
      const data = await api("/liga-sync/jobs");
      renderJobs(data.jobs);
      return data.jobs;
    }

    function startPolling() {
      if (state.polling) clearInterval(state.polling);
      state.polling = setInterval(async () => {
        try {
          const jobs = await loadJobs();
          if (!jobs.some((job) => job.status === "queued" || job.status === "running")) {
            clearInterval(state.polling);
            state.polling = null;
          }
        } catch {}
      }, 2500);
    }

    function editionKey(edition) {
      return edition.edid + ":" + edition.code;
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[char]));
    }

    els.loadEditions.addEventListener("click", () => loadEditions(true));
    els.refreshJobs.addEventListener("click", loadJobs);
    els.startSync.addEventListener("click", startSync);
    els.filter.addEventListener("input", renderEditions);
    els.years.addEventListener("input", updateStartState);
    els.downloadPrices.addEventListener("click", () => {
      window.location.href = "/prices/backup.csv";
    });
    els.uploadPrices.addEventListener("click", () => els.priceBackupFile.click());
    els.priceBackupFile.addEventListener("change", (event) => {
      uploadPriceBackup(event.target.files && event.target.files[0]);
    });
    els.selectAll.addEventListener("click", () => {
      const visible = state.editions.filter((edition) => {
        const filter = els.filter.value.trim().toLowerCase();
        const text = [edition.name, edition.code, edition.year].join(" ").toLowerCase();
        return !filter || text.includes(filter);
      });
      const allVisibleSelected = visible.every((edition) => state.selected.has(editionKey(edition)));
      for (const edition of visible) {
        if (allVisibleSelected) state.selected.delete(editionKey(edition));
        else state.selected.add(editionKey(edition));
      }
      renderEditions();
    });
    els.editions.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      if (!event.target.dataset.key) return;
      if (event.target.checked) state.selected.add(event.target.dataset.key);
      else state.selected.delete(event.target.dataset.key);
      updateStartState();
    });

    loadEditions(false).catch((err) => setStatus(err.message, "error"));
    loadJobs().then(startPolling).catch((err) => setStatus(err.message, "error"));
  </script>
</body>
</html>`;
}
